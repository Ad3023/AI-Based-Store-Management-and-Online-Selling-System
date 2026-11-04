from django.urls import path
from .views import (
    CourierCompanyListCreateView,
    CourierCompanyDetailView,
    CourierCompanyPerformanceView,
    DeliveryVehicleListCreateView,
    DeliveryVehicleDetailView,
    DeliveryPersonnelListCreateView,
    DeliveryPersonnelDetailView,
    DeliveryFeeRuleListCreateView,
    DeliveryFeeRuleDetailView,
    CalculateDeliveryFeeView,
    DeliverySettingView,
    StoreManagerDispatchOrderListView,
    StoreManagerMarkReadyForDispatchView,
    ShipmentListView,
    ShipmentDetailView,
    ShipmentAssignOrInitView,
    ShipmentStatusUpdateView,
    ShipmentAssignLocalDeliveryView,
    ShipmentBookCourierView,
    ShipmentConfirmBookingView,
    ShipmentSchedulePickupView,
    ShipmentConfirmHandoverView,
    DeliveryOTPRequestView,
    DeliveryOTPVerifyView,
    DeliveryAttemptCreateView,
    DeliveryComplaintListCreateView,
    DeliveryComplaintDetailView,
    PublicTrackShipmentView,
    CustomerMyShipmentsView,
    CourierSettlementListCreateView,
    CourierSettlementDetailView,
)

app_name = 'delivery'

urlpatterns = [
    # Courier Companies (Admin)
    path('couriers/', CourierCompanyListCreateView.as_view(), name='courier-list-create'),
    path('couriers/<int:pk>/', CourierCompanyDetailView.as_view(), name='courier-detail'),
    path('couriers/<int:pk>/performance/', CourierCompanyPerformanceView.as_view(), name='courier-performance'),

    # Fleet Vehicles (Admin)
    path('vehicles/', DeliveryVehicleListCreateView.as_view(), name='vehicle-list-create'),
    path('vehicles/<int:pk>/', DeliveryVehicleDetailView.as_view(), name='vehicle-detail'),

    # Delivery Personnel (Admin & Order Manager)
    path('personnel/', DeliveryPersonnelListCreateView.as_view(), name='personnel-list-create'),
    path('personnel/<int:pk>/', DeliveryPersonnelDetailView.as_view(), name='personnel-detail'),

    # Fee Rules & Calculator
    path('rules/', DeliveryFeeRuleListCreateView.as_view(), name='fee-rule-list-create'),
    path('rules/<int:pk>/', DeliveryFeeRuleDetailView.as_view(), name='fee-rule-detail'),
    path('calculate-fee/', CalculateDeliveryFeeView.as_view(), name='calculate-fee'),

    # Settings
    path('settings/', DeliverySettingView.as_view(), name='delivery-settings'),

    # Store Manager Dispatch
    path('dispatch-orders/', StoreManagerDispatchOrderListView.as_view(), name='dispatch-order-list'),
    path('shipments/<int:shipment_id>/ready-for-dispatch/', StoreManagerMarkReadyForDispatchView.as_view(), name='shipment-ready-dispatch'),

    # Order Manager Shipments
    path('shipments/', ShipmentListView.as_view(), name='shipment-list'),
    path('shipments/<int:pk>/', ShipmentDetailView.as_view(), name='shipment-detail'),
    path('orders/<int:order_id>/assign/', ShipmentAssignOrInitView.as_view(), name='shipment-assign'),
    path('shipments/<int:shipment_id>/status/', ShipmentStatusUpdateView.as_view(), name='shipment-status-update'),
    path('shipments/<int:shipment_id>/book-courier/', ShipmentBookCourierView.as_view(), name='shipment-book-courier'),
    path('shipments/<int:shipment_id>/confirm-booking/', ShipmentConfirmBookingView.as_view(), name='shipment-confirm-booking'),
    path('shipments/<int:shipment_id>/schedule-pickup/', ShipmentSchedulePickupView.as_view(), name='shipment-schedule-pickup'),
    path('shipments/<int:shipment_id>/confirm-handover/', ShipmentConfirmHandoverView.as_view(), name='shipment-confirm-handover'),
    path('shipments/<int:shipment_id>/assign-local/', ShipmentAssignLocalDeliveryView.as_view(), name='shipment-assign-local'),

    # OTP Verification
    path('shipments/<int:shipment_id>/request-otp/', DeliveryOTPRequestView.as_view(), name='shipment-request-otp'),
    path('shipments/<int:shipment_id>/verify-otp/', DeliveryOTPVerifyView.as_view(), name='shipment-verify-otp'),

    # Failed Delivery Attempts
    path('shipments/<int:shipment_id>/record-attempt/', DeliveryAttemptCreateView.as_view(), name='shipment-record-attempt'),

    # Complaints & Disputes
    path('complaints/', DeliveryComplaintListCreateView.as_view(), name='complaint-list-create'),
    path('complaints/<int:pk>/', DeliveryComplaintDetailView.as_view(), name='complaint-detail'),

    # Tracking & Customer
    path('track/<str:tracking_number>/', PublicTrackShipmentView.as_view(), name='public-track-shipment'),
    path('track/', PublicTrackShipmentView.as_view(), name='public-track-shipment-query'),
    path('customer/my-shipments/', CustomerMyShipmentsView.as_view(), name='customer-my-shipments'),

    # Courier Settlements (Admin & Order Manager)
    path('settlements/', CourierSettlementListCreateView.as_view(), name='courier-settlement-list-create'),
    path('settlements/<int:pk>/', CourierSettlementDetailView.as_view(), name='courier-settlement-detail'),
]
