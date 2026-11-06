import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from accounts.models import User
from accounts.email_service import get_base_email_template, _send_mail_sync, _send_mail_async
from notifications.models import Notification

logger = logging.getLogger(__name__)


def _get_frontend_url():
    return getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')


def notify_supplier_rfq(rfq):
    """Notify supplier when Store Manager creates an RFQ."""
    supplier = rfq.supplier
    recipient_email = supplier.email or (supplier.user.email if supplier.user else None)
    if not recipient_email:
        return False, "Supplier has no valid email address."

    frontend_url = _get_frontend_url()
    dashboard_url = f"{frontend_url}/supplier/quotations"
    subject = f"New Quotation Request: {rfq.rfq_number} - EthioTech Market"
    title = f"Quotation Request: {rfq.rfq_number}"

    items_html = "".join([
        f"<tr><td style='padding:6px;border:1px solid #e2e8f0;'>{item.product.name}</td>"
        f"<td style='padding:6px;border:1px solid #e2e8f0;text-align:center;'>{item.requested_quantity} units</td></tr>"
        for item in rfq.items.all()
    ])

    body_content = f"""
    <p>Dear {supplier.contact_person or supplier.name},</p>
    <p>EthioTech Market has submitted a new Request for Quotation (RFQ) <strong>{rfq.rfq_number}</strong>.</p>
    <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;'>
        <thead><tr style='background:#f8fafc;'><th style='padding:6px;border:1px solid #e2e8f0;'>Product</th><th style='padding:6px;border:1px solid #e2e8f0;'>Requested Qty</th></tr></thead>
        <tbody>{items_html}</tbody>
    </table>
    <p><strong>Required Delivery Date:</strong> {rfq.required_delivery_date or 'Flexible'}</p>
    <p><strong>Notes:</strong> {rfq.notes or 'None'}</p>
    <p>Please log in to your Supplier Portal to submit your unit pricing and available quantities.</p>
    """
    html_content = get_base_email_template(title, body_content, cta_url=dashboard_url, cta_text="View Quotation Request")
    text_content = f"New RFQ {rfq.rfq_number} from EthioTech Market.\nVisit {dashboard_url} to review and submit your quotation."

    sent, err = _send_mail_sync(subject, text_content, html_content, [recipient_email])
    if supplier.user:
        Notification.objects.create(
            user=supplier.user,
            title=f"New RFQ: {rfq.rfq_number}",
            message=f"Store Manager requested pricing for {rfq.items.count()} product(s).",
            link="/supplier/quotations"
        )
    return sent, err


def notify_supplier_purchase_order(po):
    """Notify supplier when approved PO is officially issued."""
    supplier = po.supplier
    recipient_email = supplier.email or (supplier.user.email if supplier.user else None)
    if not recipient_email:
        return False, "Supplier has no valid email address."

    frontend_url = _get_frontend_url()
    dashboard_url = f"{frontend_url}/supplier/purchase-orders"
    subject = f"New Approved Purchase Order: {po.request_number} - EthioTech Market"
    title = f"Approved Purchase Order: {po.request_number}"

    body_content = f"""
    <p>Dear {supplier.contact_person or supplier.name},</p>
    <p>EthioTech Market has issued official Purchase Order <strong>{po.request_number}</strong>.</p>
    <div style='background:#f8fafc;padding:14px;border-radius:8px;margin:16px 0;font-size:13px;'>
        <p style='margin:4px 0;'><strong>Total Value:</strong> ETB {po.total_estimated_cost}</p>
        <p style='margin:4px 0;'><strong>Agreed Price per Unit:</strong> ETB {po.agreed_price}</p>
        <p style='margin:4px 0;'><strong>Expected Delivery Date:</strong> {po.expected_supply_date or 'To be confirmed'}</p>
    </div>
    <p>Please review order details and update shipping milestones in the Supplier Portal.</p>
    """
    html_content = get_base_email_template(title, body_content, cta_url=dashboard_url, cta_text="View Purchase Order")
    text_content = f"Approved PO {po.request_number} issued with value ETB {po.total_estimated_cost}.\nVisit {dashboard_url} to review."

    sent, err = _send_mail_sync(subject, text_content, html_content, [recipient_email])
    if supplier.user:
        Notification.objects.create(
            user=supplier.user,
            title=f"Approved PO: {po.request_number}",
            message=f"Purchase order for ETB {po.total_estimated_cost} has been issued.",
            link="/supplier/purchase-orders"
        )
    return sent, err


