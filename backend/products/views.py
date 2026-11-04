from decimal import Decimal
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Avg, F, Sum, Count
from django.utils import timezone
from .models import (
    Category, Product, ProductReview, StockMovement, Supplier,
    SupplierNotificationLog, PurchaseRequest, StockAlertHistory,
    SupplierPayment, PurchaseOrderItem, SupplierInvoice
)
from .serializers import (
    CategorySerializer, ProductSerializer,
    ProductReviewSerializer, StockMovementSerializer, SupplierSerializer,
    SupplierNotificationLogSerializer, PurchaseRequestSerializer, LowStockProductSerializer,
    StockAlertHistorySerializer, SupplierPaymentSerializer,
    PurchaseOrderItemSerializer, SupplierInvoiceSerializer
)
from .low_stock_service import LowStockAlertService
from accounts.permissions import IsStoreManagerOrAdmin, require_permission
from accounts.models import AuditLog
from recommendations.models import CustomerActivity


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('categories.manage')()]
        return [permissions.AllowAny()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [require_permission('categories.manage')()]
        return [permissions.AllowAny()]


class ProductListView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('products.create')()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and (getattr(user, 'is_super_admin', False) or user.has_permission('products.view') or getattr(user, 'is_store_manager', lambda: False)()):
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

        has_discount = self.request.query_params.get('has_discount') or self.request.query_params.get('on_sale')
        if has_discount and has_discount.lower() in ('true', '1'):
            from django.utils import timezone
            from .models import Promotion
            now = timezone.now()
            # If storewide promo is active, all active products are discounted
            if not Promotion.objects.filter(apply_to_all=True, is_active=True, start_date__lte=now, end_date__gte=now).exists():
                queryset = queryset.filter(
                    Q(promotions__is_active=True, promotions__start_date__lte=now, promotions__end_date__gte=now) |
                    Q(category__promotions__is_active=True, category__promotions__start_date__lte=now, category__promotions__end_date__gte=now)
                ).distinct()

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
        if self.request.method in ['PUT', 'PATCH']:
            return [require_permission('products.edit')()]
        elif self.request.method == 'DELETE':
            return [require_permission('products.delete')()]
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
            # Monitor stock change for automatic low stock or out of stock alerts
            try:
                LowStockAlertService.evaluate_and_notify_product(
                    product,
                    trigger_type='AUTOMATIC',
                    requested_by=self.request.user
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error evaluating low stock alert on product update: {e}")


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
    permission_classes = [require_permission('products.edit')]

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
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get(self, request):
        products = Product.objects.all().order_by('stock')
        available = products.filter(stock__gt=0, is_active=True)
        low_stock = products.filter(stock__lte=F('low_stock_threshold'), is_active=True)
        out_of_stock = products.filter(stock=0, is_active=True)

        movements = StockMovement.objects.all().select_related('product', 'created_by')[:25]
        inventory_value = sum((Decimal(str(p.stock)) * Decimal(str(p.price)) for p in products), Decimal('0.00'))

        return Response({
            'total_products': products.count(),
            'available_products': available.count(),
            'low_stock_count': low_stock.count(),
            'out_of_stock_count': out_of_stock.count(),
            'total_categories': Category.objects.count(),
            'total_suppliers': Supplier.objects.count(),
            'inventory_value': float(inventory_value),
            'low_stock_products': LowStockProductSerializer(low_stock, many=True).data,
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
            product = Product.objects.select_related('supplier').get(id=product_id)
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

        # Automatically check and trigger low stock supplier notification if stock dropped
        alert_result = LowStockAlertService.evaluate_and_notify_product(
            product,
            trigger_type='AUTOMATIC',
            requested_by=request.user
        )

        return Response({
            'message': f"Stock updated. New stock: {product.stock}",
            'movement': StockMovementSerializer(movement).data,
            'product': ProductSerializer(product).data,
            'alert_result': alert_result
        })


class SupplierListCreateView(generics.ListCreateAPIView):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('inventory.manage')()]
        return [require_permission('products.view')()]


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [require_permission('inventory.manage')()]
        return [require_permission('products.view')()]


class SupplierHistoryView(APIView):
    """
    Returns full procurement, invoice, payment, and product history for a given supplier.
    Available to Store Manager and Admin.
    """
    def get_permissions(self):
        return [require_permission('products.view')()]

    def get(self, request, pk):
        try:
            supplier = Supplier.objects.get(pk=pk)
        except Supplier.DoesNotExist:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        pos = PurchaseRequest.objects.filter(supplier=supplier).select_related('requested_by', 'approved_by').prefetch_related('items').order_by('-created_at')
        invoices = SupplierInvoice.objects.filter(supplier=supplier).select_related('purchase_order', 'submitted_by', 'reviewed_by').order_by('-created_at')
        payments = SupplierPayment.objects.filter(supplier=supplier).select_related('purchase_order', 'invoice', 'authorized_by').order_by('-payment_date')
        products = supplier.products.all()

        return Response({
            'supplier': SupplierSerializer(supplier).data,
            'purchase_orders': PurchaseRequestSerializer(pos, many=True).data,
            'invoices': SupplierInvoiceSerializer(invoices, many=True).data,
            'payments': SupplierPaymentSerializer(payments, many=True).data,
            'products': ProductSerializer(products, many=True).data,
            'metrics': {
                'total_purchase_orders': pos.count(),
                'total_purchased_amount': supplier.total_purchases_amount,
                'total_paid_amount': supplier.total_paid_amount,
                'outstanding_balance': supplier.outstanding_balance,
            }
        })



class PromotionListCreateView(generics.ListCreateAPIView):
    from .models import Promotion
    from .serializers import PromotionSerializer
    serializer_class = PromotionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('promotions.manage')()]
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
        promo = serializer.save(created_by=self.request.user)
        if promo.apply_to_all:
            promo.products.clear()
            promo.categories.clear()


class PromotionDetailView(generics.RetrieveUpdateDestroyAPIView):
    from .models import Promotion
    from .serializers import PromotionSerializer
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [require_permission('promotions.manage')()]
        return [permissions.AllowAny()]

    def perform_update(self, serializer):
        promo = serializer.save()
        if promo.apply_to_all:
            promo.products.clear()
            promo.categories.clear()


def _clean_promo_string(val):
    if not val:
        return ''
    import html
    import re
    text = html.unescape(val)
    text = re.sub(r'&#x20;', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'&#xA0;', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'&#160;', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'&#32;', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'&nbsp;', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'^#+\s*', '', text)
    text = text.replace('\ufffd', '—')
    return re.sub(r'\s+', ' ', text).strip()


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
            if promo.discount_type == Promotion.DiscountType.PERCENTAGE:
                discount_label = f"{int(promo.discount_value)}% OFF"
            else:
                discount_label = f"ETB {promo.discount_value} OFF"

            return Response({
                'active': True,
                'id': promo.id,
                'title': _clean_promo_string(promo.title),
                'name': _clean_promo_string(promo.title),
                'description': _clean_promo_string(promo.description or ''),
                'banner_announcement': _clean_promo_string(promo.banner_announcement or f"Special Promotion: {promo.title}! Limited-time genuine store discounts."),
                'discount_type': promo.discount_type,
                'discount_value': str(promo.discount_value),
                'discount_label': discount_label,
                'status_label': 'Active Promotion',
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
            return [require_permission('refunds.manage')()]
        return [permissions.AllowAny()]


class WarrantyPolicyDetailView(generics.RetrieveUpdateDestroyAPIView):
    from .models import WarrantyPolicy
    from .serializers import WarrantyPolicySerializer
    queryset = WarrantyPolicy.objects.all()
    serializer_class = WarrantyPolicySerializer
    permission_classes = [require_permission('refunds.manage')]


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


# ==============================================================================
# LOW-STOCK MANAGEMENT & SUPPLIER NOTIFICATION APIS
# ==============================================================================

class LowStockManagementListView(APIView):
    """
    Returns all low-stock products (stock <= low_stock_threshold)
    with their supplier status, email delivery history, and reorder metrics.
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get(self, request):
        low_stock_products = Product.objects.filter(
            stock__lte=F('low_stock_threshold'),
            is_active=True
        ).select_related('supplier', 'category').prefetch_related('supplier_notifications')

        serialized = LowStockProductSerializer(low_stock_products, many=True).data

        missing_supplier = sum(1 for p in serialized if not p['has_supplier'])
        missing_email = sum(1 for p in serialized if p['has_supplier'] and not p['has_supplier_email'])
        notified = sum(1 for p in serialized if p['low_stock_notified'])

        return Response({
            'count': len(serialized),
            'missing_supplier_count': missing_supplier,
            'missing_email_count': missing_email,
            'notified_count': notified,
            'products': serialized
        })


class ResendSupplierLowStockAlertView(APIView):
    """
    Manually triggers or resends a low-stock reorder notification to the registered supplier.
    Allows Store Manager to re-assign or update the supplier on the fly if needed.
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        try:
            product = Product.objects.select_related('supplier').get(pk=pk)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Allow assigning / updating supplier directly
        supplier_id = request.data.get('supplier_id')
        if supplier_id:
            try:
                supplier = Supplier.objects.get(pk=supplier_id)
                product.supplier = supplier
                product.save(update_fields=['supplier'])
            except Supplier.DoesNotExist:
                return Response({'error': 'Supplier not found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Execute forced resend
        result = LowStockAlertService.evaluate_and_notify_product(
            product,
            trigger_type='MANUAL_RESEND',
            requested_by=request.user,
            force_resend=True
        )

        status_code = status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)


class ProductSupplierNotificationLogsView(APIView):
    """
    Returns full history of sent and failed supplier email notifications for a specific product.
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get(self, request, pk):
        logs = SupplierNotificationLog.objects.filter(product_id=pk).select_related('supplier', 'sent_by')
        return Response(SupplierNotificationLogSerializer(logs, many=True).data)


# ==============================================================================
# PURCHASE REQUEST & PROCUREMENT WORKFLOW (STORE MANAGER & ADMIN)
# ==============================================================================

class PurchaseRequestListCreateView(generics.ListCreateAPIView):
    """
    Lists purchase orders and creates new Draft or Submitted purchase orders.
    Enforces strict role boundaries: Store Managers cannot approve purchase orders.
    """
    serializer_class = PurchaseRequestSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = PurchaseRequest.objects.all().select_related('product', 'supplier', 'requested_by', 'approved_by').prefetch_related('items')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        product_filter = self.request.query_params.get('product_id')
        if product_filter:
            qs = qs.filter(product_id=product_filter)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier')
        if not supplier_id:
            return Response({'error': 'Supplier is required to create a purchase order.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if not supplier:
            return Response({'error': 'Selected supplier does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        items_data = data.get('items', [])
        requested_status = data.get('status') or PurchaseRequest.Status.DRAFT

        # Security check: Store Manager cannot directly approve on creation
        if requested_status not in [PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.SUBMITTED]:
            requested_status = PurchaseRequest.Status.PENDING_APPROVAL if requested_status == PurchaseRequest.Status.APPROVED else PurchaseRequest.Status.DRAFT

        notes = data.get('notes', '')
        expected_supply_date = data.get('expected_supply_date') or None

        pr = PurchaseRequest.objects.create(
            supplier=supplier,
            status=requested_status,
            expected_supply_date=expected_supply_date,
            notes=notes,
            requested_by=request.user
        )

        total_cost = Decimal('0.00')
        total_quantity = 0
        first_product = None

        if items_data and isinstance(items_data, list):
            for item in items_data:
                prod_id = item.get('product') or item.get('product_id')
                prod = Product.objects.filter(pk=prod_id).first()
                if not prod:
                    continue
                qty = int(item.get('quantity') or 1)
                unit_price = Decimal(str(item.get('unit_price') or item.get('agreed_price') or prod.cost_price or '0.00'))
                item_total = unit_price * qty
                total_cost += item_total
                total_quantity += qty
                if not first_product:
                    first_product = prod

                PurchaseOrderItem.objects.create(
                    purchase_order=pr,
                    product=prod,
                    quantity=qty,
                    unit_price=unit_price,
                    total_cost=item_total,
                    notes=item.get('notes', '')
                )
        else:
            # Single product creation support
            prod_id = data.get('product')
            if prod_id:
                prod = Product.objects.filter(pk=prod_id).first()
                if prod:
                    first_product = prod
                    qty = int(data.get('quantity') or prod.reorder_quantity or 20)
                    unit_price = Decimal(str(data.get('agreed_price') or data.get('estimated_unit_cost') or prod.cost_price or '0.00'))
                    total_cost = unit_price * qty
                    total_quantity = qty
                    PurchaseOrderItem.objects.create(
                        purchase_order=pr,
                        product=prod,
                        quantity=qty,
                        unit_price=unit_price,
                        total_cost=total_cost,
                        notes=notes
                    )

        pr.product = first_product
        pr.quantity = total_quantity or int(data.get('quantity') or 1)
        pr.total_estimated_cost = total_cost
        if total_quantity > 0:
            pr.estimated_unit_cost = (total_cost / total_quantity).quantize(Decimal('0.01'))
            pr.agreed_price = pr.estimated_unit_cost
        pr.save()

        # Audit Log
        AuditLog.objects.create(
            user=request.user,
            action="PURCHASE_ORDER_CREATED",
            details=f"Created PO {pr.request_number} for {supplier.name} in state [{pr.status}] (Total: ETB {pr.total_estimated_cost})"
        )

        serializer = self.get_serializer(pr)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PurchaseRequestDetailView(generics.RetrieveUpdateAPIView):
    """
    View and update purchase order.
    Separates Store Manager editing from Admin approval/rejection.
    """
    queryset = PurchaseRequest.objects.all()
    serializer_class = PurchaseRequestSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data
        new_status = data.get('status')
        user = request.user

        # Security check: PO Approval and Rejection are strictly Admin-only
        if new_status in [PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.REJECTED]:
            is_admin = getattr(user, 'is_admin', lambda: False)() or getattr(user, 'is_super_admin', False)
            if not is_admin:
                return Response(
                    {'error': 'Permission Denied: Only Administrators can approve or reject purchase orders. Store Managers cannot approve purchase orders.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Prevent self-approval if non-superuser
            if instance.requested_by == user and not getattr(user, 'is_super_admin', False):
                return Response(
                    {'error': 'Self-approval restriction: You cannot approve your own purchase order.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if new_status == PurchaseRequest.Status.APPROVED:
                instance.status = PurchaseRequest.Status.APPROVED
                instance.approved_by = user
                instance.approval_date = timezone.now()
                instance.admin_feedback = data.get('admin_feedback', '') or data.get('approval_notes', '')
                instance.save()

                AuditLog.objects.create(
                    user=user,
                    action="PURCHASE_ORDER_APPROVED",
                    details=f"Admin {user.username} approved PO {instance.request_number} (ETB {instance.total_estimated_cost})"
                )

                if instance.supplier:
                    try:
                        from accounts.email_service import send_supplier_purchase_order_email
                        send_supplier_purchase_order_email(instance)
                    except Exception:
                        pass
                if instance.supplier and instance.supplier.user:
                    try:
                        Notification.objects.create(
                            user=instance.supplier.user,
                            title=f"New Purchase Order Approved: {instance.request_number}",
                            message=f"EthioTech Market has issued PO {instance.request_number}. Please review and respond in your Supplier Portal.",
                            notification_type=Notification.NotificationType.SYSTEM,
                            link="/supplier/purchase-orders"
                        )
                    except Exception:
                        pass
                return Response(self.get_serializer(instance).data)

            elif new_status == PurchaseRequest.Status.REJECTED:
                instance.status = PurchaseRequest.Status.REJECTED
                instance.approved_by = user
                instance.approval_date = timezone.now()
                instance.admin_feedback = data.get('admin_feedback') or data.get('rejection_reason', 'Rejected by Admin')
                instance.save()

                AuditLog.objects.create(
                    user=user,
                    action="PURCHASE_ORDER_REJECTED",
                    details=f"Admin {user.username} rejected PO {instance.request_number}. Reason: {instance.admin_feedback}"
                )
                return Response(self.get_serializer(instance).data)

        # Allow Store Manager to update Draft POs or submit to Admin
        if instance.status == PurchaseRequest.Status.DRAFT:
            if 'notes' in data:
                instance.notes = data['notes']
            if 'expected_supply_date' in data:
                instance.expected_supply_date = data['expected_supply_date'] or None
            if new_status in [PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.SUBMITTED, PurchaseRequest.Status.CANCELLED]:
                instance.status = new_status
                AuditLog.objects.create(
                    user=user,
                    action=f"PURCHASE_ORDER_{new_status}",
                    details=f"PO {instance.request_number} status set to {new_status} by {user.username}"
                )

            if 'items' in data and isinstance(data['items'], list):
                instance.items.all().delete()
                total_cost = Decimal('0.00')
                total_qty = 0
                first_product = None
                for item in data['items']:
                    prod_id = item.get('product') or item.get('product_id')
                    prod = Product.objects.filter(pk=prod_id).first()
                    if not prod:
                        continue
                    qty = int(item.get('quantity') or 1)
                    unit_price = Decimal(str(item.get('unit_price') or item.get('agreed_price') or prod.cost_price or '0.00'))
                    item_total = unit_price * qty
                    total_cost += item_total
                    total_qty += qty
                    if not first_product:
                        first_product = prod
                    PurchaseOrderItem.objects.create(
                        purchase_order=instance,
                        product=prod,
                        quantity=qty,
                        unit_price=unit_price,
                        total_cost=item_total,
                        notes=item.get('notes', '')
                    )
                instance.product = first_product
                instance.quantity = total_qty
                instance.total_estimated_cost = total_cost
                if total_qty > 0:
                    instance.estimated_unit_cost = (total_cost / total_qty).quantize(Decimal('0.01'))
                    instance.agreed_price = instance.estimated_unit_cost
            instance.save()
            return Response(self.get_serializer(instance).data)

        # Store Manager transitioning Approved PO to SENT_TO_SUPPLIER
        if new_status == PurchaseRequest.Status.SENT_TO_SUPPLIER:
            if instance.status not in [PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.SENT_TO_SUPPLIER]:
                return Response({'error': 'Only approved purchase orders can be marked as sent to supplier.'}, status=status.HTTP_400_BAD_REQUEST)
            instance.status = PurchaseRequest.Status.SENT_TO_SUPPLIER
            if 'supplier_confirmed_at' in data:
                instance.supplier_confirmed_at = data['supplier_confirmed_at'] or timezone.now()
            if 'supplier_confirmation_notes' in data:
                instance.supplier_confirmation_notes = data['supplier_confirmation_notes']
            instance.save()
            AuditLog.objects.create(
                user=user,
                action="PURCHASE_ORDER_SENT_TO_SUPPLIER",
                details=f"PO {instance.request_number} marked as sent to supplier by {user.username}"
            )
            return Response(self.get_serializer(instance).data)

        return super().update(request, *args, **kwargs)


class PurchaseRequestSendToSupplierView(APIView):
    """
    Store Manager records sending approved PO to the supplier and records supplier confirmation.
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        try:
            pr = PurchaseRequest.objects.select_related('supplier').get(pk=pk)
        except PurchaseRequest.DoesNotExist:
            return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if pr.status not in [PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.SENT_TO_SUPPLIER]:
            return Response({'error': f'Purchase order cannot be sent in status: {pr.status}. Admin approval is required first.'}, status=status.HTTP_400_BAD_REQUEST)

        pr.status = PurchaseRequest.Status.SENT_TO_SUPPLIER
        pr.supplier_confirmed_at = timezone.now()
        pr.supplier_confirmation_notes = request.data.get('supplier_confirmation_notes') or request.data.get('notes', 'Confirmed by supplier.')
        pr.save()

        AuditLog.objects.create(
            user=request.user,
            action="PURCHASE_ORDER_SENT_TO_SUPPLIER",
            details=f"PO {pr.request_number} sent to supplier {pr.supplier.name if pr.supplier else ''}. Notes: {pr.supplier_confirmation_notes}"
        )

        if pr.supplier:
            try:
                from accounts.email_service import send_supplier_purchase_order_email
                send_supplier_purchase_order_email(pr)
            except Exception:
                pass
        if pr.supplier and pr.supplier.user:
            try:
                Notification.objects.create(
                    user=pr.supplier.user,
                    title=f"Purchase Order Sent: {pr.request_number}",
                    message=f"PO {pr.request_number} has been sent to your company. Please log in to your Supplier Portal to confirm or suggest updates.",
                    notification_type=Notification.NotificationType.SYSTEM,
                    link="/supplier/purchase-orders"
                )
            except Exception:
                pass

        return Response({
            'success': True,
            'message': f"Purchase Order {pr.request_number} marked as sent to supplier.",
            'purchase_request': PurchaseRequestSerializer(pr).data
        })


class PurchaseRequestReceiveStockView(APIView):
    """
    Store Manager records physical stock received for an approved/sent PO:
    - Increments inventory based only on quantities actually received.
    - Records damaged, missing, or outstanding products without adding damaged units to inventory.
    - Creates a RESTOCK StockMovement audit entry.
    - Resets product.low_stock_notified to False.
    - Updates PO status (PARTIALLY_RECEIVED or RECEIVED).
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        try:
            pr = PurchaseRequest.objects.select_related('product', 'supplier').prefetch_related('items').get(pk=pk)
        except PurchaseRequest.DoesNotExist:
            return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if pr.status in [PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.CANCELLED]:
            return Response({'error': f'Cannot receive goods for purchase order with status: {pr.status}. Order must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)

        items_payload = request.data.get('items', [])
        total_incoming_received = 0
        total_incoming_damaged = 0

        if items_payload and isinstance(items_payload, list):
            for it_data in items_payload:
                item_id = it_data.get('id')
                item_obj = pr.items.filter(pk=item_id).first()
                if not item_obj:
                    continue
                rec_qty = int(it_data.get('received_quantity') or 0)
                dam_qty = int(it_data.get('damaged_quantity') or 0)
                if rec_qty <= 0 and dam_qty <= 0:
                    continue

                item_obj.received_quantity += rec_qty
                item_obj.damaged_quantity += dam_qty
                item_obj.save()

                # Increment product stock only by received undamaged units
                if rec_qty > 0:
                    prod = item_obj.product
                    prod.stock += rec_qty
                    prod.low_stock_notified = False
                    prod.save()

                    StockMovement.objects.create(
                        product=prod,
                        quantity=rec_qty,
                        movement_type=StockMovement.MovementType.RESTOCK,
                        reference=f"PO {pr.request_number} Item Received ({rec_qty} units, {dam_qty} damaged)",
                        created_by=request.user
                    )

                total_incoming_received += rec_qty
                total_incoming_damaged += dam_qty

            all_items = list(PurchaseOrderItem.objects.filter(purchase_order=pr))
            pr.received_quantity = sum(i.received_quantity for i in all_items)
            pr.damaged_quantity = sum(i.damaged_quantity for i in all_items)
            total_ordered = sum(i.quantity for i in all_items)
            if pr.received_quantity >= total_ordered:
                pr.status = PurchaseRequest.Status.RECEIVED
            else:
                pr.status = PurchaseRequest.Status.PARTIALLY_RECEIVED
            pr.save()

        else:
            # Fallback to PO-level receiving
            incoming_qty = int(request.data.get('received_quantity') or 0)
            damaged_qty = int(request.data.get('damaged_quantity') or 0)
            if incoming_qty <= 0 and damaged_qty <= 0:
                remaining = max(0, pr.quantity - pr.received_quantity)
                incoming_qty = remaining

            if incoming_qty <= 0 and damaged_qty <= 0:
                return Response({'error': 'Received quantity must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

            pr.received_quantity += incoming_qty
            pr.damaged_quantity += damaged_qty
            if pr.received_quantity >= pr.quantity:
                pr.status = PurchaseRequest.Status.RECEIVED
            else:
                pr.status = PurchaseRequest.Status.PARTIALLY_RECEIVED
            pr.save()

            if pr.product and incoming_qty > 0:
                product = pr.product
                product.stock += incoming_qty
                product.low_stock_notified = False
                product.save()

                StockMovement.objects.create(
                    product=product,
                    quantity=incoming_qty,
                    movement_type=StockMovement.MovementType.RESTOCK,
                    reference=f"PO {pr.request_number} Received ({incoming_qty} units, {damaged_qty} damaged)",
                    created_by=request.user
                )
            total_incoming_received = incoming_qty
            total_incoming_damaged = damaged_qty

        AuditLog.objects.create(
            user=request.user,
            action="PURCHASE_ORDER_STOCK_RECEIVED",
            details=f"Received {total_incoming_received} units ({total_incoming_damaged} damaged) for PO {pr.request_number} by {request.user.username}"
        )

        return Response({
            'success': True,
            'message': f"Successfully recorded {total_incoming_received} units received (and {total_incoming_damaged} damaged). Total received: {pr.received_quantity}/{pr.quantity}.",
            'received_quantity': pr.received_quantity,
            'damaged_quantity': pr.damaged_quantity,
            'outstanding_quantity': pr.outstanding_quantity,
            'status': pr.status,
            'purchase_request': PurchaseRequestSerializer(pr).data
        })


# ==============================================================================
# SUPPLIER INVOICE MANAGEMENT
# ==============================================================================

class SupplierInvoiceListCreateView(generics.ListCreateAPIView):
    """
    Store Manager records and submits supplier invoices referencing a PO.
    Identifies and prevents duplicate invoices.
    Store Managers cannot authorize payment.
    """
    serializer_class = SupplierInvoiceSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = SupplierInvoice.objects.all().select_related('supplier', 'purchase_order', 'submitted_by', 'reviewed_by').order_by('-created_at')
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        po_id = self.request.query_params.get('purchase_order_id')
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier')
        invoice_number = (data.get('invoice_number') or '').strip()
        total_amount = Decimal(str(data.get('total_amount') or '0.00'))

        if not supplier_id:
            return Response({'error': 'Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not invoice_number:
            return Response({'error': 'Invoice number is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if total_amount <= Decimal('0.00'):
            return Response({'error': 'Total invoice amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        # Duplicate invoice prevention
        if SupplierInvoice.objects.filter(supplier_id=supplier_id, invoice_number__iexact=invoice_number).exists():
            return Response(
                {'error': f"Duplicate Invoice Detected: An invoice with number '{invoice_number}' already exists for this supplier."},
                status=status.HTTP_400_BAD_REQUEST
            )

        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if not supplier:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        po = None
        po_id = data.get('purchase_order')
        if po_id:
            po = PurchaseRequest.objects.filter(pk=po_id).first()

        invoice = SupplierInvoice.objects.create(
            supplier=supplier,
            purchase_order=po,
            invoice_number=invoice_number,
            invoice_date=data.get('invoice_date') or timezone.now().date(),
            due_date=data.get('due_date') or None,
            total_amount=total_amount,
            notes=data.get('notes', ''),
            attachment=request.FILES.get('attachment') or None,
            submitted_by=request.user,
            status=SupplierInvoice.Status.PENDING_APPROVAL
        )

        AuditLog.objects.create(
            user=request.user,
            action="SUPPLIER_INVOICE_SUBMITTED",
            details=f"Store Manager {request.user.username} submitted invoice #{invoice.invoice_number} for {supplier.name} (ETB {invoice.total_amount})"
        )

        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)


class SupplierInvoiceDetailView(generics.RetrieveAPIView):
    queryset = SupplierInvoice.objects.all()
    serializer_class = SupplierInvoiceSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]


class SupplierInvoiceReviewView(APIView):
    """
    Admin reviews and approves or rejects supplier invoices for payment.
    Store Managers are strictly forbidden from approving invoices.
    """
    def get_permissions(self):
        return [require_permission('settlements.manage')()]

    def post(self, request, pk):
        user = request.user
        is_admin = getattr(user, 'is_admin', lambda: False)() or getattr(user, 'is_super_admin', False)
        if not is_admin:
            return Response(
                {'error': 'Permission Denied: Only Administrators can review and approve supplier invoices for payment.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            invoice = SupplierInvoice.objects.select_related('supplier', 'purchase_order').get(pk=pk)
        except SupplierInvoice.DoesNotExist:
            return Response({'error': 'Supplier invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action') # 'approve' or 'reject'
        notes = request.data.get('review_notes') or request.data.get('rejection_reason', '')

        if action == 'approve':
            invoice.status = SupplierInvoice.Status.APPROVED
            invoice.reviewed_by = user
            invoice.reviewed_at = timezone.now()
            invoice.review_notes = notes
            invoice.save()

            AuditLog.objects.create(
                user=user,
                action="SUPPLIER_INVOICE_APPROVED",
                details=f"Admin {user.username} approved invoice #{invoice.invoice_number} for payment (ETB {invoice.total_amount})"
            )
            return Response({
                'success': True,
                'message': f"Invoice #{invoice.invoice_number} successfully approved for payment.",
                'invoice': SupplierInvoiceSerializer(invoice).data
            })

        elif action == 'reject':
            invoice.status = SupplierInvoice.Status.REJECTED
            invoice.reviewed_by = user
            invoice.reviewed_at = timezone.now()
            invoice.review_notes = notes or 'Rejected by Admin'
            invoice.save()

            AuditLog.objects.create(
                user=user,
                action="SUPPLIER_INVOICE_REJECTED",
                details=f"Admin {user.username} rejected invoice #{invoice.invoice_number}. Reason: {invoice.review_notes}"
            )
            return Response({
                'success': True,
                'message': f"Invoice #{invoice.invoice_number} has been rejected.",
                'invoice': SupplierInvoiceSerializer(invoice).data
            })
        else:
            return Response({'error': "Invalid action. Expected 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SUPPLIER PAYMENT AUTHORIZATION & RECORDING (ADMIN ONLY)
# ==============================================================================

class SupplierPaymentListCreateView(generics.ListCreateAPIView):
    """
    Lists supplier payment records and allows authorized Admin to record external supplier disbursements.
    Store Managers are strictly forbidden from authorizing or recording payments.
    """
    serializer_class = SupplierPaymentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('settlements.manage')()]
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = SupplierPayment.objects.all().select_related('supplier', 'purchase_order', 'invoice', 'authorized_by').order_by('-payment_date')
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        invoice_id = self.request.query_params.get('invoice_id')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        po_id = self.request.query_params.get('purchase_order_id')
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(payment_status=status_param)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        is_admin = getattr(user, 'is_admin', lambda: False)() or getattr(user, 'is_super_admin', False) or user.has_permission('settlements.manage')
        if not is_admin or getattr(user, 'role', '') == 'store_manager':
            return Response(
                {'error': 'Permission Denied: Store Managers cannot authorize or record supplier payments. Admin financial authorization is required.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        supplier_id = data.get('supplier')
        amount_paid = Decimal(str(data.get('amount_paid') or '0.00'))
        payment_method = data.get('payment_method') or SupplierPayment.PaymentMethod.BANK_TRANSFER
        tx_ref = (data.get('transaction_reference') or '').strip()

        if not supplier_id:
            return Response({'error': 'Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount_paid <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if not supplier:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent duplicate payment reference
        if tx_ref and SupplierPayment.objects.filter(transaction_reference__iexact=tx_ref).exists():
            return Response({'error': f"Duplicate Payment Reference: A payment with reference '{tx_ref}' already exists in the system."}, status=status.HTTP_400_BAD_REQUEST)

        invoice = None
        invoice_id = data.get('invoice')
        if invoice_id:
            invoice = SupplierInvoice.objects.filter(pk=invoice_id, supplier=supplier).first()
            if not invoice:
                return Response({'error': 'Selected invoice does not exist or belong to this supplier.'}, status=status.HTTP_400_BAD_REQUEST)
            if invoice.status not in [SupplierInvoice.Status.APPROVED, SupplierInvoice.Status.PARTIALLY_PAID]:
                return Response({'error': f"Invoice #{invoice.invoice_number} cannot receive payments in status: {invoice.status}. Invoice must be Approved first."}, status=status.HTTP_400_BAD_REQUEST)
            if amount_paid > invoice.outstanding_amount:
                return Response({'error': f"Payment amount (ETB {amount_paid}) exceeds invoice outstanding balance (ETB {invoice.outstanding_amount})."}, status=status.HTTP_400_BAD_REQUEST)

        po = None
        po_id = data.get('purchase_order')
        if po_id:
            po = PurchaseRequest.objects.filter(pk=po_id).first()
        elif invoice and invoice.purchase_order:
            po = invoice.purchase_order

        total_amount = invoice.total_amount if invoice else (po.total_estimated_cost if po else amount_paid)
        payment_status = data.get('payment_status') or SupplierPayment.PaymentStatus.PAID

        payment = SupplierPayment.objects.create(
            supplier=supplier,
            invoice=invoice,
            purchase_order=po,
            supplier_invoice=invoice.invoice_number if invoice else data.get('supplier_invoice', ''),
            purchase_order_reference=po.request_number if po else data.get('purchase_order_reference', ''),
            total_purchase_amount=total_amount,
            amount_paid=amount_paid,
            payment_method=payment_method,
            transaction_reference=tx_ref,
            payment_date=data.get('payment_date') or timezone.now(),
            payment_status=payment_status,
            authorized_by=user,
            notes=data.get('notes', '')
        )

        # Update invoice paid_amount and status
        if invoice and payment.payment_status in [SupplierPayment.PaymentStatus.PAID, SupplierPayment.PaymentStatus.AUTHORIZED]:
            invoice.paid_amount += amount_paid
            if invoice.paid_amount >= invoice.total_amount:
                invoice.status = SupplierInvoice.Status.PAID
            else:
                invoice.status = SupplierInvoice.Status.PARTIALLY_PAID
            invoice.save()

        AuditLog.objects.create(
            user=user,
            action="SUPPLIER_PAYMENT_AUTHORIZED",
            details=f"Admin {user.username} recorded payment of ETB {payment.amount_paid} to {supplier.name} via {payment.payment_method} (Ref: {payment.transaction_reference})"
        )

        return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)


class SupplierPaymentDetailView(generics.RetrieveUpdateAPIView):
    queryset = SupplierPayment.objects.all()
    serializer_class = SupplierPaymentSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [require_permission('settlements.manage')()]
        return [require_permission('inventory.manage')()]


# ==============================================================================
# PROCUREMENT & FINANCIAL REPORTS (ADMIN)
# ==============================================================================

class ProcurementReportsView(APIView):
    """
    Admin procurement and financial reports:
    - Total purchases
    - Total supplier payments
    - Outstanding supplier balances
    - Purchase orders awaiting approval
    - Unpaid supplier invoices
    - Supplier purchase history breakdown
    - Monthly and yearly procurement expenses
    """
    def get_permissions(self):
        return [require_permission('reports.view')()]

    def get(self, request):
        now = timezone.now()

        # 1. Summary Metrics
        total_purchases = PurchaseRequest.objects.exclude(
            status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.CANCELLED]
        ).aggregate(s=Sum('total_estimated_cost'))['s'] or Decimal('0.00')

        total_payments = SupplierPayment.objects.filter(
            payment_status__in=[SupplierPayment.PaymentStatus.PAID, SupplierPayment.PaymentStatus.AUTHORIZED]
        ).aggregate(s=Sum('amount_paid'))['s'] or Decimal('0.00')

        outstanding_balance = max(Decimal('0.00'), total_purchases - total_payments)

        pos_awaiting_approval = PurchaseRequest.objects.filter(
            status__in=[PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.SUBMITTED]
        ).count()

        unpaid_invoices_qs = SupplierInvoice.objects.filter(
            status__in=[SupplierInvoice.Status.PENDING_APPROVAL, SupplierInvoice.Status.APPROVED, SupplierInvoice.Status.PARTIALLY_PAID]
        )
        unpaid_invoices_count = unpaid_invoices_qs.count()
        unpaid_invoices_amount = sum(inv.outstanding_amount for inv in unpaid_invoices_qs)

        # 2. Supplier Breakdown
        suppliers = Supplier.objects.all().order_by('name')
        supplier_breakdown = []
        for s in suppliers:
            supplier_breakdown.append({
                'id': s.id,
                'name': s.name,
                'contact_person': s.contact_person,
                'email': s.email,
                'phone': s.phone,
                'status': s.status,
                'po_count': s.purchase_requests.count(),
                'total_purchases': str(s.total_purchases_amount),
                'total_paid': str(s.total_paid_amount),
                'outstanding_balance': str(s.outstanding_balance),
            })

        # 3. Monthly Expenses (Last 12 Months)
        monthly_expenses = []
        for i in range(11, -1, -1):
            m_year = now.year
            m_month = now.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            month_str = f"{m_year:04d}-{m_month:02d}"
            label_str = timezone.datetime(m_year, m_month, 1).strftime('%b %Y')

            m_purchases = PurchaseRequest.objects.filter(
                created_at__year=m_year,
                created_at__month=m_month
            ).exclude(
                status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.CANCELLED]
            ).aggregate(s=Sum('total_estimated_cost'))['s'] or Decimal('0.00')

            m_payments = SupplierPayment.objects.filter(
                payment_date__year=m_year,
                payment_date__month=m_month,
                payment_status__in=[SupplierPayment.PaymentStatus.PAID, SupplierPayment.PaymentStatus.AUTHORIZED]
            ).aggregate(s=Sum('amount_paid'))['s'] or Decimal('0.00')

            monthly_expenses.append({
                'month': month_str,
                'label': label_str,
                'purchases': str(m_purchases),
                'payments': str(m_payments),
            })

        # 4. Yearly Expenses (Last 3 Years)
        yearly_expenses = []
        for yr in [now.year - 2, now.year - 1, now.year]:
            y_purchases = PurchaseRequest.objects.filter(
                created_at__year=yr
            ).exclude(
                status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.CANCELLED]
            ).aggregate(s=Sum('total_estimated_cost'))['s'] or Decimal('0.00')

            y_payments = SupplierPayment.objects.filter(
                payment_date__year=yr,
                payment_status__in=[SupplierPayment.PaymentStatus.PAID, SupplierPayment.PaymentStatus.AUTHORIZED]
            ).aggregate(s=Sum('amount_paid'))['s'] or Decimal('0.00')

            yearly_expenses.append({
                'year': str(yr),
                'purchases': str(y_purchases),
                'payments': str(y_payments),
            })

        return Response({
            'summary': {
                'total_purchases': str(total_purchases),
                'total_supplier_payments': str(total_payments),
                'outstanding_supplier_balance': str(outstanding_balance),
                'pos_awaiting_approval': pos_awaiting_approval,
                'unpaid_invoices_count': unpaid_invoices_count,
                'unpaid_invoices_amount': str(unpaid_invoices_amount),
                'suppliers_count': suppliers.count(),
            },
            'supplier_breakdown': supplier_breakdown,
            'monthly_expenses': monthly_expenses,
            'yearly_expenses': yearly_expenses,
        })


class ProductReorderSettingsUpdateView(APIView):
    """
    Updates low-stock threshold and suggested reorder quantity for a product.
    Allows Store Manager to customize reorder thresholds and replenishment quantities.
    """
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def patch(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        reorder_qty = request.data.get('reorder_quantity')
        low_stock_thresh = request.data.get('low_stock_threshold') or request.data.get('min_stock_level')

        if reorder_qty is not None:
            try:
                rq = int(reorder_qty)
                if rq <= 0:
                    return Response({'error': 'Reorder quantity must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
                product.reorder_quantity = rq
            except (ValueError, TypeError):
                return Response({'error': 'Invalid reorder quantity.'}, status=status.HTTP_400_BAD_REQUEST)

        if low_stock_thresh is not None:
            try:
                lst = int(low_stock_thresh)
                if lst < 0:
                    return Response({'error': 'Minimum stock level cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
                product.low_stock_threshold = lst
            except (ValueError, TypeError):
                return Response({'error': 'Invalid minimum stock level.'}, status=status.HTTP_400_BAD_REQUEST)

        product.save()

        # Re-evaluate stock level against updated thresholds
        alert_res = LowStockAlertService.evaluate_and_notify_product(
            product,
            trigger_type='AUTOMATIC',
            requested_by=request.user
        )

        return Response({
            'success': True,
            'message': f"Reorder settings for '{product.name}' updated successfully.",
            'product': ProductSerializer(product).data,
            'alert_result': alert_res
        })


class AdminInventoryMonitoringView(APIView):
    """
    Comprehensive inventory monitoring endpoint for Administrators.
    Provides complete visibility into:
    - All low-stock products
    - All out-of-stock products
    - Products awaiting replenishment
    - Supplier email history (sent and failed)
    - Pending purchase requests
    - Replenishment history
    - Full stock alert audit trail
    """
    def get_permissions(self):
        return [require_permission('products.view')()]

    def get(self, request):
        products = Product.objects.all().select_related('supplier', 'category')
        low_stock = products.filter(stock__lte=F('low_stock_threshold'), stock__gt=0, is_active=True)
        out_of_stock = products.filter(stock=0, is_active=True)

        pending_prs = PurchaseRequest.objects.filter(
            status__in=[PurchaseRequest.Status.SUBMITTED, PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.ORDERED]
        ).select_related('product', 'supplier', 'requested_by', 'approved_by')

        awaiting_replenishment_product_ids = pending_prs.values_list('product_id', flat=True).distinct()
        awaiting_products = products.filter(id__in=awaiting_replenishment_product_ids)

        all_logs = SupplierNotificationLog.objects.all().select_related('product', 'supplier', 'sent_by')
        failed_logs = all_logs.filter(status=SupplierNotificationLog.Status.FAILED)

        replenishments = StockMovement.objects.filter(
            movement_type=StockMovement.MovementType.RESTOCK
        ).select_related('product', 'created_by')[:50]

        alert_history = StockAlertHistory.objects.all().select_related('product', 'supplier', 'triggered_by')[:100]

        summary = {
            'total_products': products.count(),
            'low_stock_count': low_stock.count(),
            'out_of_stock_count': out_of_stock.count(),
            'awaiting_replenishment_count': awaiting_products.count(),
            'total_supplier_emails_sent': all_logs.filter(status=SupplierNotificationLog.Status.SENT).count(),
            'failed_supplier_emails_count': failed_logs.count(),
            'pending_purchase_requests_count': pending_prs.count(),
            'total_restocks_count': replenishments.count()
        }

        return Response({
            'summary': summary,
            'low_stock_products': LowStockProductSerializer(low_stock, many=True).data,
            'out_of_stock_products': LowStockProductSerializer(out_of_stock, many=True).data,
            'awaiting_replenishment': PurchaseRequestSerializer(pending_prs, many=True).data,
            'supplier_email_history': SupplierNotificationLogSerializer(all_logs[:50], many=True).data,
            'failed_supplier_emails': SupplierNotificationLogSerializer(failed_logs[:50], many=True).data,
            'pending_purchase_requests': PurchaseRequestSerializer(pending_prs, many=True).data,
            'replenishment_history': StockMovementSerializer(replenishments, many=True).data,
            'stock_alert_history': StockAlertHistorySerializer(alert_history, many=True).data
        })


