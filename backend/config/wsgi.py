"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
from pathlib import Path
from dotenv import load_dotenv

backend_dir = Path(__file__).resolve().parent.parent
env_file = backend_dir / '.env'
if env_file.exists():
    load_dotenv(env_file, override=True)

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
