import secrets
import logging
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from django.db import transaction

from .models import (
    Shipment,
    ShipmentStatus,
    ShipmentTrackingEvent,
    DeliveryOTP,
    DeliveryFeeRule,
    DeliverySetting,
    DeliveryMethod,
    DeliveryPersonnel,
)
from notifications.models import create_order_notification, Notification
from accounts.email_service import _send_mail_async, get_base_email_template

logger = logging.getLogger(__name__)


class DeliveryFeeService:
    @staticmethod
    def calculate_shipping_fee(destination_city: str, delivery_method: str = 'THIRD_PARTY_COURIER', weight_kg: float = 1.0, origin_city: str = 'Addis Ababa') -> dict:
        """
        Calculates delivery fee based on destination city, method, and weight.
        Uses DeliveryFeeRule database configurations.
        """
        weight = Decimal(str(max(0.1, float(weight_kg))))
        dest = destination_city.strip() if destination_city else 'Addis Ababa'
        orig = origin_city.strip() if origin_city else 'Addis Ababa'

        # Look for exact rule: origin -> destination -> method
        rule = DeliveryFeeRule.objects.filter(
            origin_city__iexact=orig,
            destination_city__iexact=dest,
            delivery_method=delivery_method,
            is_active=True
        ).first()

        # If no specific method rule, check 'ALL' methods rule
        if not rule:
            rule = DeliveryFeeRule.objects.filter(
                origin_city__iexact=orig,
                destination_city__iexact=dest,
                delivery_method='ALL',
                is_active=True
            ).first()

        if rule:
            base_fee = rule.base_fee
            per_kg = rule.per_kg_fee
            est_min = rule.estimated_days_min
            est_max = rule.estimated_days_max
        else:
            # Fallback default heuristics for Ethiopian regional shipping
            is_intra_city = orig.lower() == dest.lower()
            if str(delivery_method).lower() in ['express', 'priority', 'same_day']:
                base_fee = Decimal('100.00')
                per_kg = Decimal('20.00')
                est_min = 1
                est_max = 1
            elif is_intra_city:
                base_fee = Decimal('80.00')
                per_kg = Decimal('15.00')
                est_min = 1
                est_max = 1
            else:
                base_fee = Decimal('150.00')
                per_kg = Decimal('30.00')
                est_min = 2
                est_max = 4

        extra_weight = max(Decimal('0.00'), weight - Decimal('1.00'))
        total_fee = base_fee + (extra_weight * per_kg)

        est_delivery_date = (timezone.now() + timedelta(days=est_max)).date()

        return {
            'origin_city': orig,
            'destination_city': dest,
            'delivery_method': delivery_method,
            'weight_kg': float(weight),
            'base_fee': float(base_fee),
            'per_kg_fee': float(per_kg),
            'total_shipping_fee': float(total_fee),
            'estimated_days_min': est_min,
            'estimated_days_max': est_max,
            'estimated_delivery_date': est_delivery_date.isoformat(),
        }


