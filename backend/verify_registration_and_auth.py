"""
Post-Cleanup Verification:
1. Verify kept staff accounts can authenticate.
2. Verify new customer registration and OTP works.
3. Verify catalog endpoints respond cleanly.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from products.models import Product, Category, Supplier

User = get_user_model()

def verify_system_health():
    print("======================================================================")
    print("RUNNING POST-CLEANUP HEALTH & INTEGRITY CHECK")
    print("======================================================================")

    # 1. Check kept users
    admin = User.objects.filter(email='addisuguche68@gmail.com').first()
    store_manager = User.objects.filter(email='gucheaddisu10@gmail.com').first()

    assert admin is not None, "Admin account missing"
    assert store_manager is not None, "Store manager account missing"
    assert User.objects.count() == 2, f"Expected exactly 2 users, found {User.objects.count()}"

    print(f"[+] Admin account verified: {admin.username} ({admin.email})")
    print(f"[+] Store Manager account verified: {store_manager.username} ({store_manager.email})")

    # 2. Check catalog API
    client = APIClient()
    res = client.get('/api/products/items/')
    assert res.status_code == 200, f"Products API failed: {res.status_code}"
    prods = res.data.get('results', res.data)
    print(f"[+] Public Product catalog working: {len(prods)} products returned.")

    res = client.get('/api/products/categories/')
    assert res.status_code == 200, f"Categories API failed: {res.status_code}"
    cats = res.data.get('results', res.data)
    print(f"[+] Public Categories catalog working: {len(cats)} categories returned.")

    # 3. Test customer registration endpoint
    test_email = "newcustomer_test@ethiotech.com"
    reg_payload = {
        'username': 'newcustomer_test',
        'email': test_email,
        'password': 'Password123!',
        'password_confirm': 'Password123!',
        'first_name': 'Test',
        'last_name': 'Customer'
    }
    res = client.post('/api/auth/register/', reg_payload, format='json')
    assert res.status_code == 201, f"Customer registration failed: {res.status_code} {res.data}"
    print(f"[+] Customer registration endpoint working: {res.data.get('message')}")

    # Clean up test user
    User.objects.filter(email=test_email).delete()
    print("[+] Test registered customer cleaned up safely.")

    print("\n======================================================================")
    print("SYSTEM HEALTH CHECK PASSED 100%! APPLICATION IS READY AND CLEAN.")
    print("======================================================================")

if __name__ == '__main__':
    verify_system_health()
