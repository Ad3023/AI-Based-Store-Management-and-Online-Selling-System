import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def _send_mail_async(subject, text_content, html_content, to_emails, from_email=None):
    """
    Sends an email asynchronously in a background thread so API responses return immediately.
    """
    def _target():
        try:
            host_user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
            sender = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            if not sender or 'noreply@ethiotechmarket.com' in sender:
                if host_user:
                    sender = f"EthioTech Market <{host_user}>"
                else:
                    sender = 'EthioTech Market <noreply@ethiotechmarket.com>'

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=sender,
                to=to_emails
            )
            if html_content:
                msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            logger.info(f"Email successfully sent to {to_emails} [Subject: {subject}]")
        except Exception as err:
            logger.error(f"Failed to send email to {to_emails}: {type(err).__name__}")

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()


def get_base_email_template(title, body_content, cta_url=None, cta_text=None, footer_note=None):
    """
    Generates a high-quality, responsive HTML email template with EthioTech Market branding.
    """
    cta_html = ""
    if cta_url and cta_text:
        cta_html = f"""
        <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
            <tr>
                <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #1b64da 0%, #0d9488 100%);">
                    <a href="{cta_url}" target="_blank" style="font-size: 14px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 8px; padding: 12px 28px; display: inline-block;">
                        {cta_text} &rarr;
                    </a>
                </td>
            </tr>
        </table>
        """

    footer_extra = f"<p style='margin: 8px 0; font-size: 11px; color: #94a3b8;'>{footer_note}</p>" if footer_note else ""

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 30px 15px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                        <!-- Header -->
                        <tr>
                            <td style="background-color: #0b1a2d; padding: 26px 32px; border-bottom: 2px solid #1e293b;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td>
                                            <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                                                EthioTech <span style="color: #38bdf8;">Market</span>
                                            </div>
                                            <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
                                                Better Tech. Brighter Future. &bull; Ethiopia
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 32px 32px 24px 32px; color: #1e293b; font-size: 14px; line-height: 1.6;">
                                <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 700; color: #0f172a;">{title}</h2>
                                {body_content}
                                {cta_html}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                                <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">EthioTech Market E-Commerce Platform</p>
                                <p style="margin: 0; color: #94a3b8; font-size: 11px;">Debre Birhan, Amhara, Ethiopia &bull; All prices in ETB</p>
                                {footer_extra}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    return html


def _send_mail_sync(subject, text_content, html_content, to_emails, from_email=None):
    """
    Sends email synchronously and reports whether the email backend accepted it.
    Catches SMTP and connection errors safely without exposing credentials or OTPs in logs.
    """
    import smtplib
    import socket

    backend_cls = getattr(settings, 'EMAIL_BACKEND', '')
    host_user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
    host_password = getattr(settings, 'EMAIL_HOST_PASSWORD', '').replace(' ', '').strip()

    # Pre-flight check: If SMTP backend is selected, credentials must be provided
    if 'smtp' in backend_cls.lower():
        if not host_user or not host_password:
            logger.error("SMTP backend is configured, but EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is not set in backend/.env.")
            return False, "We could not send the verification email at this time. SMTP email credentials are not configured on the server."

    try:
        sender = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        if not sender or 'noreply@ethiotechmarket.com' in sender:
            if host_user:
                sender = f"EthioTech Market <{host_user}>"
            else:
                sender = 'EthioTech Market <noreply@ethiotechmarket.com>'

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=sender,
            to=to_emails
        )
        if html_content:
            msg.attach_alternative(html_content, "text/html")
        sent = msg.send(fail_silently=False)
        if sent == 0:
            logger.warning(f"Email backend reported 0 messages sent to {to_emails}")
            return False, "We could not send the verification email at this time. Please try again later."
        logger.info(f"Verification email successfully dispatched to {to_emails}")
        return True, None
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"SMTP Authentication Error: {getattr(auth_err, 'smtp_code', 'unknown')}")
        return False, "We could not send the verification email at this time. SMTP authentication failed. Please verify the Gmail App Password in backend/.env."
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, socket.timeout, TimeoutError) as conn_err:
        logger.error(f"SMTP Connection Error: {type(conn_err).__name__}")
        return False, "We could not send the verification email at this time. Could not connect to the SMTP email server."
    except Exception as err:
        logger.error(f"Failed to send email to {to_emails}: {type(err).__name__}")
        return False, "We could not send the verification email at this time. Please try again later."


