import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from accounts.models import AuditLog

User = get_user_model()


class Command(BaseCommand):
    help = 'Securely configures or updates the Administrator and Store Manager accounts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-email',
            type=str,
            default=os.environ.get('ADMIN_EMAIL', 'addisuguche68@gmail.com'),
            help='Email for the Administrator account'
        )
        parser.add_argument(
            '--admin-password',
            type=str,
            default=os.environ.get('ADMIN_PASSWORD'),
            help='Password for the Administrator account'
        )
        parser.add_argument(
            '--manager-email',
            type=str,
            default=os.environ.get('STORE_MANAGER_EMAIL', 'gucheaddisu5@gmail.com'),
            help='Email for the Store Manager account'
        )
        parser.add_argument(
            '--manager-password',
            type=str,
            default=os.environ.get('STORE_MANAGER_PASSWORD'),
            help='Password for the Store Manager account'
        )
        parser.add_argument(
            '--default-password',
            type=str,
            default=os.environ.get('DEFAULT_PRIVILEGED_PASSWORD', 'ad30@17#'),
            help='Fallback secure password if not explicitly set in environment'
        )

    def handle(self, *args, **options):
        admin_email = options['admin_email'].strip().lower()
        admin_password = options['admin_password'] or options['default_password']

        manager_email = options['manager_email'].strip().lower()
        manager_password = options['manager_password'] or options['default_password']

        self.stdout.write(self.style.NOTICE("Initializing privileged account configuration..."))

        # 1. Provision Administrator
        admin_user = self._provision_account(
            email=admin_email,
            preferred_username='addisuguche_admin',
            password=admin_password,
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            first_name='Addisu',
            last_name='Guche'
        )

        # 2. Provision Store Manager
        manager_user = self._provision_account(
            email=manager_email,
            preferred_username='gucheaddisu_manager',
            password=manager_password,
            role=User.Role.STORE_MANAGER,
            is_staff=True,
            is_superuser=False,
            first_name='Addisu',
            last_name='Guche'
        )

        self.stdout.write(self.style.SUCCESS(
            f"Successfully configured Administrator: {admin_user.email} (Role: {admin_user.role})\n"
            f"Successfully configured Store Manager: {manager_user.email} (Role: {manager_user.role})"
        ))

    def _provision_account(self, email, preferred_username, password, role, is_staff, is_superuser, first_name, last_name):
        user = User.objects.filter(email__iexact=email).first()

        if not user:
            # Check if preferred_username is taken
            username = preferred_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{preferred_username}_{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role,
                is_staff=is_staff,
                is_superuser=is_superuser,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f"Created new account for {email}"))
        else:
            # Update existing user role and privileges safely without duplicating
            user.role = role
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.is_active = True
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            self.stdout.write(self.style.WARNING(f"Updating existing account {email} to role {role}"))

        # Set secure password hash (never stored or shown in plain text)
        if password:
            user.set_password(password)

        user.save()

        # Ensure auth token exists
        Token.objects.get_or_create(user=user)

        # Log audit entry
        AuditLog.objects.create(
            user=user,
            action="Privileged Account Setup",
            details=f"Configured {user.email} as {role} (staff={is_staff}, superuser={is_superuser})"
        )

        return user
