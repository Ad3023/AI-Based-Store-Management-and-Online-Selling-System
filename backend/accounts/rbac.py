import logging
from django.db import transaction

logger = logging.getLogger(__name__)

# Canonical Granular Permissions List
CANONICAL_PERMISSIONS = [
    # Products & Catalog
    {
        'code': 'products.view',
        'name': 'View Products & Inventory',
        'module': 'Products',
        'description': 'View product catalog, pricing, specifications, and current stock levels.'
    },
    {
        'code': 'products.create',
        'name': 'Create Products',
        'module': 'Products',
        'description': 'Add new products to the catalog.'
    },
    {
        'code': 'products.edit',
        'name': 'Edit Products',
        'module': 'Products',
        'description': 'Update product details, pricing, descriptions, and images.'
    },
    {
        'code': 'products.delete',
        'name': 'Delete Products',
        'module': 'Products',
        'description': 'Deactivate or remove products from the catalog.'
    },
    {
        'code': 'categories.manage',
        'name': 'Manage Categories',
        'module': 'Products',
        'description': 'Create, edit, and organize product categories.'
    },
    {
        'code': 'inventory.manage',
        'name': 'Manage Inventory & Stock',
        'module': 'Products',
        'description': 'Adjust stock quantities, log restocking, and record inventory movements.'
    },

    # Orders & Fulfillment
    {
        'code': 'orders.view',
        'name': 'View Customer Orders',
        'module': 'Orders',
        'description': 'View customer order details, items, delivery addresses, and histories.'
    },
    {
        'code': 'orders.update',
        'name': 'Update Order Fulfillment Status',
        'module': 'Orders',
        'description': 'Transition order fulfillment status (Pending, Confirmed, Processing, Shipped, Delivered, Cancelled).'
    },
    {
        'code': 'refunds.manage',
        'name': 'Manage Refunds & Warranty Claims',
        'module': 'Orders',
        'description': 'Review, approve, or reject customer warranty claims and return refund requests.'
    },

    # Payments & Reconciliation
    {
        'code': 'payments.view',
        'name': 'View Payment Transactions',
        'module': 'Payments',
        'description': 'Inspect payment transaction references, payment receipts, and uploaded bank evidence.'
    },
    {
        'code': 'payments.verify',
        'name': 'Verify Payments with Gateway / Bank',
        'module': 'Payments',
        'description': 'Trigger trusted server-side Chapa verification or approve bank transfer deposit evidence.'
    },

    # Promotions & Marketing
    {
        'code': 'promotions.manage',
        'name': 'Manage Promotions & Discounts',
        'module': 'Promotions',
        'description': 'Create, edit, and deactivate discount campaigns and promotional banners.'
    },

    # Customers
    {
        'code': 'customers.view',
        'name': 'View Customer Profiles & Segmentation',
        'module': 'Customers',
        'description': 'View registered customer accounts, customer purchase profiles, and RFM behavioral clusters.'
    },

    # Governance & Administration
    {
        'code': 'users.manage',
        'name': 'Manage User Accounts',
        'module': 'Administration',
        'description': 'Create administrator/staff accounts, toggle active/suspended status, and manage account details.'
    },
    {
        'code': 'roles.manage',
        'name': 'Manage Roles & Permissions',
        'module': 'Administration',
        'description': 'Create custom roles and assign granular permissions to administrators and sub-admins.'
    },
    {
        'code': 'settings.manage',
        'name': 'Manage System Configuration',
        'module': 'Administration',
        'description': 'Update payment gateway credentials, delivery rates, bank account details, and store configuration.'
    },
    {
        'code': 'audit_logs.view',
        'name': 'View Security & Audit Logs',
        'module': 'Administration',
        'description': 'Inspect system audit trails, access history, login events, and administrative security logs.'
    },

    # Reports & Analytics
    {
        'code': 'reports.view',
        'name': 'View Reports & System Analytics',
        'module': 'Reports',
        'description': 'Access platform analytics, revenue dashboards, sales statistics, and export CSV reports.'
    },
]

