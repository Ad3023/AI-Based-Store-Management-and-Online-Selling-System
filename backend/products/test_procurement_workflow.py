from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from accounts.models import User, AuditLog
from products.models import (
    Supplier, Category, Product, PurchaseRequest, PurchaseOrderItem,
    SupplierInvoice, SupplierPayment, StockMovement
)


class ProcurementWorkflowTests(APITestCase):
    def setUp(self):
        # Create Users
        self.admin = User.objects.create_user(
            username='test_admin',
            email='admin@test.com',
            password='Password123!',
            role=User.RoleChoices.ADMIN
        )
        self.store_manager = User.objects.create_user(
            username='test_store_manager',
            email='sm@test.com',
            password='Password123!',
            role=User.RoleChoices.STORE_MANAGER
        )
        self.customer = User.objects.create_user(
            username='test_customer',
            email='cust@test.com',
            password='Password123!',
            role=User.RoleChoices.CUSTOMER
        )

        # Create Category, Supplier, Product
        self.category = Category.objects.create(name='Laptops')
        self.supplier = Supplier.objects.create(
            name='Acme Tech Distributors',
            contact_person='Abebe Kebede',
            email='abebe@acmetech.et',
            phone='+251911223344',
            address='Bole, Addis Ababa',
            status=Supplier.Status.ACTIVE
        )
        self.product = Product.objects.create(
            name='ThinkPad X1 Carbon',
            category=self.category,
            supplier=self.supplier,
            price=Decimal('150000.00'),
            cost_price=Decimal('120000.00'),
            stock=10,
            low_stock_threshold=5,
            reorder_quantity=15
        )

    def test_store_manager_create_purchase_order(self):
        self.client.force_authenticate(user=self.store_manager)
        data = {
            'supplier': self.supplier.id,
            'expected_supply_date': str(timezone.now().date()),
            'notes': 'Urgent replenishment for warehouse stock.',
            'status': 'PENDING_APPROVAL',
            'items': [
                {
                    'product': self.product.id,
                    'quantity': 10,
                    'unit_price': '120000.00',
                    'notes': 'Batch A'
                }
            ]
        }
        res = self.client.post('/api/products/purchase-requests/', data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'PENDING_APPROVAL')
        self.assertEqual(res.data['total_estimated_cost'], '1200000.00')
        self.assertEqual(len(res.data['items']), 1)

        po = PurchaseRequest.objects.get(pk=res.data['id'])
        self.assertEqual(po.requested_by, self.store_manager)
        self.assertEqual(po.items.count(), 1)

    def test_store_manager_cannot_approve_own_purchase_order(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier,
            product=self.product,
            quantity=10,
            agreed_price=Decimal('120000.00'),
            total_estimated_cost=Decimal('1200000.00'),
            status=PurchaseRequest.Status.PENDING_APPROVAL,
            requested_by=self.store_manager
        )
        self.client.force_authenticate(user=self.store_manager)
        res = self.client.patch(f'/api/products/purchase-requests/{po.id}/', {'status': 'APPROVED'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        po.refresh_from_db()
        self.assertNotEqual(po.status, PurchaseRequest.Status.APPROVED)

    def test_admin_approve_and_reject_purchase_order(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier,
            product=self.product,
            quantity=10,
            agreed_price=Decimal('120000.00'),
            total_estimated_cost=Decimal('1200000.00'),
            status=PurchaseRequest.Status.PENDING_APPROVAL,
            requested_by=self.store_manager
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f'/api/products/purchase-requests/{po.id}/',
            {'status': 'APPROVED', 'admin_feedback': 'Budget approved.'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseRequest.Status.APPROVED)
        self.assertEqual(po.approved_by, self.admin)
        self.assertIn('Budget approved.', po.admin_feedback)

    def test_supplier_dispatch_and_stock_receiving(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier,
            product=self.product,
            quantity=10,
            agreed_price=Decimal('120000.00'),
            total_estimated_cost=Decimal('1200000.00'),
            status=PurchaseRequest.Status.APPROVED,
            requested_by=self.store_manager,
            approved_by=self.admin
        )
        item = PurchaseOrderItem.objects.create(
            purchase_order=po,
            product=self.product,
            quantity=10,
            unit_price=Decimal('120000.00'),
            total_cost=Decimal('1200000.00')
        )

        # Store Manager dispatches to supplier
        self.client.force_authenticate(user=self.store_manager)
        send_res = self.client.post(
            f'/api/products/purchase-requests/{po.id}/send-to-supplier/',
            {'supplier_confirmation_notes': 'Supplier confirmed shipment for Friday.'},
            format='json'
        )
        self.assertEqual(send_res.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseRequest.Status.SENT_TO_SUPPLIER)

        # Receive stock: 8 units in good condition, 2 damaged
        initial_stock = self.product.stock
        rec_res = self.client.post(
            f'/api/products/purchase-requests/{po.id}/receive-stock/',
            {
                'items': [
                    {
                        'id': item.id,
                        'received_quantity': 8,
                        'damaged_quantity': 2
                    }
                ]
            },
            format='json'
        )
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)

        self.product.refresh_from_db()
        po.refresh_from_db()
        # Stock should only increment by good received units (8), not damaged (2)
        self.assertEqual(self.product.stock, initial_stock + 8)
        self.assertEqual(po.received_quantity, 8)
        self.assertEqual(po.damaged_quantity, 2)
        self.assertEqual(po.status, PurchaseRequest.Status.PARTIALLY_RECEIVED)

        # Verify stock movement audit
        movement = StockMovement.objects.filter(product=self.product).latest('created_at')
        self.assertEqual(movement.quantity, 8)
        self.assertEqual(movement.movement_type, StockMovement.MovementType.RESTOCK)

    def test_supplier_invoice_lifecycle_and_duplicate_prevention(self):
        po = PurchaseRequest.objects.create(
            supplier=self.supplier,
            product=self.product,
            quantity=10,
            total_estimated_cost=Decimal('1200000.00'),
            status=PurchaseRequest.Status.APPROVED,
            requested_by=self.store_manager,
            approved_by=self.admin
        )

        # Store Manager records invoice
        self.client.force_authenticate(user=self.store_manager)
        inv_data = {
            'supplier': self.supplier.id,
            'purchase_order': po.id,
            'invoice_number': 'INV-2026-001',
            'invoice_date': str(timezone.now().date()),
            'total_amount': '1200000.00',
            'notes': 'Standard payment term net-30'
        }
        res = self.client.post('/api/products/supplier-invoices/', inv_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'PENDING_APPROVAL')

        # Attempt to record duplicate invoice with same invoice_number for same supplier
        dup_res = self.client.post('/api/products/supplier-invoices/', inv_data, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Duplicate Invoice Detected', dup_res.data['error'])

        # Store Manager cannot approve invoice
        inv_id = res.data['id']
        rev_fail = self.client.post(f'/api/products/supplier-invoices/{inv_id}/review/', {'action': 'approve'}, format='json')
        self.assertEqual(rev_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Admin approves invoice
        self.client.force_authenticate(user=self.admin)
        rev_ok = self.client.post(
            f'/api/products/supplier-invoices/{inv_id}/review/',
            {'action': 'approve', 'review_notes': 'Matched with goods receipt notes.'},
            format='json'
        )
        self.assertEqual(rev_ok.status_code, status.HTTP_200_OK)
        inv = SupplierInvoice.objects.get(pk=inv_id)
        self.assertEqual(inv.status, SupplierInvoice.Status.APPROVED)
        self.assertEqual(inv.reviewed_by, self.admin)

    def test_supplier_payment_authorization_and_balance_update(self):
        inv = SupplierInvoice.objects.create(
            supplier=self.supplier,
            invoice_number='INV-2026-002',
            invoice_date=timezone.now().date(),
            total_amount=Decimal('500000.00'),
            status=SupplierInvoice.Status.APPROVED,
            submitted_by=self.store_manager,
            reviewed_by=self.admin
        )

        # Store Manager cannot authorize payment
        self.client.force_authenticate(user=self.store_manager)
        pay_fail = self.client.post(
            '/api/products/supplier-payments/',
            {
                'supplier': self.supplier.id,
                'invoice': inv.id,
                'amount_paid': '250000.00',
                'payment_method': 'BANK_TRANSFER',
                'transaction_reference': 'TX-CBE-987654'
            },
            format='json'
        )
        self.assertEqual(pay_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Admin authorizes partial payment of 250,000 ETB
        self.client.force_authenticate(user=self.admin)
        pay_ok = self.client.post(
            '/api/products/supplier-payments/',
            {
                'supplier': self.supplier.id,
                'invoice': inv.id,
                'amount_paid': '250000.00',
                'payment_method': 'BANK_TRANSFER',
                'transaction_reference': 'TX-CBE-987654'
            },
            format='json'
        )
        self.assertEqual(pay_ok.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.paid_amount, Decimal('250000.00'))
        self.assertEqual(inv.status, SupplierInvoice.Status.PARTIALLY_PAID)

        # Duplicate transaction reference prevention
        dup_pay = self.client.post(
            '/api/products/supplier-payments/',
            {
                'supplier': self.supplier.id,
                'invoice': inv.id,
                'amount_paid': '250000.00',
                'payment_method': 'BANK_TRANSFER',
                'transaction_reference': 'TX-CBE-987654'
            },
            format='json'
        )
        self.assertEqual(dup_pay.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Duplicate Payment Reference', dup_pay.data['error'])

        # Pay remainder
        pay_final = self.client.post(
            '/api/products/supplier-payments/',
            {
                'supplier': self.supplier.id,
                'invoice': inv.id,
                'amount_paid': '250000.00',
                'payment_method': 'BANK_TRANSFER',
                'transaction_reference': 'TX-CBE-987655'
            },
            format='json'
        )
        self.assertEqual(pay_final.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.paid_amount, Decimal('500000.00'))
        self.assertEqual(inv.status, SupplierInvoice.Status.PAID)

    def test_procurement_reports_and_supplier_history(self):
        self.client.force_authenticate(user=self.admin)
        rep_res = self.client.get('/api/products/procurement/reports/')
        self.assertEqual(rep_res.status_code, status.HTTP_200_OK)
        self.assertIn('summary', rep_res.data)
        self.assertIn('supplier_breakdown', rep_res.data)
        self.assertIn('monthly_expenses', rep_res.data)

        hist_res = self.client.get(f'/api/products/suppliers/{self.supplier.id}/history/')
        self.assertEqual(hist_res.status_code, status.HTTP_200_OK)
        self.assertIn('purchase_orders', hist_res.data)
        self.assertIn('invoices', hist_res.data)
        self.assertIn('payments', hist_res.data)
