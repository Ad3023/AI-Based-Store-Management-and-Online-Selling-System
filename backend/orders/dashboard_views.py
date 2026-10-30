import csv
from datetime import datetime, timedelta
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth, TruncYear
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from accounts.models import User
from products.models import Product, Category, Promotion
from orders.models import Order, OrderItem, PaymentEvidence
from accounts.permissions import IsStoreManagerOrAdmin, require_permission
from orders.serializers import OrderSerializer
from products.serializers import ProductSerializer


class DashboardAnalyticsView(APIView):
    permission_classes = [require_permission('reports.view')]

    def get(self, request):
        now = timezone.now()
        timeframe = request.query_params.get('timeframe', 'monthly').lower().strip()

        # Authoritative verified paid orders: only settled payments count as revenue
        paid_orders = Order.objects.filter(
            Q(payment_status=Order.PaymentStatus.PAID) |
            Q(status__in=[Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED])
        ).exclude(
            status=Order.Status.CANCELLED
        ).exclude(
            payment_status__in=[
                Order.PaymentStatus.FAILED,
                Order.PaymentStatus.CANCELLED,
                Order.PaymentStatus.REFUNDED
            ]
        )

        total_revenue = float(paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0.0)
        total_orders = Order.objects.count()
        paid_orders_count = paid_orders.count()
        pending_orders = Order.objects.filter(status__in=[
            Order.Status.PENDING_PAYMENT,
            Order.Status.PAYMENT_SUBMITTED
        ]).count()
        pending_verifications = PaymentEvidence.objects.filter(
            verification_status=PaymentEvidence.VerificationStatus.PENDING
        ).count()

        total_users = User.objects.count()
        total_customers = User.objects.filter(role=User.Role.CUSTOMER).count()
        active_users = User.objects.filter(is_active=True).count()
        
        total_products = Product.objects.count()
        active_products = Product.objects.filter(is_active=True).count()
        low_stock_count = Product.objects.filter(stock__lte=5, stock__gt=0, is_active=True).count()
        out_of_stock_count = Product.objects.filter(stock=0, is_active=True).count()
        active_promotions_count = Promotion.objects.filter(
            is_active=True,
            start_date__lte=now,
            end_date__gte=now
        ).count()

        # Monthly Sales Series (Last 6 months) from verified paid orders
        six_months_ago = now - timedelta(days=180)
        monthly_data = (
            paid_orders.filter(created_at__gte=six_months_ago)
            .annotate(period=TruncMonth('created_at'))
            .values('period')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('period')
        )

        formatted_monthly = [
            {
                'period': item['period'].strftime('%b %Y') if item['period'] else 'Unknown',
                'month': item['period'].strftime('%b %Y') if item['period'] else 'Unknown',
                'revenue': float(item['revenue'] or 0.0),
                'orders': item['count']
            }
            for item in monthly_data
        ]

        # Yearly Sales Series (Last 5 years) from verified paid orders
        five_years_ago = now - timedelta(days=365 * 5)
        yearly_data = (
            paid_orders.filter(created_at__gte=five_years_ago)
            .annotate(period=TruncYear('created_at'))
            .values('period')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('period')
        )

        formatted_yearly = [
            {
                'period': item['period'].strftime('%Y') if item['period'] else 'Unknown',
                'month': item['period'].strftime('%Y') if item['period'] else 'Unknown',
                'revenue': float(item['revenue'] or 0.0),
                'orders': item['count']
            }
            for item in yearly_data
        ]

        # Active Sales Chart based on requested timeframe
        active_sales_series = formatted_yearly if timeframe == 'yearly' else formatted_monthly

        # Top Selling Products from verified orders
        top_selling = (
            OrderItem.objects.filter(order__in=paid_orders)
            .values('product_id', 'product__name', 'product__price')
            .annotate(units_sold=Sum('quantity'), total_sales=Sum('total_price'))
            .order_by('-units_sold')[:5]
        )

        # Category Distribution of live catalog items
        category_distribution = (
            Category.objects.annotate(
                product_count=Count('products', filter=Q(products__is_active=True))
            )
            .values('id', 'name', 'product_count')
            .order_by('-product_count')
        )

        # Real low-stock items for operational inventory alerts
        low_stock_items = list(
            Product.objects.filter(stock__lte=5, stock__gt=0, is_active=True)
            .values('id', 'name', 'stock', 'low_stock_threshold')[:6]
        )

        # Recent Orders (Latest 6)
        recent_orders = Order.objects.all().order_by('-created_at')[:6]

        # Pending Verifications Queue
        pending_evidence_orders = Order.objects.filter(
            status=Order.Status.PAYMENT_SUBMITTED
        ).order_by('-updated_at')[:6]

        return Response({
            'kpis': {
                'total_revenue': total_revenue,
                'total_orders': total_orders,
                'paid_orders_count': paid_orders_count,
                'pending_orders': pending_orders,
                'pending_verifications': pending_verifications,
                'total_users': total_users,
                'total_customers': total_customers,
                'active_users': active_users,
                'total_products': total_products,
                'active_products': active_products,
                'low_stock_count': low_stock_count,
                'out_of_stock_count': out_of_stock_count,
                'active_promotions': active_promotions_count,
            },
            'timeframe': timeframe,
            'sales_chart': active_sales_series,
            'monthly_sales': formatted_monthly,
            'yearly_sales': formatted_yearly,
            'low_stock_items': low_stock_items,
            'top_selling_products': list(top_selling),
            'category_distribution': list(category_distribution),
            'recent_orders': OrderSerializer(recent_orders, many=True).data,
            'pending_verifications_queue': OrderSerializer(pending_evidence_orders, many=True).data
        })


