import csv
from datetime import datetime, timedelta
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from accounts.models import User
from products.models import Product, Category
from orders.models import Order, OrderItem, PaymentEvidence
from accounts.permissions import IsStoreManagerOrAdmin
from orders.serializers import OrderSerializer
from products.serializers import ProductSerializer


class DashboardAnalyticsView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        now = timezone.now()

        # Core Metrics
        completed_orders = Order.objects.exclude(status=Order.Status.CANCELLED)
        total_revenue = float(completed_orders.aggregate(total=Sum('total_amount'))['total'] or 0.0)
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(status__in=[
            Order.Status.PENDING_PAYMENT,
            Order.Status.PAYMENT_SUBMITTED
        ]).count()
        pending_verifications = PaymentEvidence.objects.filter(
            verification_status=PaymentEvidence.VerificationStatus.PENDING
        ).count()

        total_customers = User.objects.filter(role=User.Role.CUSTOMER).count()
        total_products = Product.objects.count()
        low_stock_count = Product.objects.filter(stock__lte=5, stock__gt=0).count()
        out_of_stock_count = Product.objects.filter(stock=0).count()

        # Monthly Sales (Last 6 months)
        six_months_ago = now - timedelta(days=180)
        monthly_data = (
            completed_orders.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('month')
        )

        formatted_monthly = [
            {
                'month': item['month'].strftime('%b %Y') if item['month'] else 'Unknown',
                'revenue': float(item['revenue'] or 0.0),
                'orders': item['count']
            }
            for item in monthly_data
        ]

        # Top Selling Products
        top_selling = (
            OrderItem.objects.values('product_id', 'product__name', 'product__price')
            .annotate(units_sold=Sum('quantity'), total_sales=Sum('total_price'))
            .order_by('-units_sold')[:5]
        )

        # Category Distribution
        category_distribution = (
            Category.objects.annotate(product_count=Count('products'))
            .values('id', 'name', 'product_count')
            .order_by('-product_count')
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
                'pending_orders': pending_orders,
                'pending_verifications': pending_verifications,
                'total_customers': total_customers,
                'total_products': total_products,
                'low_stock_count': low_stock_count,
                'out_of_stock_count': out_of_stock_count,
            },
            'monthly_sales': formatted_monthly,
            'top_selling_products': list(top_selling),
            'category_distribution': list(category_distribution),
            'recent_orders': OrderSerializer(recent_orders, many=True).data,
            'pending_verifications_queue': OrderSerializer(pending_evidence_orders, many=True).data
        })


class ExportSalesReportView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="sales_report_{datetime.now().strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Order Number', 'Date', 'Customer Username', 'Customer Email',
            'Status', 'Items Count', 'Subtotal', 'Tax', 'Shipping Fee', 'Total Amount'
        ])

        orders = Order.objects.all().order_by('-created_at')
        for order in orders:
            writer.writerow([
                order.order_number,
                order.created_at.strftime('%Y-%m-%d %H:%M'),
                order.customer.username,
                order.customer.email,
                order.get_status_display(),
                order.items.count(),
                order.subtotal,
                order.tax,
                order.shipping_fee,
                order.total_amount
            ])

        return response


class ExportInventoryReportView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

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