def send_verification_email(user, otp_code, token_str=None):
    """
    Sends customer registration verification email with 6-digit OTP code.
    Complies strictly with Section 4 email requirements.
    Validates delivery and returns (success: bool, error_message: str | None).
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    verify_url = f"{frontend_url}/verify-email?email={user.email}&token={token_str}" if token_str else None

    subject = "Verify Your EthioTech Market Account"
    title = "Verify Your EthioTech Market Account"

    body_content = f"""
    <p style="font-size: 16px; font-weight: 700; color: #0b1a2d; margin-top: 0; margin-bottom: 8px;">Welcome to EthioTech Market!</p>
    <p style="color: #334155; margin-bottom: 16px; font-size: 14px;">Thank you for creating an account with us.</p>
    <p style="color: #334155; margin-bottom: 20px; font-size: 14px;">To complete your registration and activate your customer account, please use the verification code below:</p>

    <div style="background-color: #f8fafc; border: 2px dashed #1b64da; border-radius: 10px; padding: 22px; margin: 24px 0; text-align: center;">
        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; display: block; margin-bottom: 8px;">One-Time Verification Code</span>
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1b64da; font-family: 'Courier New', Courier, monospace; display: inline-block;">{otp_code}</span>
        <span style="font-size: 12px; color: #64748b; display: block; margin-top: 10px; font-weight: 500;">This code is valid for 10 minutes and can only be used once.</span>
    </div>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 18px 0; text-align: left;">
        <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 600;">
            &#9888; Security Notice: Never share this verification code with anyone. EthioTech Market staff will never request your verification code.
        </p>
    </div>

    <p style="color: #64748b; font-size: 13px; margin-top: 20px; margin-bottom: 20px;">If you did not request this registration, you can safely ignore this email.</p>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <p style="color: #334155; font-size: 14px; margin-bottom: 4px;">Thank you,</p>
        <p style="color: #0b1a2d; font-weight: 700; font-size: 14px; margin-top: 0; margin-bottom: 4px;">EthioTech Market Team</p>
    </div>
    """

    html_content = get_base_email_template(
        title=title,
        body_content=body_content,
        cta_url=verify_url,
        cta_text="Verify Email Address" if verify_url else None,
        footer_note="This is an automated message. Please do not reply to this email."
    )

    text_content = f"""EthioTech Market

Welcome to EthioTech Market!

Thank you for creating an account with us.

To complete your registration and activate your customer account, please use the verification code below:

{otp_code}

This code is valid for 10 minutes and can only be used once.

SECURITY NOTICE: Never share this verification code with anyone. EthioTech Market staff will never request your verification code.

If you did not request this registration, you can safely ignore this email.

Thank you,
EthioTech Market Team

