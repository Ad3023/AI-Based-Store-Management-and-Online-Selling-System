# Project Run & Setup Instructions

> **Project:** AI-Based Store Management & Online Selling System with Intelligent Product Recommendation  
> **Environment:** Windows 10/11, PowerShell, Visual Studio Code  

---

## 📋 System Requirements

Before starting, ensure the following software is installed on your computer:
1. **Python:** Version 3.12 or higher ([python.org](https://www.python.org/downloads/))
2. **Node.js:** Version 18 or higher (LTS recommended) ([nodejs.org](https://nodejs.org/))
3. **PostgreSQL:** Version 14, 15, 16, 17, or 18 running on port `5432` ([postgresql.org](https://www.postgresql.org/download/windows/))
4. **Git:** For version control

---

## 🗄️ Step 1: PostgreSQL Database Configuration

1. Make sure your PostgreSQL service is running. You can check in Windows PowerShell:
   ```powershell
   Get-Service -Name *postgres*
   ```
   If it is stopped, start it:
   ```powershell
   Start-Service postgresql-x64-18
   # or whichever version you have installed
   ```

2. Open PostgreSQL interactive terminal (`psql`) or pgAdmin and create the application database:
   ```sql
   CREATE DATABASE ai_online_selling_db;
   ```

3. Ensure the database connection settings in `backend/.env` match your PostgreSQL password:
   ```env
   SECRET_KEY=django-insecure-ai-online-selling-super-secret-key-2026-prod-ready
   DEBUG=True
   ALLOWED_HOSTS=127.0.0.1,localhost

   DB_NAME=ai_online_selling_db
   DB_USER=postgres
   DB_PASSWORD=ad30@17#
   DB_HOST=localhost
   DB_PORT=5432
   ```

---

## 🐍 Step 2: Backend Setup (Django + AI Engine)

Open a new PowerShell terminal in VS Code and navigate to the project directory:

```powershell
cd c:\Users\Addisu\Desktop\AI_Online_Selling_System\backend
```

### 1. Create and Activate the Virtual Environment
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
*(If PowerShell displays an execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and re-activate).*

### 2. Install Python Dependencies
```powershell
pip install -r requirements.txt
```
*(Dependencies include `django`, `djangorestframework`, `django-cors-headers`, `psycopg2-binary`, `scikit-learn`, `pandas`, `numpy`, `pillow`).*

### 3. Run Database Migrations
Create and execute all schema migrations into PostgreSQL:
```powershell
python manage.py makemigrations accounts products orders recommendations notifications
python manage.py migrate
```

### 4. Populate Realistic Seed Data
Populate the database with sample categories, products, customer profiles, past orders, reviews, and K-Means segmentation clusters:
```powershell
python seed_data.py
```

### 5. Launch the Django Development Server
```powershell
python manage.py runserver 127.0.0.1:8000
```
The REST API will be live at: **`http://127.0.0.1:8000/api/`**

---

## ⚛️ Step 3: Frontend Setup (React 19 + Vite)

Open a **second** terminal window in VS Code:

```powershell
cd c:\Users\Addisu\Desktop\AI_Online_Selling_System\frontend
```

### 1. Install Node Dependencies
On Windows, execute npm via `cmd.exe /c "npm install"` or `npm.cmd install` to prevent PowerShell script blocking:
```powershell
npm install
```

### 2. Launch the Vite Development Server
```powershell
cmd.exe /c "npm run dev -- --host 127.0.0.1 --port 5173"
```
The frontend application will be live at: **`http://127.0.0.1:5173/`**

---

## 🧪 Step 4: Verification & Automated Tests

To verify that all 13 core subsystems (Authentication, AI Content Recommendations, Association Matrix, RFM K-Means Segmentation, Cart, Checkout, Payment Upload, Manager Review, Receipts, and Dashboard Analytics) are working properly:

Open a terminal in the `backend` folder and run:
```powershell
cd c:\Users\Addisu\Desktop\AI_Online_Selling_System\backend
.\.venv\Scripts\python.exe -u test_all_endpoints.py
```

Expected output:
```
==================================================
   RUNNING AUTOMATED SYSTEM INTEGRATION TESTS     
==================================================
[*] Customer Login: SUCCESS
[*] Store Manager Login: SUCCESS
[*] Administrator Login: SUCCESS
[*] Product Catalog API: SUCCESS
[*] AI Content Similarity (TF-IDF): SUCCESS
[*] AI Co-Occurrence / Bought Together: SUCCESS
[*] AI Popular & Trending Fallback: SUCCESS
[*] AI RFM Customer Segmentation (K-Means): SUCCESS
[*] Customer Cart: SUCCESS
[*] Order Creation & Checkout: SUCCESS
[*] Payment Evidence Submission: SUCCESS
[*] Store Manager Payment Verification: SUCCESS
[*] Customer Digital Receipt Access: SUCCESS
[*] Manager Dashboard Analytics: SUCCESS
[*] CSV Report Exports (Sales & Inventory): SUCCESS
[*] Administrator Access Control & Audit Logs: SUCCESS

==================================================
   ALL 13 SYSTEM INTEGRATION TESTS PASSED 100%!   
==================================================
```

---

## 🔑 Default User Accounts & Credentials

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Customer** | `abebe` | `customer123` | Shopping, cart, checkout, payment upload, viewing receipts |
| **Store Manager** | `manager` | `manager123` | Payment verification, inventory control, AI customer segments |
| **Administrator** | `admin` | `admin123` | User role management, audit log inspection |

> **Pro Tip:** In the web browser (`http://127.0.0.1:5173/`), use the **Floating Demo Role Switcher** in the bottom-right corner to switch between roles with a single click.

---

## 🛠️ Troubleshooting Common Issues

### Issue 1: `npm : File ... cannot be loaded because running scripts is disabled`
- **Cause:** Windows PowerShell Execution Policy restricts `.ps1` files.
- **Solution:** Always run `cmd.exe /c "npm run dev"` or execute `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in PowerShell.

### Issue 2: `django.db.utils.OperationalError: connection to server at "localhost" failed`
- **Cause:** PostgreSQL service is not running or password in `backend/.env` is incorrect.
- **Solution:** Verify the service is running (`Get-Service *postgres*`) and check that `DB_PASSWORD=ad30@17#` in `backend/.env`.

### Issue 3: Port 8000 or 5173 already in use
- **Cause:** Previous instance still running in background.
- **Solution:** Stop running processes:
  ```powershell
  # Find PID:
  netstat -ano | findstr :8000
  netstat -ano | findstr :5173
  # Kill PID:
  taskkill /PID <PID> /F
  ```
