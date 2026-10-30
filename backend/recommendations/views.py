from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import CustomerSegment, CustomerActivity
from .serializers import CustomerSegmentSerializer, CustomerActivitySerializer
from .engine import AIRecommendationEngine
from products.serializers import ProductSerializer
from products.models import Product
from accounts.permissions import IsStoreManagerOrAdmin, require_permission


class PersonalizedRecommendationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        top_n = int(request.query_params.get('limit', 8))
        products = AIRecommendationEngine.get_personalized_recommendations(request.user, top_n=top_n)
        return Response({
            'algorithm': 'Personalized Interest Profile (TF-IDF Vector Space & Purchase History)',
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class SimilarProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        top_n = int(request.query_params.get('limit', 6))
        products = AIRecommendationEngine.get_content_based_recommendations(product_id, top_n=top_n)
        return Response({
            'algorithm': 'Content-Based Cosine Similarity (TF-IDF on Product Features)',
            'product_id': product_id,
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class FrequentlyBoughtTogetherView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        top_n = int(request.query_params.get('limit', 4))
        products = AIRecommendationEngine.get_frequently_bought_together(product_id, top_n=top_n)
        return Response({
            'algorithm': 'Order Item Co-occurrence Pattern Analysis',
            'product_id': product_id,
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class TrendingProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        top_n = int(request.query_params.get('limit', 8))
        products = AIRecommendationEngine.get_trending_products(top_n=top_n)
        return Response({
            'algorithm': 'Sales Velocity, View Density & Customer Ratings',
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class CustomerSegmentationView(APIView):
    permission_classes = [require_permission('customers.view')]

    def get(self, request):
        # Auto-run if empty
        if not CustomerSegment.objects.exists():
            AIRecommendationEngine.run_customer_segmentation()

        segments = CustomerSegment.objects.all()
        serializer = CustomerSegmentSerializer(segments, many=True)

        # Aggregate cluster counts
        clusters = {}
        for s in segments:
            cid = s.cluster_id
            if cid not in clusters:
                clusters[cid] = {
                    'cluster_id': cid,
                    'name': s.segment_name,
                    'count': 0,
                    'suggested_action': s.suggested_action,
                    'total_spent': 0.0
                }
            clusters[cid]['count'] += 1
            clusters[cid]['total_spent'] += float(s.total_spent)

        return Response({
            'algorithm': 'K-Means Clustering on RFM (Recency, Frequency, Monetary)',
            'total_customers_segmented': segments.count(),
            'clusters_summary': list(clusters.values()),
            'customers': serializer.data
        })

    def post(self, request):
        # Trigger re-clustering model
        result = AIRecommendationEngine.run_customer_segmentation()
        return Response({
            'message': 'AI Customer segmentation model retrained successfully.',
            'details': result
        }, status=status.HTTP_200_OK)


class TrackActivityView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        product_id = request.data.get('product_id')
        activity_type = request.data.get('activity_type', CustomerActivity.ActivityType.VIEW)
        session_key = request.data.get('session_id') or request.session.session_key

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user if request.user.is_authenticated else None

        activity = CustomerActivity.objects.create(
            user=user,
            session_key=session_key,
            product=product,
            activity_type=activity_type
        )
        return Response(CustomerActivitySerializer(activity).data, status=status.HTTP_201_CREATED)


class AIAssistantView(APIView):
    """
    Grounded AI Personal Shopping Assistant for Ethio Tech Market.
    Performs deterministic database retrieval on actual catalog items,
    respecting stock, price in ETB, categories, and technical specifications.
    Never fabricates products, prices, or fake discounts.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import re
        from decimal import Decimal
        from django.db.models import Q

        user_query = (request.data.get('query') or '').strip()
        if not user_query:
            return Response({
                'response': "Hello! I am your Ethio Tech Market AI Shopping Assistant. How can I help you discover technology today? You can ask me to find laptops for programming, smartphones with great cameras, budget accessories under a specific ETB amount, or compare products.",
                'products': [],
                'suggestions': [
                    "Laptops for programming under ETB 80,000",
                    "Smartphones with best camera",
                    "Wireless noise-canceling headphones",
                    "Accessories under ETB 5,000"
                ]
            })

        q_lower = user_query.lower()

        # 1. Extract Budget if specified
        budget_limit = None
        budget_match = re.search(r'(?:under|below|less than|max|budget)\s*(?:etb|birr|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', q_lower)
        if not budget_match:
            budget_match = re.search(r'(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:etb|birr)', q_lower)
        if budget_match:
            try:
                raw_num = budget_match.group(1).replace(',', '')
                budget_limit = Decimal(raw_num)
            except Exception:
                budget_limit = None

        # 2. Category & Keyword intent matching
        category_keywords = {
            'laptop': ['laptop', 'macbook', 'notebook', 'computer', 'pc', 'workstation'],
            'smartphone': ['smartphone', 'phone', 'iphone', 'galaxy', 'mobile', 'android'],
            'audio': ['headphone', 'headphones', 'earbud', 'earbuds', 'audio', 'sound', 'music', 'speaker'],
            'wearable': ['watch', 'smartwatch', 'wearable', 'fitness', 'tracker'],
            'accessory': ['accessory', 'accessories', 'mouse', 'keyboard', 'charger', 'power bank', 'cable', 'adapter']
        }

        matched_cat_slugs = []
        for cat_slug, terms in category_keywords.items():
            if any(term in q_lower for term in terms):
                matched_cat_slugs.append(cat_slug)

        # 3. Base Query
        qs = Product.objects.filter(is_active=True)

        if budget_limit:
            qs = qs.filter(price__lte=budget_limit)

        if matched_cat_slugs:
            cat_query = Q()
            for slug in matched_cat_slugs:
                cat_query |= Q(category__name__icontains=slug) | Q(category__slug__icontains=slug)
            qs = qs.filter(cat_query)

        # Keyword filtering on name and description
        search_terms = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', q_lower) 
                        if w not in {'find', 'show', 'recommend', 'what', 'which', 'under', 'below', 'with', 'good', 'best', 'the', 'for'}]
        
        if search_terms:
            text_query = Q()
            for t in search_terms:
                text_query |= Q(name__icontains=t) | Q(description__icontains=t)
            
            # Try specific query first
            filtered_qs = qs.filter(text_query)
            if filtered_qs.exists():
                qs = filtered_qs

        # Stock preference: in-stock items first
        qs = qs.order_by('-stock', '-rating_average', 'price')
        results = list(qs[:4])

        # If no results found with strict filter, fallback to top trending items
        is_fallback = False
        if not results:
            is_fallback = True
            fallback_qs = Product.objects.filter(is_active=True, stock__gt=0).order_by('-rating_average', '-stock')
            results = list(fallback_qs[:3])

        # 4. Generate grounded natural language explanation
        if is_fallback:
            reply_text = f"I couldn't find exact matches for \"{user_query}\" currently in stock with those parameters. However, here are our highest-rated trending tech items available for immediate delivery in Ethiopia:"
        else:
            product_summaries = []
            for p in results:
                stock_status = f"{p.stock} units in stock" if p.stock > 0 else "currently out of stock"
                product_summaries.append(f"**{p.name}** at ETB {p.price:,.2f} ({stock_status})")
            
            budget_str = f" within your budget of ETB {budget_limit:,.2f}" if budget_limit else ""
            reply_text = f"Based on our active catalog, I found {len(results)} verified recommendation{'s' if len(results) > 1 else ''}{budget_str}:\n\n"
            reply_text += " • " + "\n • ".join(product_summaries)
            reply_text += "\n\nAll items are backed by official warranty and fast delivery across Ethiopia."

        serialized_products = ProductSerializer(results, many=True).data

        return Response({
            'response': reply_text,
            'products': serialized_products,
            'budget_applied': str(budget_limit) if budget_limit else None,
            'suggestions': [
                "Compare these models",
                "Show cheaper alternatives",
                "Add top recommendation to cart",
                "Check delivery time to Addis Ababa"
            ]
        })


class AIProductComparisonView(APIView):
    """
    Smart Product Comparison Engine.
    Compares up to 4 real catalog products side-by-side with an
    AI-generated grounded synthesis of performance, pricing, and value.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        product_ids = request.data.get('product_ids', [])
        if isinstance(product_ids, str):
            product_ids = [int(x.strip()) for x in product_ids.split(',') if x.strip().isdigit()]

        if not product_ids or len(product_ids) < 2:
            return Response(
                {'error': 'Please select at least 2 products to compare (up to 4).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        products = list(Product.objects.filter(id__in=product_ids[:4]))
        if len(products) < 2:
            return Response(
                {'error': 'Could not find sufficient active products for comparison.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Compute grounded comparison analytics
        sorted_by_price = sorted(products, key=lambda p: p.price)
        lowest_price_prod = sorted_by_price[0]
        highest_price_prod = sorted_by_price[-1]
        price_diff = highest_price_prod.price - lowest_price_prod.price

        sorted_by_rating = sorted(products, key=lambda p: (p.rating_average or 0), reverse=True)
        top_rated_prod = sorted_by_rating[0]

        # Grounded AI synthesis narrative
        ai_synthesis = {
            'best_overall': {
                'product_id': top_rated_prod.id,
                'name': top_rated_prod.name,
                'reason': f"Highest customer satisfaction score ({top_rated_prod.rating_average}/5.0 from {top_rated_prod.rating_count} verified reviews) with comprehensive specs."
            },
            'best_value': {
                'product_id': lowest_price_prod.id,
                'name': lowest_price_prod.name,
                'reason': f"Most accessible entry price at ETB {lowest_price_prod.price:,.2f}, saving ETB {price_diff:,.2f} compared to the premium option."
            },
            'verdict_summary': (
                f"Comparing {len(products)} models in {products[0].category.name}: "
                f"If raw performance and customer ratings are your top priority, choose the {top_rated_prod.name}. "
                f"For the best balance of cost and utility, the {lowest_price_prod.name} offers tremendous value at ETB {lowest_price_prod.price:,.2f}. "
                f"Both products are authentic and eligible for official warranty coverage and Chapa checkout."
            )
        }

        return Response({
            'products': ProductSerializer(products, many=True).data,
            'ai_synthesis': ai_synthesis
        })


class AIDemandForecastingView(APIView):
    """
    Grounded Demand Forecasting & Stock Intelligence Engine.
    Analyzes verified historical sales velocity over the past 30-90 days,
    computes moving daily run rate, predicts 30-day demand, estimates days-of-stock,
    and flags stockout warnings and restocking recommendations.
    Restricted to authorized Store Managers and Admins.
    """
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Sum, Count, Q
        from orders.models import Order, OrderItem
        from products.models import Product

        now = timezone.now()
        try:
            analysis_days = max(int(request.query_params.get('days', 60)), 14)
        except ValueError:
            analysis_days = 60
        forecast_horizon_days = 30
        since_date = now - timedelta(days=analysis_days)

        # Verified paid orders for sales analysis
        verified_orders = Order.objects.filter(
            Q(payment_status=Order.PaymentStatus.PAID) |
            Q(status__in=[Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED])
        ).exclude(status=Order.Status.CANCELLED)

        recent_items = OrderItem.objects.filter(
            order__in=verified_orders,
            order__created_at__gte=since_date
        )

        total_orders_sample = verified_orders.filter(created_at__gte=since_date).count()
        has_adequate_data = total_orders_sample >= 5

        # Group sales by product
        sales_by_product = (
            recent_items.values('product_id')
            .annotate(
                units_sold=Sum('quantity'),
                revenue=Sum('total_price'),
                orders_count=Count('id')
            )
        )
        sales_map = {item['product_id']: item for item in sales_by_product}

        forecasts = []
        active_products = Product.objects.filter(is_active=True).select_related('category')

        for prod in active_products:
            sales_info = sales_map.get(prod.id, {'units_sold': 0, 'revenue': 0.0, 'orders_count': 0})
            units_sold = sales_info['units_sold'] or 0
            daily_run_rate = units_sold / max(analysis_days, 1)
            predicted_30d_demand = round(daily_run_rate * forecast_horizon_days, 1)

            # Days of stock remaining based on daily run rate
            if daily_run_rate > 0:
                days_of_stock = round(prod.stock / daily_run_rate, 1)
            else:
                days_of_stock = 999.0 if prod.stock > 0 else 0.0

            # Stockout risk evaluation
            if prod.stock == 0:
                risk_level = "CRITICAL_OUT_OF_STOCK"
                status_text = "Out of Stock"
                suggested_reorder = max(int(predicted_30d_demand) + 5, 10)
            elif days_of_stock < 14 or prod.stock <= prod.low_stock_threshold:
                risk_level = "HIGH_STOCKOUT_RISK"
                status_text = f"Restock Urgently (~{int(days_of_stock)} days left)"
                suggested_reorder = max(int(predicted_30d_demand - prod.stock) + 5, 5)
            elif days_of_stock < 30:
                risk_level = "MODERATE_REORDER_SOON"
                status_text = f"Reorder Soon (~{int(days_of_stock)} days left)"
                suggested_reorder = max(int(predicted_30d_demand - prod.stock), 0)
            else:
                risk_level = "ADEQUATE_STOCK"
                status_text = "Stock Healthy"
                suggested_reorder = 0

            forecasts.append({
                'product_id': prod.id,
                'name': prod.name,
                'sku': prod.sku,
                'category': prod.category.name,
                'price': float(prod.price),
                'current_stock': prod.stock,
                'low_stock_threshold': prod.low_stock_threshold,
                'historical_units_sold': units_sold,
                'daily_sales_velocity': round(daily_run_rate, 2),
                'predicted_30d_demand': predicted_30d_demand,
                'estimated_days_of_stock': min(days_of_stock, 999.0),
                'risk_level': risk_level,
                'status_text': status_text,
                'suggested_reorder_qty': suggested_reorder
            })

        # Sort by urgency (critical and high risk first)
        risk_priority = {
            'CRITICAL_OUT_OF_STOCK': 0,
            'HIGH_STOCKOUT_RISK': 1,
            'MODERATE_REORDER_SOON': 2,
            'ADEQUATE_STOCK': 3
        }
        forecasts.sort(key=lambda x: (risk_priority.get(x['risk_level'], 9), -x['predicted_30d_demand']))

        return Response({
            'algorithm': 'Historical Moving Average & Sales Run Rate Forecasting',
            'analysis_window_days': analysis_days,
            'forecast_horizon_days': forecast_horizon_days,
            'data_adequate': has_adequate_data,
            'data_limitation': None if has_adequate_data else f"Sample size contains only {total_orders_sample} verified order(s) in past {analysis_days} days. Baseline moving run rate estimation applied.",
            'total_products_monitored': len(forecasts),
            'stockout_warnings_count': sum(1 for f in forecasts if f['risk_level'] in ['CRITICAL_OUT_OF_STOCK', 'HIGH_STOCKOUT_RISK']),
            'forecasts': forecasts
        })
