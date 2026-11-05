import os
import sys
from decimal import Decimal
import django

# Setup Django Environment
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from products.models import Supplier, Product, PurchaseRequest, PurchaseOrderItem
from products.procurement_views import (
    PurchaseRequestListCreateView,
    PurchaseRequestDetailView
)

User = get_user_model()
factory = APIRequestFactory()


def get_results(data):
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


def run_tests():
    print("=" * 80)
    print(" TESTING STORE-SCOPED PURCHASE ORDER HISTORY & FRESH START (ETHIOTECH)")
    print("=" * 80)

    # 1. Verify Initial Cleanup
    print("\n[TEST 1] Verifying initial cleanup of Purchase Orders...")
    po_count = PurchaseRequest.objects.count()
    item_count = PurchaseOrderItem.objects.count()
    assert po_count == 0, f"Expected 0 purchase orders after cleanup, found {po_count}"
    assert item_count == 0, f"Expected 0 purchase order items after cleanup, found {item_count}"
    print(f"  -> Verified 0 purchase orders and 0 line items in database.")

    # Get or create Supplier & Product for testing
    supplier = Supplier.objects.first()
    if not supplier:
        supplier = Supplier.objects.create(
            name="Ethio Tech Distro",
            email="distro@gmail.com",
            phone="0911223344",
            status="ACTIVE"
        )
    product = Product.objects.filter(is_active=True).first()

    # Get admin
    admin_user = User.objects.filter(username='addisuguche_admin').first()
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()

    # 2. Register / Create Two Different Stores
    print("\n[TEST 2] Provisioning two distinct store accounts...")
    store_a, _ = User.objects.get_or_create(
        username='store_alpha',
        defaults={
            'email': 'store.alpha@gmail.com',
            'role': User.RoleChoices.STORE_MANAGER,
            'first_name': 'Store',
            'last_name': 'Alpha',
            'phone_number': '0912111111'
        }
    )
    store_b, _ = User.objects.get_or_create(
        username='store_beta',
        defaults={
            'email': 'store.beta@gmail.com',
            'role': User.RoleChoices.STORE_MANAGER,
            'first_name': 'Store',
            'last_name': 'Beta',
            'phone_number': '0912222222'
        }
    )
    print(f"  -> Store A: {store_a.username} ({store_a.email})")
    print(f"  -> Store B: {store_b.username} ({store_b.email})")

    # 3. Both Stores Start Fresh with Empty History
    print("\n[TEST 3] Verifying both stores start with an empty history...")
    view = PurchaseRequestListCreateView.as_view()

    req_a = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_a, user=store_a)
    res_a = view(req_a)
    items_a = get_results(res_a.data)
    assert len(items_a) == 0, f"Expected Store A history to be empty, got {len(items_a)}"

    req_b = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_b, user=store_b)
    res_b = view(req_b)
    items_b = get_results(res_b.data)
    assert len(items_b) == 0, f"Expected Store B history to be empty, got {len(items_b)}"
    print("  -> Both stores verified with EMPTY Purchase Order History (0 records).")

    # 4. Store A Creates a Purchase Order
    print("\n[TEST 4] Store A creates Purchase Order...")
    create_payload_a = {
        'supplier': supplier.id,
        'status': 'DRAFT',
        'notes': 'Initial restocking for Store Alpha',
        'items': [
            {'product': product.id, 'quantity': 15, 'unit_price': '250.00'}
        ]
    }
    req_create_a = factory.post('/api/products/purchase-requests/', create_payload_a, format='json')
    force_authenticate(req_create_a, user=store_a)
    res_create_a = view(req_create_a)
    assert res_create_a.status_code == 201, f"Store A PO creation failed: {res_create_a.data}"
    po_a = res_create_a.data
    po_a_num = po_a['request_number']
    print(f"  -> Store A created PO: {po_a_num} (Total: ETB {po_a['total_cost']})")

    # 5. Store A Sees PO, Store B Does NOT See Store A's PO
    print("\n[TEST 5] Testing store isolation between Store A and Store B...")
    req_a = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_a, user=store_a)
    res_a = view(req_a)
    items_a = get_results(res_a.data)
    assert len(items_a) == 1, f"Store A should have 1 PO, got {len(items_a)}"
    assert items_a[0]['request_number'] == po_a_num
    print(f"  -> Store A successfully sees their PO: {po_a_num}")

    req_b = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_b, user=store_b)
    res_b = view(req_b)
    items_b = get_results(res_b.data)
    assert len(items_b) == 0, f"Store B should see 0 POs (isolation failed), got {len(items_b)}"
    print(f"  -> Store B sees 0 POs. Store A's PO is strictly isolated!")

    # 6. Store B Creates Their Own Purchase Order
    print("\n[TEST 6] Store B creates Purchase Order with unique PO number...")
    create_payload_b = {
        'supplier': supplier.id,
        'status': 'DRAFT',
        'notes': 'Inventory for Store Beta',
        'items': [
            {'product': product.id, 'quantity': 8, 'unit_price': '300.00'}
        ]
    }
    req_create_b = factory.post('/api/products/purchase-requests/', create_payload_b, format='json')
    force_authenticate(req_create_b, user=store_b)
    res_create_b = view(req_create_b)
    assert res_create_b.status_code == 201, f"Store B PO creation failed: {res_create_b.data}"
    po_b = res_create_b.data
    po_b_num = po_b['request_number']
    assert po_a_num != po_b_num, "PO numbers must be unique across stores!"
    print(f"  -> Store B created PO: {po_b_num} (Total: ETB {po_b['total_cost']})")

    # 7. Verify Each Store Only Sees Their Own History
    print("\n[TEST 7] Verifying distinct histories...")
    req_a = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_a, user=store_a)
    res_a = view(req_a)
    items_a = get_results(res_a.data)
    assert len(items_a) == 1 and items_a[0]['request_number'] == po_a_num

    req_b = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_b, user=store_b)
    res_b = view(req_b)
    items_b = get_results(res_b.data)
    assert len(items_b) == 1 and items_b[0]['request_number'] == po_b_num
    print(f"  -> Store A sees only PO-A ({po_a_num}).")
    print(f"  -> Store B sees only PO-B ({po_b_num}).")

    # 8. Platform Admin Oversees Both Stores
    print("\n[TEST 8] Platform Administrator oversees all stores...")
    if admin_user:
        req_admin = factory.get('/api/products/purchase-requests/')
        force_authenticate(req_admin, user=admin_user)
        res_admin = view(req_admin)
        items_admin = get_results(res_admin.data)
        assert len(items_admin) == 2, f"Admin should oversee all 2 POs, got {len(items_admin)}"
        po_nums = [p['request_number'] for p in items_admin]
        assert po_a_num in po_nums and po_b_num in po_nums
        print(f"  -> Admin successfully sees all {len(items_admin)} POs across both stores.")

    # 9. Status Transitions Preserved in History
    print("\n[TEST 9] Status updates are preserved across transitions...")
    detail_view = PurchaseRequestDetailView.as_view()
    # Store A submits draft for approval
    req_sub = factory.patch(f'/api/products/purchase-requests/{po_a["id"]}/', {'status': 'PENDING_APPROVAL'}, format='json')
    force_authenticate(req_sub, user=store_a)
    res_sub = detail_view(req_sub, pk=po_a['id'])
    assert res_sub.status_code == 200
    assert res_sub.data['status'] == 'PENDING_APPROVAL'

    # Admin approves PO A
    if admin_user:
        req_app = factory.patch(f'/api/products/purchase-requests/{po_a["id"]}/', {
            'status': 'APPROVED',
            'admin_feedback': 'Approved by Administrator for Store Alpha.'
        }, format='json')
        force_authenticate(req_app, user=admin_user)
        res_app = detail_view(req_app, pk=po_a['id'])
        assert res_app.status_code == 200
        assert res_app.data['status'] == 'APPROVED'
        print(f"  -> Status updated DRAFT -> PENDING_APPROVAL -> APPROVED.")

    # Store A still sees their PO in history under APPROVED
    req_a = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_a, user=store_a)
    res_a = view(req_a)
    items_a = get_results(res_a.data)
    assert len(items_a) == 1
    assert items_a[0]['status'] == 'APPROVED'
    print(f"  -> Confirmed: History record maintained with updated status.")

    # 10. Register Store C - Starts Fresh with Empty History
    print("\n[TEST 10] Registering a new Store C account...")
    store_c, _ = User.objects.get_or_create(
        username='store_gamma',
        defaults={
            'email': 'store.gamma@gmail.com',
            'role': User.RoleChoices.STORE_MANAGER,
            'first_name': 'Store',
            'last_name': 'Gamma',
            'phone_number': '0912333333'
        }
    )
    req_c = factory.get('/api/products/purchase-requests/')
    force_authenticate(req_c, user=store_c)
    res_c = view(req_c)
    items_c = get_results(res_c.data)
    assert len(items_c) == 0, f"New Store C must start empty, got {len(items_c)}"
    print(f"  -> Store C ({store_c.email}) starts with EMPTY Purchase Order History (0 records).")

    # Clean up test POs and test users so database remains clean
    PurchaseRequest.objects.filter(id__in=[po_a['id'], po_b['id']]).delete()
    store_a.delete()
    store_b.delete()
    store_c.delete()

    print("\n" + "=" * 80)
    print(" ALL 10 TESTS PASSED SUCCESSFULLY! STORE ISOLATION FULLY VERIFIED!")
    print("=" * 80)


if __name__ == '__main__':
    run_tests()