This is an automated message. Please do not reply to this email.
"""

    return _send_mail_sync(subject, text_content, html_content, [user.email])



def send_password_reset_email(user, token_str, raw_otp=None):
    """
    Sends secure password reset link and 6-digit OTP to user.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_url = f"{frontend_url}/reset-password?email={user.email}&token={token_str}"

    subject = "EthioTech Market - Password Reset Instructions & OTP Code"
    title = "Reset Your Password"

    otp_block_html = ""
    otp_block_text = ""
    if raw_otp:
        otp_block_html = f"""
        <div style="background-color: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
            <div style="font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 6px;">Your 6-Digit Password Reset Code</div>
            <div style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">{raw_otp}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Enter this code on the password reset screen or click the direct link below.</div>
        </div>
        """
        otp_block_text = f"\nYour 6-digit password reset code: {raw_otp}\n"

    body_content = f"""
    <p>Hello {user.first_name or user.username},</p>
    <p>We received a request to reset the password for your EthioTech Market account associated with <strong>{user.email}</strong>.</p>
    {otp_block_html}
    <p>Alternatively, you can securely set a new password by clicking the button below:</p>
    <p style="font-size: 12px; color: #64748b; margin-top: 16px;">This single-use reset code and link expire in 24 hours. If you did not make this request, you can safely ignore this email and your existing password will remain active.</p>
    """

    html_content = get_base_email_template(
        title=title,
        body_content=body_content,
        cta_url=reset_url,
        cta_text="Reset Password",
        footer_note="For security reasons, never share this code or link with anyone."
    )

    text_content = f"""
Hello {user.first_name or user.username},

We received a request to reset your password for your EthioTech Market account ({user.email}).
{otp_block_text}
You can also click the link below to set a new password:
{reset_url}

This code and link are valid for 24 hours and can only be used once.

If you did not request this, please ignore this email.

Regards,
EthioTech Market Security Team
"""

    _send_mail_async(subject, text_content, html_content, [user.email])


def send_password_changed_notification(user):
    """
    Notifies the user immediately after their password has been changed.
    """
    subject = "Security Alert: Your EthioTech Market Password Was Changed"
    title = "Password Changed Successfully"

    body_content = f"""
    <p>Hello {user.first_name or user.username},</p>
    <p>This is a confirmation that the password for your EthioTech Market account (<strong>{user.email}</strong>) was recently updated.</p>
    <p>If you made this change, no further action is required.</p>
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-top: 16px; color: #991b1b; font-size: 13px;">
        <strong>Didn't make this change?</strong> Please contact our support team immediately or request a new password reset to secure your account.
    </div>
    """

    html_content = get_base_email_template(
        title=title,
        body_content=body_content,
        footer_note="Security automated message &bull; EthioTech Market"
    )

    text_content = f"""
Hello {user.first_name or user.username},

Your EthioTech Market password was successfully changed.

If you made this change, you can safely disregard this email.
If you did not make this change, please contact support or reset your password immediately.

Regards,
EthioTech Market Security Team
"""

    _send_mail_async(subject, text_content, html_content, [user.email])


def send_newsletter_verification_email(subscriber):
    """
    Sends email confirmation link to verify double opt-in subscription.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    verify_url = f"{frontend_url}/newsletter/verify?token={subscriber.verification_token}"
    unsubscribe_url = f"{frontend_url}/newsletter/unsubscribe?token={subscriber.unsubscribe_token}"

    subject = "Confirm Your EthioTech Market Newsletter Subscription"
    title = "Confirm Your Subscription"

    body_content = f"""
    <p>Hello,</p>
    <p>Thank you for subscribing to the <strong>EthioTech Market</strong> newsletter.</p>
    <p>To confirm that this is your email address and start receiving exclusive tech promotions, discounts, and product launches, please confirm below:</p>
    """

    html_content = get_base_email_template(
        title=title,
        body_content=body_content,
        cta_url=verify_url,
        cta_text="Confirm Subscription",
        footer_note=f"<a href='{unsubscribe_url}' style='color: #94a3b8;'>Unsubscribe</a> if you did not request this."
    )

    text_content = f"""
Hello,

Please confirm your subscription to the EthioTech Market newsletter by clicking:
{verify_url}

