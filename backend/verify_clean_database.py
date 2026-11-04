import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.db import connection

User = get_user_model()

print("=" * 60)
print("DATABASE HEALTH & ADMIN VERIFICATION")
print("=" * 60)

# 1. User count and admin check
users = list(User.objects.all())
print(f"Total Users Remaining: {len(users)}")
assert len(users) == 1, f"Expected exactly 1 user, found {len(users)}"
admin = users[0]
print(f"Remaining User: ID={admin.id}, Username={admin.username}, Email={admin.email}")
print(f"Admin Flags: is_superuser={admin.is_superuser}, is_staff={admin.is_staff}, is_active={admin.is_active}, role={admin.role}")

# 2. Check password validity
has_password = admin.has_usable_password()
print(f"Admin Has Usable Password: {has_password} (Hash Prefix: {admin.password[:15]}...)")

# 3. Check Database Tables and Migrations
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT count(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    table_count = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM django_migrations;")
    migration_count = cursor.fetchone()[0]

print(f"Total Database Tables Intact: {table_count}")
print(f"Total Django Migrations Recorded: {migration_count}")
assert table_count > 30, "Database tables appear missing!"
assert migration_count > 20, "Django migrations appear missing!"

# 4. API Endpoints Test with Clean Database
client = APIClient()

# Products endpoint (/api/products/items/)
res_products = client.get('/api/products/items/')
print(f"GET /api/products/items/ -> Status: {res_products.status_code}, Results: {len(res_products.data.get('results', res_products.data))}")
assert res_products.status_code == 200
assert len(res_products.data.get('results', res_products.data)) == 0, "Products should be empty!"

# Categories endpoint
res_categories = client.get('/api/products/categories/')
categories_list = res_categories.data.get('results', res_categories.data) if isinstance(res_categories.data, dict) else res_categories.data
print(f"GET /api/products/categories/ -> Status: {res_categories.status_code}, Results: {len(categories_list)}")
assert res_categories.status_code == 200
assert len(categories_list) == 0, "Categories should be empty!"

# Admin auth with API
client.force_authenticate(user=admin)

# Suppliers endpoint (requires manager/admin permission)
res_suppliers = client.get('/api/products/suppliers/')
suppliers_list = res_suppliers.data.get('results', res_suppliers.data) if isinstance(res_suppliers.data, dict) else res_suppliers.data
print(f"GET /api/products/suppliers/ (Authenticated) -> Status: {res_suppliers.status_code}, Results: {len(suppliers_list)}")
assert res_suppliers.status_code == 200
assert len(suppliers_list) == 0, "Suppliers should be empty!"
res_admin_users = client.get('/api/auth/users/')
print(f"GET /api/auth/users/ (Authenticated Admin) -> Status: {res_admin_users.status_code}, Users Count: {len(res_admin_users.data.get('results', res_admin_users.data))}")
assert res_admin_users.status_code == 200
assert len(res_admin_users.data.get('results', res_admin_users.data)) == 1, "Only admin should appear in users list!"

res_orders = client.get('/api/orders/')
orders_list = res_orders.data.get('results', res_orders.data) if isinstance(res_orders.data, dict) else res_orders.data
print(f"GET /api/orders/ -> Status: {res_orders.status_code}, Orders Count: {len(orders_list)}")
assert res_orders.status_code == 200
assert len(orders_list) == 0, "Orders should be empty!"

res_shipments = client.get('/api/delivery/shipments/')
print(f"GET /api/delivery/shipments/ -> Status: {res_shipments.status_code}, Shipments Count: {len(res_shipments.data.get('results', res_shipments.data))}")
assert res_shipments.status_code == 200
assert len(res_shipments.data.get('results', res_shipments.data)) == 0, "Shipments should be empty!"

print("\n" + "=" * 60)
print("ALL VERIFICATIONS PASSED: CLEAN DATABASE 100% OPERATIONAL")
print("=" * 60)
