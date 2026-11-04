import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.contrib.auth import get_user_model
from django.apps import apps
from django.contrib.sessions.models import Session
from rest_framework.authtoken.models import Token

User = get_user_model()
MAIN_ADMIN_USERNAME = 'addisuguche_admin'
MAIN_ADMIN_EMAIL = 'addisuguche68@gmail.com'

def get_stats():
    admin = User.objects.filter(username=MAIN_ADMIN_USERNAME).first()
    
    from notifications.models import Notification, NewsletterSubscriber, PromotionalCampaign, CampaignDeliveryLog
    from recommendations.models import CustomerActivity, CustomerSegment
    from delivery.models import (
        DeliveryComplaint, DeliveryAttempt, DeliveryOTP,
        ShipmentTrackingEvent, Shipment, DeliveryPersonnel,
        DeliveryVehicle, CourierCompany, DeliveryFeeRule, DeliverySetting
    )
    from orders.models import (
        Receipt, PaymentEvidence, WarrantyClaim, OrderStatusHistory,
        OrderItem, Order, CartItem, Cart
    )
    from products.models import (
        StockAlertHistory, SupplierNotificationLog, PurchaseRequest,
        StockMovement, ProductReview, CustomerFeedback, Product,
        Promotion, Supplier, Category, WarrantyPolicy
    )
    from accounts.models import (
        CustomerProfile, EmailVerificationToken, PasswordResetToken,
        AuditLog, Role, Permission
    )

    stats = {
        'users_total': User.objects.count(),
        'users_other': User.objects.exclude(id=admin.id).count() if admin else 0,
        'orders': Order.objects.count(),
        'order_items': OrderItem.objects.count(),
        'order_status_history': OrderStatusHistory.objects.count(),
        'carts': Cart.objects.count(),
        'cart_items': CartItem.objects.count(),
        'receipts': Receipt.objects.count(),
        'payment_evidences': PaymentEvidence.objects.count(),
        'warranty_claims': WarrantyClaim.objects.count(),
        'products': Product.objects.count(),
        'categories': Category.objects.count(),
        'suppliers': Supplier.objects.count(),
        'stock_movements': StockMovement.objects.count(),
        'stock_alerts': StockAlertHistory.objects.count(),
        'supplier_notifs': SupplierNotificationLog.objects.count(),
        'purchase_requests': PurchaseRequest.objects.count(),
        'promotions': Promotion.objects.count(),
        'reviews': ProductReview.objects.count(),
        'feedback': CustomerFeedback.objects.count(),
        'warranty_policies': WarrantyPolicy.objects.count(),
        'shipments': Shipment.objects.count(),
        'tracking_events': ShipmentTrackingEvent.objects.count(),
        'delivery_otps': DeliveryOTP.objects.count(),
        'delivery_attempts': DeliveryAttempt.objects.count(),
        'delivery_complaints': DeliveryComplaint.objects.count(),
        'delivery_personnel': DeliveryPersonnel.objects.count(),
        'delivery_vehicles': DeliveryVehicle.objects.count(),
        'courier_companies': CourierCompany.objects.count(),
        'notifications': Notification.objects.count(),
        'newsletter_subscribers': NewsletterSubscriber.objects.count(),
        'campaigns': PromotionalCampaign.objects.count(),
        'customer_activities': CustomerActivity.objects.count(),
        'customer_profiles': CustomerProfile.objects.count(),
        'email_tokens': EmailVerificationToken.objects.count(),
        'password_tokens': PasswordResetToken.objects.count(),
        'audit_logs': AuditLog.objects.count(),
        'sessions': Session.objects.count(),
        # Preserved System Configuration
        'roles': Role.objects.count(),
        'permissions': Permission.objects.count(),
        'delivery_settings': DeliverySetting.objects.count(),
        'delivery_fee_rules': DeliveryFeeRule.objects.count(),
    }
    return admin, stats