def notify_supplier_question(supplier, question_text, sender_user, reference=None):
    """Notify supplier when Store Manager sends a question or clarification request."""
    recipient_email = supplier.email or (supplier.user.email if supplier.user else None)
    if not recipient_email:
        return False, "Supplier has no valid email address."

    frontend_url = _get_frontend_url()
    dashboard_url = f"{frontend_url}/supplier/dashboard"
    subject = f"New Message from EthioTech Market{' (' + reference + ')' if reference else ''}"
    title = "Message from Store Management"

    body_content = f"""
    <p>Dear {supplier.contact_person or supplier.name},</p>
    <p>Store Manager {sender_user.first_name or sender_user.username} has sent a clarification request:</p>
    <blockquote style='background:#f1f5f9;border-left:4px solid #1b64da;padding:12px;margin:16px 0;font-style:italic;'>
        {question_text}
    </blockquote>
    <p>Please sign in to the Supplier Portal to respond.</p>
    """
    html_content = get_base_email_template(title, body_content, cta_url=dashboard_url, cta_text="View and Respond")
    text_content = f"New message from EthioTech Market:\n{question_text}\nSign in at {dashboard_url} to reply."

    sent, err = _send_mail_sync(subject, text_content, html_content, [recipient_email])
    if supplier.user:
        Notification.objects.create(
            user=supplier.user,
            title="Message from Store Management",
            message=question_text[:200],
            link="/supplier/dashboard"
        )
    return sent, err


def notify_store_manager_quotation_submitted(quotation):
    """Notify Store Managers when a supplier submits a quotation."""
    frontend_url = _get_frontend_url()
    dashboard_url = f"{frontend_url}/manager/procurement/rfqs"
    subject = f"Quotation Received: {quotation.quotation_number} from {quotation.supplier.name}"
    title = f"Quotation Received from {quotation.supplier.name}"

    body_content = f"""
    <p>Supplier <strong>{quotation.supplier.name}</strong> has submitted quotation <strong>{quotation.quotation_number}</strong> for RFQ {quotation.rfq.rfq_number}.</p>
    <div style='background:#f8fafc;padding:12px;border-radius:8px;margin:16px 0;font-size:13px;'>
        <p style='margin:4px 0;'><strong>Total Quoted Amount:</strong> ETB {quotation.total_amount}</p>
        <p style='margin:4px 0;'><strong>Delivery Lead Time:</strong> {quotation.delivery_lead_time or 'N/A'}</p>
        <p style='margin:4px 0;'><strong>Payment Terms:</strong> {quotation.payment_terms or 'Standard'}</p>
    </div>
    <p>Review and compare this quotation in the Store Manager procurement section.</p>
    """
    html_content = get_base_email_template(title, body_content, cta_url=dashboard_url, cta_text="Review & Compare Quotation")
    text_content = f"Quotation {quotation.quotation_number} submitted by {quotation.supplier.name}. Visit {dashboard_url}."

    managers = User.objects.filter(role=User.RoleChoices.STORE_MANAGER, is_active=True)
    manager_emails = list(managers.values_list('email', flat=True))
    if manager_emails:
        _send_mail_async(subject, text_content, html_content, manager_emails)

    for m in managers:
        Notification.objects.create(
            user=m,
            title=f"Quotation Submitted: {quotation.quotation_number}",
            message=f"{quotation.supplier.name} quoted ETB {quotation.total_amount} on {quotation.rfq.rfq_number}.",
            link="/manager/procurement/rfqs"
        )
    return True, None


def notify_staff_supplier_response(supplier, response_text, reference=None):
    """Notify Store Managers when supplier responds to question."""
    subject = f"Supplier Response from {supplier.name}{' (' + reference + ')' if reference else ''}"
    managers = User.objects.filter(role=User.RoleChoices.STORE_MANAGER, is_active=True)
    for m in managers:
        Notification.objects.create(
            user=m,
            title=f"Supplier Response: {supplier.name}",
            message=response_text[:200],
            link="/manager/procurement/rfqs"
        )
    manager_emails = list(managers.values_list('email', flat=True))
    if manager_emails:
        _send_mail_async(subject, response_text, None, manager_emails)
    return True, None

