import json
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from products.models import (
    Supplier, Product, Category, RequestForQuotation, RFQItem,
    SupplierQuotation, SupplierQuotationItem, PurchaseRequest
)


class SupplierQuotationWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Laptops & Computers", slug="laptops")
        self.laptop = Product.objects.create(
            category=self.category,
            name="Lenovo ThinkPad X1 Carbon",
            slug="lenovo-thinkpad-x1-carbon",
            sku="TP-X1-001",
            price=Decimal("95000.00"), # Customer selling price
            stock=2,
            cost_price=Decimal("75000.00")
        )

        # Users
        self.admin = User.objects.create_superuser(
            username="rfq_admin",
            email="admin@ethiotech.com",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN
        )

        self.store_manager = User.objects.create_user(
            username="rfq_manager",
            email="manager@ethiotech.com",
            password="StorePassword123!",
            role=User.RoleChoices.STORE_MANAGER
        )

        # Supplier 1: Lenovo Official Importers PLC
        self.supplier_user1 = User.objects.create_user(
            username="supplier_lenovo",
            email="lenovo@supplier.com",
            password="SupplierPassword123!",
            role=User.RoleChoices.SUPPLIER
        )
        self.supplier1 = Supplier.objects.create(
            user=self.supplier_user1,
            name="Lenovo Official Importers PLC",
            email="lenovo@supplier.com",
            phone="+251911111111",
            bank_name="Commercial Bank of Ethiopia",
            bank_account_number="1000111111111",
            status=Supplier.Status.ACTIVE
        )

        # Supplier 2: Competitor Tech PLC
        self.supplier_user2 = User.objects.create_user(
            username="supplier_competitor",
            email="competitor@supplier.com",
            password="SupplierPassword123!",
            role=User.RoleChoices.SUPPLIER
        )
        self.supplier2 = Supplier.objects.create(
            user=self.supplier_user2,
            name="Competitor Tech PLC",
            email="competitor@supplier.com",
            phone="+251922222222",
            bank_name="Awash Bank",
            bank_account_number="2000222222222",
            status=Supplier.Status.ACTIVE
        )

    def test_complete_rfq_and_quotation_lifecycle(self):
        # -------------------------------------------------------------
        # STEP 1: Store Manager creates an RFQ for 10 ThinkPads to Supplier 1
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.store_manager)
        rfq_payload = {
            'supplier': self.supplier1.id,
            'required_delivery_date': str(timezone.now().date() + timezone.timedelta(days=7)),
            'notes': 'Urgent procurement for enterprise customer order.',
            'items': [
                {
                    'product': self.laptop.id,
                    'requested_quantity': 10,
                    'target_price': '78000.00',
                    'notes': 'Must include manufacturer warranty.'
                }
            ]
        }
        res_rfq = self.client.post('/api/products/rfqs/', rfq_payload, format='json')
        self.assertEqual(res_rfq.status_code, status.HTTP_201_CREATED)
        rfq_id = res_rfq.data['id']
        rfq = RequestForQuotation.objects.get(pk=rfq_id)
        self.assertEqual(rfq.status, RequestForQuotation.Status.SENT)
        self.assertEqual(rfq.items.count(), 1)
        self.assertEqual(rfq.items.first().requested_quantity, 10)

        # -------------------------------------------------------------
        # STEP 2: Isolation Security Verification: Supplier 2 CANNOT access Supplier 1's RFQ
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user2)
        sup2_list = self.client.get('/api/supplier/rfqs/')
        self.assertEqual(sup2_list.status_code, status.HTTP_200_OK)
        sup2_rfqs = sup2_list.data.get('results', sup2_list.data) if isinstance(sup2_list.data, dict) else sup2_list.data
        self.assertFalse(any(r['id'] == rfq_id for r in sup2_rfqs))

        sup2_detail = self.client.get(f'/api/supplier/rfqs/{rfq_id}/')
        self.assertEqual(sup2_detail.status_code, status.HTTP_404_NOT_FOUND)

        # -------------------------------------------------------------
        # STEP 3: Supplier 1 views the RFQ -> auto marked as VIEWED
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user1)
        sup1_detail = self.client.get(f'/api/supplier/rfqs/{rfq_id}/')
        self.assertEqual(sup1_detail.status_code, status.HTTP_200_OK)
        rfq.refresh_from_db()
        self.assertEqual(rfq.status, RequestForQuotation.Status.VIEWED)
        self.assertIsNotNone(rfq.viewed_at)

        # -------------------------------------------------------------
        # STEP 4: Supplier 1 submits Quotation: 10 units @ ETB 80,000 = ETB 800,000
        # -------------------------------------------------------------
        quo_payload = {
            'rfq': rfq_id,
            'delivery_lead_time': '3 days',
            'estimated_delivery_date': str(timezone.now().date() + timezone.timedelta(days=3)),
            'payment_terms': 'Bank transfer after delivery',
            'notes': 'Price valid for 14 days. Delivered with original packaging.',
            'items': [
                {
                    'product': self.laptop.id,
                    'rfq_item': rfq.items.first().id,
                    'requested_quantity': 10,
                    'offered_unit_price': '80000.00',
                    'available_quantity': 15,
                    'notes': '15 units available in Addis Ababa warehouse.'
                }
            ]
        }
        res_quo = self.client.post('/api/supplier/quotations/', quo_payload, format='json')
        self.assertEqual(res_quo.status_code, status.HTTP_201_CREATED)
        quo_id = res_quo.data['id']
        quotation = SupplierQuotation.objects.get(pk=quo_id)
        self.assertEqual(quotation.total_amount, Decimal('800000.00'))
        self.assertEqual(quotation.status, SupplierQuotation.Status.SUBMITTED)

        rfq.refresh_from_db()
        self.assertEqual(rfq.status, RequestForQuotation.Status.RESPONDED)
        self.assertIsNotNone(rfq.responded_at)

        # -------------------------------------------------------------
        # STEP 5: Store Manager compares quotations
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.store_manager)
        compare_res = self.client.get(f'/api/products/quotations/compare/?rfq_id={rfq_id}')
        self.assertEqual(compare_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(compare_res.data), 1)
        self.assertEqual(compare_res.data[0]['supplier_name'], "Lenovo Official Importers PLC")
        self.assertEqual(compare_res.data[0]['offered_unit_price'], '80000.00')
        self.assertEqual(compare_res.data[0]['total_quotation_amount'], '800000.00')

        # -------------------------------------------------------------
        # STEP 6: Store Manager selects Supplier 1's quotation
        # -------------------------------------------------------------
        sel_res = self.client.post(f'/api/products/quotations/{quo_id}/select/', {
            'selection_notes': 'Best pricing and prompt 3-day delivery timeline.'
        }, format='json')
        self.assertEqual(sel_res.status_code, status.HTTP_200_OK)
        quotation.refresh_from_db()
        self.assertEqual(quotation.status, SupplierQuotation.Status.SELECTED)
        self.assertEqual(quotation.selected_by, self.store_manager)

        # -------------------------------------------------------------
        # STEP 7: Convert Quotation to Purchase Order
        # -------------------------------------------------------------
        po_convert_res = self.client.post(f'/api/products/quotations/{quo_id}/create-po/', {}, format='json')
        self.assertEqual(po_convert_res.status_code, status.HTTP_201_CREATED)
        po_id = po_convert_res.data['purchase_order']['id']
        po = PurchaseRequest.objects.get(pk=po_id)

        # Verify PO was populated with supplier's quoted price, NOT random prices
        self.assertEqual(po.supplier, self.supplier1)
        self.assertEqual(po.quotation, quotation)
        self.assertEqual(po.quantity, 10)
        self.assertEqual(po.total_estimated_cost, Decimal('800000.00'))
        self.assertEqual(po.agreed_price, Decimal('800000.00') / 10)
        self.assertEqual(po.status, PurchaseRequest.Status.PENDING_APPROVAL)

        # Customer selling price must NOT change!
        self.laptop.refresh_from_db()
        self.assertEqual(self.laptop.price, Decimal("95000.00"))

        # -------------------------------------------------------------
        # STEP 8: Admin approves the Purchase Order
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.admin)
        admin_appr = self.client.patch(f'/api/products/purchase-requests/{po_id}/', {
            'status': 'APPROVED',
            'admin_feedback': 'Approved based on negotiated quotation # ' + quotation.quotation_number
        }, format='json')
        self.assertEqual(admin_appr.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseRequest.Status.APPROVED)
        self.assertEqual(po.approved_by, self.admin)

        # -------------------------------------------------------------
        # STEP 9: Supplier receives and inspects the approved PO
        # -------------------------------------------------------------
        self.client.force_authenticate(user=self.supplier_user1)
        sup_po_res = self.client.get(f'/api/supplier/purchase-orders/{po_id}/')
        self.assertEqual(sup_po_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sup_po_res.data['total_cost'], '800000.00')
        self.assertEqual(sup_po_res.data['status'], 'APPROVED')

    def test_supplier_decline_rfq_workflow(self):
        self.client.force_authenticate(user=self.store_manager)
        rfq = RequestForQuotation.objects.create(
            supplier=self.supplier1,
            created_by=self.store_manager,
            status=RequestForQuotation.Status.SENT
        )
        RFQItem.objects.create(rfq=rfq, product=self.laptop, requested_quantity=50)

        self.client.force_authenticate(user=self.supplier_user1)
        dec_res = self.client.post(f'/api/supplier/rfqs/{rfq.id}/', {
            'action': 'decline',
            'decline_reason': 'Out of stock until next quarter importation.'
        }, format='json')
        self.assertEqual(dec_res.status_code, status.HTTP_200_OK)
        rfq.refresh_from_db()
        self.assertEqual(rfq.status, RequestForQuotation.Status.DECLINED)
        self.assertEqual(rfq.decline_reason, 'Out of stock until next quarter importation.')

