from rest_framework import serializers
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
    ShipmentStatus,
    DeliveryMethod,
    CourierSettlement,
)
from orders.models import Order


class CourierCompanySerializer(serializers.ModelSerializer):
    assigned_shipments_count = serializers.IntegerField(read_only=True)
    delivered_shipments_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CourierCompany
        fields = [
            'id',
            'name',
            'code',
            'contact_person',
            'phone_number',
            'email',
            'office_address',
            'origin_city',
            'supported_destination_cities',
            'service_description',
            'tracking_url_template',
            'is_active',
            'assigned_shipments_count',
            'delivered_shipments_count',
            'created_at',
            'updated_at',
        ]

    def validate_email(self, value):
        from accounts.validators import validate_email_address
        return validate_email_address(value, required=True)

    def validate_phone_number(self, value):
        from accounts.validators import validate_phone_number_format
        return validate_phone_number_format(value, required=True)


class DeliveryVehicleSerializer(serializers.ModelSerializer):
    vehicle_type_display = serializers.CharField(source='get_vehicle_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DeliveryVehicle
        fields = [
            'id',
            'registration_number',
            'vehicle_type',
            'vehicle_type_display',
            'model',
            'driver_name',
            'driver_phone',
            'current_city',
            'status',
            'status_display',
            'is_active',
            'created_at',
            'updated_at',
        ]

    def validate_driver_phone(self, value):
        if not value or not str(value).strip():
            return ''
        from accounts.validators import validate_phone_number_format
        return validate_phone_number_format(value, required=False)


class DeliveryPersonnelSerializer(serializers.ModelSerializer):
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    courier_company_name = serializers.CharField(source='courier_company.name', read_only=True, allow_null=True)
    user_account_username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_account_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = DeliveryPersonnel
        fields = [
            'id',
            'full_name',
            'phone_number',
            'email',
            'employee_code',
            'delivery_method',
            'delivery_method_display',
            'courier_company',
            'courier_company_name',
            'vehicle_type',
            'vehicle_registration_number',
            'delivery_area',
            'status',
            'current_city',
            'is_available',
            'is_active',
            'user',
            'user_account_username',
            'user_account_password',
            'user_username',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'employee_code': {'required': False}
        }

    def validate_email(self, value):
        if not value or not str(value).strip():
            return ''
        from accounts.validators import validate_email_address
        return validate_email_address(value, required=False)

    def validate_phone_number(self, value):
        from accounts.validators import validate_phone_number_format
        return validate_phone_number_format(value, required=True)

    def create(self, validated_data):
        username = validated_data.pop('user_account_username', '').strip()
        password = validated_data.pop('user_account_password', '').strip()

        if not validated_data.get('employee_code'):
            import uuid
            validated_data['employee_code'] = f"CR-{uuid.uuid4().hex[:6].upper()}"

        user = validated_data.get('user')
        if not user and username:
            from accounts.models import User
            email = validated_data.get('email') or f"{username.lower()}@ethiotech.com"
            existing_user = User.objects.filter(username__iexact=username).first()
            if not existing_user and email:
                existing_user = User.objects.filter(email__iexact=email).first()
            if existing_user:
                existing_user.role = User.RoleChoices.DELIVERY
                existing_user.is_active = validated_data.get('is_active', True)
                if password:
                    existing_user.set_password(password)
                existing_user.save()
                if hasattr(existing_user, 'delivery_profile') and existing_user.delivery_profile:
                    return self.update(existing_user.delivery_profile, validated_data)
                user = existing_user
            else:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password or 'DriverPass123!',
                    role=User.RoleChoices.DELIVERY,
                    first_name=validated_data.get('full_name', '').split(' ')[0],
                    last_name=' '.join(validated_data.get('full_name', '').split(' ')[1:]) if ' ' in validated_data.get('full_name', '') else '',
                    phone_number=validated_data.get('phone_number', ''),
                    is_active=validated_data.get('is_active', True)
                )
            validated_data['user'] = user

        return super().create(validated_data)

    def update(self, instance, validated_data):
        username = validated_data.pop('user_account_username', None)
        password = validated_data.pop('user_account_password', None)

        is_active = validated_data.get('is_active')
        if is_active is not None and instance.user:
            instance.user.is_active = is_active
            instance.user.save(update_fields=['is_active'])

        if password and instance.user:
            instance.user.set_password(password)
            instance.user.save()

        return super().update(instance, validated_data)


