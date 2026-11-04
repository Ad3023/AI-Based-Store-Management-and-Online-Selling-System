import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model
from notifications.models import Notification
from .models import Product, Supplier, SupplierNotificationLog, StockAlertHistory

logger = logging.getLogger(__name__)


class LowStockAlertService:
    @staticmethod
    def get_alert_recipients():
        """
        Retrieves active Admin and Store Manager users for stock notifications.
        Admin: superusers and users with role in [super_admin, admin]
        Store Manager: users with role in [store_manager]
        If no dedicated store manager exists, admin users are also included.
        """
        User = get_user_model()
        admins = list(User.objects.filter(
            Q(role__in=[User.RoleChoices.SUPER_ADMIN, User.RoleChoices.ADMIN]) | Q(is_superuser=True),
            is_active=True
        ).distinct())

        managers = list(User.objects.filter(
            role=User.RoleChoices.STORE_MANAGER,
            is_active=True
        ).distinct())

        if not managers:
            managers = list(admins)

        return admins, managers

    @staticmethod
    def send_in_system_notification(
        user,
        title: str,
        message: str,
        notification_type: str,
        product: Product,
        current_stock: int,
        min_level: int,
        reorder_qty: int,
        supplier_email_status: str = '',
        link: str = None
    ):
        """
        Safely creates an in-system notification for a specific user.
        """
        try:
            return Notification.objects.create(
                user=user,
                title=title,
                message=message,
                notification_type=notification_type,
                product=product,
                product_name=product.name,
                current_stock=current_stock,
                min_stock_level=min_level,
                suggested_reorder_qty=reorder_qty,
                supplier_email_status=supplier_email_status,
                link=link or f"/manager/inventory?product_id={product.id}"
            )
        except Exception as e:
            logger.error(f"Failed to create in-system notification for {user.username}: {e}")
            return None

    @classmethod
    def evaluate_and_notify_product(
        cls,
        product: Product,
        trigger_type='AUTOMATIC',
        requested_by=None,
        force_resend=False
    ) -> dict:
        """
        Evaluates a single product's stock against its minimum stock level (low_stock_threshold).
        If low stock is detected:
          1. Generates in-system notifications for both Admin and Store Manager.
          2. Generates OUT OF STOCK notification if stock == 0.
          3. Checks duplicate prevention: sends 1 notification per low-stock cycle unless force_resend=True.
          4. Verifies supplier email and sends professional reorder inquiry email.
          5. Records notification logs and stock alert history.
          6. Notifies Admin and Store Manager about the email result.
        """
        min_level = product.low_stock_threshold
        current_stock = product.stock
        reorder_qty = getattr(product, 'reorder_quantity', 20) or 20
        now = timezone.now()

        # ---------------------------------------------------------------------
        # 1. Healthy Stock Check (Replenishment Reset)
        # ---------------------------------------------------------------------
        if current_stock > min_level:
            was_low = product.low_stock_notified or product.out_of_stock_notified
            if was_low:
                product.low_stock_notified = False
                product.out_of_stock_notified = False
                product.save(update_fields=['low_stock_notified', 'out_of_stock_notified'])

                # Record Replenishment Event in history
                StockAlertHistory.objects.create(
                    product=product,
                    alert_type=StockAlertHistory.AlertType.REPLENISHED,
                    current_stock=current_stock,
                    min_stock_level=min_level,
                    reorder_quantity=reorder_qty,
                    supplier=product.supplier,
                    supplier_email=product.supplier.email if product.supplier else '',
                    email_status='REPLENISHED',
                    details=f"Stock replenished to {current_stock} units (above minimum level {min_level}). Alert condition reset.",
                    triggered_by=requested_by
                )

            return {
                'alert_needed': False,
                'status': 'HEALTHY',
                'current_stock': current_stock,
                'min_stock_level': min_level,
                'message': f"Stock ({current_stock}) is above minimum level ({min_level})."
            }

        # ---------------------------------------------------------------------
        # 2. Duplicate Prevention Check
        # ---------------------------------------------------------------------
        if product.low_stock_notified and not force_resend:
            # If stock recently reached zero and out_of_stock_notified is not yet sent, allow sending zero alert
            if current_stock == 0 and not product.out_of_stock_notified:
                pass  # Proceed to out-of-stock notification
            else:
                return {
                    'alert_needed': False,
                    'status': 'ALREADY_NOTIFIED',
                    'current_stock': current_stock,
                    'min_stock_level': min_level,
                    'last_notification': product.last_low_stock_notification.isoformat() if product.last_low_stock_notification else None,
                    'message': "Supplier was already notified for this low-stock cycle. Use manual resend to send again."
                }

        admins, managers = cls.get_alert_recipients()

        # ---------------------------------------------------------------------
        # 3. Out-of-Stock Alert Generation (when stock == 0)
        # ---------------------------------------------------------------------
        is_zero_stock = (current_stock == 0)
        if is_zero_stock and (not product.out_of_stock_notified or force_resend):
            zero_title = f"OUT OF STOCK: {product.name}"
            zero_message = f"OUT OF STOCK: {product.name} is currently unavailable. Please arrange replenishment."
            
            # Send in-system notification to all admins
            for adm in admins:
                cls.send_in_system_notification(
                    user=adm,
                    title=zero_title,
                    message=zero_message,
                    notification_type=Notification.NotificationType.OUT_OF_STOCK,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty
                )
            
            # Send in-system notification to all store managers
            for mgr in managers:
                if mgr.id not in [a.id for a in admins]:
                    cls.send_in_system_notification(
                        user=mgr,
                        title=zero_title,
                        message=zero_message,
                        notification_type=Notification.NotificationType.OUT_OF_STOCK,
                        product=product,
                        current_stock=current_stock,
                        min_level=min_level,
                        reorder_qty=reorder_qty
                    )

            product.out_of_stock_notified = True
            StockAlertHistory.objects.create(
                product=product,
                alert_type=StockAlertHistory.AlertType.OUT_OF_STOCK,
                current_stock=0,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                supplier=product.supplier,
                supplier_email=product.supplier.email if product.supplier else '',
                details=f"Product {product.name} is completely out of stock (0 units). Replenishment required.",
                triggered_by=requested_by
            )

        # ---------------------------------------------------------------------
        # 4. Low-Stock In-System Notifications for Admin and Store Manager
        # ---------------------------------------------------------------------
        if not product.low_stock_notified or force_resend:
            admin_title = f"LOW STOCK ALERT: {product.name}"
            admin_msg = f"LOW STOCK ALERT: {product.name} has only {current_stock} units remaining. The minimum stock level is {min_level} units. Please monitor the replenishment process."

            manager_title = f"REORDER REQUIRED: {product.name}"
            manager_msg = f"REORDER REQUIRED: {product.name} stock is below the minimum level. Current quantity: {current_stock} units. Suggested reorder quantity: {reorder_qty} units."

            for adm in admins:
                cls.send_in_system_notification(
                    user=adm,
                    title=admin_title,
                    message=admin_msg,
                    notification_type=Notification.NotificationType.LOW_STOCK,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty
                )

            for mgr in managers:
                # If store manager is also admin, provide the manager actionable notice
                cls.send_in_system_notification(
                    user=mgr,
                    title=manager_title,
                    message=manager_msg,
                    notification_type=Notification.NotificationType.LOW_STOCK,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty
                )

            StockAlertHistory.objects.create(
                product=product,
                alert_type=StockAlertHistory.AlertType.LOW_STOCK if trigger_type != 'MANUAL_RESEND' else StockAlertHistory.AlertType.MANUAL_RESEND,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                supplier=product.supplier,
                supplier_email=product.supplier.email if product.supplier else '',
                details=f"Stock reached {current_stock} units (<= threshold {min_level}). Alert dispatched to Admin and Store Manager.",
                triggered_by=requested_by
            )

        # ---------------------------------------------------------------------
        # 5. Retrieve Registered Supplier & Validate Email
        # ---------------------------------------------------------------------
        supplier = product.supplier
        supplier_name = supplier.name if supplier else 'No Supplier Assigned'
        supplier_email = (supplier.email or '').strip() if supplier else ''
        has_valid_email = bool(supplier and supplier_email and '@' in supplier_email)

        # ---------------------------------------------------------------------
        # 6. Handle Missing Supplier or Missing Email
        # ---------------------------------------------------------------------
        if not has_valid_email:
            if not supplier:
                err_msg = "Product has no supplier assigned. Please assign a supplier in Hardware Suppliers."
            else:
                err_msg = f"Supplier '{supplier.name}' has no valid email registered in Hardware Suppliers."

            log = SupplierNotificationLog.objects.create(
                product=product,
                supplier=supplier,
                supplier_name=supplier_name,
                supplier_email=supplier_email,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                status=SupplierNotificationLog.Status.FAILED,
                trigger_type=trigger_type,
                subject=f"Low Stock Alert – Reorder Inquiry for {product.name}",
                error_message=err_msg,
                sent_by=requested_by
            )

            # In-system notification to Store Manager and Admin that contact info is missing
            missing_title = f"SUPPLIER CONTACT MISSING: {product.name}"
            missing_msg = f"Supplier contact information is missing for {product.name}. Please assign a supplier with a registered email address to arrange replenishment."

            for mgr in managers:
                cls.send_in_system_notification(
                    user=mgr,
                    title=missing_title,
                    message=missing_msg,
                    notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty,
                    supplier_email_status='FAILED',
                    link="/manager/suppliers"
                )

            for adm in admins:
                if adm.id not in [m.id for m in managers]:
                    cls.send_in_system_notification(
                        user=adm,
                        title=missing_title,
                        message=missing_msg,
                        notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED,
                        product=product,
                        current_stock=current_stock,
                        min_level=min_level,
                        reorder_qty=reorder_qty,
                        supplier_email_status='FAILED',
                        link="/admin/suppliers"
                    )

            product.low_stock_notified = True
            product.save(update_fields=['low_stock_notified', 'out_of_stock_notified'])

            logger.warning(f"Low stock supplier email skipped for '{product.name}': {err_msg}")
            return {
                'success': False,
                'missing_supplier': True,
                'status': 'FAILED',
                'error': err_msg,
                'log_id': log.id,
                'product_id': product.id,
                'product_name': product.name,
                'current_stock': current_stock,
                'min_stock_level': min_level
            }

        # ---------------------------------------------------------------------
        # 7. Generate Professional Reorder Inquiry Email
        # ---------------------------------------------------------------------
        subject = f"Low Stock Alert – Reorder Inquiry for {product.name}"
        sku_code = product.sku or f"SKU-{product.id}"

        # Standard plain text message matching Requirement Section 4
        plain_body = f"""Subject: Low Stock Alert – Reorder Inquiry for {product.name}

Dear {supplier.name},

We would like to inform you that the stock level of the following product in our store has reached its minimum stock level.

Product: {product.name}
Product Code: {sku_code}
Current Stock: {current_stock} units
Minimum Stock Level: {min_level} units
Suggested Reorder Quantity: {reorder_qty} units

Please confirm:
- Product availability
- Current unit price
- Available quantity
- Expected delivery time

Thank you.

Best regards,
Store Management Team
EthioTech Market
"""

        # Branded, modern HTML email
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #0b1a2d; padding: 24px 32px; border-bottom: 2px solid #1e293b;">
                            <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                                EthioTech <span style="color: #38bdf8;">Market</span>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
                                Hardware Store Procurement &bull; Ethiopia
                            </div>
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px; color: #1e293b; font-size: 14px; line-height: 1.6;">
                            <div style="display: inline-block; padding: 4px 12px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                                Low Stock Reorder Inquiry
                            </div>
                            <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 700; color: #0f172a;">
                                Reorder Inquiry for {product.name}
                            </h2>
                            <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px;">
                                Dear <strong>{supplier.name}</strong>,
                            </p>
                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px;">
                                We would like to inform you that the stock level of the following product in our store has reached its minimum stock level.
                            </p>

                            <!-- Product Stock Specs Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 12px 16px; color: #64748b; font-weight: 600; width: 40%;">Product</td>
                                    <td style="padding: 12px 16px; color: #0f172a; font-weight: 700;">{product.name}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Product Code (SKU)</td>
                                    <td style="padding: 12px 16px; color: #0f172a; font-weight: 600;"><code>{sku_code}</code></td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Current Stock</td>
                                    <td style="padding: 12px 16px; color: #dc2626; font-weight: 700;">{current_stock} units</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Minimum Stock Level</td>
                                    <td style="padding: 12px 16px; color: #475569; font-weight: 600;">{min_level} units</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Suggested Reorder Quantity</td>
                                    <td style="padding: 12px 16px; color: #0284c7; font-weight: 700;">{reorder_qty} units</td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
                                Please confirm:
                            </p>
                            <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 13px;">
                                <li>Product availability</li>
                                <li>Current unit price</li>
                                <li>Available quantity</li>
                                <li>Expected delivery time</li>
                            </ul>

                            <p style="margin: 0 0 24px 0; color: #475569; font-size: 13px;">
                                <em>Please note: This email is only a reorder inquiry. It does not automatically create a confirmed purchase or make a payment.</em>
                            </p>
                            <p style="margin: 0 0 4px 0; color: #334155; font-size: 13px;">Thank you for your cooperation.</p>
                            <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 700;">
                                Best regards,<br>
                                <span style="color: #64748b; font-weight: 500;">Store Management Team</span><br>
                                <span style="color: #0284c7; font-size: 12px;">EthioTech Market E-Commerce</span>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                            <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">EthioTech Market Store Management</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 11px;">Debre Birhan, Amhara, Ethiopia &bull; Hardware Procurement Division</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        # ---------------------------------------------------------------------
        # 8. Send Email using Django Mail Configuration
        # ---------------------------------------------------------------------
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Ethio Tech Market <noreply@ethiotechmarket.com>')

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_body,
                from_email=from_email,
                to=[supplier_email]
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)

            # Record successful notification log
            log = SupplierNotificationLog.objects.create(
                product=product,
                supplier=supplier,
                supplier_name=supplier.name,
                supplier_email=supplier_email,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                status=SupplierNotificationLog.Status.SENT,
                trigger_type=trigger_type,
                subject=subject,
                sent_by=requested_by
            )

            # Record in StockAlertHistory
            StockAlertHistory.objects.create(
                product=product,
                alert_type=StockAlertHistory.AlertType.SUPPLIER_EMAIL,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                supplier=supplier,
                supplier_email=supplier_email,
                email_status='SENT',
                email_sent_at=now,
                details=f"Reorder inquiry email successfully transmitted to {supplier.name} ({supplier_email}).",
                triggered_by=requested_by
            )

            # Notify Admin and Store Manager about successful email result
            email_success_title = f"SUPPLIER EMAIL SENT: {product.name}"
            email_success_msg = f"Reorder inquiry email successfully sent to {supplier.name} ({supplier_email}) for {product.name}."

            for adm in admins:
                cls.send_in_system_notification(
                    user=adm,
                    title=email_success_title,
                    message=email_success_msg,
                    notification_type=Notification.NotificationType.SUPPLIER_EMAIL_SENT,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty,
                    supplier_email_status='SENT'
                )

            for mgr in managers:
                if mgr.id not in [a.id for a in admins]:
                    cls.send_in_system_notification(
                        user=mgr,
                        title=email_success_title,
                        message=email_success_msg,
                        notification_type=Notification.NotificationType.SUPPLIER_EMAIL_SENT,
                        product=product,
                        current_stock=current_stock,
                        min_level=min_level,
                        reorder_qty=reorder_qty,
                        supplier_email_status='SENT'
                    )

            # Update product notification flags
            product.low_stock_notified = True
            product.last_low_stock_notification = now
            product.save(update_fields=['low_stock_notified', 'out_of_stock_notified', 'last_low_stock_notification'])

            logger.info(f"Low stock reorder email successfully sent to {supplier_email} for '{product.name}'.")
            return {
                'success': True,
                'status': 'SENT',
                'message': f"Reorder email successfully sent to {supplier.name} ({supplier_email}).",
                'log_id': log.id,
                'recipient': supplier_email,
                'supplier_name': supplier.name,
                'current_stock': current_stock,
                'min_stock_level': min_level,
                'reorder_quantity': reorder_qty,
                'sent_at': now.isoformat()
            }

        except Exception as exc:
            err_text = str(exc)
            logger.error(f"Failed sending low stock alert to {supplier_email} for '{product.name}': {err_text}")

            # Record failed notification log
            log = SupplierNotificationLog.objects.create(
                product=product,
                supplier=supplier,
                supplier_name=supplier.name,
                supplier_email=supplier_email,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                status=SupplierNotificationLog.Status.FAILED,
                trigger_type=trigger_type,
                subject=subject,
                error_message=err_text,
                sent_by=requested_by
            )

            # Record in StockAlertHistory
            StockAlertHistory.objects.create(
                product=product,
                alert_type=StockAlertHistory.AlertType.SUPPLIER_EMAIL,
                current_stock=current_stock,
                min_stock_level=min_level,
                reorder_quantity=reorder_qty,
                supplier=supplier,
                supplier_email=supplier_email,
                email_status='FAILED',
                email_sent_at=now,
                details=f"Email transmission to supplier failed: {err_text}",
                triggered_by=requested_by
            )

            # Notify Admin and Store Manager about email failure
            fail_title = f"SUPPLIER EMAIL FAILED: {product.name}"
            fail_msg = f"Failed to send reorder inquiry email to supplier {supplier.name} for {product.name}: {err_text}"

            for adm in admins:
                cls.send_in_system_notification(
                    user=adm,
                    title=fail_title,
                    message=fail_msg,
                    notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED,
                    product=product,
                    current_stock=current_stock,
                    min_level=min_level,
                    reorder_qty=reorder_qty,
                    supplier_email_status='FAILED'
                )

            for mgr in managers:
                if mgr.id not in [a.id for a in admins]:
                    cls.send_in_system_notification(
                        user=mgr,
                        title=fail_title,
                        message=fail_msg,
                        notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED,
                        product=product,
                        current_stock=current_stock,
                        min_level=min_level,
                        reorder_qty=reorder_qty,
                        supplier_email_status='FAILED'
                    )

            product.low_stock_notified = True
            product.save(update_fields=['low_stock_notified', 'out_of_stock_notified'])

            return {
                'success': False,
                'status': 'FAILED',
                'error': f"Email transmission failed: {err_text}",
                'log_id': log.id,
                'recipient': supplier_email,
                'supplier_name': supplier.name
            }

    @classmethod
    def check_and_alert_all_low_stock_products(cls, trigger_type='AUTOMATIC') -> list:
        """
        Scans all active products in the store and triggers low stock alerts
        for any products currently meeting low stock condition that haven't been notified yet.
        """
        from django.db.models import F
        low_stock_products = Product.objects.filter(
            is_active=True,
            stock__lte=F('low_stock_threshold'),
            low_stock_notified=False
        ).select_related('supplier')

        results = []
        for p in low_stock_products:
            res = cls.evaluate_and_notify_product(p, trigger_type=trigger_type)
            results.append({
                'product_id': p.id,
                'product_name': p.name,
                'result': res
            })
        return results