To cancel, visit:
{unsubscribe_url}
"""

    _send_mail_async(subject, text_content, html_content, [subscriber.email])


def send_promotional_campaign_email(campaign, subscriber):
    """
    Sends a promotional campaign email to a single subscriber.
    Must include clear, working unsubscribe link.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    unsubscribe_url = f"{frontend_url}/newsletter/unsubscribe?token={subscriber.unsubscribe_token}"

    discount_badge = ""
    if campaign.discount_info:
        discount_badge = f"""
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center; color: #065f46; font-weight: bold; font-size: 15px;">
            🎉 Special Offer: {campaign.discount_info}
        </div>
        """

    banner_html = ""
    if campaign.banner_image:
        banner_url = campaign.banner_image.url if hasattr(campaign.banner_image, 'url') else ''
        if banner_url and not banner_url.startswith('http'):
            backend_url = getattr(settings, 'BACKEND_URL', 'http://127.0.0.1:8000').rstrip('/')
            banner_url = f"{backend_url}{banner_url}"
        if banner_url:
            banner_html = f"""
            <div style="margin-bottom: 20px; text-align: center;">
                <img src="{banner_url}" alt="{campaign.title}" style="max-width: 100%; height: auto; border-radius: 8px;" />
            </div>
            """

    formatted_message = campaign.message.replace('\n', '<br>')

    body_content = f"""
    {banner_html}
    {discount_badge}
    <div style="font-size: 14px; line-height: 1.7; color: #334155;">
        {formatted_message}
    </div>
    """

    html_content = get_base_email_template(
        title=campaign.title,
        body_content=body_content,
        cta_url=f"{frontend_url}/shop",
        cta_text="Explore Marketplace Deals",
        footer_note=f"You received this because you are subscribed to EthioTech Market promotions. <a href='{unsubscribe_url}' style='color: #64748b; text-decoration: underline;'>Unsubscribe at any time</a>."
    )

    text_content = f"""
{campaign.title}

{campaign.message}

Special Offer: {campaign.discount_info or 'Check our shop for latest deals!'}

Shop Now: {frontend_url}/shop

To unsubscribe from future promotional emails:
{unsubscribe_url}
"""

    try:
        sender = getattr(settings, 'DEFAULT_FROM_EMAIL', 'EthioTech Market <noreply@ethiotechmarket.com>')
        msg = EmailMultiAlternatives(
            subject=campaign.subject,
            body=text_content,
            from_email=sender,
            to=[subscriber.email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        return True, None
    except Exception as e:
        return False, str(e)


def send_supplier_purchase_order_email(purchase_order):
    """
    Sends an automated notification email to a hardware supplier when a purchase order is approved/sent.
    """
    if not purchase_order.supplier or not purchase_order.supplier.email:
        return False, "No supplier email"

    recipient = purchase_order.supplier.email
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    po_url = f"{frontend_url}/supplier/purchase-orders"

    body_content = f"""
    <p>Dear {purchase_order.supplier.contact_person or purchase_order.supplier.name},</p>
    <p>EthioTech Market has issued an official Purchase Order <strong>{purchase_order.request_number}</strong> for your hardware supply catalog.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b;">PO Number:</td><td style="padding: 6px 0; font-weight: bold; color: #0f172a;">{purchase_order.request_number}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Order Date:</td><td style="padding: 6px 0; color: #0f172a;">{purchase_order.created_at.strftime('%Y-%m-%d')}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Total Value:</td><td style="padding: 6px 0; font-weight: bold; color: #0f172a;">ETB {purchase_order.total_estimated_cost}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Expected Delivery:</td><td style="padding: 6px 0; color: #0f172a;">{purchase_order.expected_supply_date or 'To be confirmed'}</td></tr>
        </table>
    </div>
    <p>Please log in to your Supplier Management Portal to review requested items, confirm available quantities, or suggest delivery adjustments.</p>
    """

    html_content = get_base_email_template(
        title=f"New Purchase Order: {purchase_order.request_number}",
        body_content=body_content,
        cta_url=po_url,
        cta_text="Review Purchase Order in Portal",
        footer_note="EthioTech Market Procurement & Supply Operations &bull; Debre Birhan, Amhara, Ethiopia"
    )

    text_content = f"""
EthioTech Market - Purchase Order {purchase_order.request_number}

Dear {purchase_order.supplier.contact_person or purchase_order.supplier.name},

EthioTech Market has issued Purchase Order {purchase_order.request_number} with a total value of ETB {purchase_order.total_estimated_cost}.

Expected Delivery: {purchase_order.expected_supply_date or 'To be confirmed'}

Please sign in to the Supplier Portal to review and confirm:
{po_url}
"""

    _send_mail_async(f"EthioTech Market - Purchase Order {purchase_order.request_number}", text_content, html_content, [recipient])
    return True, None
