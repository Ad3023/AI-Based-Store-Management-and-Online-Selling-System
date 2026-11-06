from django.core.management.base import BaseCommand
from django.db import transaction
from django.apps import apps
from accounts.models import User, AuditLog


class Command(BaseCommand):
    help = "Safely clean up old test transactions, orders, and dummy records while preserving store data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Inspect and print counts without executing deletions.',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Explicitly confirm execution of the database cleanup.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        confirm = options['confirm']

        Order = apps.get_model('orders', 'Order')
        OrderItem = apps.get_model('orders', 'OrderItem')
        PaymentEvidence = apps.get_model('orders', 'PaymentEvidence')
        Receipt = apps.get_model('orders', 'Receipt')
        OrderStatusHistory = apps.get_model('orders', 'OrderStatusHistory')
        Cart = apps.get_model('orders', 'Cart')

        Shipment = apps.get_model('delivery', 'Shipment')
        ShipmentTrackingEvent = apps.get_model('delivery', 'ShipmentTrackingEvent')
        DeliveryOTP = apps.get_model('delivery', 'DeliveryOTP')
        DeliveryAttempt = apps.get_model('delivery', 'DeliveryAttempt')

        PurchaseRequest = apps.get_model('products', 'PurchaseRequest')
        PurchaseOrderItem = apps.get_model('products', 'PurchaseOrderItem')
        SupplierInvoice = apps.get_model('products', 'SupplierInvoice')
        SupplierPayment = apps.get_model('products', 'SupplierPayment')
        StockMovement = apps.get_model('products', 'StockMovement')
        RFQ = apps.get_model('products', 'RequestForQuotation')
        RFQItem = apps.get_model('products', 'RFQItem')
        Quotation = apps.get_model('products', 'SupplierQuotation')
        QuotationItem = apps.get_model('products', 'SupplierQuotationItem')
        Supplier = apps.get_model('products', 'Supplier')

        CustomerActivity = apps.get_model('recommendations', 'CustomerActivity')
        Notification = apps.get_model('notifications', 'Notification')
        EmailVerificationToken = apps.get_model('accounts', 'EmailVerificationToken')
        PasswordResetToken = apps.get_model('accounts', 'PasswordResetToken')

        # Test users to clean (explicitly protecting the main admin and store manager)
        PRESERVED_EMAILS = {'addisuguche68@gmail.com', 'gucheaddisu10@gmail.com'}
        test_users_qs = User.objects.exclude(email__in=PRESERVED_EMAILS).filter(
            email__in=[
                'abebe.customer@gmail.com', 'bahirdar.recipient@example.com', 'chala.customer@gmail.com',
                'admin.delivery@ethiotech.com', 'mgr.delivery@ethiotech.com', 'store.dock.manager@ethiotechmarket.com',
                'order.logistics.mgr@ethiotechmarket.com', 'w22222222e@gmail.com', 'kassahun.driver@gmail.com',
                'lenovo.supp.test@gmail.com', 'dell.supp.test@gmail.com'
            ]
        )

        test_suppliers_qs = Supplier.objects.filter(
            email__in=['lenovo.supp.test@gmail.com', 'dell.supp.test@gmail.com']
        )

        records_to_clean = {
            'Orders': Order.objects.count(),
            'Order Items': OrderItem.objects.count(),
            'Payment Evidence': PaymentEvidence.objects.count(),
            'Receipts': Receipt.objects.count(),
            'Order Status History': OrderStatusHistory.objects.count(),
            'Carts': Cart.objects.count(),
            'Shipments': Shipment.objects.count(),
            'Shipment Tracking Events': ShipmentTrackingEvent.objects.count(),
            'Delivery OTPs': DeliveryOTP.objects.count(),
            'Delivery Attempts': DeliveryAttempt.objects.count(),
            'Purchase Orders (POs)': PurchaseRequest.objects.count(),
            'Purchase Order Items': PurchaseOrderItem.objects.count(),
            'Supplier Invoices': SupplierInvoice.objects.count(),
            'Supplier Payments': SupplierPayment.objects.count(),
            'Stock Movements (Test Logs)': StockMovement.objects.count(),
            'RFQs': RFQ.objects.count(),
            'RFQ Items': RFQItem.objects.count(),
            'Supplier Quotations': Quotation.objects.count(),
            'Quotation Items': QuotationItem.objects.count(),
            'Customer Activities': CustomerActivity.objects.count(),
            'Notifications': Notification.objects.count(),
            'Verification Tokens': EmailVerificationToken.objects.count(),
            'Reset Tokens': PasswordResetToken.objects.count(),
            'Test User Accounts': test_users_qs.count(),
            'Test Supplier Organizations': test_suppliers_qs.count(),
        }

        self.stdout.write(self.style.MIGRATE_HEADING("=== TRANSACTION & TEST DATA CLEANUP MANIFEST ==="))
        for label, count in records_to_clean.items():
            self.stdout.write(f"  - {label:<32}: {count} records scheduled for deletion")

        Product = apps.get_model('products', 'Product')
        Category = apps.get_model('products', 'Category')
        self.stdout.write(self.style.SUCCESS("\n=== PRESERVED BUSINESS ASSETS ==="))
        self.stdout.write(f"  + Main Admin (addisuguche68@gmail.com): PRESERVED")
        self.stdout.write(f"  + Store Manager (gucheaddisu10@gmail.com): PRESERVED")
        self.stdout.write(f"  + Products: {Product.objects.count()} preserved with exact prices and stocks")
        self.stdout.write(f"  + Categories: {Category.objects.count()} preserved")
        self.stdout.write(f"  + Genuine Suppliers: {Supplier.objects.exclude(id__in=test_suppliers_qs.values_list('id', flat=True)).count()} preserved")

        if dry_run or not confirm:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] No database changes applied. Use --confirm to execute cleanup."))
            return

        # Execute inside atomic transaction
        with transaction.atomic():
            self.stdout.write(self.style.NOTICE("\nExecuting safe transactional cleanup..."))
            
            # 1. Unlink FKs before deletion
            SupplierPayment.objects.all().update(invoice=None, purchase_order=None)
            SupplierInvoice.objects.all().update(purchase_order=None)
            Quotation.objects.all().update(purchase_order=None)

            # 2. Delete deliveries and order dependencies
            DeliveryAttempt.objects.all().delete()
            DeliveryOTP.objects.all().delete()
            ShipmentTrackingEvent.objects.all().delete()
            Shipment.objects.all().delete()

            PaymentEvidence.objects.all().delete()
            Receipt.objects.all().delete()
            OrderStatusHistory.objects.all().delete()
            OrderItem.objects.all().delete()
            Cart.objects.all().delete()
            Order.objects.all().delete()

            # 3. Delete procurement transactions
            SupplierPayment.objects.all().delete()
            SupplierInvoice.objects.all().delete()
            PurchaseOrderItem.objects.all().delete()
            PurchaseRequest.objects.all().delete()
            StockMovement.objects.all().delete()

            QuotationItem.objects.all().delete()
            Quotation.objects.all().delete()
            RFQItem.objects.all().delete()
            RFQ.objects.all().delete()

            # 4. Delete activities, notifications, tokens
            CustomerActivity.objects.all().delete()
            Notification.objects.all().delete()
            EmailVerificationToken.objects.all().delete()
            PasswordResetToken.objects.all().delete()

            # 5. Delete test suppliers and test users
            test_suppliers_qs.delete()
            test_users_qs.delete()

            # 6. Audit log entry
            main_admin = User.objects.filter(email='addisuguche68@gmail.com').first()
            AuditLog.objects.create(
                user=main_admin,
                action="DATABASE_CLEANUP",
                details="Removed test orders, deliveries, procurement transactions, and sample users while preserving store catalog and main admin/manager accounts."
            )

        self.stdout.write(self.style.SUCCESS("Cleanup completed successfully within atomic transaction!"))

