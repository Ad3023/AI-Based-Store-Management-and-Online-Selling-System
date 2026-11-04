import smtplib
import socket
from django.core.management.base import BaseCommand
from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings


class Command(BaseCommand):
    help = "Tests Gmail SMTP connectivity and dispatches a test email safely without printing credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            type=str,
            default='',
            help='Target email address for test message (defaults to EMAIL_HOST_USER).'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== EthioTech Market - SMTP Diagnostic Utility ==="))

        host = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
        port = getattr(settings, 'EMAIL_PORT', 587)
        use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
        timeout = getattr(settings, 'EMAIL_TIMEOUT', 15)
        user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
        pwd = getattr(settings, 'EMAIL_HOST_PASSWORD', '').strip()
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')

        self.stdout.write(f"EMAIL_BACKEND:       {getattr(settings, 'EMAIL_BACKEND', '')}")
        self.stdout.write(f"EMAIL_HOST:          {host}")
        self.stdout.write(f"EMAIL_PORT:          {port}")
        self.stdout.write(f"EMAIL_USE_TLS:       {use_tls}")
        self.stdout.write(f"EMAIL_USE_SSL:       {use_ssl}")
        self.stdout.write(f"EMAIL_TIMEOUT:       {timeout}s")
        self.stdout.write(f"EMAIL_HOST_USER:     {user or '[NOT SET]'}")
        self.stdout.write(f"EMAIL_HOST_PASSWORD: {'[CONFIGURED - ' + str(len(pwd)) + ' chars]' if pwd else '[MISSING / EMPTY]'}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL:  {from_email}")
        self.stdout.write("--------------------------------------------------")

        if not user:
            self.stderr.write(self.style.ERROR("ERROR: EMAIL_HOST_USER is missing in backend/.env."))
            return

        if not pwd:
            self.stderr.write(self.style.ERROR(
                "ERROR: EMAIL_HOST_PASSWORD is empty in backend/.env.\n"
                "Please configure a 16-character Google App Password in backend/.env:\n"
                "  EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx"
            ))
            return

        recipient = options.get('recipient') or user
        self.stdout.write(f"Attempting SMTP connection and handshake to {host}:{port}...")

        try:
            connection = get_connection(
                backend=settings.EMAIL_BACKEND,
                host=host,
                port=port,
                username=user,
                password=pwd,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=timeout,
            )
            connection.open()
            self.stdout.write(self.style.SUCCESS(f"SUCCESS: Connected and authenticated to {host}:{port} via TLS!"))

            self.stdout.write(f"Sending test email to: {recipient}...")
            subject = "EthioTech Market - SMTP Configuration Test"
            text_body = (
                "Hello,\n\n"
                "This is a test email sent from EthioTech Market to confirm that Gmail SMTP "
                "email delivery is properly configured and operational on the server.\n\n"
                "Customer OTP verification codes and password reset links can now be sent successfully.\n\n"
                "EthioTech Market Engineering Team"
            )
            html_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="background-color: #0b1a2d; padding: 18px 24px; border-radius: 6px; margin-bottom: 20px;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 20px;">EthioTech <span style="color: #38bdf8;">Market</span></h2>
                    <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Better Tech. Brighter Future.</p>
                </div>
                <h3 style="color: #0f172a;">SMTP Test Verification Succeeded!</h3>
                <p style="color: #334155; line-height: 1.6;">
                    This confirms that your Django backend has successfully connected to <strong>smtp.gmail.com:587</strong> 
                    and authenticated as <strong>{user}</strong> using STARTTLS.
                </p>
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 14px; margin: 18px 0; color: #065f46; font-size: 13px;">
                    &#10003; Customer OTP verification emails and notifications are now ready to be delivered.
                </div>
                <p style="color: #64748b; font-size: 11px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                    Automated SMTP Diagnostic Message &bull; EthioTech Market
                </p>
            </div>
            """

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=from_email or f"EthioTech Market <{user}>",
                to=[recipient],
                connection=connection
            )
            msg.attach_alternative(html_body, "text/html")
            sent_count = msg.send(fail_silently=False)

            if sent_count > 0:
                self.stdout.write(self.style.SUCCESS(f"SUCCESS: Test email successfully sent to {recipient}!"))
            else:
                self.stderr.write(self.style.WARNING("WARNING: SMTP server accepted connection, but returned 0 sent messages."))

            connection.close()
        except smtplib.SMTPAuthenticationError as auth_err:
            self.stderr.write(self.style.ERROR(
                f"AUTHENTICATION FAILED (code {getattr(auth_err, 'smtp_code', 'unknown')}): "
                f"Google rejected the credentials for {user}.\n"
                "Please verify that:\n"
                "1. 2-Step Verification is enabled on your Google Account.\n"
                "2. You generated a dedicated 16-character App Password at https://myaccount.google.com/apppasswords.\n"
                "3. The 16-character password is placed into EMAIL_HOST_PASSWORD in backend/.env."
            ))
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, socket.timeout, TimeoutError) as conn_err:
            self.stderr.write(self.style.ERROR(
                f"CONNECTION ERROR: Could not connect to {host}:{port} ({type(conn_err).__name__}: {conn_err})."
            ))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(
                f"UNEXPECTED ERROR: {type(exc).__name__}: {exc}"
            ))