# Canonical System Roles
SYSTEM_ROLES = {
    'super_admin': {
        'name': 'Super Admin',
        'description': 'Full access to system configuration, users, roles, permissions, security settings, and audit logs.',
        'is_system_role': True,
        'permissions': 'ALL'  # Super admin receives all permissions
    },
    'admin': {
        'name': 'Admin',
        'description': 'Manage products, categories, inventory, orders, customers, promotions, and reports according to assigned permissions. Cannot modify Super Admin ownership.',
        'is_system_role': True,
        'permissions': [
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'categories.manage', 'inventory.manage',
            'orders.view', 'orders.update', 'refunds.manage',
            'payments.view', 'payments.verify',
            'promotions.manage',
            'customers.view',
            'reports.view',
            'audit_logs.view'
        ]
    },
    'sub_admin': {
        'name': 'Sub-Admin',
        'description': 'Access only the modules and actions explicitly granted by the Super Admin. Least privilege by default.',
        'is_system_role': True,
        'permissions': []  # Least privilege: empty by default until explicitly granted
    },
    'customer': {
        'name': 'Customer',
        'description': 'Public storefront browsing, personal cart, checkout, own order history, and profile management.',
        'is_system_role': True,
        'permissions': []
    },
    'store_manager': {
        'name': 'Store Manager',
        'description': 'Manage store catalog, inventory stock movements, customer orders, and fulfillment.',
        'is_system_role': True,
        'permissions': [
            'products.view', 'products.create', 'products.edit',
            'categories.manage', 'inventory.manage',
            'orders.view', 'orders.update', 'refunds.manage',
            'payments.view',
            'customers.view',
            'reports.view'
        ]
    },
    'order_manager': {
        'name': 'Order Manager',
        'description': 'Process customer orders, view order details and customer info, confirm or reject orders, advance fulfillment statuses, and generate order reports.',
        'is_system_role': True,
        'permissions': [
            'orders.view',
            'orders.update',
            'products.view',
            'customers.view',
            'reports.view',
            'payments.view'
        ]
    }
}

# Optional Permission Profile Templates
PERMISSION_TEMPLATES = {
    'product_manager': {
        'name': 'Product Manager',
        'description': 'Specialized profile focused on managing catalog items, inventory levels, category taxonomy, and product discounts.',
        'permissions': [
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'categories.manage', 'inventory.manage', 'promotions.manage'
        ]
    },
    'order_manager': {
        'name': 'Order Manager',
        'description': 'Specialized profile focused on processing customer orders, fulfillment pipelines, and dispatch tracking.',
        'permissions': [
            'orders.view', 'orders.update', 'products.view', 'customers.view'
        ]
    },
    'payment_manager': {
        'name': 'Payment Manager',
        'description': 'Specialized profile for finance and reconciliation: verify gateway payments, inspect bank slips, and handle refunds.',
        'permissions': [
            'payments.view', 'payments.verify', 'refunds.manage', 'orders.view'
        ]
    },
    'customer_support_manager': {
        'name': 'Customer Support Manager',
        'description': 'Specialized profile for customer service: review orders, address feedback and warranty claims, and inspect customer profiles.',
        'permissions': [
            'customers.view', 'orders.view', 'refunds.manage', 'products.view'
        ]
    }
}


def init_rbac():
    """
    Synchronizes canonical permissions and system roles with database.
    Safe and idempotent.
    """
    from .models import Permission, Role, User

    with transaction.atomic():
        # 1. Sync Permissions
        perm_map = {}
        for p_data in CANONICAL_PERMISSIONS:
            perm_obj, _ = Permission.objects.update_or_create(
                code=p_data['code'],
                defaults={
                    'name': p_data['name'],
                    'module': p_data['module'],
                    'description': p_data['description']
                }
            )
            perm_map[perm_obj.code] = perm_obj

        # 2. Sync System Roles
        for role_code, r_data in SYSTEM_ROLES.items():
            role_obj, _ = Role.objects.update_or_create(
                code=role_code,
                defaults={
                    'name': r_data['name'],
                    'description': r_data['description'],
                    'is_system_role': True
                }
            )
            if r_data['permissions'] == 'ALL':
                role_obj.permissions.set(perm_map.values())
            else:
                target_perms = [perm_map[code] for code in r_data['permissions'] if code in perm_map]
                role_obj.permissions.set(target_perms)

        # 3. Create or sync Optional Permission Profiles as customizable roles if not present
        for template_code, t_data in PERMISSION_TEMPLATES.items():
            if template_code in SYSTEM_ROLES:
                continue
            template_role, created = Role.objects.get_or_create(
                code=template_code,
                defaults={
                    'name': t_data['name'],
                    'description': t_data['description'],
                    'is_system_role': False
                }
            )
            if created:
                target_perms = [perm_map[code] for code in t_data['permissions'] if code in perm_map]
                template_role.permissions.set(target_perms)

        # 4. Ensure superuser / main admin is designated as SUPER_ADMIN
        superusers = User.objects.filter(is_superuser=True)
        super_admin_role = Role.objects.filter(code='super_admin').first()
        for su in superusers:
            if su.role != User.Role.SUPER_ADMIN:
                su.role = User.Role.SUPER_ADMIN
                su.custom_role = super_admin_role
                su.save(update_fields=['role', 'custom_role'])

        # Also check addisuguche_admin
        main_admin = User.objects.filter(username='addisuguche_admin').first()
        if main_admin and main_admin.role != User.Role.SUPER_ADMIN:
            main_admin.role = User.Role.SUPER_ADMIN
            main_admin.is_superuser = True
            main_admin.is_staff = True
            main_admin.custom_role = super_admin_role
            main_admin.save(update_fields=['role', 'is_superuser', 'is_staff', 'custom_role'])

        logger.info("RBAC system initialized successfully with canonical permissions and roles.")
