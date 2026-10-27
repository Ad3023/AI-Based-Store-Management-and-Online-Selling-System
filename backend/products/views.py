from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Avg
from .models import Category, Product, ProductReview, StockMovement
from .serializers import (
    CategorySerializer, ProductSerializer,
    ProductReviewSerializer, StockMovementSerializer
)
from accounts.permissions import IsStoreManagerOrAdmin
from recommendations.models import CustomerActivity


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]


class ProductListView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        # Store managers see all products, customers see only active products
        user = self.request.user
        if user.is_authenticated and (getattr(user, 'is_store_manager', lambda: False)() or getattr(user, 'is_admin', lambda: False)()):
            queryset = Product.objects.all()
        else:
            queryset = Product.objects.filter(is_active=True)

        # Filters
        category = self.request.query_params.get('category')
        category_slug = self.request.query_params.get('category_slug')
        search = self.request.query_params.get('search')
        in_stock = self.request.query_params.get('in_stock')
        is_featured = self.request.query_params.get('is_featured')
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        ordering = self.request.query_params.get('ordering', '-created_at')

        if category:
            cat_str = str(category).strip()
            if cat_str.isdigit():
                queryset = queryset.filter(category_id=int(cat_str))
            else:
                queryset = queryset.filter(
                    Q(category__slug__iexact=cat_str) |
                    Q(category__name__iexact=cat_str) |
                    Q(category__name__icontains=cat_str) |
                    Q(category__slug__icontains=cat_str)
                )
        if category_slug:
            slug_str = str(category_slug).strip()
            queryset = queryset.filter(
                Q(category__slug__iexact=slug_str) |
                Q(category__slug__icontains=slug_str)
            )
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search) |
                Q(category__name__icontains=search) |
                Q(sku__icontains=search)
            )
        if in_stock and in_stock.lower() in ('true', '1'):
            queryset = queryset.filter(stock__gt=0)
        if is_featured and is_featured.lower() in ('true', '1'):
            queryset = queryset.filter(is_featured=True)
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        valid_orderings = ['price', '-price', 'created_at', '-created_at', 'rating_average', '-rating_average']
        if ordering in valid_orderings:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def perform_create(self, serializer):
        product = serializer.save()
        if product.stock > 0:
            StockMovement.objects.create(
                product=product,
                quantity=product.stock,
                movement_type=StockMovement.MovementType.RESTOCK,
                reference="Initial stock upon creation",
                created_by=self.request.user if self.request.user.is_authenticated else None
            )


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Log view for AI recommendations
        user = request.user if request.user.is_authenticated else None
        session_key = request.session.session_key or request.META.get('HTTP_X_SESSION_ID')
        try:
            CustomerActivity.objects.create(
                user=user,
                session_key=session_key,
                product=instance,
                activity_type=CustomerActivity.ActivityType.VIEW
            )
        except Exception:
            pass

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_update(self, serializer):
        old_stock = self.get_object().stock
        product = serializer.save()
        new_stock = product.stock
        if new_stock != old_stock:
            diff = new_stock - old_stock
            StockMovement.objects.create(
                product=product,
                quantity=diff,
                movement_type=StockMovement.MovementType.RESTOCK if diff > 0 else StockMovement.MovementType.ADJUSTMENT,
                reference=f"Manual update ({diff:+d})",
                created_by=self.request.user
            )


class ProductReviewCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verified customer purchase check
        from orders.models import OrderItem, Order
        has_purchased = OrderItem.objects.filter(
            order__customer=request.user,
            product=product,
            order__status__in=[Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED]
        ).exists()

        is_staff = request.user.role in ['store_manager', 'admin'] or request.user.is_superuser
        if not has_purchased and not is_staff:
            return Response({
                'error': 'Verified Customer Purchase Required: You can only submit a product review after purchasing this product.'
            }, status=status.HTTP_403_FORBIDDEN)

        rating = request.data.get('rating')
        comment = request.data.get('comment', '')

        if not rating or not (1 <= int(rating) <= 5):
            return Response({'error': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)

        review, created = ProductReview.objects.update_or_create(
            product=product,
            user=request.user,
            defaults={'rating': int(rating), 'comment': comment}
        )

        # Recalculate product rating average and count
        reviews = product.reviews.all()
        product.rating_count = reviews.count()
        product.rating_average = round(reviews.aggregate(avg=Avg('rating'))['avg'] or 0.0, 2)
        product.save()

        return Response(ProductReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ProductReviewModerationView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

    def patch(self, request, review_id):
        try:
            review = ProductReview.objects.get(id=review_id)
        except ProductReview.DoesNotExist:
            return Response({'error': 'Review not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_approved = request.data.get('is_approved')
        manager_response = request.data.get('manager_response')

        if is_approved is not None:
            review.is_approved = is_approved
        if manager_response is not None:
            from django.utils import timezone
            review.manager_response = manager_response
            review.response_by = request.user
            review.responded_at = timezone.now()

        review.save()
        return Response(ProductReviewSerializer(review).data)


class InventoryManagementView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        products = Product.objects.all().order_by('stock')
        low_stock = products.filter(stock__lte=5, stock__gt=0)
        out_of_stock = products.filter(stock=0)

        movements = StockMovement.objects.all()[:20]

        return Response({
            'total_products': products.count(),
            'low_stock_count': low_stock.count(),
            'out_of_stock_count': out_of_stock.count(),
            'low_stock_products': ProductSerializer(low_stock, many=True).data,
            'out_of_stock_products': ProductSerializer(out_of_stock, many=True).data,
            'recent_movements': StockMovementSerializer(movements, many=True).data
        })

    def post(self, request):
        # Adjust stock
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity')
        movement_type = request.data.get('movement_type', StockMovement.MovementType.RESTOCK)
        reference = request.data.get('reference', 'Store Manager inventory update')

        try:
            product = Product.objects.get(id=product_id)
            qty = int(quantity)
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid product or quantity.'}, status=status.HTTP_400_BAD_REQUEST)

        product.stock = max(0, product.stock + qty)
        product.save()

        movement = StockMovement.objects.create(
            product=product,
            quantity=qty,
            movement_type=movement_type,
            reference=reference,
            created_by=request.user
        )

        return Response({
            'message': f"Stock updated. New stock: {product.stock}",
            'movement': StockMovementSerializer(movement).data,
            'product': ProductSerializer(product).data
        })


class PromotionListCreateView(generics.ListCreateAPIView):
    from .models import Promotion
    from .serializers import PromotionSerializer
    serializer_class = PromotionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        from .models import Promotion
        from django.utils import timezone
        now = timezone.now()
        status_param = (self.request.query_params.get('status') or '').strip().lower()
        active_only = self.request.query_params.get('active_only') == 'true'
        search = (self.request.query_params.get('search') or '').strip()
        user = self.request.user
        is_staff = user.is_authenticated and (getattr(user, 'is_store_manager', lambda: False)() or getattr(user, 'is_admin', lambda: False)())

        if not is_staff or active_only:
            queryset = Promotion.objects.filter(is_active=True, start_date__lte=now, end_date__gte=now)
        else:
            queryset = Promotion.objects.all()

        if status_param == 'active':
            queryset = queryset.filter(is_active=True, start_date__lte=now, end_date__gte=now)
        elif status_param == 'scheduled':
            queryset = queryset.filter(is_active=True, start_date__gt=now)
        elif status_param == 'expired':
            queryset = queryset.filter(end_date__lt=now)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False)

        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PromotionDetailView(generics.RetrieveUpdateDestroyAPIView):
    from .models import Promotion
    from .serializers import PromotionSerializer
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    permission_classes = [IsStoreManagerOrAdmin]


class ActivePromotionAnnouncementView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .models import Promotion
        from django.utils import timezone
        now = timezone.now()
        # Find active promotions within validity window
        promo = Promotion.objects.filter(
            is_active=True,
            start_date__lte=now,
            end_date__gte=now
        ).exclude(banner_announcement__isnull=True).exclude(banner_announcement__exact='').first()

        if not promo:
            promo = Promotion.objects.filter(
                is_active=True,
                start_date__lte=now,
                end_date__gte=now
            ).first()

        if promo:
            return Response({
                'active': True,
                'id': promo.id,
                'title': promo.title,
                'name': promo.title,
                'description': promo.description or '',
                'banner_announcement': promo.banner_announcement or f"Special Promotion: {promo.title}! Limited-time genuine store discounts.",
                'discount_type': promo.discount_type,
                'discount_value': str(promo.discount_value),
                'apply_to_all': promo.apply_to_all,
                'start_date': promo.start_date,
                'end_date': promo.end_date,
            })
        return Response({'active': False, 'banner_announcement': None})


class WarrantyPolicyListCreateView(generics.ListCreateAPIView):
    from .models import WarrantyPolicy
    from .serializers import WarrantyPolicySerializer
    queryset = WarrantyPolicy.objects.all()
    serializer_class = WarrantyPolicySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStoreManagerOrAdmin()]
        return [permissions.AllowAny()]


class WarrantyPolicyDetailView(generics.RetrieveUpdateDestroyAPIView):
    from .models import WarrantyPolicy
    from .serializers import WarrantyPolicySerializer
    queryset = WarrantyPolicy.objects.all()
    serializer_class = WarrantyPolicySerializer
    permission_classes = [IsStoreManagerOrAdmin]


class CustomerFeedbackListCreateView(generics.ListCreateAPIView):
    from .models import CustomerFeedback
    from .serializers import CustomerFeedbackSerializer
    serializer_class = CustomerFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import CustomerFeedback
        user = self.request.user
        if user.role in ['store_manager', 'admin'] or user.is_superuser:
            qs = CustomerFeedback.objects.all()
            category = self.request.query_params.get('category')
            status_param = self.request.query_params.get('status')
            if category:
                qs = qs.filter(category=category)
            if status_param:
                qs = qs.filter(status=status_param)
            return qs
        return CustomerFeedback.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CustomerFeedbackDetailView(generics.RetrieveUpdateDestroyAPIView):
    from .models import CustomerFeedback
    from .serializers import CustomerFeedbackSerializer
    queryset = CustomerFeedback.objects.all()
    serializer_class = CustomerFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        user = request.user
        if not (user.role in ['store_manager', 'admin'] or user.is_superuser):
            return Response({'error': 'Only store managers or administrators can respond to customer feedback.'}, status=status.HTTP_403_FORBIDDEN)

        feedback = self.get_object()
        admin_response = request.data.get('admin_response')
        status_val = request.data.get('status', CustomerFeedback.FeedbackStatus.RESOLVED)
        if admin_response:
            feedback.admin_response = admin_response
        feedback.status = status_val
        feedback.responded_by = user
        feedback.save()
        return Response(CustomerFeedbackSerializer(feedback).data)