class ExportSalesReportView(APIView):
    permission_classes = [require_permission('reports.view')]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="sales_report_{datetime.now().strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Order Number', 'Date', 'Customer Username', 'Customer Email',
            'Status', 'Payment Status', 'Payment Method', 'Items Count', 'Subtotal', 'Tax', 'Shipping Fee', 'Total Amount'
        ])

        orders = Order.objects.all().order_by('-created_at')
        for order in orders:
            writer.writerow([
                order.order_number,
                order.created_at.strftime('%Y-%m-%d %H:%M'),
                order.customer.username,
                order.customer.email,
                order.get_status_display(),
                order.get_payment_status_display() if hasattr(order, 'get_payment_status_display') else order.payment_status,
                order.payment_method,
                order.items.count(),
                order.subtotal,
                order.tax,
                order.shipping_fee,
                order.total_amount
            ])

        return response


class ExportInventoryReportView(APIView):
    permission_classes = [require_permission('reports.view')]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="inventory_report_{datetime.now().strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'SKU', 'Product Name', 'Category', 'Price', 'Cost Price',
            'Stock Level', 'Stock Status', 'Total Valuation'
        ])

        products = Product.objects.all().order_by('category__name', 'name')
        for p in products:
            status_text = "Out of Stock" if p.stock == 0 else ("Low Stock" if p.is_low_stock else "In Stock")
            valuation = float(p.price) * p.stock
            writer.writerow([
                p.sku,
                p.name,
                p.category.name,
                p.price,
                p.cost_price,
                p.stock,
                status_text,
                f"{valuation:.2f}"
            ])

        return response


class OrderManagerStatsView(APIView):
    permission_classes = [require_permission('orders.view')]

    def get(self, request):
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(
            Q(fulfillment_status=Order.FulfillmentStatus.PENDING) |
            Q(status__in=[Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_SUBMITTED])
        ).count()
        confirmed_orders = Order.objects.filter(fulfillment_status=Order.FulfillmentStatus.CONFIRMED).count()
        processing_orders = Order.objects.filter(fulfillment_status=Order.FulfillmentStatus.PROCESSING).count()
        shipped_orders = Order.objects.filter(fulfillment_status=Order.FulfillmentStatus.SHIPPED).count()
        delivered_orders = Order.objects.filter(fulfillment_status=Order.FulfillmentStatus.DELIVERED).count()
        cancelled_orders = Order.objects.filter(fulfillment_status=Order.FulfillmentStatus.CANCELLED).count()

        # Recent 8 orders with related data
        recent = Order.objects.all().select_related('customer').prefetch_related('items__product', 'status_history').order_by('-created_at')[:8]

        # Verified Paid orders revenue
        paid_orders = Order.objects.filter(payment_status=Order.PaymentStatus.PAID)
        total_revenue = float(paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0.0)

        return Response({
            'kpis': {
                'total_orders': total_orders,
                'pending_orders': pending_orders,
                'confirmed_orders': confirmed_orders,
                'processing_orders': processing_orders,
                'shipped_orders': shipped_orders,
                'delivered_orders': delivered_orders,
                'cancelled_orders': cancelled_orders,
                'total_revenue': total_revenue,
            },
            'recent_orders': OrderSerializer(recent, many=True).data
        })

