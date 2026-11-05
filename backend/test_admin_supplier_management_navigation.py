import os
import sys
import django

# Setup Django Environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User, AuditLog
from products.models import Supplier, Category, PurchaseRequest, SupplierInvoice, SupplierPayment

passed_tests = []
failed_tests = []

def record_pass(test_name, details=""):
    print(f"  [PASS] {test_name}" + (f" ({details})" if details else ""))
    passed_tests.append(test_name)

def record_fail(test_name, error=""):
    print(f"  [FAIL] {test_name}" + (f" - Error: {error}" if error else ""))
    failed_tests.append((test_name, error))

def run_tests():
    print("=" * 80)
    print(" ETHIOTECH MARKET: ADMIN SUPPLIER MANAGEMENT INTEGRATION TEST SUITE")
    print("=" * 80)

    # 1. Setup Admin, Store Manager, and Supplier credentials
    admin_user = User.objects.filter(role=User.RoleChoices.ADMIN, is_active=True).first()
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True, is_active=True).first()
    
    assert admin_user is not None, "Active admin user must exist in database"

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    print("\n--- 1. Supplier Directory (GET /api/products/suppliers/) ---")
    res_list = admin_client.get('/api/products/suppliers/')
    suppliers_list = res_list.data.get('results', res_list.data) if isinstance(res_list.data, dict) else res_list.data
    if res_list.status_code == 200 and len(suppliers_list) > 0:
        record_pass("Fetch Supplier Directory from PostgreSQL", f"Found {len(suppliers_list)} suppliers")
        # Check serialization contains linked portal details
        first_sup = suppliers_list[0]
        if 'has_account' in first_sup and 'user_username' in first_sup:
            record_pass("Supplier Serializer Portal Fields", f"user_username={first_sup.get('user_username')}, has_account={first_sup.get('has_account')}")
        else:
            record_fail("Supplier Serializer Portal Fields", "Missing portal fields in SupplierSerializer")
    else:
        record_fail("Fetch Supplier Directory", f"Status: {res_list.status_code}")

    print("\n--- 2. Register, Edit, Activate, Suspend, Deactivate Suppliers ---")
    test_supplier_name = "Apex Silicon Distribution"
    Supplier.objects.filter(name=test_supplier_name).delete()
    User.objects.filter(email="apex.silicon@gmail.com").delete()

    # Register
    create_payload = {
        'name': test_supplier_name,
        'contact_person': 'Abebe Tadesse',
        'email': 'apex.silicon@gmail.com',
        'phone': '0911445566',
        'address': 'Bole Subcity, Addis Ababa',
        'notes': 'Authorized semiconductor and RAM distributor',
        'status': 'ACTIVE',
        'is_active': True,
    }
    res_create = admin_client.post('/api/products/suppliers/', create_payload, format='json')
    if res_create.status_code == 201:
        supplier_id = res_create.data['id']
        record_pass("Admin Register New Supplier", f"ID: {supplier_id}, Name: {test_supplier_name}")
    else:
        record_fail("Admin Register New Supplier", f"Status: {res_create.status_code}, data: {res_create.data}")
        return

    # Edit
    edit_payload = {
        'name': test_supplier_name,
        'contact_person': 'Abebe Tadesse Senior',
        'email': 'apex.silicon@gmail.com',
        'phone': '0911445566',
        'address': 'Bole Subcity, Woreda 04, Addis Ababa',
        'status': 'ACTIVE',
    }
    res_edit = admin_client.put(f'/api/products/suppliers/{supplier_id}/', edit_payload, format='json')
    if res_edit.status_code == 200 and res_edit.data['contact_person'] == 'Abebe Tadesse Senior':
        record_pass("Admin Edit Supplier Details", "Contact person updated")
    else:
        record_fail("Admin Edit Supplier Details", f"Status: {res_edit.status_code}")

    # Suspend
    res_suspend = admin_client.patch(f'/api/products/suppliers/{supplier_id}/', {'status': 'SUSPENDED'}, format='json')
    sup_obj = Supplier.objects.get(id=supplier_id)
    if res_suspend.status_code == 200 and sup_obj.status == 'SUSPENDED' and not sup_obj.is_active:
        record_pass("Admin Suspend Supplier", "Status set to SUSPENDED, is_active=False")
    else:
        record_fail("Admin Suspend Supplier", f"Status: {sup_obj.status}, is_active: {sup_obj.is_active}")

    # Deactivate
    res_deact = admin_client.patch(f'/api/products/suppliers/{supplier_id}/', {'status': 'DEACTIVATED'}, format='json')
    sup_obj.refresh_from_db()
    if res_deact.status_code == 200 and sup_obj.status == 'DEACTIVATED' and not sup_obj.is_active:
        record_pass("Admin Deactivate Supplier", "Status set to DEACTIVATED, is_active=False")
    else:
        record_fail("Admin Deactivate Supplier", f"Status: {sup_obj.status}, is_active: {sup_obj.is_active}")

    # Activate
    res_act = admin_client.patch(f'/api/products/suppliers/{supplier_id}/', {'status': 'ACTIVE'}, format='json')
    sup_obj.refresh_from_db()
    if res_act.status_code == 200 and sup_obj.status == 'ACTIVE' and sup_obj.is_active:
        record_pass("Admin Activate Supplier", "Status set to ACTIVE, is_active=True")
    else:
        record_fail("Admin Activate Supplier", f"Status: {sup_obj.status}, is_active: {sup_obj.is_active}")

    print("\n--- 3. Supplier Portal Account Provisioning & Role Enforcement ---")
    portal_payload = {
        'email': 'apex.silicon@gmail.com',
        'phone': '0911445566',
        'password': 'Temp#Password2026!',
        'full_name': 'Abebe Tadesse'
    }
    res_portal = admin_client.post(f'/api/products/suppliers/{supplier_id}/create-account/', portal_payload, format='json')
    if res_portal.status_code == 201:
        created_user = User.objects.get(email='apex.silicon@gmail.com')
        if created_user.role == User.RoleChoices.SUPPLIER:
            record_pass("Strict SUPPLIER Role Assignment", f"Role: {created_user.role}")
        else:
            record_fail("Strict SUPPLIER Role Assignment", f"Expected 'supplier', got {created_user.role}")

        if created_user.must_change_password:
            record_pass("Mandatory First-Login Password Change Enforced", "must_change_password = True")
        else:
            record_fail("Mandatory First-Login Password Change", "Flag was False")
    else:
        record_fail("Create Portal Account", f"Status: {res_portal.status_code}, data: {res_portal.data}")

    # Prevent Duplicate Accounts
    res_dup = admin_client.post(f'/api/products/suppliers/{supplier_id}/create-account/', portal_payload, format='json')
    # If account exists, it updates credentials (does not duplicate users)
    user_count = User.objects.filter(email='apex.silicon@gmail.com').count()
    if user_count == 1:
        record_pass("Duplicate Supplier Account Prevention", f"Verified single user in DB (count={user_count})")
    else:
        record_fail("Duplicate Supplier Account Prevention", f"Multiple users found: {user_count}")

    print("\n--- 4. Supplier Activity History & Database Audit Trail ---")
    res_history = admin_client.get(f'/api/products/suppliers/{supplier_id}/history/')
    if res_history.status_code == 200:
        record_pass("Fetch Supplier Ledger History (GET /api/products/suppliers/<id>/history/)", f"Supplier: {res_history.data['supplier']['name']}")
    else:
        record_fail("Fetch Supplier Ledger History", f"Status: {res_history.status_code}")

    res_audits = admin_client.get('/api/auth/audit-logs/')
    audits_list = res_audits.data.get('results', res_audits.data) if isinstance(res_audits.data, dict) else res_audits.data
    if res_audits.status_code == 200:
        record_pass("Fetch System Activity Logs (GET /api/auth/audit-logs/)", f"Total logs: {len(audits_list)}")
    else:
        record_fail("Fetch System Activity Logs", f"Status: {res_audits.status_code}")

    print("\n--- 5. Security & Permission Enforcement ---")
    # Customer cannot provision supplier portal accounts
    customer_user = User.objects.filter(role=User.RoleChoices.CUSTOMER, is_active=True).first()
    if customer_user:
        cust_client = APIClient()
        cust_client.force_authenticate(user=customer_user)
        res_cust = cust_client.post(f'/api/products/suppliers/{supplier_id}/create-account/', portal_payload, format='json')
        if res_cust.status_code == 403:
            record_pass("Customer Access to Supplier Provisioning Blocked", "403 Forbidden")
        else:
            record_fail("Customer Access to Supplier Provisioning", f"Expected 403, got {res_cust.status_code}")

        res_cust_edit = cust_client.put(f'/api/products/suppliers/{supplier_id}/', edit_payload, format='json')
        if res_cust_edit.status_code == 403:
            record_pass("Customer Modification of Supplier Blocked", "403 Forbidden")
        else:
            record_fail("Customer Modification of Supplier", f"Expected 403, got {res_cust_edit.status_code}")

    # Clean up test supplier
    Supplier.objects.filter(id=supplier_id).delete()
    User.objects.filter(email="apex.silicon@gmail.com").delete()

    print("\n" + "=" * 80)
    print(f" TOTAL TESTS EXECUTED: {len(passed_tests) + len(failed_tests)}")
    print(f"   PASSED: {len(passed_tests)}")
    print(f"   FAILED: {len(failed_tests)}")
    print("=" * 80)

    if failed_tests:
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