class CourierSettlementSerializer(serializers.ModelSerializer):
    courier_name = serializers.CharField(source='courier.full_name', read_only=True)
    courier_phone = serializers.CharField(source='courier.phone_number', read_only=True)
    tracking_number = serializers.CharField(source='shipment.tracking_number', read_only=True, allow_null=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True, allow_null=True)
    settlement_status_display = serializers.CharField(source='get_settlement_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    settled_by_username = serializers.CharField(source='settled_by.username', read_only=True, allow_null=True)

    class Meta:
        model = CourierSettlement
        fields = [
            'id',
            'courier',
            'courier_name',
            'courier_phone',
            'shipment',
            'tracking_number',
            'order',
            'order_number',
            'customer_delivery_fee',
            'courier_amount_payable',
            'amount_settled',
            'outstanding_balance',
            'settlement_reference',
            'settlement_status',
            'settlement_status_display',
            'payment_method',
            'payment_method_display',
            'notes',
            'settled_at',
            'settled_by',
            'settled_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'settlement_reference', 'settled_by', 'created_at', 'updated_at']


class ShipmentTrackingEventSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ShipmentTrackingEvent
        fields = [
            'id',
            'previous_status',
            'status',
            'status_display',
            'location',
            'description',
            'delivery_note',
            'updated_by',
            'updated_by_name',
            'timestamp',
        ]

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return 'System Automated'


class DeliveryAttemptSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    personnel_name = serializers.CharField(source='delivery_personnel.full_name', read_only=True, allow_null=True)

    class Meta:
        model = DeliveryAttempt
        fields = [
            'id',
            'shipment',
            'delivery_personnel',
            'personnel_name',
            'attempt_number',
            'reason',
            'reason_display',
            'notes',
            'next_scheduled_attempt',
            'attempted_at',
        ]


class DeliveryComplaintSerializer(serializers.ModelSerializer):
    complaint_type_display = serializers.CharField(source='get_complaint_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.SerializerMethodField()
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    tracking_number = serializers.CharField(source='shipment.tracking_number', read_only=True)

    class Meta:
        model = DeliveryComplaint
        fields = [
            'id',
            'shipment',
            'customer',
            'customer_name',
            'order',
            'order_number',
            'tracking_number',
            'complaint_type',
            'complaint_type_display',
            'description',
            'status',
            'status_display',
            'investigated_by',
            'resolution_notes',
            'created_at',
            'resolved_at',
        ]
        read_only_fields = ['shipment', 'customer', 'order', 'status', 'investigated_by', 'resolution_notes', 'resolved_at']

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.username
        return 'Anonymous'


class DeliveryFeeRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryFeeRule
        fields = [
            'id',
            'origin_city',
            'destination_city',
            'delivery_method',
            'base_fee',
            'per_kg_fee',
            'estimated_days_min',
            'estimated_days_max',
            'is_active',
        ]


class DeliverySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverySetting
        fields = [
            'default_delivery_method',
            'third_party_courier_enabled',
            'own_delivery_enabled',
            'otp_expiry_minutes',
            'otp_max_attempts',
            'otp_cooldown_seconds',
            'updated_at',
        ]


class ShipmentListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_username = serializers.CharField(source='order.customer.username', read_only=True)
    customer_email = serializers.CharField(source='order.customer.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    courier_name = serializers.CharField(source='courier_company.name', read_only=True, allow_null=True)
    vehicle_plate = serializers.CharField(source='vehicle.registration_number', read_only=True, allow_null=True)
    personnel_name = serializers.CharField(source='delivery_personnel.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Shipment
        fields = [
            'id',
            'tracking_number',
            'order',
            'order_number',
            'customer_username',
            'customer_email',
            'delivery_method',
            'delivery_method_display',
            'courier_company',
            'courier_name',
            'external_tracking_number',
            'vehicle',
            'vehicle_plate',
            'delivery_personnel',
            'personnel_name',
            'status',
            'status_display',
            'origin_city',
            'destination_city',
            'recipient_name',
            'recipient_phone',
            'delivery_address',
            'shipping_fee',
            'weight_kg',
            'booking_status',
            'booking_reference',
            'booking_email_sent',
            'pickup_driver_name',
            'pickup_driver_phone',
            'pickup_vehicle_plate',
            'pickup_scheduled_at',
            'handover_confirmed_at',
            'created_at',
            'updated_at',
        ]


class ShipmentDetailSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_total = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    order_payment_status = serializers.CharField(source='order.payment_status', read_only=True, allow_null=True)
    order_payment_method = serializers.CharField(source='order.payment_method', read_only=True, allow_null=True)
    order_items = serializers.SerializerMethodField()
    delivery_confirmation_code = serializers.SerializerMethodField()
    customer_username = serializers.CharField(source='order.customer.username', read_only=True)
    customer_email = serializers.CharField(source='order.customer.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    courier_company = CourierCompanySerializer(read_only=True)
    vehicle = DeliveryVehicleSerializer(read_only=True)
    delivery_personnel = DeliveryPersonnelSerializer(read_only=True)
    events = ShipmentTrackingEventSerializer(many=True, read_only=True)
    attempts = DeliveryAttemptSerializer(many=True, read_only=True)
    complaints = DeliveryComplaintSerializer(many=True, read_only=True)

    class Meta:
        model = Shipment
        fields = [
            'id',
            'tracking_number',
            'order',
            'order_id',
            'order_number',
            'order_total',
            'order_items',
            'customer_username',
            'customer_email',
            'delivery_method',
            'delivery_method_display',
            'courier_company',
            'external_tracking_number',
            'vehicle',
            'delivery_personnel',
            'status',
            'status_display',
            'origin_city',
            'destination_city',
            'recipient_name',
            'recipient_phone',
            'delivery_address',
            'delivery_instructions',
            'shipping_fee',
            'weight_kg',
            'estimated_delivery_date',
            'actual_delivery_date',
            'delivery_confirmation_code',
            'order_payment_status',
            'order_payment_method',
            'booking_status',
            'booking_requested_at',
            'booking_reference',
            'booking_notes',
            'booking_email_sent',
            'booking_confirmed_at',
            'booking_rejected_at',
            'booking_rejection_reason',
            'package_dimensions',
            'pickup_driver_name',
            'pickup_driver_phone',
            'pickup_vehicle_plate',
            'pickup_scheduled_at',
            'handover_confirmed_by',
            'handover_confirmed_at',
            'handover_notes',
            'events',
            'attempts',
            'complaints',
            'created_at',
            'updated_at',
        ]


    def get_delivery_confirmation_code(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return ''
        user = request.user
        if (
            getattr(user, 'is_super_admin', False) or
            getattr(user, 'is_admin', lambda: False)() or
            getattr(user, 'is_store_manager', lambda: False)() or
            getattr(user, 'is_order_manager', lambda: False)() or
            (obj.order and obj.order.customer_id == user.id) or
            (obj.delivery_personnel and obj.delivery_personnel.user_id == user.id)
        ):
            return obj.delivery_confirmation_code
        return ''
    def get_order_items(self, obj):
        if not obj.order:
            return []
        items = []
        for item in obj.order.items.select_related('product').all():
            img_url = None
            if item.product and item.product.image:
                img_url = item.product.image.url
            items.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': item.product.name if item.product else 'Product',
                'product_image': img_url,
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'total_price': str(item.total_price),
                'warranty_duration_days': item.warranty_duration_days,
            })
        return items


class ShipmentAssignSerializer(serializers.Serializer):
    delivery_method = serializers.ChoiceField(choices=DeliveryMethod.choices, default=DeliveryMethod.THIRD_PARTY_COURIER)
    courier_company_id = serializers.IntegerField(required=False, allow_null=True)
    external_tracking_number = serializers.CharField(required=False, allow_blank=True, max_length=100)
    vehicle_id = serializers.IntegerField(required=False, allow_null=True)
    delivery_personnel_id = serializers.IntegerField(required=False, allow_null=True)
    delivery_address = serializers.CharField(required=False, allow_blank=True)
    expected_delivery_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class DriverShipmentUpdateStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
    ])
    confirmation_code = serializers.CharField(required=False, allow_blank=True)
    delivery_note = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)


class ShipmentStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ShipmentStatus.choices)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)


class DeliveryAttemptCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=DeliveryAttempt.Reason.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
    next_scheduled_attempt = serializers.DateField(required=False, allow_null=True)


class DeliveryOTPVerifySerializer(serializers.Serializer):
    otp = serializers.CharField(max_length=10, min_length=4)


class CalculateFeeRequestSerializer(serializers.Serializer):
    destination_city = serializers.CharField(max_length=100)
    origin_city = serializers.CharField(max_length=100, default='Addis Ababa')
    delivery_method = serializers.ChoiceField(choices=DeliveryMethod.choices, default=DeliveryMethod.THIRD_PARTY_COURIER)
    weight_kg = serializers.DecimalField(max_digits=6, decimal_places=2, default=1.0)


class CourierBookingRequestSerializer(serializers.Serializer):
    courier_company_id = serializers.IntegerField(required=True)
    pickup_date = serializers.DateField(required=False, allow_null=True)
    package_dimensions = serializers.CharField(max_length=100, required=False, default='35x25x10 cm')
    package_weight_kg = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class CourierBookingConfirmSerializer(serializers.Serializer):
    confirmed = serializers.BooleanField(default=True)
    external_tracking_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pickup_time_window = serializers.CharField(max_length=100, required=False, allow_blank=True)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    courier_notes = serializers.CharField(required=False, allow_blank=True)


