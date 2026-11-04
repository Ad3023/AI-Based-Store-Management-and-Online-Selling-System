from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.utils import timezone
from django.db import transaction

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
from .serializers import (
    CourierCompanySerializer,
    DeliveryVehicleSerializer,
    DeliveryPersonnelSerializer,
    CourierSettlementSerializer,
    ShipmentListSerializer,
    ShipmentDetailSerializer,
    ShipmentAssignSerializer,
    DriverShipmentUpdateStatusSerializer,
    ShipmentStatusUpdateSerializer,
    DeliveryAttemptCreateSerializer,
    DeliveryAttemptSerializer,
    DeliveryComplaintSerializer,
    DeliveryFeeRuleSerializer,
    DeliverySettingSerializer,
    DeliveryOTPVerifySerializer,
    CalculateFeeRequestSerializer,
    CourierBookingRequestSerializer,
    CourierBookingConfirmSerializer,
    DriverPickupScheduleSerializer,
    PackageHandoverConfirmSerializer,
)
from .permissions import (
    CanManageLogisticsAdmin,
    CanManageShipments,
    CanPrepareAndDispatch,
    CanVerifyHandover,
    IsDriverUser,
)
from .services import (
    DeliveryFeeService,
    ShipmentWorkflowService,
    DeliveryOTPService,
)
from orders.models import Order


# ==============================================================================
# COURIER COMPANY MANAGEMENT (ADMIN)
# ==============================================================================

