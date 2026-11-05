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
    'failed': []
}

def record_pass(test_name, details=''):
    results['passed'].append((test_name, details))
    print(f"  [PASS] {test_name} {f'({details})' if details else ''}")

def record_fail(test_name, error=''):
    results['failed'].append((test_name, error))
    print(f"  [FAIL] {test_name}: {error}")

def run_tests():
    print("=" * 80)
    print(" ETHIOTECH MARKET: SUPPLIER ACCOUNT PROVISIONING & DASHBOARD TEST SUITE")
    print("=" * 80)

    admin = User.objects.filter(role=User.RoleChoices.ADMIN, is_active=True).first()
    store_mgr = User.objects.filter(role=User.RoleChoices.STORE_MANAGER, is_active=True).first()
    assert admin, "Admin user required"
    assert store_mgr, "Store manager user required"

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)

    sm_client = APIClient()
    sm_client.force_authenticate(user=store_mgr)

    target_email = "gucheaddisu5@gmail.com"
    target_phone = "0911556677"
    supplier_name = "Guche Addisu Tech Distro"

    # Temporary initial password provided by admin
    initial_temp_pass = "TempSupplierPass2026!"
    # Permanent password set by supplier upon forced password change
    permanent_pass = "GucheAddisu2026!Secure"

    supplier = None
    created_user = None

    # --------------------------------------------------------------------------
    # 1. CREATE SUPPLIER ACCOUNT
    # --------------------------------------------------------------------------
    print("\n--- 1. Create Supplier Account ---")
    try:
        # Check existing supplier or create supplier entity
        supplier = Supplier.objects.filter(email__iexact=target_email).first()
        if not supplier:
            sup_res = admin_client.post('/api/products/suppliers/', {
                'name': supplier_name,
                'contact_person': 'Guche Addisu',
                'email': target_email,
                'phone': target_phone,
                'address': 'Bole Subcity, Addis Ababa, Ethiopia',
                'supplied_categories': 'Laptops, Accessories, Storage',
                'status': 'ACTIVE',
                'notes': 'Official hardware vendor for laptops and peripherals.'
            }, format='json')
            assert sup_res.status_code == status.HTTP_201_CREATED, f"Failed to create supplier: {sup_res.data}"
            supplier = Supplier.objects.get(id=sup_res.data['id'])
            record_pass("Supplier Entity Created", f"ID: {supplier.id}, Name: {supplier.name}")
        else:
            record_pass("Existing Supplier Entity Found", f"ID: {supplier.id}")

        # Provision Portal Account via Admin
        prov_payload = {
            'email': target_email,
            'phone': target_phone,
            'password': initial_temp_pass,
            'full_name': 'Guche Addisu'
        }
        res_prov = admin_client.post(f'/api/products/suppliers/{supplier.id}/create-account/', prov_payload, format='json')
        assert res_prov.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED], f"Provisioning failed: {res_prov.data}"

        created_user = User.objects.get(email__iexact=target_email)
        assert created_user.role == User.RoleChoices.SUPPLIER, f"Role mismatch: {created_user.role}"
        assert created_user.is_active is True, "User account is not active"
        assert created_user.must_change_password is True, "must_change_password flag not set"
        assert not created_user.is_admin(), "User erroneously has admin access"
        assert not created_user.is_store_manager(), "User erroneously has store manager access"
        assert not created_user.is_customer(), "User erroneously has customer access"

        record_pass(
            "Supplier Account Provisioned",
            f"User: {created_user.username}, Role: {created_user.role}, must_change_password: {created_user.must_change_password}"
        )

        # Duplicate check: Attempting to create duplicate account
        dup_res = admin_client.post(f'/api/products/suppliers/{supplier.id}/create-account/', prov_payload, format='json')
        assert dup_res.status_code == status.HTTP_200_OK, "Re-provisioning should update or link without duplicating"
        user_count = User.objects.filter(email__iexact=target_email).count()
        assert user_count == 1, f"Expected exactly 1 user, found {user_count}"
        record_pass("Duplicate Account Prevention", f"Verified single user in DB (count={user_count})")

    except Exception as e:
        record_fail("Create Supplier Account", str(e))

    # --------------------------------------------------------------------------
    # 2. TEST SUPPLIER LOGIN & PASSWORD CHANGE ENFORCEMENT
    # --------------------------------------------------------------------------
    print("\n--- 2. Test Supplier Login & Password Change Enforcement ---")
    supplier_client = APIClient()
    try:
        # 2a. Login with initial temporary password
        login_res = supplier_client.post('/api/auth/login/supplier/', {
            'email': target_email,
            'password': initial_temp_pass,
            'portal': 'supplier'
        }, format='json')
        assert login_res.status_code == status.HTTP_200_OK, f"Login failed: {login_res.data}"
        token = login_res.data['token']
        role = login_res.data['role']
        dashboard_url = login_res.data.get('dashboard_url')
        must_change_pw = login_res.data.get('must_change_password')

        assert token, "Token not returned"
        assert role == 'supplier', f"Role is {role}"
        assert dashboard_url == '/supplier/dashboard', f"Dashboard URL is {dashboard_url}"
        assert must_change_pw is True, "must_change_password should be True on initial login"

        record_pass("Supplier Portal Authentication", f"Token issued, redirect={dashboard_url}, must_change_pw={must_change_pw}")

        # Set auth credentials for subsequent requests
        supplier_client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        # 2b. Supplier changes temporary password to permanent password
        chg_res = supplier_client.post('/api/auth/change-password/', {
            'old_password': initial_temp_pass,
            'new_password': permanent_pass,
            'new_password_confirm': permanent_pass
        }, format='json')
        assert chg_res.status_code == status.HTTP_200_OK, f"Password change failed: {chg_res.data}"

        created_user.refresh_from_db()
        assert created_user.check_password(permanent_pass), "New permanent password does not authenticate in DB"
        assert created_user.must_change_password is False, "must_change_password was not cleared"
        record_pass("Forced Password Change Enforcement", "Password updated, must_change_password cleared")

        # 2c. Verify login with new permanent password
        supplier_client.credentials()  # Clear credentials
        new_login_res = supplier_client.post('/api/auth/login/supplier/', {
            'email': target_email,
            'password': permanent_pass,
            'portal': 'supplier'
        }, format='json')
        assert new_login_res.status_code == status.HTTP_200_OK, f"New login failed: {new_login_res.data}"
        new_token = new_login_res.data['token']
        supplier_client.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")
        record_pass("Login with Permanent Password", f"Successful token: {new_token[:10]}...")

        # 2d. Verify old temporary password is now invalid
        old_attempt = supplier_client.post('/api/auth/login/supplier/', {
            'email': target_email,
            'password': initial_temp_pass,
            'portal': 'supplier'
        }, format='json')
        assert old_attempt.status_code == status.HTTP_400_BAD_REQUEST, "Old password must be rejected"
        record_pass("Old Password Invalidation", "Temporary password correctly rejected")

    except Exception as e:
        record_fail("Test Supplier Login & Password Change", str(e))

    # --------------------------------------------------------------------------
    # 3. INSPECT SUPPLIER DASHBOARD FEATURES
    # --------------------------------------------------------------------------
    print("\n--- 3. Inspect Supplier Dashboard Features ---")
    po = None
    invoice = None
    try:
        # 3a. Supplier Dashboard Stats
        stats_res = supplier_client.get('/api/supplier/dashboard/')
        assert stats_res.status_code == status.HTTP_200_OK, f"Dashboard stats failed: {stats_res.data}"
        assert 'kpis' in stats_res.data or 'metrics' in stats_res.data, "KPIs missing from dashboard"
        assert stats_res.data['supplier']['id'] == supplier.id, "Dashboard returned incorrect supplier"
        record_pass("Supplier Dashboard Stats (GET /api/supplier/dashboard/)", f"Supplier: {stats_res.data['supplier']['name']}")

        # 3b. Store Manager creates a Purchase Order for this supplier
        product = Product.objects.filter(is_active=True).first()
        assert product, "Product required"

        po = PurchaseRequest.objects.create(
            supplier=supplier,
            product=product,
            quantity=15,
            estimated_unit_cost=Decimal('1200.00'),
            total_estimated_cost=Decimal('18000.00'),
            requested_by=store_mgr,
            status=PurchaseRequest.Status.APPROVED,
            approved_by=admin
        )
        po.request_number = f"PO-GUCHE-{po.id:04d}"
        po.save()

        # Send to supplier
        send_res = sm_client.post(f'/api/products/purchase-requests/{po.id}/send-to-supplier/', {
            'supplier_confirmation_notes': 'Sent to Guche Addisu for fulfillment.'
        }, format='json')
        assert send_res.status_code == status.HTTP_200_OK, f"Send PO failed: {send_res.data}"
        po.refresh_from_db()
        record_pass("PO Sent to Supplier", f"PO Number: {po.request_number}, Status: {po.status}")

        # 3c. Supplier Views Assigned Purchase Orders
        po_list_res = supplier_client.get('/api/supplier/purchase-orders/')
        assert po_list_res.status_code == status.HTTP_200_OK, f"PO list failed: {po_list_res.data}"
        po_list = po_list_res.data.get('results', po_list_res.data) if isinstance(po_list_res.data, dict) else po_list_res.data
        found_po = any(p['id'] == po.id for p in po_list)
        assert found_po, f"PO {po.id} not found in supplier's assigned orders list"
        record_pass("Supplier View Assigned Orders (GET /api/supplier/purchase-orders/)", f"Found {len(po_list)} PO(s)")

        # 3d. Supplier Views Purchase Order Details
        po_detail_res = supplier_client.get(f'/api/supplier/purchase-orders/{po.id}/')
        assert po_detail_res.status_code == status.HTTP_200_OK, f"PO detail failed: {po_detail_res.data}"
        assert po_detail_res.data['id'] == po.id, "PO detail ID mismatch"
        record_pass("Supplier View Order Details (GET /api/supplier/purchase-orders/<id>/)", f"PO: {po_detail_res.data.get('request_number')}")

        # 3e. Supplier Accepts Purchase Order & Confirms Delivery Date
        respond_res = supplier_client.post(f'/api/supplier/purchase-orders/{po.id}/respond/', {
            'action': 'accept',
            'suggested_delivery_date': '2026-11-20',
            'notes': 'All 15 units available in warehouse. Dispatched within 48h.'
        }, format='json')
        assert respond_res.status_code == status.HTTP_200_OK, f"PO respond failed: {respond_res.data}"
        po.refresh_from_db()
        assert po.status == PurchaseRequest.Status.ACCEPTED, f"Status is {po.status}"
        record_pass("Supplier Accepts Purchase Order (POST /respond/)", f"Status: {po.status}")

        # 3f. Supplier Updates Delivery Progress (PREPARING -> READY_FOR_DELIVERY -> SHIPPED)
        deliv_res = supplier_client.post(f'/api/supplier/purchase-orders/{po.id}/delivery-update/', {
            'status': 'SHIPPED',
            'carrier': 'Ethio Logistics Express',
            'tracking_number': f'ETX-{po.id}-9988',
            'notes': 'En route to EthioTech central warehouse.'
        }, format='json')
        assert deliv_res.status_code == status.HTTP_200_OK, f"Delivery update failed: {deliv_res.data}"
        po.refresh_from_db()
        assert po.status == PurchaseRequest.Status.SHIPPED, f"Status is {po.status}"
        record_pass("Supplier Updates Delivery Progress (POST /delivery-update/)", f"Carrier: {po.supplier_shipping_carrier}, Status: {po.status}")

        # 3g. Supplier Uploads Invoice
        inv_res = supplier_client.post('/api/supplier/invoices/', {
            'purchase_order': po.id,
            'invoice_number': f"INV-GUCHE-{po.id:04d}",
            'invoice_date': '2026-11-05',
            'due_date': '2026-12-05',
            'total_amount': '18000.00',
            'notes': 'Commercial invoice for 15 units of hardware.'
        }, format='json')
        assert inv_res.status_code == status.HTTP_201_CREATED, f"Invoice upload failed: {inv_res.data}"
        invoice_id = inv_res.data['id']
        invoice = SupplierInvoice.objects.get(id=invoice_id)
        record_pass("Supplier Uploads Invoice (POST /api/supplier/invoices/)", f"Invoice ID {invoice_id}, Number: {invoice.invoice_number}")

        # 3h. Supplier Views Invoice History
        inv_list_res = supplier_client.get('/api/supplier/invoices/')
        assert inv_list_res.status_code == status.HTTP_200_OK, f"Invoice list failed: {inv_list_res.data}"
        inv_list = inv_list_res.data.get('results', inv_list_res.data) if isinstance(inv_list_res.data, dict) else inv_list_res.data
        assert any(i['id'] == invoice_id for i in inv_list), "Uploaded invoice not found in history"
        record_pass("Supplier View Invoice History (GET /api/supplier/invoices/)", f"Found {len(inv_list)} invoice(s)")

        # 3i. Supplier Views Payment History (Read-Only)
        # Create an authorized disbursement from admin
        payment = SupplierPayment.objects.create(
            invoice=invoice,
            purchase_order=po,
            supplier=supplier,
            total_purchase_amount=Decimal('18000.00'),
            amount_paid=Decimal('18000.00'),
            payment_method=SupplierPayment.PaymentMethod.BANK_TRANSFER,
            transaction_reference=f"TXN-SETTLE-{po.id:04d}",
            authorized_by=admin,
            payment_status=SupplierPayment.PaymentStatus.PAID
        )
        invoice.paid_amount = Decimal('18000.00')
        invoice.status = SupplierInvoice.Status.PAID
        invoice.save()

        pay_list_res = supplier_client.get('/api/supplier/payments/')
        assert pay_list_res.status_code == status.HTTP_200_OK, f"Payment list failed: {pay_list_res.data}"
        pay_list = pay_list_res.data.get('results', pay_list_res.data) if isinstance(pay_list_res.data, dict) else pay_list_res.data
        assert any(p['id'] == payment.id for p in pay_list), "Payment not found in supplier payment history"
        record_pass("Supplier View Payment History (GET /api/supplier/payments/)", f"Payment of ETB {payment.amount_paid} verified")

        # 3j. Supplier Updates Permitted Profile Information
        prof_res = supplier_client.put('/api/auth/profile/', {
            'first_name': 'Guche Addisu Senior',
            'phone_number': '0922446688',
            'city': 'Addis Ababa'
        }, format='json')
        assert prof_res.status_code == status.HTTP_200_OK, f"Profile update failed: {prof_res.data}"
        created_user.refresh_from_db()
        assert created_user.first_name == 'Guche Addisu Senior', "Profile name mismatch"
        assert created_user.phone_number == '0922446688', "Phone number mismatch"
        assert created_user.role == User.RoleChoices.SUPPLIER, "Role was improperly altered"
        record_pass("Supplier Updates Permitted Profile (PUT /api/auth/profile/)", "Contact details updated, role preserved")

    except Exception as e:
        record_fail("Inspect Supplier Dashboard Features", str(e))

    # --------------------------------------------------------------------------
    # 4. SECURITY VERIFICATION & DATA ISOLATION
    # --------------------------------------------------------------------------
    print("\n--- 4. Security Verification & Data Isolation ---")
    try:
        # 4a. Data Isolation: Cannot see other suppliers' POs
        other_supplier = Supplier.objects.exclude(id=supplier.id).first()
        if other_supplier:
            other_po = PurchaseRequest.objects.create(
                supplier=other_supplier,
                product=product,
                quantity=5,
                estimated_unit_cost=Decimal('200.00'),
                total_estimated_cost=Decimal('1000.00'),
                requested_by=store_mgr,
                status=PurchaseRequest.Status.APPROVED,
                approved_by=admin
            )
            # Direct detail access attempt
            other_detail_res = supplier_client.get(f'/api/supplier/purchase-orders/{other_po.id}/')
            assert other_detail_res.status_code == status.HTTP_404_NOT_FOUND, f"Expected 404, got {other_detail_res.status_code}"

            # Direct response attempt
            other_respond_res = supplier_client.post(f'/api/supplier/purchase-orders/{other_po.id}/respond/', {
                'action': 'accept'
            }, format='json')
            assert other_respond_res.status_code == status.HTTP_404_NOT_FOUND, f"Expected 404, got {other_respond_res.status_code}"

            other_po.delete()
            record_pass("Cross-Supplier Data Isolation", "Cannot view or respond to other suppliers' purchase orders (404 Not Found)")

        # 4b. Prohibited Administrative Endpoints
        admin_users_res = supplier_client.get('/api/auth/users/')
        assert admin_users_res.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN], f"Expected 403, got {admin_users_res.status_code}"
        record_pass("Admin User Management Blocked", "403 Forbidden")

        store_inventory_res = supplier_client.get('/api/products/inventory/')
        assert store_inventory_res.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN], f"Expected 403, got {store_inventory_res.status_code}"
        record_pass("Store Inventory Access Blocked", "403 Forbidden")

        customer_orders_res = supplier_client.get('/api/orders/')
        assert customer_orders_res.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN], f"Expected 403, got {customer_orders_res.status_code}"
        record_pass("Customer Orders Access Blocked", "403 Forbidden")

        # 4c. Portal separation: Cannot login as Staff or Customer
        staff_portal_attempt = supplier_client.post('/api/auth/login/staff/', {
            'email': target_email,
            'password': permanent_pass,
            'portal': 'staff'
        }, format='json')
        assert staff_portal_attempt.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {staff_portal_attempt.status_code}"
        record_pass("Staff Portal Access Denied", "403 Forbidden with portal redirection")

        cust_portal_attempt = supplier_client.post('/api/auth/login/customer/', {
            'email': target_email,
            'password': permanent_pass,
            'portal': 'customer'
        }, format='json')
        assert cust_portal_attempt.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {cust_portal_attempt.status_code}"
        record_pass("Customer Portal Access Denied", "403 Forbidden with portal redirection")

    except Exception as e:
        record_fail("Security Verification & Data Isolation", str(e))

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