class DriverPickupScheduleSerializer(serializers.Serializer):
    driver_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    driver_phone = serializers.CharField(max_length=35, required=False, allow_blank=True)
    pickup_driver_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    pickup_driver_phone = serializers.CharField(max_length=35, required=False, allow_blank=True)
    vehicle_plate = serializers.CharField(max_length=40, required=False, allow_blank=True)
    pickup_vehicle_plate = serializers.CharField(max_length=40, required=False, allow_blank=True)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    pickup_scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        name = attrs.get('driver_name') or attrs.get('pickup_driver_name')
        if not name:
            raise serializers.ValidationError({'driver_name': 'Driver name is required.'})
        attrs['driver_name'] = name

        phone = attrs.get('driver_phone') or attrs.get('pickup_driver_phone')
        if not phone:
            raise serializers.ValidationError({'driver_phone': 'Driver phone is required.'})
        from accounts.validators import validate_phone_number_format
        try:
            attrs['driver_phone'] = validate_phone_number_format(phone, required=True)
        except serializers.ValidationError as e:
            raise serializers.ValidationError({'driver_phone': e.detail[0] if isinstance(e.detail, list) else str(e.detail)})

        attrs['vehicle_plate'] = attrs.get('vehicle_plate') or attrs.get('pickup_vehicle_plate', '')
        attrs['scheduled_at'] = attrs.get('scheduled_at') or attrs.get('pickup_scheduled_at')
        return attrs


class PackageHandoverConfirmSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(max_length=150, required=False, default='Addis Ababa Fulfillment Center')
