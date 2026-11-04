import uuid
import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password


class DeliveryMethod(models.TextChoices):
    THIRD_PARTY_COURIER = 'THIRD_PARTY_COURIER', 'Third-Party Courier Delivery'
    OWN_DELIVERY = 'OWN_DELIVERY', 'Own Delivery Service'


class ShipmentStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PENDING_ASSIGNMENT = 'PENDING_ASSIGNMENT', 'Pending Assignment'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    PROCESSING = 'PROCESSING', 'Processing'
    READY_FOR_DISPATCH = 'READY_FOR_DISPATCH', 'Ready for Dispatch / Packed'
    BOOKING_REQUESTED = 'BOOKING_REQUESTED', 'Courier Booking Requested'
    BOOKING_CONFIRMED = 'BOOKING_CONFIRMED', 'Courier Booking Confirmed'
    PICKUP_SCHEDULED = 'PICKUP_SCHEDULED', 'Driver Pickup Scheduled'
    COURIER_ASSIGNED = 'COURIER_ASSIGNED', 'Courier Assigned'
    PICKED_UP = 'PICKED_UP', 'Picked Up'
    IN_TRANSIT = 'IN_TRANSIT', 'In Transit'
    ARRIVED_AT_SORTING_CENTER = 'ARRIVED_AT_SORTING_CENTER', 'Arrived at Sorting Center'
    ARRIVED_AT_DESTINATION = 'ARRIVED_AT_DESTINATION', 'Arrived at Destination Station'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', 'Out for Delivery'
    DELIVERY_ATTEMPT_FAILED = 'DELIVERY_ATTEMPT_FAILED', 'Delivery Attempt Failed'
    FAILED_DELIVERY = 'FAILED_DELIVERY', 'Failed Delivery'
    DELAYED = 'DELAYED', 'Delayed'
    DELIVERED = 'DELIVERED', 'Delivered'
    DELIVERY_DISPUTED = 'DELIVERY_DISPUTED', 'Delivery Disputed'
    RETURNED = 'RETURNED', 'Returned'
    RETURNED_TO_SELLER = 'RETURNED_TO_SELLER', 'Returned to Seller'
    CANCELLED = 'CANCELLED', 'Cancelled'


def generate_tracking_number():
    """Generates a unique tracking number in format ETH-YYYY-XXXXX."""
    year = datetime.datetime.now().year
    suffix = uuid.uuid4().hex[:5].upper()
    return f"ETH-{year}-{suffix}"


class CourierCompany(models.Model):
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    contact_person = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=35)
    email = models.EmailField()
    office_address = models.TextField()
    origin_city = models.CharField(max_length=100, default='Addis Ababa')
    supported_destination_cities = models.JSONField(
        default=list,
        help_text="List of destination cities supported by this courier company."
    )
    service_description = models.TextField(blank=True, default='')
    tracking_url_template = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="URL pattern with {tracking_number} placeholder"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Courier Companies'

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def assigned_shipments_count(self):
        if hasattr(self, '_assigned_shipments_count'):
            return self._assigned_shipments_count
        return self.shipments.count()

    @assigned_shipments_count.setter
    def assigned_shipments_count(self, value):
        self._assigned_shipments_count = value

    @property
    def delivered_shipments_count(self):
        if hasattr(self, '_delivered_shipments_count'):
            return self._delivered_shipments_count
        return self.shipments.filter(status=ShipmentStatus.DELIVERED).count()

    @delivered_shipments_count.setter
    def delivered_shipments_count(self, value):
        self._delivered_shipments_count = value


class DeliveryVehicle(models.Model):
    class VehicleType(models.TextChoices):
        MOTORCYCLE = 'MOTORCYCLE', 'Motorcycle'
        CAR = 'CAR', 'Car'
        VAN = 'VAN', 'Van'
        TRUCK = 'TRUCK', 'Truck'

    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        IN_USE = 'IN_USE', 'In Use / Dispatched'
        MAINTENANCE = 'MAINTENANCE', 'Under Maintenance'
        INACTIVE = 'INACTIVE', 'Inactive'

    registration_number = models.CharField(max_length=40, unique=True, db_index=True)
    vehicle_type = models.CharField(
        max_length=30,
        choices=VehicleType.choices,
        default=VehicleType.VAN
    )
    model = models.CharField(max_length=100)
    driver_name = models.CharField(max_length=120, blank=True, default='')
    driver_phone = models.CharField(max_length=35, blank=True, default='')
    current_city = models.CharField(max_length=100, default='Addis Ababa')
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.AVAILABLE
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['registration_number']

    def __str__(self):
        return f"{self.registration_number} - {self.model} ({self.get_vehicle_type_display()})"


