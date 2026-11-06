import secrets
import datetime
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import views, permissions, status
from rest_framework.response import Response

from accounts.models import User
from accounts.models_tokens import EmailVerificationToken
from accounts.validators import validate_business_email_address, validate_phone_number_format
from accounts.supplier_email_service import send_supplier_invitation_email
from .models import Supplier
from .supplier_portal_views import log_supplier_action


class AdminInviteSupplierAccountView(views.APIView):
    """
    Admin-only endpoint to invite and provision a genuine Supplier Portal account.
    Enforces real business email validation, case-insensitive duplicate prevention,
    inactive status pending verification, and actual email delivery.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        is_admin = getattr(request.user, 'is_admin', lambda: False)() or getattr(request.user, 'is_super_admin', False)
        if not is_admin:
            return Response(
                {'error': 'Permission Denied: Only platform Administrators can invite supplier accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        supplier = get_object_or_404(Supplier, pk=pk)

        raw_email = (request.data.get('email') or supplier.email or '').strip()
        try:
            email = validate_business_email_address(raw_email, required=True).lower()
        except Exception as err:
            err_msg = getattr(err, 'detail', str(err))
            if isinstance(err_msg, list):
                err_msg = err_msg[0]
            return Response({'error': str(err_msg)}, status=status.HTTP_400_BAD_REQUEST)

        raw_phone = (request.data.get('phone') or supplier.phone or '').strip()
        formatted_phone = ''
        if raw_phone:
            try:
                formatted_phone = validate_phone_number_format(raw_phone, required=False)
            except Exception as err:
                err_msg = getattr(err, 'detail', str(err))
                if isinstance(err_msg, list):
                    err_msg = err_msg[0]
                return Response({'error': str(err_msg)}, status=status.HTTP_400_BAD_REQUEST)

        password = (request.data.get('password') or '').strip()
        if not password and not supplier.user:
            # Generate a secure temporary password if none provided
            password = secrets.token_urlsafe(10) + "!9A"
        elif password and len(password) < 6:
            return Response({'error': 'Password must be at least six characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        # Case-insensitive duplicate email check
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user and existing_user != supplier.user:
            if existing_user.role in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN, User.RoleChoices.STORE_MANAGER, User.RoleChoices.ORDER_MANAGER]:
                return Response(
                    {'error': f"Account '{email}' is an internal staff account ({existing_user.role}) and cannot be assigned to a supplier."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if hasattr(existing_user, 'supplier_profile') and existing_user.supplier_profile and existing_user.supplier_profile.id != supplier.id:
                return Response(
                    {'error': f"Account '{email}' is already linked to another supplier organization ('{existing_user.supplier_profile.name}')."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        target_user = supplier.user or existing_user
        created_new_user = False

        if not target_user:
            # Generate unique username
            base_un = email.split('@')[0].replace('.', '_').replace('-', '_').lower()
            username = f"sup_{base_un}"
            counter = 1
            final_username = username
            while User.objects.filter(username__iexact=final_username).exists():
                final_username = f"{username}_{counter}"
                counter += 1

            target_user = User.objects.create_user(
                username=final_username,
                email=email,
                password=password,
                first_name=supplier.contact_person or supplier.name,
                role=User.RoleChoices.SUPPLIER,
                phone_number=formatted_phone,
                email_verified=False,
                is_active=False,
                must_change_password=True
            )
            created_new_user = True
        else:
            target_user.email = email
            target_user.role = User.RoleChoices.SUPPLIER
            if formatted_phone:
                target_user.phone_number = formatted_phone
            if password:
                target_user.set_password(password)
                target_user.must_change_password = True
            target_user.email_verified = False
            target_user.is_active = False
            target_user.save()

        supplier.user = target_user
        supplier.email = email
        if formatted_phone:
            supplier.phone = formatted_phone
        supplier.save()

        # Invalidate old tokens and issue new 24-hour verification token
        EmailVerificationToken.objects.filter(user=target_user, is_used=False).update(is_used=True)
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        token_str = secrets.token_urlsafe(32)
        token_obj = EmailVerificationToken(
            user=target_user,
            token=token_str,
            purpose='supplier_invitation',
            expires_at=timezone.now() + datetime.timedelta(hours=24)
        )
        token_obj.set_otp(otp_code)
        token_obj.save()

        # Dispatch real invitation email
        sent_ok, err_msg = send_supplier_invitation_email(
            user=target_user,
            supplier=supplier,
            otp_code=otp_code,
            token_str=token_str,
            temporary_password=password if created_new_user else None
        )

        if not sent_ok:
            log_supplier_action(
                request.user,
                "SUPPLIER_INVITATION_FAILED",
                f"Failed to dispatch invitation email to {email}: {err_msg}",
                request
            )
            return Response({
                'error': f"We could not send the invitation email to {email}. {err_msg or 'Please verify email service configuration.'}",
                'email_sent': False,
                'email': email,
                'requires_verification': True
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        log_supplier_action(
            request.user,
            "SUPPLIER_INVITED",
            f"Admin invited supplier '{supplier.name}' ({target_user.email}). Verification code sent.",
            request
        )

        return Response({
            'message': f"Invitation email with a six-digit verification code was successfully sent to {target_user.email}.",
            'email_sent': True,
            'supplier': {
                'id': supplier.id,
                'name': supplier.name,
                'email': target_user.email,
                'status': supplier.status,
                'email_verified': target_user.email_verified,
                'is_active': target_user.is_active
            }
        }, status=status.HTTP_201_CREATED)

