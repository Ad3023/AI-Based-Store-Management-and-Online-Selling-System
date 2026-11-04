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


class ShipmentAssignOrInitView(views.APIView):
    """
    Initializes a shipment for an Order, or updates Courier / Own Fleet assignment.
    """
    permission_classes = [CanManageShipments]

    @transaction.atomic
    def post(self, request, order_id):
        order = get_object_or_404(Order, pk=order_id)
        serializer = ShipmentAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        method = data.get('delivery_method', DeliveryMethod.THIRD_PARTY_COURIER)
        courier_id = data.get('courier_company_id')
        ext_tracking = data.get('external_tracking_number')
        vehicle_id = data.get('vehicle_id')
        personnel_id = data.get('delivery_personnel_id')
        notes = data.get('notes', '')

        # Get or create shipment for order
        shipment, created = Shipment.objects.get_or_create(
            order=order,
            defaults={
                'delivery_method': method,
                'origin_city': 'Addis Ababa',
                'destination_city': order.shipping_city or 'Addis Ababa',
                'recipient_name': order.shipping_name or order.customer.get_full_name(),
                'recipient_phone': order.shipping_phone or '',
                'delivery_address': order.shipping_address or '',
                'shipping_fee': order.shipping_fee or 0.00,
                'status': ShipmentStatus.CONFIRMED,
            }
        )

        shipment.delivery_method = method
        if method == DeliveryMethod.THIRD_PARTY_COURIER:
            if courier_id:
                courier = get_object_or_404(CourierCompany, pk=courier_id)
                shipment.courier_company = courier
            if ext_tracking:
                shipment.external_tracking_number = ext_tracking
            shipment.vehicle = None
            if personnel_id:
                shipment.delivery_personnel = get_object_or_404(DeliveryPersonnel, pk=personnel_id)
            new_status = ShipmentStatus.COURIER_ASSIGNED
        else:
            # Own delivery service
            if vehicle_id:
                vehicle = get_object_or_404(DeliveryVehicle, pk=vehicle_id)
                shipment.vehicle = vehicle
                vehicle.status = DeliveryVehicle.Status.IN_USE
                vehicle.save(update_fields=['status'])
            if personnel_id:
                personnel = get_object_or_404(DeliveryPersonnel, pk=personnel_id)
                shipment.delivery_personnel = personnel
            shipment.courier_company = None
            new_status = ShipmentStatus.READY_FOR_DISPATCH

        shipment.save()

        # Log transition event
        log_desc = notes or f"Assigned to {shipment.get_delivery_method_display()}."
        if shipment.courier_company:
            log_desc += f" Carrier: {shipment.courier_company.name}."
        if shipment.delivery_personnel:
            log_desc += f" Personnel: {shipment.delivery_personnel.full_name}."
        if shipment.vehicle:
            log_desc += f" Vehicle: {shipment.vehicle.registration_number}."

        ShipmentWorkflowService.advance_status(
            shipment=shipment,
            new_status=new_status,
            location=shipment.origin_city,
            description=log_desc,
            updated_by=request.user,
            force=True
        )

        return Response({
            'success': True,
            'message': f"Shipment configured successfully. Tracking: {shipment.tracking_number}",
            'shipment': ShipmentDetailSerializer(shipment).data
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

        data = ShipmentDetailSerializer(shipment).data
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