class DeliveryPersonnel(models.Model):
    class Method(models.TextChoices):
        OWN_FLEET = 'OWN_FLEET', 'Own Fleet Delivery'
        THIRD_PARTY_LOCAL = 'THIRD_PARTY_LOCAL', 'Third-Party Local Courier Partner'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        ON_LEAVE = 'ON_LEAVE', 'On Leave'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    full_name = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=35)
    email = models.EmailField(blank=True, null=True)
    employee_code = models.CharField(max_length=40, unique=True, db_index=True)
    delivery_method = models.CharField(
        max_length=30,
        choices=Method.choices,
        default=Method.OWN_FLEET
    )
    courier_company = models.ForeignKey(
        CourierCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='personnel'
    )
    vehicle_type = models.CharField(max_length=50, blank=True, default='Motorcycle')
    vehicle_registration_number = models.CharField(max_length=50, blank=True, default='')
    delivery_area = models.CharField(max_length=150, blank=True, default='Addis Ababa')
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.ACTIVE)
    current_city = models.CharField(max_length=100, default='Addis Ababa')
    is_available = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delivery_profile'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['full_name']
        verbose_name_plural = 'Delivery Personnel'

    def __str__(self):
        return f"{self.full_name} ({self.employee_code}) - {self.delivery_area or self.current_city} [{self.status}]"


class Shipment(models.Model):
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='shipment'
    )
    tracking_number = models.CharField(
        max_length=40,
        unique=True,
        db_index=True,
        default=generate_tracking_number
    )
    delivery_method = models.CharField(
        max_length=30,
        choices=DeliveryMethod.choices,
        default=DeliveryMethod.THIRD_PARTY_COURIER
    )
    courier_company = models.ForeignKey(
        CourierCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipments'
    )
    external_tracking_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Tracking code provided by third-party courier partner"
    )
    vehicle = models.ForeignKey(
        DeliveryVehicle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipments'
    )
    delivery_personnel = models.ForeignKey(
        DeliveryPersonnel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipments'
    )
    status = models.CharField(
        max_length=40,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.PENDING,
        db_index=True
    )
    origin_city = models.CharField(max_length=100, default='Addis Ababa')
    destination_city = models.CharField(max_length=100)
    recipient_name = models.CharField(max_length=150)
    recipient_phone = models.CharField(max_length=35)
    delivery_address = models.TextField()
    delivery_instructions = models.TextField(blank=True, default='')
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=1.0)
    estimated_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateTimeField(null=True, blank=True)
    # Courier Booking Lifecycle (Workflow Stages 3 & 4)
    booking_status = models.CharField(
        max_length=30,
        choices=[
            ('NOT_REQUESTED', 'Not Requested'),
            ('REQUESTED', 'Booking Requested'),
            ('CONFIRMED', 'Booking Confirmed'),
            ('REJECTED', 'Booking Rejected'),
        ],
        default='NOT_REQUESTED'
    )
    booking_requested_at = models.DateTimeField(null=True, blank=True)
    booking_reference = models.CharField(max_length=100, blank=True, default='')
    booking_notes = models.TextField(blank=True, default='')
    booking_email_sent = models.BooleanField(default=False)
    booking_confirmed_at = models.DateTimeField(null=True, blank=True)
    booking_rejected_at = models.DateTimeField(null=True, blank=True)
    booking_rejection_reason = models.TextField(blank=True, default='')
    package_dimensions = models.CharField(max_length=100, blank=True, default='35x25x10 cm')

    # Driver Pickup Lifecycle (Workflow Stage 5)
    pickup_driver_name = models.CharField(max_length=120, blank=True, default='')
    pickup_driver_phone = models.CharField(max_length=35, blank=True, default='')
    pickup_vehicle_plate = models.CharField(max_length=40, blank=True, default='')
    pickup_scheduled_at = models.DateTimeField(null=True, blank=True)

    # Physical Handover Confirmation (Workflow Stage 6)
    handover_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_handovers'
    )
    handover_confirmed_at = models.DateTimeField(null=True, blank=True)
    handover_notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Shipment {self.tracking_number} [{self.get_status_display()}] for {self.order.order_number}"

    def save(self, *args, **kwargs):
        if not self.tracking_number:
            self.tracking_number = generate_tracking_number()
        super().save(*args, **kwargs)


class ShipmentTrackingEvent(models.Model):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name='events'
    )
    status = models.CharField(max_length=40, choices=ShipmentStatus.choices)
    location = models.CharField(max_length=150)
    description = models.TextField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.shipment.tracking_number} -> {self.status}"


