import logging
from django.conf import settings
from .email_service import get_base_email_template, _send_mail_sync

logger = logging.getLogger(__name__)


def send_supplier_invitation_email(user, supplier, otp_code, token_str=None, temporary_password=None):
    """
    Sends an official supplier portal invitation email with a six-digit verification code.
    Verifies actual email delivery through the configured email service.
    Returns (success: bool, error_message: str | None).
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    verify_url = f"{frontend_url}/verify-email?email={user.email}&token={token_str or ''}"

    subject = f"EthioTech Market: Supplier Portal Invitation for {supplier.name}"
    title = f"Welcome to EthioTech Market Supplier Portal"

    contact_greeting = supplier.contact_person or supplier.name

    temp_pw_section = ""
    if temporary_password:
        temp_pw_section = f"""
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px;">
            <strong>Temporary Password:</strong> <code style="font-size: 15px; color: #0f172a;">{temporary_password}</code><br>
            <span style="color: #64748b; font-size: 11px;">You will be prompted to choose a new password upon first login.</span>
        </div>
        """

    body_content = f"""
    <p>Dear {contact_greeting},</p>
    <p>You have been officially invited by EthioTech Market Administration as an authorized hardware supplier for <strong>{supplier.name}</strong>.</p>
    <p>To verify your business email address and activate your Supplier Portal account, please use the six-digit verification code below:</p>
    
    <div style="background-color: #f8fafc; border: 2px dashed #f59e0b; border-radius: 10px; padding: 22px; margin: 24px 0; text-align: center;">
        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; display: block; margin-bottom: 8px;">Supplier Verification Code</span>
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #d97706; font-family: 'Courier New', Courier, monospace; display: inline-block;">{otp_code}</span>
        <span style="font-size: 12px; color: #64748b; display: block; margin-top: 10px; font-weight: 500;">Valid for twenty-four hours. Single-use only.</span>
    </div>

    {temp_pw_section}

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 18px 0; text-align: left;">
        <p style="margin: 0; color: #1e40af; font-size: 12px; font-weight: 600;">
            Security Notice: Your portal account requires email verification before accessing procurement features. EthioTech Market staff will never request your verification code or password.
        </p>
    </div>

    <p style="color: #64748b; font-size: 13px; margin-top: 20px;">Once verified, you will be able to review purchase orders, submit price quotations, and upload invoices directly through the Supplier Portal.</p>
    """

    html_content = get_base_email_template(
        title=title,
        body_content=body_content,
        cta_url=verify_url if token_str else f"{frontend_url}/supplier/login",
        cta_text="Verify & Access Supplier Portal",
        footer_note="EthioTech Market &bull; Official Supplier Operations &bull; Debre Birhan, Amhara, Ethiopia"
    )

    text_content = f"""
EthioTech Market - Supplier Portal Invitation

Dear {contact_greeting},

You have been invited by EthioTech Market Administration as an authorized supplier for {supplier.name}.

Your six-digit email verification code: {otp_code}

This code is valid for twenty-four hours.

{f'Temporary Password: {temporary_password}' if temporary_password else ''}

Verify your account online:
{verify_url}

Thank you,
EthioTech Market Procurement Team
"""

    return _send_mail_sync(subject, text_content, html_content, [user.email])

