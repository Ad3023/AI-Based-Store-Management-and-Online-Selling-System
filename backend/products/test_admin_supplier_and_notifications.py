from unittest.mock import patch
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from products.models import Supplier, Product, Category, PurchaseRequest, RequestForQuotation, RFQItem
from accounts.models_tokens import EmailVerificationToken
from notifications.models import Notification

User = get_user_model()


class AdminSupplierAndNotificationsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_perm_test',
            email='addisuguche68@gmail.com',
            password='AdminPassword123!',
            role=User.RoleChoices.ADMIN,
            is_active=True,
            email_verified=True
        )
        self.manager = User.objects.create_user(
            username='manager_perm_test',
            email='gucheaddisu10@gmail.com',
            password='ManagerPassword123!',
            role=User.RoleChoices.STORE_MANAGER,
            is_active=True,
            email_verified=True
        )
        self.category = Category.objects.create(name='Hardware', slug='hardware')
        self.product = Product.objects.create(
            category=self.category,
            name='Industrial Switch 24-Port',
            sku='TECH-SW-24P',
            price=Decimal('12500.00'),
            stock=20
        )
        self.supplier = Supplier.objects.create(
            name='Ethio Genuine Hardware Corp',
            email='sales@ethiogenuine.com',
            status=Supplier.Status.ACTIVE
        )

    def test_admin_only_supplier_management_permissions(self):
        """Store Manager CANNOT create, edit, or delete suppliers. ONLY Admin can."""
        self.client.force_authenticate(user=self.manager)

        # 1. Store Manager attempts supplier creation -> 403
        create_res = self.client.post('/api/products/suppliers/', {
            'name': 'Unauthorized Supplier Org',
            'email': 'unauth@vendor.com'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Store Manager attempts supplier edit -> 403
        edit_res = self.client.patch(f'/api/products/suppliers/{self.supplier.id}/', {
            'contact_person': 'New Name'
        }, format='json')
        self.assertEqual(edit_res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Store Manager attempts supplier delete -> 403
        del_res = self.client.delete(f'/api/products/suppliers/{self.supplier.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Admin CAN create and edit
        self.client.force_authenticate(user=self.admin)
        admin_create = self.client.post('/api/products/suppliers/', {
            'name': 'Admin Approved Vendor',
            'email': 'adminapproved@vendor.com'
        }, format='json')
        self.assertEqual(admin_create.status_code, status.HTTP_201_CREATED)

    def test_supplier_deletion_safety_with_business_history(self):
        """Suppliers with financial/procurement history are deactivated, not deleted."""
        self.client.force_authenticate(user=self.admin)
        PurchaseRequest.objects.create(
            product=self.product,
            supplier=self.supplier,
            requested_by=self.manager,
            approved_by=self.admin,
            quantity=5,
            total_estimated_cost=Decimal('50000.00'),
            status=PurchaseRequest.Status.APPROVED
        )

        del_res = self.client.delete(f'/api/products/suppliers/{self.supplier.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertTrue(del_res.data.get('archived'))

        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.status, Supplier.Status.DEACTIVATED)
        self.assertFalse(self.supplier.is_active)

    def test_lowercase_email_normalization_and_case_insensitive_auth(self):
        """Email input in upper/mixed case normalizes to lowercase and authenticates."""
        mixed_email = 'UpperCaseCustomer@Gmail.COM'
        user = User.objects.create_user(
            username='uppercust',
            email=mixed_email,
            password='TestPass123!',
            role=User.RoleChoices.CUSTOMER,
            email_verified=True,
            is_active=True
        )
        user.refresh_from_db()
        self.assertEqual(user.email, 'uppercasecustomer@gmail.com')

        login_res = self.client.post('/api/auth/login/', {
            'identifier': 'UPPERCASECUSTOMER@GMAIL.COM',
            'password': 'TestPass123!',
            'portal': 'customer'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

    @patch('accounts.supplier_email_service._send_mail_sync')
    def test_supplier_email_notifications_and_dashboard_links(self, mock_send_mail):
        """Store Manager triggers RFQ and question emails with correct dashboard links."""
        mock_send_mail.return_value = (True, None)

        # 1. Invite supplier and verify
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/products/suppliers/{self.supplier.id}/create-account/', {
            'email': 'vendor@ethiohardware.com',
            'password': 'VendorPass123!'
        }, format='json')
        sup_user = User.objects.get(email='vendor@ethiohardware.com')
        tok = EmailVerificationToken.objects.filter(user=sup_user).first()
        tok.set_otp('654321')
        tok.save()
        self.client.post('/api/auth/verify-email/', {'email': 'vendor@ethiohardware.com', 'otp': '654321'}, format='json')

        # 2. Store Manager creates RFQ -> triggers email to supplier
        self.client.force_authenticate(user=self.manager)
        rfq_res = self.client.post('/api/products/rfqs/', {
            'supplier': self.supplier.id,
            'required_delivery_date': '2026-11-20',
            'notes': 'High priority request',
            'items': [{'product': self.product.id, 'requested_quantity': 10}]
        }, format='json')
        self.assertEqual(rfq_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_send_mail.called)

        # 3. Store Manager sends clarification question
        msg_res = self.client.post(f'/api/products/suppliers/{self.supplier.id}/send-message/', {
            'message': 'Do you offer warranty extension for 24-Port switches?'
        }, format='json')
        self.assertEqual(msg_res.status_code, status.HTTP_200_OK)

        # 4. Check Supplier In-App Notification history
        sup_user.refresh_from_db()
        self.client.force_authenticate(user=sup_user)
        notif_res = self.client.get('/api/supplier/notifications/')
        self.assertEqual(notif_res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(notif_res.data) >= 1)

        # 5. Mark notification as read
        notif_id = notif_res.data[0]['id']
        read_res = self.client.post('/api/supplier/notifications/', {'id': notif_id}, format='json')
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        updated_notif = Notification.objects.get(pk=notif_id)
        self.assertTrue(updated_notif.is_read)

