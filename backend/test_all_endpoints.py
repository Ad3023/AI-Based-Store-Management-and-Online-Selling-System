import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from accounts.models import User
from products.models import Product, Category
from orders.models import Cart, Order, OrderItem, PaymentEvidence, Receipt
from recommendations.engine import AIRecommendationEngine
from rest_framework.authtoken.models import Token

def run_system_tests():
    print("==================================================")
    print("   RUNNING AUTOMATED SYSTEM INTEGRATION TESTS     ")
    print("==================================================")

    client = Client()

    # 1. Test Customer Authentication
    login_resp = client.post('/api/auth/login/', {'username': 'abebe', 'password': 'customer123'}, content_type='application/json')
    assert login_resp.status_code == 200, f"Customer login failed: {login_resp.content}"
    token_cust = login_resp.json()['token']
    print(f"[*] Customer Login: SUCCESS (Token: {token_cust[:8]}...)")

    # 2. Test Store Manager Authentication
    login_mgr = client.post('/api/auth/login/', {'username': 'manager', 'password': 'manager123'}, content_type='application/json')
    assert login_mgr.status_code == 200, f"Manager login failed: {login_mgr.content}"
    token_mgr = login_mgr.json()['token']
    print(f"[*] Store Manager Login: SUCCESS (Token: {token_mgr[:8]}...)")

    # 3. Test Administrator Authentication
    login_admin = client.post('/api/auth/login/', {'username': 'admin', 'password': 'admin123'}, content_type='application/json')
    assert login_admin.status_code == 200, f"Admin login failed: {login_admin.content}"
    token_admin = login_admin.json()['token']
    print(f"[*] Administrator Login: SUCCESS (Token: {token_admin[:8]}...)")

    # 4. Test Product Catalog API
    prod_resp = client.get('/api/products/items/')
    assert prod_resp.status_code == 200
    prod_data = prod_resp.json()
    assert prod_data['count'] >= 12
    print(f"[*] Product Catalog API: SUCCESS ({prod_data['count']} items returned)")

    # 5. Test AI Recommendations Engine
    p_first = Product.objects.first()
    if p_first.stock < 5:
        p_first.stock = 50
        p_first.save()

    sim_resp = client.get(f'/api/recommendations/similar/{p_first.id}/')
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert len(sim_data['results']) > 0
    print(f"[*] AI Content Similarity (TF-IDF): SUCCESS (Returned {len(sim_data['results'])} matches for '{p_first.name}')")

    fbt_resp = client.get(f'/api/recommendations/bought-together/{p_first.id}/')
    assert fbt_resp.status_code == 200
    print(f"[*] AI Co-Occurrence / Bought Together: SUCCESS")

    trend_resp = client.get('/api/recommendations/trending/')
    assert trend_resp.status_code == 200
    print(f"[*] AI Popular & Trending Fallback: SUCCESS ({len(trend_resp.json()['results'])} trending items)")

    # 6. Test AI Customer Segmentation
    seg_resp = client.get('/api/recommendations/segmentation/', HTTP_AUTHORIZATION=f'Token {token_mgr}')
    assert seg_resp.status_code == 200
    seg_data = seg_resp.json()
    assert len(seg_data['clusters_summary']) > 0
    print(f"[*] AI RFM Customer Segmentation (K-Means): SUCCESS ({len(seg_data['clusters_summary'])} distinct behavioral clusters)")

    # 7. Test Customer Cart & Checkout
    # Clear cart for idempotent test runs
    cust_user = User.objects.get(username='abebe')
    cart_obj, _ = Cart.objects.get_or_create(user=cust_user)
    cart_obj.items.all().delete()

    add_resp = client.post('/api/orders/cart/', {'product_id': p_first.id, 'quantity': 1}, content_type='application/json', HTTP_AUTHORIZATION=f'Token {token_cust}')
    assert add_resp.status_code == 200
    cart_resp = client.get('/api/orders/cart/', HTTP_AUTHORIZATION=f'Token {token_cust}')
    assert cart_resp.status_code == 200
    print(f"[*] Customer Cart: SUCCESS (Items in cart: {cart_resp.json()['total_items']})")

    # Checkout
    checkout_payload = {
        'shipping_name': 'Abebe Bikila Test',
        'shipping_phone': '+251911223344',
        'shipping_address': 'Bole Subcity 03',
        'shipping_city': 'Addis Ababa',
        'notes': 'Final year automated test order'
    }
    order_resp = client.post('/api/orders/checkout/', checkout_payload, content_type='application/json', HTTP_AUTHORIZATION=f'Token {token_cust}')
    assert order_resp.status_code == 201
    new_order = order_resp.json()
    print(f"[*] Order Creation & Checkout: SUCCESS (Generated Order #{new_order['order_number']}, Total: ${new_order['total_amount']})")

    # 8. Test Payment Evidence Submission
    from django.core.files.uploadedfile import SimpleUploadedFile
    mock_receipt = SimpleUploadedFile("cbe_receipt.jpg", b"sample_jpeg_bytes_for_receipt", content_type="image/jpeg")
    evidence_payload = {
        'payment_method': 'Commercial Bank of Ethiopia (CBE)',
        'transaction_reference': 'CBE-TEST-992211',
        'evidence_image': mock_receipt
    }
    ev_resp = client.post(f"/api/orders/{new_order['id']}/payment-evidence/", evidence_payload, HTTP_AUTHORIZATION=f'Token {token_cust}')
    assert ev_resp.status_code == 200
    print(f"[*] Payment Evidence Submission: SUCCESS (Order moved to PAYMENT_SUBMITTED)")

    # 9. Test Store Manager Payment Verification
    verify_resp = client.post(f"/api/orders/{new_order['id']}/verify-payment/", {'action': 'approve'}, content_type='application/json', HTTP_AUTHORIZATION=f'Token {token_mgr}')
    assert verify_resp.status_code == 200
    receipt_data = verify_resp.json()['receipt']
    print(f"[*] Store Manager Payment Verification: SUCCESS (Approved & Generated Receipt #{receipt_data['receipt_number']})")

    # 10. Test Official Digital Receipt
    rcp_resp = client.get(f"/api/orders/{new_order['id']}/receipt/", HTTP_AUTHORIZATION=f'Token {token_cust}')
    assert rcp_resp.status_code == 200
    print(f"[*] Customer Digital Receipt Access: SUCCESS (Official Receipt #{rcp_resp.json()['receipt']['receipt_number']})")

    # 11. Test Store Manager Dashboard Analytics
    dash_resp = client.get('/api/orders/analytics/dashboard/', HTTP_AUTHORIZATION=f'Token {token_mgr}')
    assert dash_resp.status_code == 200
    kpis = dash_resp.json()['kpis']
    print(f"[*] Manager Dashboard Analytics: SUCCESS (Revenue: ${kpis['total_revenue']:.2f}, Orders: {kpis['total_orders']})")

    # 12. Test Report Exports
    sales_rep = client.get('/api/orders/analytics/export-sales/', HTTP_AUTHORIZATION=f'Token {token_mgr}')
    assert sales_rep.status_code == 200 and 'text/csv' in sales_rep['Content-Type']
    inv_rep = client.get('/api/orders/analytics/export-inventory/', HTTP_AUTHORIZATION=f'Token {token_mgr}')
    assert inv_rep.status_code == 200 and 'text/csv' in inv_rep['Content-Type']
    print(f"[*] CSV Report Exports (Sales & Inventory): SUCCESS")

    # 13. Test Administrator User Controls & Security Audits
    users_resp = client.get('/api/auth/users/', HTTP_AUTHORIZATION=f'Token {token_admin}')
    assert users_resp.status_code == 200
    audits_resp = client.get('/api/auth/audit-logs/', HTTP_AUTHORIZATION=f'Token {token_admin}')
    assert audits_resp.status_code == 200
    print(f"[*] Administrator Access Control & Audit Logs: SUCCESS")

    print("\n==================================================")
    print("   ALL 13 SYSTEM INTEGRATION TESTS PASSED 100%!   ")
    print("==================================================")

if __name__ == '__main__':
    run_system_tests()