def execute_cleanup():
    admin = User.objects.filter(username=MAIN_ADMIN_USERNAME).first()
    if not admin:
        raise ValueError(f"CRITICAL ERROR: Main admin '{MAIN_ADMIN_USERNAME}' not found!")

    print(f"Executing database cleanup. Retaining ONLY main admin: {admin.username} (ID: {admin.id}, {admin.email})...")

    with transaction.atomic():
        # 1. Notifications & Marketing
        from notifications.models import Notification, NewsletterSubscriber, PromotionalCampaign, CampaignDeliveryLog
        CampaignDeliveryLog.objects.all().delete()
        PromotionalCampaign.objects.all().delete()
        NewsletterSubscriber.objects.all().delete()
        Notification.objects.all().delete()

        # 2. Recommendations & Customer Activity
        from recommendations.models import CustomerActivity, CustomerSegment
        CustomerActivity.objects.all().delete()
        CustomerSegment.objects.all().delete()

        # 3. Delivery & Logistics
        from delivery.models import (
            DeliveryComplaint, DeliveryAttempt, DeliveryOTP,
            ShipmentTrackingEvent, Shipment, DeliveryPersonnel,
            DeliveryVehicle, CourierCompany
        )
        DeliveryComplaint.objects.all().delete()
        DeliveryAttempt.objects.all().delete()
        DeliveryOTP.objects.all().delete()
        ShipmentTrackingEvent.objects.all().delete()
        Shipment.objects.all().delete()
        DeliveryPersonnel.objects.all().delete()
        DeliveryVehicle.objects.all().delete()
        CourierCompany.objects.all().delete()

        # 4. Orders & Commerce (OrderItem must be deleted before Product due to PROTECT)
        from orders.models import (
            Receipt, PaymentEvidence, WarrantyClaim, OrderStatusHistory,
            OrderItem, Order, CartItem, Cart
        )
        OrderStatusHistory.objects.all().delete()
        WarrantyClaim.objects.all().delete()
        Receipt.objects.all().delete()
        PaymentEvidence.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        CartItem.objects.all().delete()
        Cart.objects.all().delete()

        # 5. Products & Inventory
        from products.models import (
            StockAlertHistory, SupplierNotificationLog, PurchaseRequest,
            StockMovement, ProductReview, CustomerFeedback, Product,
            Promotion, Supplier, Category, WarrantyPolicy
        )
        StockAlertHistory.objects.all().delete()
        SupplierNotificationLog.objects.all().delete()
        PurchaseRequest.objects.all().delete()
        StockMovement.objects.all().delete()
        ProductReview.objects.all().delete()
        CustomerFeedback.objects.all().delete()
        Product.objects.all().delete()
        Promotion.objects.all().delete()
        Supplier.objects.all().delete()
        Category.objects.all().delete()
        WarrantyPolicy.objects.all().delete()

        # 6. Accounts, Profiles, Tokens, Sessions & Other Users
        from accounts.models import (
            CustomerProfile, EmailVerificationToken, PasswordResetToken,
            AuditLog
        )
        CustomerProfile.objects.all().delete()
        EmailVerificationToken.objects.all().delete()
        PasswordResetToken.objects.all().delete()
        AuditLog.objects.all().delete()
        Session.objects.all().delete()

        # Delete auth tokens for non-admin users
        Token.objects.exclude(user=admin).delete()

        # Delete all users EXCEPT main admin
        deleted_users_count, _ = User.objects.exclude(id=admin.id).delete()
        print(f"Successfully deleted {deleted_users_count} other user accounts and related records.")

        # Ensure main admin remains intact and active
        admin.refresh_from_db()
        admin.is_active = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()

    print("Database cleanup transaction committed successfully!")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--execute':
        execute_cleanup()
        admin, stats = get_stats()
        print("\n=== POST-CLEANUP VERIFICATION STATS ===")
        for k, v in stats.items():
            print(f"  {k}: {v}")
    else:
        admin, stats = get_stats()
        print("=== CURRENT DATABASE STATS (PRE-CLEANUP) ===")
        print(f"Confirmed Main Admin: {admin.username} ({admin.email}) | ID: {admin.id}")
        for k, v in stats.items():
            print(f"  {k}: {v}")
