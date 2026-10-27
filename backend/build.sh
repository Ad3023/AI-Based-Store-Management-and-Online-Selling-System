#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== Building Backend for Production ==="

# Upgrade pip and install production dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Collect static files into STATIC_ROOT
echo "=== Running collectstatic ==="
python manage.py collectstatic --no-input

# Apply database migrations
echo "=== Applying database migrations ==="
python manage.py migrate --no-input

# Seed database with initial catalog and demo roles (idempotent get_or_create)
echo "=== Running initial data seeding ==="
python seed_data.py || echo "Seeding completed or skipped"

echo "=== Build completed successfully ==="
