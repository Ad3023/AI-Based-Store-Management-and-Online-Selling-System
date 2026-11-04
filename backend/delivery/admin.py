from django.contrib import admin
from .models import (
    CourierCompany,
    DeliveryVehicle,
    DeliveryPersonnel,
    Shipment,
    ShipmentTrackingEvent,
    DeliveryOTP,
    DeliveryAttempt,
    DeliveryComplaint,
    DeliveryFeeRule,
    DeliverySetting,
)


@admin.register(CourierCompany)
class CourierCompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'contact_person', 'phone_number', 'origin_city', 'is_active')
    search_fields = ('name', 'code', 'contact_person', 'email')
    list_filter = ('is_active', 'origin_city')


@admin.register(DeliveryVehicle)
class DeliveryVehicleAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'vehicle_type', 'model', 'driver_name', 'status', 'is_active')
    search_fields = ('registration_number', 'model', 'driver_name')
    list_filter = ('vehicle_type', 'status', 'is_active')


@admin.register(DeliveryPersonnel)
class DeliveryPersonnelAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'employee_code', 'phone_number', 'delivery_method', 'current_city', 'is_available', 'is_active')
    search_fields = ('full_name', 'employee_code', 'phone_number', 'email')
    list_filter = ('delivery_method', 'is_available', 'is_active', 'current_city')


class ShipmentTrackingEventInline(admin.TabularInline):
    model = ShipmentTrackingEvent
    extra = 0
    readonly_fields = ('timestamp',)


class DeliveryAttemptInline(admin.TabularInline):
    model = DeliveryAttempt
    extra = 0
    readonly_fields = ('attempted_at',)


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ('tracking_number', 'order', 'delivery_method', 'status', 'destination_city', 'recipient_name', 'created_at')
    search_fields = ('tracking_number', 'order__order_number', 'recipient_name', 'recipient_phone')
    list_filter = ('delivery_method', 'status', 'destination_city')
    inlines = [ShipmentTrackingEventInline, DeliveryAttemptInline]


@admin.register(ShipmentTrackingEvent)
class ShipmentTrackingEventAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'status', 'location', 'timestamp', 'updated_by')
    search_fields = ('shipment__tracking_number', 'location', 'description')
    list_filter = ('status',)


@admin.register(DeliveryOTP)
class DeliveryOTPAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'customer', 'is_used', 'attempts_count', 'expires_at', 'created_at')
    search_fields = ('shipment__tracking_number', 'customer__username', 'recipient_email')
    list_filter = ('is_used',)


@admin.register(DeliveryAttempt)
class DeliveryAttemptAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'attempt_number', 'reason', 'attempted_at')
    search_fields = ('shipment__tracking_number', 'notes')
    list_filter = ('reason',)


@admin.register(DeliveryComplaint)
class DeliveryComplaintAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'customer', 'complaint_type', 'status', 'created_at')
    search_fields = ('shipment__tracking_number', 'customer__username', 'description')
    list_filter = ('complaint_type', 'status')


@admin.register(DeliveryFeeRule)
class DeliveryFeeRuleAdmin(admin.ModelAdmin):
    list_display = ('origin_city', 'destination_city', 'delivery_method', 'base_fee', 'per_kg_fee', 'is_active')
    search_fields = ('origin_city', 'destination_city')
    list_filter = ('delivery_method', 'is_active')


@admin.register(DeliverySetting)
class DeliverySettingAdmin(admin.ModelAdmin):
    list_display = ('default_delivery_method', 'third_party_courier_enabled', 'own_delivery_enabled', 'updated_at')