class DeliveryOTP(models.Model):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name='otps'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='delivery_otps'
    )
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    attempts_count = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    recipient_email = models.EmailField()
    recipient_phone = models.CharField(max_length=35, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def set_otp(self, raw_otp: str):
        self.otp_hash = make_password(str(raw_otp))

    def check_otp(self, raw_otp: str) -> bool:
        return check_password(str(raw_otp), self.otp_hash)

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"OTP for {self.shipment.tracking_number} (Used: {self.is_used}, Expired: {self.is_expired})"


class DeliveryAttempt(models.Model):
    class Reason(models.TextChoices):
        CUSTOMER_UNAVAILABLE = 'CUSTOMER_UNAVAILABLE', 'Customer Unavailable'
        INCORRECT_ADDRESS = 'INCORRECT_ADDRESS', 'Incorrect Address'
        PHONE_UNREACHABLE = 'PHONE_UNREACHABLE', 'Customer Phone Unreachable'
        CUSTOMER_REJECTED = 'CUSTOMER_REJECTED', 'Customer Rejected Package'
        PACKAGE_DAMAGED = 'PACKAGE_DAMAGED', 'Package Damaged'
        COURIER_DELAY = 'COURIER_DELAY', 'Courier Transportation Delay'
        PACKAGE_LOST = 'PACKAGE_LOST', 'Package Lost in Transit'
        OTHER = 'OTHER', 'Other Delivery Issue'

    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name='attempts'
    )
    delivery_personnel = models.ForeignKey(
        DeliveryPersonnel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delivery_attempts'
    )
    attempt_number = models.PositiveIntegerField(default=1)
    reason = models.CharField(max_length=50, choices=Reason.choices)
    notes = models.TextField(blank=True, default='')
    next_scheduled_attempt = models.DateField(null=True, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']

    def __str__(self):
        return f"Attempt #{self.attempt_number} on {self.shipment.tracking_number}: {self.get_reason_display()}"


class DeliveryComplaint(models.Model):
    class ComplaintType(models.TextChoices):
        NOT_RECEIVED = 'NOT_RECEIVED', 'Package marked delivered but not received'
        DAMAGED = 'DAMAGED', 'Package arrived damaged'
        MISSING_ITEMS = 'MISSING_ITEMS', 'Items missing from package'
        WRONG_PRODUCT = 'WRONG_PRODUCT', 'Received incorrect product'
        DELAYED = 'DELAYED', 'Severe delivery delay'
        UNPROFESSIONAL_COURIER = 'UNPROFESSIONAL_COURIER', 'Courier conduct issue'
        OTHER = 'OTHER', 'Other delivery issue'

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open (Awaiting Review)'
        UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', 'Under Investigation'
        RESOLVED = 'RESOLVED', 'Resolved'
        REJECTED = 'REJECTED', 'Rejected'

    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name='complaints'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='delivery_complaints'
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='delivery_complaints'
    )
    complaint_type = models.CharField(max_length=50, choices=ComplaintType.choices)
    description = models.TextField()
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.OPEN
    )
    investigated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='investigated_delivery_complaints'
    )
    resolution_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Complaint on {self.shipment.tracking_number} [{self.status}]: {self.complaint_type}"


class DeliveryFeeRule(models.Model):
    origin_city = models.CharField(max_length=100, default='Addis Ababa')
    destination_city = models.CharField(max_length=100)
    delivery_method = models.CharField(
        max_length=30,
        choices=[
            ('ALL', 'All Methods'),
            (DeliveryMethod.THIRD_PARTY_COURIER, 'Third-Party Courier'),
            (DeliveryMethod.OWN_DELIVERY, 'Own Delivery Service')
        ],
        default='ALL'
    )
    base_fee = models.DecimalField(max_digits=10, decimal_places=2, default=150.00)
    per_kg_fee = models.DecimalField(max_digits=10, decimal_places=2, default=30.00)
    estimated_days_min = models.PositiveIntegerField(default=1)
    estimated_days_max = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['destination_city', 'delivery_method']
        unique_together = ('origin_city', 'destination_city', 'delivery_method')

    def __str__(self):
        return f"{self.origin_city} -> {self.destination_city} ({self.delivery_method}): ETB {self.base_fee}"


class DeliverySetting(models.Model):
    default_delivery_method = models.CharField(
        max_length=30,
        choices=DeliveryMethod.choices,
        default=DeliveryMethod.THIRD_PARTY_COURIER
    )
    third_party_courier_enabled = models.BooleanField(default=True)
    own_delivery_enabled = models.BooleanField(default=True)
    otp_expiry_minutes = models.PositiveIntegerField(default=5)
    otp_max_attempts = models.PositiveIntegerField(default=3)
    otp_cooldown_seconds = models.PositiveIntegerField(default=60)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Delivery Settings (Default: {self.default_delivery_method})"

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class CourierSettlement(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SETTLED = 'SETTLED', 'Settled'
        DISPUTED = 'DISPUTED', 'Disputed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        TELEBIRR = 'TELEBIRR', 'Telebirr SuperApp / Merchant'
        CASH = 'CASH', 'Cash'
        CHEQUE = 'CHEQUE', 'Cheque'
        OTHER = 'OTHER', 'Other'

    courier = models.ForeignKey(DeliveryPersonnel, on_delete=models.CASCADE, related_name='settlements')
    shipment = models.ForeignKey(Shipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='courier_settlements')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='courier_settlements')
    customer_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    courier_amount_payable = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    amount_settled = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    outstanding_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    settlement_reference = models.CharField(max_length=100, unique=True, blank=True)
    settlement_status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=50, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    notes = models.TextField(blank=True, default='')
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settled_courier_records'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.settlement_reference:
            self.settlement_reference = f"SETTLE-{uuid.uuid4().hex[:8].upper()}"
        if self.courier_amount_payable and not self.outstanding_balance and self.amount_settled == 0:
            self.outstanding_balance = self.courier_amount_payable
        elif self.courier_amount_payable:
            self.outstanding_balance = max(0, self.courier_amount_payable - self.amount_settled)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.settlement_reference} - {self.courier.full_name} [{self.settlement_status}]"
