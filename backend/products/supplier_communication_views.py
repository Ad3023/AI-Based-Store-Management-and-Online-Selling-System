from django.shortcuts import get_object_or_404
from rest_framework import views, permissions, status
from rest_framework.response import Response

from accounts.models import User
from .models import Supplier
from .supplier_notification_service import notify_supplier_question, notify_staff_supplier_response
from .supplier_portal_views import log_supplier_action


class SendSupplierMessageView(views.APIView):
    """
    Store Manager or Admin sends question or clarification request to a supplier.
    Triggers an email notification with a direct response link.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        is_staff = request.user.role in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN, User.RoleChoices.STORE_MANAGER]
        if not is_staff and not request.user.is_superuser:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        supplier = get_object_or_404(Supplier, pk=pk)
        message_text = request.data.get('message', '').strip()
        reference = request.data.get('reference', '').strip()

        if not message_text:
            return Response({'error': 'Message text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        sent, err = notify_supplier_question(supplier, message_text, request.user, reference=reference)
        if not sent:
            return Response({
                'error': f"Failed to send email to supplier: {err or 'Email service error'}",
                'email_sent': False
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        log_supplier_action(request.user, "SUPPLIER_MESSAGE_SENT", f"Question sent to supplier '{supplier.name}' by {request.user.email}.", request)

        return Response({
            'message': f"Question successfully sent to {supplier.name}.",
            'email_sent': True,
            'supplier_id': supplier.id
        }, status=status.HTTP_200_OK)


class SupplierSendResponseView(views.APIView):
    """
    Supplier submits clarification or response back to Store Management.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.RoleChoices.SUPPLIER or not hasattr(request.user, 'supplier_profile'):
            return Response({'error': 'Permission denied: Supplier account required.'}, status=status.HTTP_403_FORBIDDEN)

        supplier = request.user.supplier_profile
        response_text = request.data.get('response', '').strip()
        reference = request.data.get('reference', '').strip()

        if not response_text:
            return Response({'error': 'Response text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        sent, err = notify_staff_supplier_response(supplier, response_text, reference=reference)
        log_supplier_action(request.user, "SUPPLIER_RESPONSE_SENT", f"Supplier '{supplier.name}' submitted response to store management.", request)

        return Response({
            'message': 'Your response has been sent to EthioTech Market store management.',
            'supplier_id': supplier.id
        }, status=status.HTTP_200_OK)