class ShipmentWorkflowService:
    # State transition validation graph
    ALLOWED_TRANSITIONS = {
        ShipmentStatus.PREPARED: [
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.COURIER_ASSIGNED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.PENDING: [
            ShipmentStatus.PREPARED,
            ShipmentStatus.CONFIRMED,
            ShipmentStatus.PROCESSING,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.CONFIRMED: [
            ShipmentStatus.PROCESSING,
            ShipmentStatus.READY_FOR_DISPATCH,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.PROCESSING: [
            ShipmentStatus.READY_FOR_DISPATCH,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.READY_FOR_DISPATCH: [
            ShipmentStatus.BOOKING_REQUESTED,
            ShipmentStatus.BOOKING_CONFIRMED,
            ShipmentStatus.PICKUP_SCHEDULED,
            ShipmentStatus.COURIER_ASSIGNED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.BOOKING_REQUESTED: [
            ShipmentStatus.BOOKING_CONFIRMED,
            ShipmentStatus.READY_FOR_DISPATCH,  # On courier rejection
            ShipmentStatus.COURIER_ASSIGNED,
            ShipmentStatus.PICKUP_SCHEDULED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.BOOKING_CONFIRMED: [
            ShipmentStatus.PICKUP_SCHEDULED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.COURIER_ASSIGNED: [
            ShipmentStatus.BOOKING_REQUESTED,
            ShipmentStatus.BOOKING_CONFIRMED,
            ShipmentStatus.PICKUP_SCHEDULED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.PICKUP_SCHEDULED: [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.DELAYED,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.PICKED_UP: [
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.FAILED,
            ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
            ShipmentStatus.ARRIVED_AT_DESTINATION,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER
        ],
        ShipmentStatus.IN_TRANSIT: [
            ShipmentStatus.DELIVERED,
            ShipmentStatus.FAILED,
            ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
            ShipmentStatus.ARRIVED_AT_DESTINATION,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER
        ],
        ShipmentStatus.ARRIVED_AT_SORTING_CENTER: [
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.ARRIVED_AT_DESTINATION,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER
        ],
        ShipmentStatus.ARRIVED_AT_DESTINATION: [
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER
        ],
        ShipmentStatus.OUT_FOR_DELIVERY: [
            ShipmentStatus.DELIVERED,  # Only permissible via OTP verification
            ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
            ShipmentStatus.FAILED_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED,
            ShipmentStatus.RETURNED_TO_SELLER
        ],
        ShipmentStatus.DELIVERY_ATTEMPT_FAILED: [
            ShipmentStatus.OUT_FOR_DELIVERY,  # Reschedule attempt
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER,
            ShipmentStatus.RETURNED
        ],
        ShipmentStatus.FAILED_DELIVERY: [
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER,
            ShipmentStatus.RETURNED
        ],
        ShipmentStatus.DELAYED: [
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.ARRIVED_AT_DESTINATION,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.RETURNED_TO_SELLER,
            ShipmentStatus.RETURNED
        ],
        ShipmentStatus.PENDING_ASSIGNMENT: [
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.COURIER_ASSIGNED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.ASSIGNED: [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.FAILED,
            ShipmentStatus.FAILED_DELIVERY,
            ShipmentStatus.DELAYED,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.FAILED: [
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.DELAYED,
            ShipmentStatus.RETURNED_TO_SELLER,
            ShipmentStatus.RETURNED,
            ShipmentStatus.CANCELLED
        ],
        ShipmentStatus.DELIVERED: [
            ShipmentStatus.DELIVERY_DISPUTED
        ],
        ShipmentStatus.DELIVERY_DISPUTED: [
            ShipmentStatus.DELIVERED,
            ShipmentStatus.RETURNED_TO_SELLER,
            ShipmentStatus.RETURNED
        ],
        ShipmentStatus.RETURNED_TO_SELLER: [],
        ShipmentStatus.RETURNED: [],
        ShipmentStatus.CANCELLED: []
    }

    @classmethod
    def can_transition(cls, current_status: str, target_status: str) -> bool:
        if current_status == target_status:
            return True
        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, [])
        return target_status in allowed

    @classmethod
    @transaction.atomic
    def advance_status(cls, shipment: Shipment, new_status: str, location: str = '', description: str = '', delivery_note: str = '', updated_by=None, force=False):
        """
        Advances the shipment status, generates an event log, and synchronizes the parent order.
        """
        if not force and not cls.can_transition(shipment.status, new_status):
            raise ValueError(
                f"Invalid transition from '{shipment.get_status_display()}' to '{new_status}'."
            )

        old_status = shipment.status
        shipment.status = new_status

        if not shipment.delivery_confirmation_code:
            import secrets
            shipment.delivery_confirmation_code = f"{secrets.randbelow(900000) + 100000}"

        if new_status == ShipmentStatus.DELIVERED:
            shipment.actual_delivery_date = timezone.now()

        shipment.save()

        # Create tracking event record
        ShipmentTrackingEvent.objects.create(
            shipment=shipment,
            previous_status=old_status,
            status=new_status,
            location=location or shipment.origin_city or 'Fulfillment Hub',
            description=description or delivery_note or f"Shipment status updated to {shipment.get_status_display()}.",
            delivery_note=delivery_note or description or '',
            updated_by=updated_by
        )

        # Synchronize order fulfillment and status
        order = shipment.order
        if order:
            from orders.models import Order
            if new_status == ShipmentStatus.DELIVERED:
                order.fulfillment_status = Order.FulfillmentStatus.DELIVERED
                order.status = Order.Status.DELIVERED
                # Activate warranties on all items
                now = timezone.now()
                for item in order.items.all():
                    item.warranty_start_date = now
                    days = item.warranty_duration_days or 7
                    item.warranty_end_date = now + timedelta(days=days)
                    item.save()
            elif new_status in [
                ShipmentStatus.PICKED_UP,
                ShipmentStatus.IN_TRANSIT,
                ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
                ShipmentStatus.ARRIVED_AT_DESTINATION,
                ShipmentStatus.OUT_FOR_DELIVERY
            ]:
                order.fulfillment_status = Order.FulfillmentStatus.SHIPPED
                if order.status != Order.Status.DELIVERED:
                    order.status = Order.Status.SHIPPED
            elif new_status in [ShipmentStatus.CONFIRMED, ShipmentStatus.ASSIGNED]:
                order.fulfillment_status = Order.FulfillmentStatus.CONFIRMED
            elif new_status in [
                ShipmentStatus.PREPARED,
                ShipmentStatus.PROCESSING,
                ShipmentStatus.READY_FOR_DISPATCH,
                ShipmentStatus.BOOKING_REQUESTED,
                ShipmentStatus.BOOKING_CONFIRMED,
                ShipmentStatus.PICKUP_SCHEDULED,
                ShipmentStatus.COURIER_ASSIGNED
            ]:
                order.fulfillment_status = Order.FulfillmentStatus.PROCESSING
            elif new_status == ShipmentStatus.CANCELLED:
                order.fulfillment_status = Order.FulfillmentStatus.CANCELLED
                order.status = Order.Status.CANCELLED

            order.save()

        # Send milestone notifications & emails
        cls._send_status_notifications(shipment, new_status, location, description)

        return shipment

    @classmethod
    @transaction.atomic
    def book_courier(cls, shipment: Shipment, courier_company, requested_by=None, pickup_date=None, package_dimensions=None, package_weight=None, notes='', **kwargs):
        """
        Stage 3: Order Manager selects a courier and creates a booking request.
        Sends an official booking request email to the courier company.
        """
        import uuid
        requested_by = requested_by or kwargs.get('user')
        pickup_date = pickup_date or kwargs.get('requested_pickup_date')
        package_dimensions = package_dimensions or kwargs.get('dimensions')
        package_weight = package_weight if package_weight is not None else kwargs.get('package_weight_kg')
        notes = notes or kwargs.get('booking_notes', '')

        bkg_ref = f"BKG-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}"

        shipment.courier_company = courier_company
        shipment.booking_status = 'REQUESTED'
        shipment.booking_requested_at = timezone.now()
        shipment.booking_reference = bkg_ref
        shipment.booking_notes = notes or ''
        if package_dimensions:
            shipment.package_dimensions = package_dimensions
        if package_weight:
            shipment.weight_kg = Decimal(str(package_weight))
        shipment.save()

        # Advance status to BOOKING_REQUESTED
        cls.advance_status(
            shipment=shipment,
            new_status=ShipmentStatus.BOOKING_REQUESTED,
            location=shipment.origin_city,
            description=f"Courier booking request submitted to {courier_company.name}. Booking Ref: {bkg_ref}.",
            updated_by=requested_by,
            force=True
        )

        # Send professional Courier Booking Request Email using existing email service
        if courier_company.email:
            try:
                subject = f"Booking Request: Order {shipment.order.order_number} to {shipment.destination_city} (Ref: {bkg_ref})"
                body_content = f"""
                <h2 style="color: #0b1a2d; margin-top: 0;">Courier Booking Request</h2>
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    Dear <strong>{courier_company.name}</strong> Logistics Dispatch,
                </p>
                <p style="color: #475569; font-size: 14px;">
                    We have an order prepared for customer delivery and request a scheduled courier pickup from our Addis Ababa fulfillment center.
                </p>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; font-size: 13px;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600; width: 40%;">Booking Reference</td>
                        <td style="padding: 10px 16px; color: #0f172a; font-weight: 700; font-family: monospace;">{bkg_ref}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Store Pickup Dock</td>
                        <td style="padding: 10px 16px; color: #0f172a;">EthioTech Market Fulfillment Center, Addis Ababa</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Destination Hub</td>
                        <td style="padding: 10px 16px; color: #0f172a; font-weight: 700;">{shipment.destination_city}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Recipient Name</td>
                        <td style="padding: 10px 16px; color: #0f172a;">{shipment.recipient_name} ({shipment.recipient_phone})</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Delivery Address</td>
                        <td style="padding: 10px 16px; color: #0f172a;">{shipment.delivery_address}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Package Weight / Dims</td>
                        <td style="padding: 10px 16px; color: #0f172a;">{shipment.weight_kg} kg &bull; {shipment.package_dimensions}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Requested Pickup Date</td>
                        <td style="padding: 10px 16px; color: #0284c7; font-weight: 700;">{pickup_date or 'Earliest Available'}</td>
                    </tr>
                </table>
                <p style="color: #475569; font-size: 13px;">
                    Please confirm receipt and provide driver assignment / pickup schedule window.
                </p>
                """
                html_content = get_base_email_template(
                    title="Courier Booking Request",
                    body_content=body_content,
                    footer_note="EthioTech Market Logistics Division &bull; Addis Ababa, Ethiopia"
                )
                _send_mail_async(
                    subject=subject,
                    text_content=f"Booking Request for Order {shipment.order.order_number} to {shipment.destination_city}. Ref: {bkg_ref}. Weight: {shipment.weight_kg}kg.",
                    html_content=html_content,
                    to_emails=[courier_company.email]
                )
                shipment.booking_email_sent = True
                shipment.save(update_fields=['booking_email_sent'])
            except Exception as e:
                logger.error(f"Failed to dispatch courier booking email: {e}")

        return shipment

    @classmethod
    @transaction.atomic
    def confirm_booking(cls, shipment: Shipment, confirmed: bool, confirmed_by=None, external_tracking_number='', pickup_time_window='', rejection_reason='', courier_notes=''):
        """
        Stage 4: Record the courier's actual confirmation or rejection.
        """
        if confirmed:
            shipment.booking_status = 'CONFIRMED'
            shipment.booking_confirmed_at = timezone.now()
            if external_tracking_number:
                shipment.external_tracking_number = external_tracking_number
            elif not shipment.external_tracking_number:
                shipment.external_tracking_number = shipment.booking_reference
            shipment.save()

            desc = f"Courier {shipment.courier_company.name} confirmed booking. Waybill: {shipment.external_tracking_number}."
            if pickup_time_window:
                desc += f" Pickup Window: {pickup_time_window}."
            if courier_notes:
                desc += f" Notes: {courier_notes}."

            cls.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.BOOKING_CONFIRMED,
                location=shipment.origin_city,
                description=desc,
                updated_by=confirmed_by,
                force=True
            )
        else:
            shipment.booking_status = 'REJECTED'
            shipment.booking_rejected_at = timezone.now()
            shipment.booking_rejection_reason = rejection_reason or 'Courier unavailable for requested corridor/schedule.'
            shipment.save()

            desc = f"Courier {shipment.courier_company.name if shipment.courier_company else 'Partner'} rejected booking request: {shipment.booking_rejection_reason}."
            cls.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.READY_FOR_DISPATCH,
                location=shipment.origin_city,
                description=desc,
                updated_by=confirmed_by,
                force=True
            )

        return shipment

    @classmethod
    @transaction.atomic
    def schedule_pickup(cls, shipment: Shipment, driver_name: str, driver_phone: str, vehicle_plate: str = '', scheduled_at=None, updated_by=None, notes=''):
        """
        Stage 5: Driver pickup - Record the assigned driver and scheduled pickup.
        """
        if not driver_name or not driver_phone:
            raise ValueError("Driver name and driver phone number are required to schedule pickup.")

        shipment.pickup_driver_name = driver_name
        shipment.pickup_driver_phone = driver_phone
        shipment.pickup_vehicle_plate = vehicle_plate or ''
        shipment.pickup_scheduled_at = scheduled_at or timezone.now()
        shipment.save()

        desc = f"Courier driver {driver_name} ({driver_phone}) scheduled for package collection."
        if vehicle_plate:
            desc += f" Vehicle: {vehicle_plate}."
        if notes:
            desc += f" Notes: {notes}."

        cls.advance_status(
            shipment=shipment,
            new_status=ShipmentStatus.PICKUP_SCHEDULED,
            location=shipment.origin_city,
            description=desc,
            updated_by=updated_by,
            force=True
        )
        return shipment

    @classmethod
    @transaction.atomic
    def confirm_handover(cls, shipment: Shipment, confirmed_by, notes='', location='Addis Ababa Fulfillment Center', **kwargs):
        """
        Stage 6: Package handover - Store Manager confirms physical handover to the driver.
        """
        shipment.handover_confirmed_by = confirmed_by
        shipment.handover_confirmed_at = timezone.now()
        shipment.handover_notes = notes or ''
        shipment.save()

        driver_info = shipment.pickup_driver_name or (shipment.delivery_personnel.full_name if shipment.delivery_personnel else 'Carrier Driver')
        plate_info = f" (Vehicle: {shipment.pickup_vehicle_plate})" if shipment.pickup_vehicle_plate else ''
        desc = f"Store Manager {confirmed_by.get_full_name() or confirmed_by.username} confirmed physical package handover to driver {driver_info}{plate_info}."
        if notes:
            desc += f" Handover Notes: {notes}."

        cls.advance_status(
            shipment=shipment,
            new_status=ShipmentStatus.PICKED_UP,
            location=location or shipment.origin_city,
            description=desc,
            updated_by=confirmed_by,
            force=True
        )
        return shipment

    @classmethod
    @transaction.atomic
    def assign_local_delivery(cls, shipment: Shipment, personnel: DeliveryPersonnel, notes: str = '', user=None):
        """
        Stage 8: Assign local delivery personnel in destination city and mark OUT_FOR_DELIVERY.
        """
        shipment.delivery_personnel = personnel
        desc = f"Assigned to local delivery driver: {personnel.full_name} ({personnel.phone_number}). {notes}".strip()
        
        if shipment.status in [ShipmentStatus.ARRIVED_AT_DESTINATION, ShipmentStatus.DELIVERY_ATTEMPT_FAILED, ShipmentStatus.DELAYED, ShipmentStatus.IN_TRANSIT]:
            cls.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.OUT_FOR_DELIVERY,
                location=shipment.destination_city,
                description=desc,
                updated_by=user,
                force=True
            )
        else:
            shipment.save(update_fields=['delivery_personnel'])
            ShipmentTrackingEvent.objects.create(
                shipment=shipment,
                status=shipment.status,
                location=shipment.destination_city,
                description=desc,
                updated_by=user
            )
        return shipment

    @classmethod
    def _send_status_notifications(cls, shipment: Shipment, status: str, location: str, description: str):
        customer = shipment.order.customer if shipment.order else None
        if not customer:
            return

        order_num = shipment.order.order_number
        track_num = shipment.tracking_number
        event_key = f"SHIP_{shipment.id}_{status}_{timezone.now().strftime('%Y%m%d%H%M')}"

        status_messages = {
            ShipmentStatus.READY_FOR_DISPATCH: (
                "Order Packed & Ready for Dispatch",
                f"Your order {order_num} has been securely packed at our fulfillment center and is prepared for carrier handover. Tracking: {track_num}"
            ),
            ShipmentStatus.BOOKING_REQUESTED: (
                "Courier Booking Requested",
                f"A courier booking request has been dispatched to {shipment.courier_company.name if shipment.courier_company else 'our carrier partner'} for order {order_num}."
            ),
            ShipmentStatus.BOOKING_CONFIRMED: (
                "Courier Booking Confirmed",
                f"Carrier {shipment.courier_company.name if shipment.courier_company else 'Courier'} has confirmed pickup for order {order_num}. Waybill: {shipment.external_tracking_number or track_num}."
            ),
            ShipmentStatus.PICKUP_SCHEDULED: (
                "Driver Pickup Scheduled",
                f"Courier driver {shipment.pickup_driver_name or 'Courier Driver'} is scheduled to collect package for order {order_num} from our warehouse dock."
            ),
            ShipmentStatus.COURIER_ASSIGNED: (
                "Courier Assigned to Shipment",
                f"Courier partner {shipment.courier_company.name if shipment.courier_company else 'Courier'} has been assigned to pick up your order {order_num}."
            ),
            ShipmentStatus.PICKED_UP: (
                "Package Collected by Carrier",
                f"Your package for order {order_num} has been physically handed over to the courier driver in {location} and is now moving to transport."
            ),
            ShipmentStatus.IN_TRANSIT: (
                "Shipment in Transit",
                f"Your package is on its way to {shipment.destination_city}. Current location: {location}."
            ),
            ShipmentStatus.ARRIVED_AT_SORTING_CENTER: (
                "Package at Regional Sorting Center",
                f"Your shipment has arrived at the regional sorting facility ({location}) and is being routed."
            ),
            ShipmentStatus.ARRIVED_AT_DESTINATION: (
                "Package Arrived in Destination City",
                f"Your package has arrived at the {shipment.destination_city} delivery hub ({location}). Local delivery will commence shortly."
            ),
            ShipmentStatus.OUT_FOR_DELIVERY: (
                "Out for Delivery Today!",
                f"Exciting news! Your package for order {order_num} is out for delivery with our local driver. Please ensure someone is available at {shipment.delivery_address} to receive it and provide the delivery OTP."
            ),
            ShipmentStatus.DELIVERY_ATTEMPT_FAILED: (
                "Delivery Attempt Notice",
                f"A delivery attempt was made for order {order_num} in {location}, but could not be completed. We will reschedule delivery."
            ),
            ShipmentStatus.DELAYED: (
                "Delivery Update: Minor Delay",
                f"Your shipment {track_num} has experienced a minor transit delay ({description}). We are working to expedite delivery."
            ),
            ShipmentStatus.DELIVERED: (
                "Package Delivered Successfully!",
                f"Your order {order_num} has been verified and successfully delivered to {shipment.recipient_name}. Thank you for shopping with EthioTech Market!"
            ),
        }

        info = status_messages.get(status)
        if info:
            title, msg = info
            create_order_notification(
                user=customer,
                title=title,
                message=msg,
                notification_type=Notification.NotificationType.ORDER_UPDATE,
                order_number=order_num,
                link=f"/track-order?tracking_number={track_num}",
                event_key=event_key
            )

            # Send Email
            email_body = f"""
            <h2 style="color: #0b1a2d; margin-top: 0;">{title}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">{msg}</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #1b64da; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Tracking Number:</strong> <span style="font-family: monospace; color: #1b64da;">{track_num}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Destination:</strong> {shipment.destination_city}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Current Status:</strong> <span style="font-weight: 600; color: #0d9488;">{shipment.get_status_display()}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Location:</strong> {location}</p>
            </div>
            """
            cta_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/track-order?tracking_number={track_num}"
            html_content = get_base_email_template(
                title=title,
                body_content=email_body,
                cta_url=cta_url,
                cta_text="Track Shipment Live"
            )
            _send_mail_async(
                subject=f"[{track_num}] {title}",
                text_content=msg,
                html_content=html_content,
                to_emails=[customer.email]
            )


class DeliveryOTPService:
    @classmethod
    def request_delivery_otp(cls, shipment: Shipment, requested_by=None) -> dict:
        """
        Generates a cryptographically secure 6-digit OTP, stores its secure hash,
        and dispatches it to the customer via email and notification.
        Enforces cooldown and status restrictions.
        """
        settings_obj = DeliverySetting.get_settings()

        if shipment.status not in [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.ARRIVED_AT_DESTINATION]:
            raise ValueError(
                f"Delivery OTP can only be requested when package is Out for Delivery or at Destination Hub (current: {shipment.get_status_display()})."
            )

        customer = shipment.order.customer
        if not customer or not customer.email:
            raise ValueError("Customer email is missing or invalid for OTP delivery verification.")

        # Check resend cooldown
        cooldown_seconds = settings_obj.otp_cooldown_seconds or 60
        latest_otp = DeliveryOTP.objects.filter(shipment=shipment).order_by('-created_at').first()
        if latest_otp and not latest_otp.is_used:
            time_since = (timezone.now() - latest_otp.created_at).total_seconds()
            if time_since < cooldown_seconds:
                remaining = int(cooldown_seconds - time_since)
                raise ValueError(
                    f"Please wait {remaining} seconds before requesting a new delivery OTP."
                )

        # Generate 6-digit numeric OTP
        raw_otp = f"{secrets.randbelow(900000) + 100000}"
        expiry_minutes = settings_obj.otp_expiry_minutes or 5
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        otp_record = DeliveryOTP(
            shipment=shipment,
            customer=customer,
            expires_at=expires_at,
            max_attempts=settings_obj.otp_max_attempts or 3,
            recipient_email=customer.email,
            recipient_phone=shipment.recipient_phone or getattr(customer, 'phone_number', '')
        )
        otp_record.set_otp(raw_otp)
        otp_record.save()

        # Send OTP to customer via Email
        order_num = shipment.order.order_number
        track_num = shipment.tracking_number

        otp_email_body = f"""
        <h2 style="color: #0b1a2d; margin-top: 0;">Your Secure Delivery Handover OTP</h2>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            The delivery person has arrived with your order <strong>{order_num}</strong>.
            Please inspect the package to ensure it is in good condition, then provide the OTP below to confirm receipt.
        </p>
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 12px; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase;">Your 6-Digit Delivery OTP</span>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: 'Courier New', monospace; margin: 10px 0;">
                {raw_otp}
            </div>
            <span style="font-size: 12px; color: #cbd5e1;">Valid for {expiry_minutes} minutes. Single-use only.</span>
        </div>
        <p style="font-size: 13px; color: #ef4444; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 14px; border-radius: 6px;">
            <strong>Important Safety Notice:</strong> Do not share this OTP over phone or chat before the physical package has been safely placed in your hands.
        </p>
        """
        html_content = get_base_email_template(
            title="Delivery Confirmation OTP",
            body_content=otp_email_body,
            footer_note="If you did not expect a delivery, please contact support immediately."
        )

        _send_mail_async(
            subject=f"[{track_num}] Your Delivery Handover OTP: {raw_otp}",
            text_content=f"Your delivery confirmation OTP for order {order_num} (Tracking: {track_num}) is: {raw_otp}. Valid for {expiry_minutes} minutes.",
            html_content=html_content,
            to_emails=[customer.email]
        )

        # In-app notification
        create_order_notification(
            user=customer,
            title="Delivery Handover OTP Generated",
            message=f"Your delivery agent is completing handover for order {order_num}. Your verification code has been sent to your email.",
            notification_type=Notification.NotificationType.ORDER_UPDATE,
            order_number=order_num,
            link=f"/track-order?tracking_number={track_num}",
            event_key=f"OTP_SENT_{shipment.id}_{otp_record.id}"
        )

        logger.info(f"Generated secure delivery OTP for shipment {track_num} (Customer: {customer.email})")

        # Response safely returns metadata WITHOUT exposing plain raw_otp
        return {
            'success': True,
            'message': f"A secure 6-digit delivery OTP has been dispatched to customer {customer.email}.",
            'recipient_email_masked': f"{customer.email[:3]}***@{customer.email.split('@')[-1]}",
            'expires_at': expires_at.isoformat(),
            'cooldown_seconds': cooldown_seconds
        }

    @classmethod
    def generate_and_send_otp(cls, shipment: Shipment, requested_by=None):
        """
        Generates and stores OTP, returning (raw_otp, otp_record).
        Useful for internal automated test verification and explicit dispatch.
        """
        settings_obj = DeliverySetting.get_settings()
        customer = shipment.order.customer
        raw_otp = f"{secrets.randbelow(900000) + 100000}"
        expiry_minutes = settings_obj.otp_expiry_minutes or 5
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        # Deactivate any previous unused OTPs for clean state
        DeliveryOTP.objects.filter(shipment=shipment, is_used=False).update(is_used=True)

        otp_record = DeliveryOTP(
            shipment=shipment,
            customer=customer,
            expires_at=expires_at,
            max_attempts=settings_obj.otp_max_attempts or 3,
            recipient_email=customer.email if customer else '',
            recipient_phone=shipment.recipient_phone or getattr(customer, 'phone_number', '') if customer else ''
        )
        otp_record.set_otp(raw_otp)
        otp_record.save()
        return raw_otp, otp_record

    @classmethod
    def verify_delivery_otp(cls, shipment: Shipment, raw_otp: str, verified_by_user=None) -> dict:
        """
        Verifies customer OTP, updates shipment and order to DELIVERED, and activates item warranties.
        """
        if shipment.status == ShipmentStatus.DELIVERED:
            return {'success': True, 'message': 'Shipment has already been verified and delivered.'}

        active_otp = DeliveryOTP.objects.filter(
            shipment=shipment,
            is_used=False
        ).order_by('-created_at').first()

        if not active_otp:
            raise ValueError("No active delivery OTP found for this shipment. Please request an OTP first.")

        if active_otp.is_expired:
            raise ValueError("The delivery OTP has expired. Please request a fresh OTP.")

        if active_otp.attempts_count >= active_otp.max_attempts:
            raise ValueError("Maximum verification attempts exceeded. Please request a new OTP.")

        # Check hash and persist attempt count immediately
        if not active_otp.check_otp(raw_otp.strip()):
            active_otp.attempts_count += 1
            active_otp.save(update_fields=['attempts_count'])
            remaining = active_otp.max_attempts - active_otp.attempts_count
            raise ValueError(
                f"Invalid OTP entered. {remaining} attempt(s) remaining before invalidation."
            )

        with transaction.atomic():
            # Mark OTP used
            active_otp.is_used = True
            active_otp.used_at = timezone.now()
            active_otp.save(update_fields=['is_used', 'used_at'])

            # Advance status to DELIVERED
            agent_name = verified_by_user.get_full_name() or verified_by_user.username if verified_by_user else 'Authorized Courier'
            ShipmentWorkflowService.advance_status(
                shipment=shipment,
                new_status=ShipmentStatus.DELIVERED,
                location=shipment.destination_city,
                description=f"Package handed over and verified via secure Customer OTP by {agent_name}.",
                updated_by=verified_by_user,
                force=True
            )

        return {
            'success': True,
            'message': f"Delivery verified successfully! Order {shipment.order.order_number} marked as DELIVERED.",
            'delivered_at': shipment.actual_delivery_date.isoformat() if shipment.actual_delivery_date else timezone.now().isoformat()
        }