class CourierCompanyListCreateView(generics.ListCreateAPIView):
    queryset = CourierCompany.objects.annotate(
        assigned_shipments_count=Count('shipments'),
        delivered_shipments_count=Count('shipments', filter=Q(shipments__status=ShipmentStatus.DELIVERED))
    ).order_by('name')
    serializer_class = CourierCompanySerializer
    permission_classes = [CanManageLogisticsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() in ['true', '1']:
            qs = qs.filter(is_active=True)
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(supported_destination_cities__contains=[city])
        return qs


class CourierCompanyDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CourierCompany.objects.annotate(
        assigned_shipments_count=Count('shipments'),
        delivered_shipments_count=Count('shipments', filter=Q(shipments__status=ShipmentStatus.DELIVERED))
    )
    serializer_class = CourierCompanySerializer
    permission_classes = [CanManageLogisticsAdmin]


class CourierCompanyPerformanceView(views.APIView):
    permission_classes = [CanManageLogisticsAdmin]

    def get(self, request, pk):
        company = get_object_or_404(CourierCompany, pk=pk)
        shipments = company.shipments.all()
        total = shipments.count()
        delivered = shipments.filter(status=ShipmentStatus.DELIVERED).count()
        in_transit = shipments.filter(status__in=[
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
            ShipmentStatus.ARRIVED_AT_DESTINATION,
            ShipmentStatus.OUT_FOR_DELIVERY
        ]).count()
        failed_or_delayed = shipments.filter(status__in=[
            ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
            ShipmentStatus.DELAYED,
            ShipmentStatus.DELIVERY_DISPUTED
        ]).count()

        success_rate = (delivered / total * 100) if total > 0 else 100.0

        return Response({
            'company_id': company.id,
            'company_name': company.name,
            'company_code': company.code,
            'total_shipments': total,
            'delivered_shipments': delivered,
            'in_transit_shipments': in_transit,
            'delayed_or_failed_shipments': failed_or_delayed,
            'delivery_success_rate_percent': round(success_rate, 1),
            'supported_cities': company.supported_destination_cities,
        })


# ==============================================================================
# DELIVERY VEHICLE MANAGEMENT (ADMIN)
# ==============================================================================

class DeliveryVehicleListCreateView(generics.ListCreateAPIView):
    queryset = DeliveryVehicle.objects.all().order_by('registration_number')
    serializer_class = DeliveryVehicleSerializer
    permission_classes = [CanManageLogisticsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        v_type = self.request.query_params.get('type')
        if v_type:
            qs = qs.filter(vehicle_type=v_type)
        v_status = self.request.query_params.get('status')
        if v_status:
            qs = qs.filter(status=v_status)
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(current_city__iexact=city)
        return qs


class DeliveryVehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DeliveryVehicle.objects.all()
    serializer_class = DeliveryVehicleSerializer
    permission_classes = [CanManageLogisticsAdmin]


# ==============================================================================
# DELIVERY PERSONNEL MANAGEMENT (ADMIN & ORDER MANAGER)
# ==============================================================================

class DeliveryPersonnelListCreateView(generics.ListCreateAPIView):
    queryset = DeliveryPersonnel.objects.all().order_by('full_name')
    serializer_class = DeliveryPersonnelSerializer
    permission_classes = [CanManageShipments]

    def get_queryset(self):
        qs = super().get_queryset()
        method = self.request.query_params.get('method')
        if method:
            qs = qs.filter(delivery_method=method)
        available = self.request.query_params.get('available')
        if available is not None:
            qs = qs.filter(is_available=(available.lower() in ['true', '1']))
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(current_city__iexact=city)
        return qs


class DeliveryPersonnelDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DeliveryPersonnel.objects.all()
    serializer_class = DeliveryPersonnelSerializer
    permission_classes = [CanManageShipments]


# ==============================================================================
# DELIVERY FEE RULES & CALCULATION
# ==============================================================================

class DeliveryFeeRuleListCreateView(generics.ListCreateAPIView):
    queryset = DeliveryFeeRule.objects.all().order_by('destination_city')
    serializer_class = DeliveryFeeRuleSerializer
    permission_classes = [CanManageLogisticsAdmin]


class DeliveryFeeRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DeliveryFeeRule.objects.all()
    serializer_class = DeliveryFeeRuleSerializer
    permission_classes = [CanManageLogisticsAdmin]


class CalculateDeliveryFeeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CalculateFeeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        fee_result = DeliveryFeeService.calculate_shipping_fee(
            destination_city=data['destination_city'],
            delivery_method=data['delivery_method'],
            weight_kg=float(data.get('weight_kg', 1.0)),
            origin_city=data.get('origin_city', 'Addis Ababa')
        )
        return Response(fee_result, status=status.HTTP_200_OK)


class DeliverySettingView(views.APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [CanManageLogisticsAdmin()]

    def get(self, request):
        settings_obj = DeliverySetting.get_settings()
        serializer = DeliverySettingSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = DeliverySetting.get_settings()
        serializer = DeliverySettingSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ==============================================================================
# STORE MANAGER DISPATCH VIEW
# ==============================================================================

class StoreManagerDispatchOrderListView(generics.ListAPIView):
    serializer_class = ShipmentListSerializer
    permission_classes = [CanPrepareAndDispatch]

    def get_queryset(self):
        # Shipments ready for warehouse handling, packing, or driver handover
        return Shipment.objects.filter(
            status__in=[
                ShipmentStatus.CONFIRMED,
                ShipmentStatus.PROCESSING,
                ShipmentStatus.READY_FOR_DISPATCH,
                ShipmentStatus.BOOKING_REQUESTED,
                ShipmentStatus.BOOKING_CONFIRMED,
                ShipmentStatus.PICKUP_SCHEDULED,
                ShipmentStatus.COURIER_ASSIGNED,
            ]
        ).select_related('order', 'courier_company', 'vehicle', 'delivery_personnel').order_by('-created_at')


class StoreManagerMarkReadyForDispatchView(views.APIView):
    permission_classes = [CanPrepareAndDispatch]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        location = request.data.get('location', shipment.origin_city)
        notes = request.data.get('notes', 'Items inspected, packed and labeled for dispatch.')

        try:
            ShipmentWorkflowService.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.READY_FOR_DISPATCH,
                location=location,
                description=notes,
                updated_by=request.user
            )
            return Response({
                'success': True,
                'message': f"Shipment {shipment.tracking_number} is now READY_FOR_DISPATCH.",
                'shipment': ShipmentDetailSerializer(shipment).data
            })
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SHIPMENT MANAGEMENT (ORDER MANAGER & ADMIN)
# ==============================================================================

class ShipmentListView(generics.ListAPIView):
    serializer_class = ShipmentListSerializer
    permission_classes = [CanManageShipments]

    def get_queryset(self):
        qs = Shipment.objects.select_related(
            'order', 'order__customer', 'courier_company', 'vehicle', 'delivery_personnel'
        ).all().order_by('-created_at')

        q = self.request.query_params.get('search')
        if q:
            qs = qs.filter(
                Q(tracking_number__icontains=q) |
                Q(order__order_number__icontains=q) |
                Q(recipient_name__icontains=q) |
                Q(recipient_phone__icontains=q) |
                Q(destination_city__icontains=q)
            )

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        method_param = self.request.query_params.get('delivery_method')
        if method_param:
            qs = qs.filter(delivery_method=method_param)

        city_param = self.request.query_params.get('city')
        if city_param:
            qs = qs.filter(destination_city__iexact=city_param)

        return qs


class ShipmentDetailView(generics.RetrieveAPIView):
    queryset = Shipment.objects.select_related(
        'order', 'order__customer', 'courier_company', 'vehicle', 'delivery_personnel'
    ).prefetch_related('events', 'attempts', 'complaints')
    serializer_class = ShipmentDetailSerializer
    permission_classes = [CanManageShipments]


class EligibleOrdersForDeliveryView(views.APIView):
    """
    Returns existing orders eligible for delivery assignment.
    Accessible by Store Manager and Admin.
    """
    permission_classes = [CanManageShipments]

    def get(self, request):
        q = request.query_params.get('search', '').strip()
        qs = Order.objects.exclude(
            status__in=[Order.Status.CANCELLED, Order.Status.REJECTED]
        ).exclude(
            fulfillment_status__in=[Order.FulfillmentStatus.CANCELLED, Order.FulfillmentStatus.REJECTED]
        ).select_related('customer', 'shipment', 'shipment__delivery_personnel', 'shipment__courier_company').order_by('-created_at')

        if q:
            qs = qs.filter(
                Q(order_number__icontains=q) |
                Q(shipping_name__icontains=q) |
                Q(shipping_phone__icontains=q) |
                Q(shipping_city__icontains=q) |
                Q(customer__username__icontains=q) |
                Q(customer__email__icontains=q)
            )

        unassigned_only = request.query_params.get('unassigned_only')
        if unassigned_only and unassigned_only.lower() in ['true', '1']:
            qs = qs.filter(
                Q(shipment__isnull=True) |
                Q(shipment__status__in=[ShipmentStatus.PENDING, ShipmentStatus.PENDING_ASSIGNMENT, ShipmentStatus.PREPARED, ShipmentStatus.CONFIRMED, ShipmentStatus.PROCESSING])
            )

        results = []
        for o in qs[:50]:
            shipment = getattr(o, 'shipment', None)
            assigned_to = None
            if shipment:
                if shipment.delivery_personnel:
                    assigned_to = f"Driver: {shipment.delivery_personnel.full_name}"
                elif shipment.courier_company:
                    assigned_to = f"Courier: {shipment.courier_company.name}"

            results.append({
                'id': o.id,
                'order_number': o.order_number,
                'customer_name': o.shipping_name or (o.customer.get_full_name() or o.customer.username),
                'customer_phone': o.shipping_phone or getattr(o.customer, 'phone_number', ''),
                'customer_email': o.customer.email,
                'shipping_address': o.shipping_address or '',
                'shipping_city': o.shipping_city or 'Addis Ababa',
                'total_amount': float(o.total_amount),
                'payment_status': o.payment_status,
                'fulfillment_status': o.fulfillment_status,
                'status': o.status,
                'created_at': o.created_at.isoformat(),
                'has_shipment': bool(shipment),
                'shipment_id': shipment.id if shipment else None,
                'tracking_number': shipment.tracking_number if shipment else None,
                'shipment_status': shipment.status if shipment else None,
                'shipment_status_display': shipment.get_status_display() if shipment else 'Unassigned',
                'assigned_to': assigned_to,
                'estimated_delivery_date': shipment.estimated_delivery_date.isoformat() if shipment and shipment.estimated_delivery_date else None,
            })

        return Response(results, status=status.HTTP_200_OK)


class ShipmentAssignOrInitView(views.APIView):
    """
    Assigns a delivery person or courier company to an order.
    Validates order eligibility (prevents assigning CANCELLED, REJECTED, or already DELIVERED orders).
    Updates delivery address and expected delivery date.
    """
    permission_classes = [CanManageShipments]

    @transaction.atomic
    def post(self, request, order_id):
        order = get_object_or_404(Order, pk=order_id)

        # Validate order eligibility
        if order.status in [Order.Status.CANCELLED, Order.Status.REJECTED]:
            return Response(
                {'error': f"Order {order.order_number} is {order.get_status_display()} and cannot be assigned for delivery."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if order.fulfillment_status in [Order.FulfillmentStatus.DELIVERED]:
            return Response(
                {'error': f"Order {order.order_number} is already marked as DELIVERED and cannot be reassigned."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ShipmentAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        method = data.get('delivery_method', DeliveryMethod.THIRD_PARTY_COURIER)
        courier_id = data.get('courier_company_id')
        ext_tracking = data.get('external_tracking_number')
        vehicle_id = data.get('vehicle_id')
        personnel_id = data.get('delivery_personnel_id')
        delivery_address = data.get('delivery_address') or order.shipping_address or ''
        expected_date = data.get('expected_delivery_date')
        notes = data.get('notes', '')

        shipment, created = Shipment.objects.get_or_create(
            order=order,
            defaults={
                'delivery_method': method,
                'origin_city': 'Addis Ababa',
                'destination_city': order.shipping_city or 'Addis Ababa',
                'recipient_name': order.shipping_name or order.customer.get_full_name() or order.customer.username,
                'recipient_phone': order.shipping_phone or '',
                'delivery_address': delivery_address,
                'shipping_fee': order.shipping_fee or 0.00,
                'status': ShipmentStatus.ASSIGNED,
                'estimated_delivery_date': expected_date,
            }
        )

        shipment.delivery_method = method
        if delivery_address:
            shipment.delivery_address = delivery_address
        if expected_date:
            shipment.estimated_delivery_date = expected_date

        if not shipment.delivery_confirmation_code:
            import secrets
            shipment.delivery_confirmation_code = f"{secrets.randbelow(900000) + 100000}"

        if method == DeliveryMethod.THIRD_PARTY_COURIER:
            if courier_id:
                courier = get_object_or_404(CourierCompany, pk=courier_id)
                shipment.courier_company = courier
            if ext_tracking:
                shipment.external_tracking_number = ext_tracking
            shipment.vehicle = None
            if personnel_id:
                shipment.delivery_personnel = get_object_or_404(DeliveryPersonnel, pk=personnel_id)
            new_status = ShipmentStatus.ASSIGNED
        else:
            if vehicle_id:
                vehicle = get_object_or_404(DeliveryVehicle, pk=vehicle_id)
                shipment.vehicle = vehicle
                vehicle.status = DeliveryVehicle.Status.IN_USE
                vehicle.save(update_fields=['status'])
            if personnel_id:
                personnel = get_object_or_404(DeliveryPersonnel, pk=personnel_id)
                shipment.delivery_personnel = personnel
            shipment.courier_company = None
            new_status = ShipmentStatus.ASSIGNED

        shipment.save()

        log_desc = notes or f"Assigned for delivery."
        if shipment.delivery_personnel:
            log_desc += f" Delivery Person: {shipment.delivery_personnel.full_name} ({shipment.delivery_personnel.phone_number})."
        if shipment.courier_company:
            log_desc += f" Courier: {shipment.courier_company.name}."
        if shipment.estimated_delivery_date:
            log_desc += f" Expected Delivery: {shipment.estimated_delivery_date}."

        ShipmentWorkflowService.advance_status(
            shipment=shipment,
            new_status=new_status,
            location=shipment.origin_city,
            description=log_desc,
            delivery_note=notes,
            updated_by=request.user,
            force=True
        )

        return Response({
            'success': True,
            'message': f"Order {order.order_number} assigned for delivery. Tracking: {shipment.tracking_number}",
            'shipment': ShipmentDetailSerializer(shipment, context={'request': request}).data
        })


class ShipmentStatusUpdateView(views.APIView):
    permission_classes = [CanManageShipments]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = ShipmentStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        target_status = data['status']
        location = data.get('location') or shipment.destination_city
        description = data.get('description') or f"Status updated to {target_status}."

        if target_status == ShipmentStatus.DELIVERED:
            return Response(
                {'error': "Direct update to DELIVERED is forbidden. Delivery can only be completed via Customer OTP verification."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ShipmentWorkflowService.advance_status(
                shipment=shipment,
                new_status=target_status,
                location=location,
                description=description,
                updated_by=request.user
            )
            return Response({
                'success': True,
                'message': f"Shipment {shipment.tracking_number} moved to {target_status}.",
                'shipment': ShipmentDetailSerializer(shipment).data
            })
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class ShipmentAssignLocalDeliveryView(views.APIView):
    """
    Assigns a local delivery person to a shipment (e.g. upon reaching destination city).
    """
    permission_classes = [CanManageShipments]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        personnel_id = request.data.get('delivery_personnel_id')
        notes = request.data.get('notes', '')

        if not personnel_id:
            return Response({'error': "delivery_personnel_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        personnel = get_object_or_404(DeliveryPersonnel, pk=personnel_id)
        ShipmentWorkflowService.assign_local_delivery(
            shipment=shipment,
            personnel=personnel,
            notes=notes,
            user=request.user
        )

        return Response({
            'success': True,
            'message': f"Local delivery assigned to {personnel.full_name}.",
            'shipment': ShipmentDetailSerializer(shipment).data
        })


class ShipmentBookCourierView(views.APIView):
    """
    Stage 3: Order Manager selects a courier and creates a booking request.
    Dispatches official courier booking email and sets status to BOOKING_REQUESTED.
    """
    permission_classes = [CanManageShipments]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = CourierBookingRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        courier = get_object_or_404(CourierCompany, pk=data['courier_company_id'])
        try:
            ShipmentWorkflowService.book_courier(
                shipment=shipment,
                courier_company=courier,
                requested_by=request.user,
                pickup_date=data.get('pickup_date'),
                package_dimensions=data.get('package_dimensions'),
                package_weight=data.get('package_weight_kg'),
                notes=data.get('notes', '')
            )
            return Response({
                'success': True,
                'message': f"Booking request sent to {courier.name}. Booking Ref: {shipment.booking_reference}",
                'shipment': ShipmentDetailSerializer(shipment).data
            }, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class ShipmentConfirmBookingView(views.APIView):
    """
    Stage 4: Record the courier's actual confirmation or rejection.
    """
    permission_classes = [CanManageShipments]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = CourierBookingConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            ShipmentWorkflowService.confirm_booking(
                shipment=shipment,
                confirmed=data['confirmed'],
                confirmed_by=request.user,
                external_tracking_number=data.get('external_tracking_number', ''),
                pickup_time_window=data.get('pickup_time_window', ''),
                rejection_reason=data.get('rejection_reason', ''),
                courier_notes=data.get('courier_notes', '')
            )
            msg = "Courier booking confirmed." if data['confirmed'] else "Courier booking rejection recorded."
            return Response({
                'success': True,
                'message': msg,
                'shipment': ShipmentDetailSerializer(shipment).data
            }, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class ShipmentSchedulePickupView(views.APIView):
    """
    Stage 5: Driver pickup - Record the assigned driver and scheduled pickup.
    """
    permission_classes = [CanManageShipments]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = DriverPickupScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            ShipmentWorkflowService.schedule_pickup(
                shipment=shipment,
                driver_name=data['driver_name'],
                driver_phone=data['driver_phone'],
                vehicle_plate=data.get('vehicle_plate', ''),
                scheduled_at=data.get('scheduled_at'),
                updated_by=request.user,
                notes=data.get('notes', '')
            )
            return Response({
                'success': True,
                'message': f"Pickup scheduled with driver {data['driver_name']}.",
                'shipment': ShipmentDetailSerializer(shipment).data
            }, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class ShipmentConfirmHandoverView(views.APIView):
    """
    Stage 6: Package handover - Store Manager confirms physical handover.
    """
    permission_classes = [CanPrepareAndDispatch]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = PackageHandoverConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            ShipmentWorkflowService.confirm_handover(
                shipment=shipment,
                confirmed_by=request.user,
                notes=data.get('notes', ''),
                location=data.get('location', shipment.origin_city)
            )
            return Response({
                'success': True,
                'message': f"Store Manager confirmed physical package handover for {shipment.tracking_number}.",
                'shipment': ShipmentDetailSerializer(shipment).data
            }, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# DELIVERY OTP GENERATION & VERIFICATION
# ==============================================================================

class DeliveryOTPRequestView(views.APIView):
    permission_classes = [CanVerifyHandover]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        try:
            result = DeliveryOTPService.request_delivery_otp(
                shipment=shipment,
                requested_by=request.user
            )
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class DeliveryOTPVerifyView(views.APIView):
    permission_classes = [CanVerifyHandover]

    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = DeliveryOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_otp = serializer.validated_data['otp']

        try:
            result = DeliveryOTPService.verify_delivery_otp(
                shipment=shipment,
                raw_otp=raw_otp,
                verified_by_user=request.user
            )
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# FAILED DELIVERY ATTEMPT LOGGING
# ==============================================================================

class DeliveryAttemptCreateView(views.APIView):
    permission_classes = [CanVerifyHandover]

    @transaction.atomic
    def post(self, request, shipment_id):
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        serializer = DeliveryAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        personnel = shipment.delivery_personnel
        attempt_count = shipment.attempts.count() + 1

        attempt = DeliveryAttempt.objects.create(
            shipment=shipment,
            delivery_personnel=personnel,
            attempt_number=attempt_count,
            reason=data['reason'],
            notes=data.get('notes', ''),
            next_scheduled_attempt=data.get('next_scheduled_attempt')
        )

        # Transition status to DELIVERY_ATTEMPT_FAILED
        ShipmentWorkflowService.advance_status(
            shipment=shipment,
            new_status=ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
            location=shipment.destination_city,
            description=f"Attempt #{attempt_count} failed: {attempt.get_reason_display()}. {attempt.notes}",
            updated_by=request.user,
            force=True
        )

        return Response({
            'success': True,
            'message': f"Delivery attempt #{attempt_count} logged.",
            'attempt': DeliveryAttemptSerializer(attempt).data,
            'shipment': ShipmentDetailSerializer(shipment).data
        }, status=status.HTTP_201_CREATED)


# ==============================================================================
# CUSTOMER COMPLAINTS & DISPUTES MANAGEMENT
# ==============================================================================

class DeliveryComplaintListCreateView(generics.ListCreateAPIView):
    serializer_class = DeliveryComplaintSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [CanManageShipments()]

    def get_queryset(self):
        user = self.request.user
        if (
            getattr(user, 'is_super_admin', False) or
            getattr(user, 'is_admin', lambda: False)() or
            getattr(user, 'is_order_manager', lambda: False)()
        ):
            return DeliveryComplaint.objects.select_related('shipment', 'customer', 'order').all().order_by('-created_at')
        return DeliveryComplaint.objects.filter(customer=user).select_related('shipment', 'customer', 'order').order_by('-created_at')

    def perform_create(self, serializer):
        shipment_id = self.request.data.get('shipment') or self.request.data.get('shipment_id')
        if not shipment_id:
            raise serializers.ValidationError({'shipment': 'Shipment ID is required.'})
        shipment = get_object_or_404(Shipment, pk=shipment_id)
        complaint = serializer.save(
            customer=self.request.user,
            shipment=shipment,
            order=shipment.order
        )
        # Update shipment status to DELIVERY_DISPUTED if already delivered
        if shipment.status == ShipmentStatus.DELIVERED:
            ShipmentWorkflowService.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.DELIVERY_DISPUTED,
                location=shipment.destination_city,
                description=f"Customer dispute opened: {complaint.get_complaint_type_display()}",
                updated_by=self.request.user,
                force=True
            )


class DeliveryComplaintDetailView(generics.RetrieveUpdateAPIView):
    queryset = DeliveryComplaint.objects.all()
    serializer_class = DeliveryComplaintSerializer
    permission_classes = [CanManageShipments]

    def perform_update(self, serializer):
        status_val = self.request.data.get('status')
        resolution_notes = self.request.data.get('resolution_notes')
        update_kwargs = {}
        if status_val:
            update_kwargs['status'] = status_val
            if status_val in [DeliveryComplaint.Status.RESOLVED, DeliveryComplaint.Status.REJECTED]:
                update_kwargs['resolved_at'] = timezone.now()
                update_kwargs['investigated_by'] = self.request.user
        if resolution_notes is not None:
            update_kwargs['resolution_notes'] = resolution_notes
        serializer.save(**update_kwargs)


# ==============================================================================
# PUBLIC & CUSTOMER TRACKING LOOKUP
# ==============================================================================

class PublicTrackShipmentView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_number=None):
        tn = tracking_number or request.query_params.get('tracking_number')
        if not tn:
            return Response({'error': "Tracking number is required."}, status=status.HTTP_400_BAD_REQUEST)

        shipment = Shipment.objects.filter(
            Q(tracking_number__iexact=tn.strip()) | Q(order__order_number__iexact=tn.strip())
        ).select_related('order', 'courier_company', 'vehicle', 'delivery_personnel').first()

        if not shipment:
            return Response(
                {'error': f"No shipment found matching tracking number or order ID '{tn}'."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Security: Authenticated customers can only view their own shipments
        if request.user.is_authenticated:
            is_staff = bool(
                getattr(request.user, 'is_super_admin', False) or
                getattr(request.user, 'is_admin', lambda: False)() or
                getattr(request.user, 'is_store_manager', lambda: False)() or
                getattr(request.user, 'is_order_manager', lambda: False)() or
                hasattr(request.user, 'delivery_profile')
            )
            if not is_staff and shipment.order.customer_id != request.user.id:
                return Response(
                    {'error': "Access denied. You can only track your own orders."},
                    status=status.HTTP_403_FORBIDDEN
                )

        data = ShipmentDetailSerializer(shipment, context={'request': request}).data

        # If unauthenticated, mask sensitive customer phone
        if not request.user.is_authenticated and data.get('recipient_phone'):
            phone = data['recipient_phone']
            if len(phone) > 6:
                data['recipient_phone'] = phone[:4] + '***' + phone[-2:]

        return Response(data, status=status.HTTP_200_OK)


class CustomerMyShipmentsView(generics.ListAPIView):
    serializer_class = ShipmentListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Shipment.objects.filter(order__customer=self.request.user).select_related(
            'order', 'courier_company', 'vehicle', 'delivery_personnel'
        ).order_by('-created_at')


# ==============================================================================
# COURIER SETTLEMENTS (ADMIN & ORDER MANAGER)
# ==============================================================================

class CourierSettlementListCreateView(generics.ListCreateAPIView):
    queryset = CourierSettlement.objects.all().select_related('courier', 'shipment', 'order', 'settled_by')
    serializer_class = CourierSettlementSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [CanManageLogisticsAdmin()]
        return [CanManageShipments()]

    def get_queryset(self):
        qs = super().get_queryset()
        courier_id = self.request.query_params.get('courier_id')
        if courier_id:
            qs = qs.filter(courier_id=courier_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(settlement_status=status_param)
        return qs

    def perform_create(self, serializer):
        settled_at = timezone.now() if serializer.validated_data.get('settlement_status') == CourierSettlement.Status.SETTLED else None
        serializer.save(settled_by=self.request.user, settled_at=settled_at)


class CourierSettlementDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CourierSettlement.objects.all()
    serializer_class = CourierSettlementSerializer
    permission_classes = [CanManageLogisticsAdmin]

    def perform_update(self, serializer):
        update_kwargs = {}
        if serializer.validated_data.get('settlement_status') == CourierSettlement.Status.SETTLED:
            update_kwargs['settled_at'] = timezone.now()
            update_kwargs['settled_by'] = self.request.user
        serializer.save(**update_kwargs)



class LiveShipmentsStatsView(views.APIView):
    """
    Aggregate statistics for the Live Shipments Dashboard.
    Accessible by Admin and Store Manager.
    """
    permission_classes = [CanManageShipments]

    def get(self, request):
        total_active = Shipment.objects.filter(
            status__in=[
                ShipmentStatus.PREPARED,
                ShipmentStatus.READY_FOR_DISPATCH,
                ShipmentStatus.ASSIGNED,
                ShipmentStatus.COURIER_ASSIGNED,
                ShipmentStatus.PICKUP_SCHEDULED,
                ShipmentStatus.PICKED_UP,
                ShipmentStatus.IN_TRANSIT,
                ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
                ShipmentStatus.ARRIVED_AT_DESTINATION,
                ShipmentStatus.OUT_FOR_DELIVERY,
                ShipmentStatus.FAILED,
                ShipmentStatus.FAILED_DELIVERY,
                ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
                ShipmentStatus.DELAYED,
            ]
        ).count()

        prepared = Shipment.objects.filter(
            status__in=[ShipmentStatus.PREPARED, ShipmentStatus.READY_FOR_DISPATCH, ShipmentStatus.PROCESSING]
        ).count()

        assigned = Shipment.objects.filter(
            status__in=[ShipmentStatus.ASSIGNED, ShipmentStatus.COURIER_ASSIGNED]
        ).count()

        picked_up = Shipment.objects.filter(
            status__in=[ShipmentStatus.PICKED_UP, ShipmentStatus.PICKUP_SCHEDULED]
        ).count()

        in_transit = Shipment.objects.filter(
            status__in=[
                ShipmentStatus.IN_TRANSIT,
                ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
                ShipmentStatus.ARRIVED_AT_DESTINATION,
                ShipmentStatus.OUT_FOR_DELIVERY
            ]
        ).count()

        delivered = Shipment.objects.filter(status=ShipmentStatus.DELIVERED).count()

        failed = Shipment.objects.filter(
            status__in=[
                ShipmentStatus.FAILED,
                ShipmentStatus.FAILED_DELIVERY,
                ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
                ShipmentStatus.DELAYED
            ]
        ).count()

        return Response({
            'total_active': total_active,
            'prepared': prepared,
            'assigned': assigned,
            'picked_up': picked_up,
            'in_transit': in_transit,
            'delivered': delivered,
            'failed': failed,
            'timestamp': timezone.now().isoformat(),
        })


class DriverShipmentListView(generics.ListAPIView):
    """
    Returns only shipments assigned to the currently authenticated driver.
    """
    permission_classes = [IsDriverUser]
    serializer_class = ShipmentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        personnel = getattr(user, 'delivery_profile', None)
        if not personnel:
            personnel = DeliveryPersonnel.objects.filter(Q(user=user) | Q(email=user.email)).first()

        if not personnel:
            return Shipment.objects.none()

        qs = Shipment.objects.filter(delivery_personnel=personnel).select_related(
            'order', 'order__customer', 'vehicle', 'courier_company'
        ).prefetch_related('events', 'attempts').order_by('-created_at')

        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            qs = qs.exclude(status__in=[ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])
        elif status_filter == 'in_transit':
            qs = qs.filter(status__in=[ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY])
        elif status_filter == 'delivered':
            qs = qs.filter(status=ShipmentStatus.DELIVERED)
        elif status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)

        return qs


class DriverShipmentDetailView(generics.RetrieveAPIView):
    """
    Retrieves detail for a single shipment assigned to the driver.
    """
    permission_classes = [IsDriverUser]
    serializer_class = ShipmentDetailSerializer
    lookup_url_kwarg = 'shipment_id'

    def get_object(self):
        user = self.request.user
        personnel = getattr(user, 'delivery_profile', None)
        if not personnel:
            personnel = DeliveryPersonnel.objects.filter(Q(user=user) | Q(email=user.email)).first()

        shipment = get_object_or_404(Shipment, pk=self.kwargs['shipment_id'])
        if not personnel or shipment.delivery_personnel_id != personnel.id:
            raise permissions.PermissionDenied("Access denied. You can only view deliveries assigned to you.")
        return shipment


class DriverShipmentStatusUpdateView(views.APIView):
    """
    Allows the assigned driver to advance delivery status:
    - PICKED_UP
    - IN_TRANSIT
    - DELIVERED (requires confirmation code from customer)
    - FAILED (requires failure reason/note)
    """
    permission_classes = [IsDriverUser]

    @transaction.atomic
    def post(self, request, shipment_id):
        user = request.user
        personnel = getattr(user, 'delivery_profile', None)
        if not personnel:
            personnel = DeliveryPersonnel.objects.filter(Q(user=user) | Q(email=user.email)).first()

        shipment = get_object_or_404(Shipment, pk=shipment_id)
        if not personnel or shipment.delivery_personnel_id != personnel.id:
            return Response(
                {'error': "Access denied. You can only update deliveries assigned to you."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = DriverShipmentUpdateStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_status = serializer.validated_data['status']
        delivery_note = serializer.validated_data.get('delivery_note', '').strip()
        confirmation_code = serializer.validated_data.get('confirmation_code', '').strip()
        location = serializer.validated_data.get('location', '').strip() or shipment.destination_city

        # Validate DELIVERED requires confirmation code
        if target_status == ShipmentStatus.DELIVERED:
            if not confirmation_code:
                return Response(
                    {'error': "Delivery confirmation code is required to mark an order as DELIVERED. Please ask the customer for their 6-digit confirmation code."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            valid_code = (
                shipment.delivery_confirmation_code and
                str(shipment.delivery_confirmation_code).strip() == confirmation_code
            )

            if not valid_code:
                active_otp = shipment.otps.filter(is_used=False).order_by('-created_at').first()
                if active_otp and not active_otp.is_expired and active_otp.check_otp(confirmation_code):
                    valid_code = True
                    active_otp.is_used = True
                    active_otp.used_at = timezone.now()
                    active_otp.save(update_fields=['is_used', 'used_at'])

            if not valid_code:
                return Response(
                    {'error': "Invalid delivery confirmation code. The code provided does not match the customer's order confirmation code."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if target_status == ShipmentStatus.FAILED and not delivery_note:
            return Response(
                {'error': "Please provide a reason or note explaining why the delivery could not be completed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ShipmentWorkflowService.advance_status(
                shipment=shipment,
                new_status=target_status,
                location=location,
                description=delivery_note or f"Driver updated status to {target_status}.",
                delivery_note=delivery_note,
                updated_by=user
            )

            if target_status == ShipmentStatus.FAILED:
                DeliveryAttempt.objects.create(
                    shipment=shipment,
                    delivery_personnel=personnel,
                    attempt_number=shipment.attempts.count() + 1,
                    reason=DeliveryAttempt.Reason.OTHER,
                    notes=delivery_note
                )

            return Response({
                'success': True,
                'message': f"Shipment status successfully updated to {target_status}.",
                'shipment': ShipmentDetailSerializer(shipment, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        except ValueError as err:
            return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


class DriverProfileView(views.APIView):
    """
    Driver profile inspection and availability toggle.
    """
    permission_classes = [IsDriverUser]

    def get(self, request):
        user = request.user
        personnel = getattr(user, 'delivery_profile', None)
        if not personnel:
            personnel = DeliveryPersonnel.objects.filter(Q(user=user) | Q(email=user.email)).first()
        if not personnel:
            return Response({'error': 'No delivery profile linked to this account.'}, status=status.HTTP_404_NOT_FOUND)

        active_deliveries = Shipment.objects.filter(
            delivery_personnel=personnel,
            status__in=[ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY]
        ).count()

        completed_deliveries = Shipment.objects.filter(
            delivery_personnel=personnel,
            status=ShipmentStatus.DELIVERED
        ).count()

        return Response({
            'id': personnel.id,
            'full_name': personnel.full_name,
            'phone_number': personnel.phone_number,
            'vehicle_type': personnel.vehicle_type,
            'vehicle_registration_number': personnel.vehicle_registration_number,
            'delivery_area': personnel.delivery_area,
            'current_city': personnel.current_city,
            'is_available': personnel.is_available,
            'is_active': personnel.is_active,
            'status': personnel.status,
            'active_deliveries_count': active_deliveries,
            'completed_deliveries_count': completed_deliveries,
        })

    def patch(self, request):
        user = request.user
        personnel = getattr(user, 'delivery_profile', None)
        if not personnel:
            personnel = DeliveryPersonnel.objects.filter(Q(user=user) | Q(email=user.email)).first()
        if not personnel:
            return Response({'error': 'No delivery profile found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_available' in request.data:
            personnel.is_available = bool(request.data['is_available'])
            personnel.save(update_fields=['is_available'])

        return Response({
            'success': True,
            'is_available': personnel.is_available
        })
