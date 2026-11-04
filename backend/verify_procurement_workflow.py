"""
End-to-end verification of EthioTech Market Procurement & Supplier Payment Management.
Tests strict separation of responsibilities:
- Store Manager: Supplier purchasing, draft POs, supplier communication, receiving physical stock, submitting invoices.
- Admin: PO approvals, invoice reviews, payment authorizations, financial reporting.
- Strict RBAC: Store Manager blocked from self-approving POs, approving invoices, or authorizing payments.
"""
import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from products.models import (
    Supplier, Product, PurchaseRequest, PurchaseOrderItem,
    SupplierInvoice, SupplierPayment, StockMovement
)

User = get_user_model()

def run_verification():
    print("======================================================================")
    print("STARTING ETHIOTECH MARKET PROCUREMENT & SUPPLIER PAYMENT VERIFICATION")
    print("======================================================================")

    # Cleanup prior test runs if any
    SupplierPayment.objects.filter(transaction_reference__startswith='CBE-TX-20261103').delete()
    SupplierPayment.objects.filter(transaction_reference__startswith='TB-TX-20261103').delete()
    SupplierInvoice.objects.filter(invoice_number__startswith='INV-ETH-2026-').delete()
    PurchaseRequest.objects.filter(notes__contains='Quarterly peripheral and hardware restocking.').delete()

    # 1. Setup Actors
    admin = User.objects.filter(role='admin', is_superuser=True).first()
    store_manager = User.objects.filter(role='store_manager').first()

    assert admin is not None, "Admin user not found"
    assert store_manager is not None, "Store Manager user not found"

    print(f"[*] Admin Actor: {admin.username} (role={admin.role})")
    print(f"[*] Store Manager Actor: {store_manager.username} (role={store_manager.role})")

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)

    sm_client = APIClient()
    sm_client.force_authenticate(user=store_manager)

    # 2. Select Supplier and Products
    supplier = Supplier.objects.first()
    assert supplier is not None, "No supplier available in database"
    products = list(Product.objects.filter(is_active=True)[:2])
    assert len(products) >= 2, "At least 2 active products required for multi-item test"

    prod1, prod2 = products[0], products[1]
    initial_stock1 = prod1.stock
    initial_stock2 = prod2.stock

    print(f"[*] Supplier: {supplier.name} (ID: {supplier.id})")
    print(f"[*] Product 1: {prod1.name} (Initial stock: {initial_stock1}, Cost: ETB {prod1.cost_price or 500})")
    print(f"[*] Product 2: {prod2.name} (Initial stock: {initial_stock2}, Cost: ETB {prod2.cost_price or 800})")

    # TEST 1: Store Manager views suppliers
    print("\n--- TEST 1: Store Manager Views Suppliers ---")
    res = sm_client.get('/api/products/suppliers/')
    assert res.status_code == 200, f"Failed to list suppliers: {res.status_code}"
    supplier_list = res.data.get('results', res.data)
    print(f"[+] Store Manager successfully retrieved {len(supplier_list)} suppliers.")

    # TEST 2: Store Manager creates Draft Purchase Order with multi-item lines
    print("\n--- TEST 2: Store Manager Creates Draft PO (Multi-Product) ---")
    unit_cost1 = Decimal(str(prod1.cost_price or '500.00'))
    unit_cost2 = Decimal(str(prod2.cost_price or '800.00'))
    po_payload = {
        'supplier': supplier.id,
        'status': 'DRAFT',
        'notes': 'Quarterly peripheral and hardware restocking.',
        'expected_supply_date': '2026-11-20',
        'items': [
            {'product': prod1.id, 'quantity': 20, 'unit_price': str(unit_cost1), 'notes': 'Primary batch'},
            {'product': prod2.id, 'quantity': 10, 'unit_price': str(unit_cost2), 'notes': 'Secondary batch'}
        ]
    }
    res = sm_client.post('/api/products/purchase-requests/', po_payload, format='json')
    assert res.status_code == 201, f"Failed to create PO: {res.status_code} {res.data}"
    po_data = res.data
    po_id = po_data['id']
    expected_total = (20 * unit_cost1) + (10 * unit_cost2)
    print(f"[+] Draft PO Created: {po_data['request_number']} (Status: {po_data['status']}, Total: ETB {po_data['total_estimated_cost']})")
    assert Decimal(str(po_data['total_estimated_cost'])) == expected_total, f"Total cost mismatch: {po_data['total_estimated_cost']} vs {expected_total}"

    # TEST 3: Store Manager submits Draft PO for Admin approval
    print("\n--- TEST 3: Store Manager Submits PO to Admin ---")
    res = sm_client.patch(f'/api/products/purchase-requests/{po_id}/', {'status': 'PENDING_APPROVAL'}, format='json')
    assert res.status_code == 200, f"Failed to submit PO: {res.status_code} {res.data}"
    assert res.data['status'] == 'PENDING_APPROVAL', "Status did not update to PENDING_APPROVAL"
    print(f"[+] PO {po_data['request_number']} successfully submitted to Admin (Status: PENDING_APPROVAL).")

    # TEST 4: Security RBAC Check — Store Manager attempts self-approval
    print("\n--- TEST 4: Security RBAC — Store Manager Attempts Self-Approval ---")
    res = sm_client.patch(f'/api/products/purchase-requests/{po_id}/', {'status': 'APPROVED', 'admin_feedback': 'Self approve'}, format='json')
    assert res.status_code == 403, f"Expected 403 Forbidden for self-approval, got: {res.status_code}"
    print(f"[+] Security check PASSED: Store Manager self-approval correctly blocked with 403 Forbidden: {res.data.get('error')}")

    # TEST 5: Admin reviews and approves PO
    print("\n--- TEST 5: Admin Reviews & Approves PO ---")
    admin_approval_payload = {
        'status': 'APPROVED',
        'admin_feedback': 'Approved under Hardware Procurement Allocation Q4.'
    }
    res = admin_client.patch(f'/api/products/purchase-requests/{po_id}/', admin_approval_payload, format='json')
    assert res.status_code == 200, f"Admin approval failed: {res.status_code} {res.data}"
    assert res.data['status'] == 'APPROVED', "PO status is not APPROVED"
    assert res.data['approved_by_username'] == admin.username, "Approver username mismatch"
    print(f"[+] Admin approved PO {po_data['request_number']} successfully.")

    # TEST 6: Store Manager sends approved PO to supplier & records confirmation
    print("\n--- TEST 6: Store Manager Dispatches PO to Supplier ---")
    res = sm_client.post(f'/api/products/purchase-requests/{po_id}/send-to-supplier/', {
        'supplier_confirmation_notes': 'Confirmed via supplier sales rep. Expected dispatch Friday.'
    }, format='json')
    assert res.status_code == 200, f"Send to supplier failed: {res.status_code} {res.data}"
    assert res.data['purchase_request']['status'] == 'SENT_TO_SUPPLIER', "PO status is not SENT_TO_SUPPLIER"
    print(f"[+] Store Manager recorded supplier dispatch (Status: SENT_TO_SUPPLIER).")

    # TEST 7: Store Manager receives physical stock (with damaged units)
    # Ordered: 20 pcs of prod1, 10 pcs of prod2 (total 30 pcs)
    # Receiving:
    #   prod1: 18 good, 2 damaged
    #   prod2: 10 good, 0 damaged
    # Total received = 28 good, 2 damaged. Inventory must increase ONLY by 18 for prod1 and 10 for prod2.
    print("\n--- TEST 7: Store Manager Receives Stock (Good vs Damaged) ---")
    po_obj = PurchaseRequest.objects.get(pk=po_id)
    item1 = po_obj.items.get(product=prod1)
    item2 = po_obj.items.get(product=prod2)

    receiving_payload = {
        'items': [
            {'id': item1.id, 'received_quantity': 18, 'damaged_quantity': 2},
            {'id': item2.id, 'received_quantity': 10, 'damaged_quantity': 0}
        ]
    }
    res = sm_client.post(f'/api/products/purchase-requests/{po_id}/receive-stock/', receiving_payload, format='json')
    assert res.status_code == 200, f"Stock receiving failed: {res.status_code} {res.data}"

    prod1.refresh_from_db()
    prod2.refresh_from_db()
    assert prod1.stock == initial_stock1 + 18, f"Product 1 stock mismatch: expected {initial_stock1 + 18}, got {prod1.stock}"
    assert prod2.stock == initial_stock2 + 10, f"Product 2 stock mismatch: expected {initial_stock2 + 10}, got {prod2.stock}"

    # Verify StockMovement records
    movements = StockMovement.objects.filter(product__in=[prod1, prod2], movement_type=StockMovement.MovementType.RESTOCK).order_by('-created_at')[:2]
    assert movements.count() == 2, "Expected 2 RESTOCK stock movement entries"
    print(f"[+] Stock receiving PASSED: Prod1 stock: {initial_stock1} -> {prod1.stock} (+18, 2 damaged quarantined).")
    print(f"[+] Stock receiving PASSED: Prod2 stock: {initial_stock2} -> {prod2.stock} (+10, 0 damaged).")
    print(f"[+] Damaged units (2 pcs) strictly excluded from sellable inventory.")

    # TEST 8: Store Manager records & submits Supplier Invoice
    print("\n--- TEST 8: Store Manager Submits Supplier Invoice ---")
    invoice_payload = {
        'supplier': supplier.id,
        'purchase_order': po_id,
        'invoice_number': 'INV-ETH-2026-001',
        'invoice_date': '2026-11-03',
        'due_date': '2026-12-03',
        'total_amount': str(expected_total),
        'notes': 'Official vendor invoice for hardware replenishment.'
    }
    res = sm_client.post('/api/products/supplier-invoices/', invoice_payload, format='json')
    assert res.status_code == 201, f"Failed to submit invoice: {res.status_code} {res.data}"
    invoice_id = res.data['id']
    print(f"[+] Supplier Invoice #{res.data['invoice_number']} submitted (Status: {res.data['status']}, Total: ETB {res.data['total_amount']}).")

    # TEST 9: Duplicate Invoice Prevention
    print("\n--- TEST 9: Duplicate Invoice Prevention ---")
    res = sm_client.post('/api/products/supplier-invoices/', invoice_payload, format='json')
    assert res.status_code == 400, f"Expected 400 for duplicate invoice, got: {res.status_code}"
    print(f"[+] Duplicate invoice check PASSED: Blocked with error: {res.data.get('error')}")

    # TEST 10: Security RBAC — Store Manager cannot approve invoice
    print("\n--- TEST 10: Security RBAC — Store Manager Cannot Approve Invoice ---")
    res = sm_client.post(f'/api/products/supplier-invoices/{invoice_id}/review/', {'action': 'approve'}, format='json')
    assert res.status_code == 403, f"Expected 403 Forbidden for SM invoice approval, got: {res.status_code}"
    print(f"[+] Security check PASSED: Store Manager invoice approval blocked with 403 Forbidden.")

    # TEST 11: Security RBAC — Store Manager cannot authorize/record payments
    print("\n--- TEST 11: Security RBAC — Store Manager Cannot Authorize Payments ---")
    payment_payload = {
        'supplier': supplier.id,
        'invoice': invoice_id,
        'amount_paid': str(expected_total),
        'payment_method': 'BANK_TRANSFER',
        'transaction_reference': 'CBE-TX-SM-UNAUTH'
    }
    res = sm_client.post('/api/products/supplier-payments/', payment_payload, format='json')
    assert res.status_code == 403, f"Expected 403 Forbidden for SM payment authorization, got: {res.status_code}"
    print(f"[+] Security check PASSED: Store Manager payment authorization blocked with 403 Forbidden.")

    # TEST 12: Admin reviews and approves Supplier Invoice
    print("\n--- TEST 12: Admin Reviews & Approves Supplier Invoice ---")
    res = admin_client.post(f'/api/products/supplier-invoices/{invoice_id}/review/', {
        'action': 'approve',
        'review_notes': 'Invoice matches PO and goods receipt inspection.'
    }, format='json')
    assert res.status_code == 200, f"Admin invoice review failed: {res.status_code} {res.data}"
    assert res.data['invoice']['status'] == 'APPROVED', "Invoice status is not APPROVED"
    print(f"[+] Admin approved invoice #{invoice_payload['invoice_number']} for payment.")

    # TEST 13: Admin records partial payment (e.g. 50% via Bank Transfer)
    print("\n--- TEST 13: Admin Authorizes & Records Partial Supplier Payment ---")
    half_payment = (expected_total / 2).quantize(Decimal('0.01'))
    tx_ref_1 = 'CBE-TX-20261103-01'
    payment_payload_1 = {
        'supplier': supplier.id,
        'invoice': invoice_id,
        'amount_paid': str(half_payment),
        'payment_method': 'BANK_TRANSFER',
        'transaction_reference': tx_ref_1,
        'notes': 'Initial 50% bank disbursement.'
    }
    res = admin_client.post('/api/products/supplier-payments/', payment_payload_1, format='json')
    assert res.status_code == 201, f"Admin payment creation failed: {res.status_code} {res.data}"
    inv_check = SupplierInvoice.objects.get(pk=invoice_id)
    assert inv_check.status == SupplierInvoice.Status.PARTIALLY_PAID, f"Expected PARTIALLY_PAID, got {inv_check.status}"
    assert inv_check.paid_amount == half_payment, f"Paid amount mismatch: {inv_check.paid_amount} vs {half_payment}"
    print(f"[+] First payment of ETB {half_payment} recorded. Invoice is now PARTIALLY_PAID.")

    # TEST 14: Duplicate Transaction Reference Prevention
    print("\n--- TEST 14: Duplicate Transaction Reference Prevention ---")
    res = admin_client.post('/api/products/supplier-payments/', payment_payload_1, format='json')
    assert res.status_code == 400, f"Expected 400 for duplicate transaction ref, got {res.status_code}"
    print(f"[+] Duplicate transaction ref check PASSED: Blocked with error: {res.data.get('error')}")

    # TEST 15: Admin records remaining payment (Telebirr)
    print("\n--- TEST 15: Admin Records Final Balance Payment (Telebirr) ---")
    remaining_balance = expected_total - half_payment
    tx_ref_2 = 'TB-TX-20261103-02'
    payment_payload_2 = {
        'supplier': supplier.id,
        'invoice': invoice_id,
        'amount_paid': str(remaining_balance),
        'payment_method': 'TELEBIRR',
        'transaction_reference': tx_ref_2,
        'notes': 'Final balance settlement via Telebirr merchant transfer.'
    }
    res = admin_client.post('/api/products/supplier-payments/', payment_payload_2, format='json')
    assert res.status_code == 201, f"Final payment creation failed: {res.status_code} {res.data}"
    inv_check.refresh_from_db()
    assert inv_check.status == SupplierInvoice.Status.PAID, f"Expected PAID, got {inv_check.status}"
    assert inv_check.outstanding_amount == Decimal('0.00'), f"Outstanding amount should be 0, got {inv_check.outstanding_amount}"
    print(f"[+] Final payment of ETB {remaining_balance} recorded. Invoice status is now PAID (Outstanding: ETB 0.00).")

    # TEST 16: Check Supplier Ledger Totals
    print("\n--- TEST 16: Supplier Ledger Totals & Balance Verification ---")
    supplier.refresh_from_db()
    print(f"[*] Supplier Total Purchases: ETB {supplier.total_purchases_amount}")
    print(f"[*] Supplier Total Paid: ETB {supplier.total_paid_amount}")
    print(f"[*] Supplier Outstanding Balance: ETB {supplier.outstanding_balance}")
    assert supplier.total_paid_amount >= expected_total, "Supplier paid amount does not reflect payments"

    # TEST 17: Admin Procurement & Financial Reports
    print("\n--- TEST 17: Admin Procurement & Financial Reports API ---")
    res = admin_client.get('/api/products/procurement/reports/')
    assert res.status_code == 200, f"Reports API failed: {res.status_code}"
    rep = res.data
    summary = rep['summary']
    print(f"[+] Total Purchases Metric: ETB {summary['total_purchases']}")
    print(f"[+] Total Payments Metric: ETB {summary['total_supplier_payments']}")
    print(f"[+] Outstanding Balance Metric: ETB {summary['outstanding_supplier_balance']}")
    print(f"[+] POs Awaiting Approval: {summary['pos_awaiting_approval']}")
    print(f"[+] Unpaid Invoices: {summary['unpaid_invoices_count']} (Amount: ETB {summary['unpaid_invoices_amount']})")
    print(f"[+] Supplier Breakdown: {len(rep['supplier_breakdown'])} suppliers analysed.")
    print(f"[+] Monthly Expense Series: {len(rep['monthly_expenses'])} monthly periods.")
    print(f"[+] Yearly Expense Series: {len(rep['yearly_expenses'])} yearly periods.")
    assert Decimal(str(summary['total_supplier_payments'])) >= expected_total, "Total payments mismatch in reports"

    print("\n======================================================================")
    print("ALL 17 PROCUREMENT & SUPPLIER PAYMENT VERIFICATION TESTS PASSED 100%!")
    print("======================================================================")

if __name__ == '__main__':
    run_verification()
