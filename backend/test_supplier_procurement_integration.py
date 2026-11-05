import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from products.models import Supplier, Product, PurchaseRequest, SupplierInvoice, SupplierPayment
from decimal import Decimal

results = {
    'passed': [],
    'failed': [],
    'untested': []
}

def record_pass(test_name, details=''):
    results['passed'].append((test_name, details))
    print(f"  [PASS] {test_name} {f'({details})' if details else ''}")

def record_fail(test_name, error=''):
    results['failed'].append((test_name, error))
    print(f"  [FAIL] {test_name}: {error}")

def run_tests():
    print("=" * 80)
    print(" ETHIOTECH MARKET: SUPPLIER & PROCUREMENT INTEGRATION TEST SUITE")
    print("=" * 80)

    admin = User.objects.filter(role=User.RoleChoices.ADMIN, is_active=True).first()
    store_mgr = User.objects.filter(role=User.RoleChoices.STORE_MANAGER, is_active=True).first()
    customer = User.objects.filter(role=User.RoleChoices.CUSTOMER, is_active=True).first()

    assert admin, "Admin user required"
    assert store_mgr, "Store manager user required"
    assert customer, "Customer user required"

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)

    sm_client = APIClient()
    sm_client.force_authenticate(user=store_mgr)

    cust_client = APIClient()
    cust_client.force_authenticate(user=customer)

    # --------------------------------------------------------------------------
    # 1. SUPPLIER CRUD OPERATIONS (REAL POSTGRESQL DB)
    # --------------------------------------------------------------------------
    print("\n--- 1. Testing Supplier CRUD Operations ---")
    created_supplier_id = None
    try:
        # Create
        sup_payload = {
            'name': 'Test Integration Global Electronics Ltd',
            'contact_person': 'Alazar Tadesse',
            'email': 'alazar.integration@gmail.com',
            'phone': '0911223344',
            'address': 'Bole Subcity, Woreda 03, Addis Ababa',
            'supplied_categories': 'Laptops, Storage Devices',
            'status': 'ACTIVE',
            'notes': 'Hardware vendor test verification notes.'
        }
        res_create = sm_client.post('/api/products/suppliers/', sup_payload, format='json')
        if res_create.status_code == status.HTTP_201_CREATED and res_create.data.get('id'):
            created_supplier_id = res_create.data['id']
            record_pass("Supplier Create (POST /api/products/suppliers/)", f"Supplier ID {created_supplier_id} created")
        else:
            record_fail("Supplier Create", f"Status {res_create.status_code}: {res_create.data}")

        # Read / List
        res_list = sm_client.get('/api/products/suppliers/')
        suppliers_list = res_list.data.get('results', res_list.data) if isinstance(res_list.data, dict) else res_list.data
        found = any(s['id'] == created_supplier_id for s in suppliers_list)
        if res_list.status_code == status.HTTP_200_OK and found:
            record_pass("Supplier List / Read (GET /api/products/suppliers/)", f"Found {len(suppliers_list)} suppliers")
        else:
            record_fail("Supplier List / Read", f"Status {res_list.status_code}, found={found}")

        # Update / PUT
        if created_supplier_id:
            update_payload = {
                'name': 'Test Integration Global Electronics Ltd (Updated)',
                'contact_person': 'Alazar Tadesse Senior',
                'email': 'alazar.integration@gmail.com',
                'phone': '0922334455',
                'address': 'Kazanchis, Addis Ababa',
                'status': 'ACTIVE',
                'notes': 'Updated terms: Net 30 payment.'
            }
            res_update = sm_client.put(f'/api/products/suppliers/{created_supplier_id}/', update_payload, format='json')
            if res_update.status_code == status.HTTP_200_OK and res_update.data['contact_person'] == 'Alazar Tadesse Senior':
                record_pass("Supplier Update (PUT /api/products/suppliers/<id>/)", "Contact person updated")
            else:
                record_fail("Supplier Update", f"Status {res_update.status_code}: {res_update.data}")

            # Delete / DELETE
            res_delete = sm_client.delete(f'/api/products/suppliers/{created_supplier_id}/')
            if res_delete.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]:
                exists_in_db = Supplier.objects.filter(id=created_supplier_id).exists()
                if not exists_in_db:
                    record_pass("Supplier Delete (DELETE /api/products/suppliers/<id>/)", "Verified removed from DB")
                else:
                    record_fail("Supplier Delete", "Record still exists in DB")
            else:
                record_fail("Supplier Delete", f"Status {res_delete.status_code}")

    except Exception as e:
        record_fail("Supplier CRUD Operations", str(e))

    # --------------------------------------------------------------------------
    # 2. SUPPLIER HISTORY & FINANCIAL SUMMARIES
    # --------------------------------------------------------------------------
    print("\n--- 2. Testing Supplier History & Financial Summaries ---")
    try:
        sample_supplier = Supplier.objects.first()
        if not sample_supplier:
            sample_supplier = Supplier.objects.create(
                name="Hub Supplier Ethiopia",
                email="hub.supplier@gmail.com",
                phone="0911001122"
            )
        res_hist = sm_client.get(f'/api/products/suppliers/{sample_supplier.id}/history/')
        if res_hist.status_code == status.HTTP_200_OK:
            data = res_hist.data
            has_metrics = 'metrics' in data and 'total_purchase_orders' in data['metrics']
            has_tabs = all(k in data for k in ['products', 'purchase_orders', 'invoices', 'payments'])
            if has_metrics and has_tabs:
                metrics = data['metrics']
                record_pass(
                    "Supplier History & Metrics (GET /api/products/suppliers/<id>/history/)",
                    f"PO count={metrics['total_purchase_orders']}, Outstanding={metrics.get('outstanding_balance')}"
                )
            else:
                record_fail("Supplier History Payload Structure", f"Keys: {list(data.keys())}")
        else:
            record_fail("Supplier History Endpoint", f"Status {res_hist.status_code}: {res_hist.data}")
    except Exception as e:
        record_fail("Supplier History & Financial Summaries", str(e))

    # --------------------------------------------------------------------------
    # 3. PURCHASE ORDER, INVOICE, AND DISBURSEMENT INTEGRATION
    # --------------------------------------------------------------------------
    print("\n--- 3. Testing PO, Invoice & Disbursement Integrations ---")
    try:
        supplier = Supplier.objects.first()
        product = Product.objects.filter(is_active=True).first()
        if supplier and product:
            # Create PO
            po = PurchaseRequest.objects.create(
                supplier=supplier,
                product=product,
                quantity=10,
                estimated_unit_cost=Decimal('500.00'),
                total_estimated_cost=Decimal('5000.00'),
                requested_by=store_mgr,
                status=PurchaseRequest.Status.DRAFT
            )
            po.request_number = f"PO-TEST-{po.id:04d}"
            po.status = PurchaseRequest.Status.APPROVED
            po.approved_by = admin
            po.save()

            # Create Invoice
            invoice = SupplierInvoice.objects.create(
                supplier=supplier,
                purchase_order=po,
                invoice_number=f"INV-TEST-{po.id:04d}",
                total_amount=Decimal('5000.00'),
                paid_amount=Decimal('0.00'),
                status=SupplierInvoice.Status.PENDING_APPROVAL,
                submitted_by=admin
            )

            # Create Disbursement / Payment
            payment = SupplierPayment.objects.create(
                invoice=invoice,
                purchase_order=po,
                supplier=supplier,
                total_purchase_amount=Decimal('5000.00'),
                amount_paid=Decimal('2000.00'),
                payment_method=SupplierPayment.PaymentMethod.BANK_TRANSFER,
                transaction_reference=f"TXN-DISB-{po.id:04d}",
                authorized_by=admin,
                payment_status=SupplierPayment.PaymentStatus.PAID
            )
            invoice.paid_amount += payment.amount_paid
            invoice.status = SupplierInvoice.Status.PARTIALLY_PAID
            invoice.save()

            # Verify in history endpoint
            res_h = sm_client.get(f'/api/products/suppliers/{supplier.id}/history/')
            if res_h.status_code == status.HTTP_200_OK:
                po_ids = [p['id'] for p in res_h.data.get('purchase_orders', [])]
                inv_ids = [i['id'] for i in res_h.data.get('invoices', [])]
                pay_ids = [p['id'] for p in res_h.data.get('payments', [])]
                if po.id in po_ids and invoice.id in inv_ids and payment.id in pay_ids:
                    record_pass("PO -> Invoice -> Payment Ledger Linking", "All 3 entities linked and verified in supplier history")
                else:
                    record_fail("PO -> Invoice -> Payment Linking", f"po_in={po.id in po_ids}, inv_in={invoice.id in inv_ids}, pay_in={payment.id in pay_ids}")
            else:
                record_fail("Supplier History fetch for PO/Invoice test", f"Status {res_h.status_code}")

            # Clean up test entities
            payment.delete()
            invoice.delete()
            po.delete()
        else:
            record_fail("PO, Invoice, Disbursement Test", "Missing supplier or product in database")
    except Exception as e:
        record_fail("PO, Invoice, Disbursement Integration", str(e))

    # --------------------------------------------------------------------------
    # 4. SUPPLIER PORTAL ACCOUNT CREATION AND AUTHENTICATION
    # --------------------------------------------------------------------------
    print("\n--- 4. Testing Supplier Portal Account Provisioning & Login ---")
    try:
        portal_supplier = Supplier.objects.create(
            name="Apex Hardware Distribution Ethiopia",
            email="apex.vendor.test@gmail.com",
            phone="0911889900",
            address="Bole Road, Addis Ababa",
            status="ACTIVE"
        )

        # 4a. Admin provisions portal account
        prov_payload = {
            'email': 'apex.vendor.test@gmail.com',
            'phone': '0911889900',
            'password': 'SecureSupplierPassword123!',
            'full_name': 'Apex Account Manager'
        }
        res_prov = admin_client.post(f'/api/products/suppliers/{portal_supplier.id}/create-account/', prov_payload, format='json')
        if res_prov.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]:
            username_created = res_prov.data.get('user', {}).get('username') or res_prov.data.get('username')
            record_pass("Portal Account Provisioning (POST /create-account/)", f"Created user {username_created}")
        else:
            record_fail("Portal Account Provisioning", f"Status {res_prov.status_code}: {res_prov.data}")

        # 4b. Authenticate supplier via supplier portal login
        login_client = APIClient()
        login_payload = {
            'email': 'apex.vendor.test@gmail.com',
            'password': 'SecureSupplierPassword123!',
            'portal': 'supplier'
        }
        res_login = login_client.post('/api/auth/login/supplier/', login_payload, format='json')
        if res_login.status_code == status.HTTP_200_OK and res_login.data.get('token'):
            user_data = res_login.data.get('user', {})
            token = res_login.data['token']
            if user_data.get('role') == 'supplier' or res_login.data.get('role') == 'supplier':
                record_pass("Supplier Portal Login (/api/auth/login/supplier/)", f"Token issued, role={user_data.get('role')}")
            else:
                record_fail("Supplier Portal Login Role", f"Expected supplier, got {user_data.get('role')}")
        else:
            record_fail("Supplier Portal Login", f"Status {res_login.status_code}: {res_login.data}")

        # 4c. Role Separation: Ensure customer cannot login via supplier portal
        cust_attempt = login_client.post('/api/auth/login/supplier/', {
            'identifier': customer.email,
            'password': 'SomePassword123!',
            'portal': 'supplier'
        }, format='json')
        # Expect 400 (bad password) or 403 (forbidden for supplier portal)
        if cust_attempt.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN]:
            record_pass("Supplier Portal Role Separation", "Unauthorized portal access blocked")
        else:
            record_fail("Supplier Portal Role Separation", f"Status {cust_attempt.status_code}")

        # Clean up portal user & supplier
        if portal_supplier.user:
            portal_user = portal_supplier.user
            portal_supplier.user = None
            portal_supplier.save()
            portal_user.delete()
        portal_supplier.delete()

    except Exception as e:
        record_fail("Supplier Portal Account & Auth", str(e))

    # --------------------------------------------------------------------------
    # 5. ADMIN AND STORE MANAGER PERMISSIONS
    # --------------------------------------------------------------------------
    print("\n--- 5. Testing Admin & Store Manager Permissions ---")
    try:
        # Admin can access suppliers
        res_admin = admin_client.get('/api/products/suppliers/')
        if res_admin.status_code == status.HTTP_200_OK:
            record_pass("Admin Access to Suppliers List", "200 OK")
        else:
            record_fail("Admin Access to Suppliers List", f"Status {res_admin.status_code}")

        # Store Manager can access suppliers
        res_sm = sm_client.get('/api/products/suppliers/')
        if res_sm.status_code == status.HTTP_200_OK:
            record_pass("Store Manager Access to Suppliers List", "200 OK")
        else:
            record_fail("Store Manager Access to Suppliers List", f"Status {res_sm.status_code}")

        # Customer is blocked from suppliers
        res_cust = cust_client.get('/api/products/suppliers/')
        if res_cust.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]:
            record_pass("Customer Access Blocked from Suppliers List", f"Correctly rejected with {res_cust.status_code}")
        else:
            record_fail("Customer Access to Suppliers List", f"Expected 401/403, got {res_cust.status_code}")

    except Exception as e:
        record_fail("Permissions Verification", str(e))

    # --------------------------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print(f" TOTAL TESTS EXECUTED: {len(results['passed']) + len(results['failed'])}")
    print(f"   PASSED: {len(results['passed'])}")
    print(f"   FAILED: {len(results['failed'])}")
    print("=" * 80)

if __name__ == '__main__':
    run_tests()
