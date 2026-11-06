import json
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from products.models import Supplier, Product, Category, PurchaseRequest, SupplierInvoice, SupplierPayment


class CompleteSupplierInvoicePaymentWorkflowTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Electronics", slug="electronics")
        self.product = Product.objects.create(
            category=self.category,
            name="HP EliteBook Pro",
            slug="hp-elitebook-pro",
            sku="HPEB-001",
            price=Decimal("55000.00"),
            stock=5,
            cost_price=Decimal("45000.00")
        )

        # 1. Admin User
        self.admin = User.objects.create_superuser(
            username="test_admin",
            email="admin@ethiotech.com",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN
        )

        # 2. Store Manager User
        self.store_manager = User.objects.create_user(
            username="test_store_manager",
            email="store@ethiotech.com",
            password="StorePassword123!",
            role=User.RoleChoices.STORE_MANAGER
        )

        # 3. Supplier Account & Profile
        self.supplier_user = User.objects.create_user(
            username="test_supplier",
            email="gucheaddisu5@gmail.com",
            password="SupplierPassword123!",
            role=User.RoleChoices.SUPPLIER
        )
        self.supplier = Supplier.objects.create(
            user=self.supplier_user,
            name="Addisu Tech Imports PLC",
            email="gucheaddisu5@gmail.com",
            phone="+251911223344",
            bank_name="Commercial Bank of Ethiopia",
            bank_account_name="Addisu Tech Imports PLC",
            bank_account_number="1000123456789",
            status=Supplier.Status.ACTIVE
        )

    def test_complete_invoice_and_payment_lifecycle(self):
        # -----------------------------------------------------------------
        # STEP 1: Store Manager creates a Purchase Order (PO)
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.store_manager)
        po_res = self.client.post('/api/products/purchase-requests/', {
            'supplier': self.supplier.id,
            'product': self.product.id,
            'quantity': 10,
            'estimated_unit_cost': '50000.00',
            'notes': 'Procurement of 10 HP EliteBook Laptops'
        }, format='json')
        self.assertEqual(po_res.status_code, status.HTTP_201_CREATED)
        po_id = po_res.data['id']
        po = PurchaseRequest.objects.get(pk=po_id)
        self.assertEqual(po.quantity, 10)

        # -----------------------------------------------------------------
        # STEP 2: Admin approves the PO & marks sent to supplier
        # -----------------------------------------------------------------
        po.status = PurchaseRequest.Status.APPROVED
        po.approved_by = self.admin
        po.approval_date = timezone.now()
        po.save()

        # -----------------------------------------------------------------
        # STEP 3: Supplier accepts the PO
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user)
        respond_res = self.client.post(f'/api/supplier/purchase-orders/{po_id}/respond/', {
            'action': 'accept',
            'confirmed_quantity': 10,
            'estimated_delivery_date': str(timezone.now().date()),
            'notes': 'Accepted full order, ready for delivery.'
        }, format='json')
        self.assertEqual(respond_res.status_code, status.HTTP_200_OK)

        # -----------------------------------------------------------------
        # STEP 4: Store Manager checks delivery and records accepted quantity
        # 10 delivered, 1 damaged -> 9 accepted
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.store_manager)
        recv_res = self.client.post(f'/api/products/purchase-requests/{po_id}/receive-stock/', {
            'received_quantity': 10,
            'damaged_quantity': 1,
            'notes': 'Received 10 units, 1 unit screen damaged during shipping. Accepted 9 units.'
        }, format='json')
        self.assertEqual(recv_res.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.received_quantity, 10)
        self.assertEqual(po.damaged_quantity, 1)
        self.assertEqual(po.accepted_quantity, 9)

        # -----------------------------------------------------------------
        # STEP 5: Supplier queries eligible POs
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user)
        eligible_res = self.client.get('/api/supplier/invoices/?eligible_pos=true')
        self.assertEqual(eligible_res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['id'] == po.id and item['accepted_quantity'] == 9 for item in eligible_res.data))

        # -----------------------------------------------------------------
        # STEP 6: Supplier attempts to bill 10 units (exceeds accepted 9) -> REJECTED
        # -----------------------------------------------------------------
        dummy_file = SimpleUploadedFile("invoice_receipt.pdf", b"%PDF-1.4 dummy invoice content", content_type="application/pdf")
        bad_inv_res = self.client.post('/api/supplier/invoices/', {
            'purchase_order': po.id,
            'invoice_number': 'INV-2026-001',
            'invoiced_quantity': 10,
            'unit_price': '50000.00',
            'attachment': dummy_file
        }, format='multipart')
        self.assertEqual(bad_inv_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot exceed store-accepted quantity", bad_inv_res.data['error'])

        # -----------------------------------------------------------------
        # STEP 7: Supplier submits valid invoice for accepted 9 units
        # 9 * 50,000 = 450,000 ETB
        # -----------------------------------------------------------------
        dummy_file2 = SimpleUploadedFile("invoice_receipt.pdf", b"%PDF-1.4 valid invoice", content_type="application/pdf")
        good_inv_res = self.client.post('/api/supplier/invoices/', {
            'purchase_order': po.id,
            'invoice_number': 'INV-2026-001',
            'invoiced_quantity': 9,
            'unit_price': '50000.00',
            'tax_amount': '0.00',
            'notes': 'Final invoice for 9 accepted HP EliteBook laptops',
            'attachment': dummy_file2
        }, format='multipart')
        self.assertEqual(good_inv_res.status_code, status.HTTP_201_CREATED)
        inv_id = good_inv_res.data['id']
        invoice = SupplierInvoice.objects.get(pk=inv_id)
        self.assertEqual(invoice.invoiced_quantity, 9)
        self.assertEqual(invoice.accepted_quantity, 9)
        self.assertEqual(invoice.total_amount, Decimal('450000.00'))
        self.assertEqual(invoice.paid_amount, Decimal('0.00'))
        self.assertEqual(invoice.outstanding_amount, Decimal('450000.00'))
        self.assertEqual(invoice.status, SupplierInvoice.Status.SUBMITTED)

        # -----------------------------------------------------------------
        # STEP 8: Duplicate invoice prevention
        # -----------------------------------------------------------------
        dup_res = self.client.post('/api/supplier/invoices/', {
            'purchase_order': po.id,
            'invoice_number': 'INV-2026-001',
            'invoiced_quantity': 9,
            'unit_price': '50000.00'
        }, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already submitted invoice", dup_res.data['error'])

        # -----------------------------------------------------------------
        # STEP 9: Store Manager verifies invoice & forwards to Admin
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.store_manager)
        verify_res = self.client.post(f'/api/products/supplier-invoices/{inv_id}/store-verify/', {
            'action': 'verify',
            'notes': 'Verified: 9 laptops received and accepted in warehouse inventory.'
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.PENDING_ADMIN_APPROVAL)
        self.assertEqual(invoice.verified_by_store, self.store_manager)

        # Store Manager cannot authorize payment
        sm_pay_res = self.client.post('/api/products/supplier-payments/', {
            'invoice': inv_id,
            'amount_paid': '450000.00',
            'transaction_reference': 'CBE-TX-FORBIDDEN'
        }, format='json')
        self.assertEqual(sm_pay_res.status_code, status.HTTP_403_FORBIDDEN)

        # -----------------------------------------------------------------
        # STEP 10: Admin approves invoice for payment
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.admin)
        admin_review_res = self.client.post(f'/api/products/supplier-invoices/{inv_id}/review/', {
            'action': 'approve',
            'review_notes': 'Commercial and technical approval confirmed. Authorized for bank disbursement.'
        }, format='json')
        self.assertEqual(admin_review_res.status_code, status.HTTP_200_OK)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.APPROVED_FOR_PAYMENT)
        self.assertEqual(invoice.paid_amount, Decimal('0.00')) # STILL 0.00! Approval is NOT payment!

        # -----------------------------------------------------------------
        # STEP 11: Admin records partial manual bank transfer of ETB 200,000
        # -----------------------------------------------------------------
        receipt_file1 = SimpleUploadedFile("cbe_receipt_1.pdf", b"%PDF-1.4 CBE Bank Wire Receipt 1", content_type="application/pdf")
        pay_res1 = self.client.post('/api/products/supplier-payments/', {
            'invoice': inv_id,
            'amount_paid': '200000.00',
            'payment_method': 'BANK_TRANSFER',
            'transaction_reference': 'CBE-FT-8849201',
            'bank_name': 'Commercial Bank of Ethiopia',
            'bank_account_number': '1000123456789',
            'notes': 'Advance manual wire settlement via CBE Birr transfer',
            'receipt': receipt_file1
        }, format='multipart')
        self.assertEqual(pay_res1.status_code, status.HTTP_201_CREATED)
        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal('200000.00'))
        self.assertEqual(invoice.outstanding_amount, Decimal('250000.00'))
        self.assertEqual(invoice.status, SupplierInvoice.Status.PARTIALLY_PAID)

        # -----------------------------------------------------------------
        # STEP 12: Admin attempts to overpay (ETB 300,000 > remaining 250,000) -> REJECTED
        # -----------------------------------------------------------------
        overpay_res = self.client.post('/api/products/supplier-payments/', {
            'invoice': inv_id,
            'amount_paid': '300000.00',
            'transaction_reference': 'CBE-FT-OVERPAY'
        }, format='json')
        self.assertEqual(overpay_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds invoice outstanding balance", overpay_res.data['error'])

        # -----------------------------------------------------------------
        # STEP 13: Admin records final manual bank transfer of remaining ETB 250,000
        # -----------------------------------------------------------------
        receipt_file2 = SimpleUploadedFile("cbe_receipt_2.pdf", b"%PDF-1.4 CBE Bank Wire Receipt 2", content_type="application/pdf")
        pay_res2 = self.client.post('/api/products/supplier-payments/', {
            'invoice': inv_id,
            'amount_paid': '250000.00',
            'payment_method': 'BANK_TRANSFER',
            'transaction_reference': 'CBE-FT-8849202',
            'bank_name': 'Commercial Bank of Ethiopia',
            'bank_account_number': '1000123456789',
            'notes': 'Final manual wire balance settlement',
            'receipt': receipt_file2
        }, format='multipart')
        self.assertEqual(pay_res2.status_code, status.HTTP_201_CREATED)
        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal('450000.00'))
        self.assertEqual(invoice.outstanding_amount, Decimal('0.00'))
        self.assertEqual(invoice.status, SupplierInvoice.Status.PAID)

        # -----------------------------------------------------------------
        # STEP 14: Supplier inspects payments and receipts on portal
        # -----------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user)
        portal_payments = self.client.get('/api/supplier/payments/')
        self.assertEqual(portal_payments.status_code, status.HTTP_200_OK)
        pay_data = portal_payments.data.get('results', portal_payments.data) if isinstance(portal_payments.data, dict) else portal_payments.data
        self.assertEqual(len(pay_data), 2)
        tx_refs = [p['transaction_reference'] for p in pay_data]
        self.assertIn('CBE-FT-8849201', tx_refs)
        self.assertIn('CBE-FT-8849202', tx_refs)
        self.assertTrue(all(p['receipt_url'] is not None for p in pay_data))

    def test_store_manager_rejection_workflow(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier, product=self.product, quantity=5,
            received_quantity=5, damaged_quantity=0,
            status=PurchaseRequest.Status.RECEIVED, requested_by=self.store_manager
        )
        inv = SupplierInvoice.objects.create(
            supplier=self.supplier, purchase_order=po, invoice_number='INV-REJ-STORE-01',
            total_amount=Decimal('250000.00'), status=SupplierInvoice.Status.SUBMITTED,
            submitted_by=self.supplier_user
        )
        self.client.force_authenticate(user=self.store_manager)
        # Attempt without reason -> fails
        fail_res = self.client.post(f'/api/products/supplier-invoices/{inv.id}/store-verify/', {
            'action': 'reject', 'rejection_reason': ''
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Reject with valid reason
        rej_res = self.client.post(f'/api/products/supplier-invoices/{inv.id}/store-verify/', {
            'action': 'reject', 'rejection_reason': 'Mismatched serial numbers on delivery note.'
        }, format='json')
        self.assertEqual(rej_res.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, SupplierInvoice.Status.REJECTED_BY_STORE)
        self.assertEqual(inv.rejection_reason, 'Mismatched serial numbers on delivery note.')

    def test_admin_rejection_workflow(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier, product=self.product, quantity=5,
            received_quantity=5, damaged_quantity=0,
            status=PurchaseRequest.Status.RECEIVED, requested_by=self.store_manager
        )
        inv = SupplierInvoice.objects.create(
            supplier=self.supplier, purchase_order=po, invoice_number='INV-REJ-ADMIN-01',
            total_amount=Decimal('250000.00'), status=SupplierInvoice.Status.PENDING_ADMIN_APPROVAL,
            submitted_by=self.supplier_user
        )
        self.client.force_authenticate(user=self.admin)
        rej_res = self.client.post(f'/api/products/supplier-invoices/{inv.id}/review/', {
            'action': 'reject', 'rejection_reason': 'Invalid tax identification format.'
        }, format='json')
        self.assertEqual(rej_res.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, SupplierInvoice.Status.REJECTED_BY_ADMIN)
        self.assertEqual(inv.rejection_reason, 'Invalid tax identification format.')
