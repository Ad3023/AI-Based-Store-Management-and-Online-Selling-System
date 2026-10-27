# AI-Based Store Management & Online Selling System with Intelligent Product Recommendation

> **Final-Year University Project in Information Systems / Software Engineering**  
> *A full-stack, enterprise-grade e-commerce platform integrating Machine Learning recommendation algorithms, multi-role store management, verifiable payment evidence processing, automated digital receipts, and real-time customer segmentation.*

---

## 🌟 Executive Summary

This system bridges the gap between modern online retail and intelligent automation. Beyond standard e-commerce features, the platform integrates **Scikit-learn and Pandas-driven Machine Learning engines** directly with a **PostgreSQL** relational database to deliver personalized shopping experiences, assist inventory managers with data-backed analytics, and provide administrators with granular audit trails.

### 🎯 Key System Highlights

- **Role-Based Access Control (RBAC):** Three distinct personas—**Customer**, **Store Manager**, and **Administrator**—with strict backend permission guards and dynamic UI navigation.
- **AI Recommendation Engine (3 Algorithmic Pillars):**
  1. **Content-Based Similarity (TF-IDF + Cosine Similarity):** Analyzes natural language product titles, descriptions, categories, and tags to recommend contextually relevant alternatives.
  2. **Collaborative Association ("Frequently Bought Together"):** Co-occurrence matrix built from actual completed customer order histories.
  3. **Customer Segmentation (RFM + K-Means Clustering):** Computes Recency, Frequency, and Monetary scores across shoppers to categorize them into High-Value VIPs, Frequent Buyers, Potential Loyalists, and At-Risk segments.
- **Payment Verification Workflow:** Supports manual payment uploads (CBE, Telebirr, Awash Bank receipt screenshots and transaction reference IDs) with Store Manager review, approval/rejection, and audit logging.
- **Digital Receipt Generator:** Instant generation of formal, verifiable digital receipts with unique receipt codes and a clean, browser-native printable invoice layout.
- **Instant Role Switcher for Demonstrations:** A floating 1-click persona switcher (`Customer (Abebe)`, `Store Manager`, `Administrator`) designed specifically for project evaluation and defense demonstrations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, JavaScript (ESNext), Bootstrap 5, Bootstrap Icons, Chart.js 4, React-Chartjs-2, Axios, React Router 7 |
| **Backend** | Python 3.12+, Django 5.2, Django REST Framework 3.18, Django-Cors-Headers |
| **Database** | PostgreSQL 18.6 (Relational DB with atomic transactions and foreign keys) |
| **Machine Learning** | Scikit-learn 1.9, Pandas 3.0, NumPy, TF-IDF Vectorizer, Cosine Similarity, K-Means Clustering |
| **Styling & UX** | Modern Vanilla CSS, Glassmorphic UI tokens, Responsive Grid, Micro-animations, Print Media Styles |

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client ["Client Layer (React + Vite)"]
        UI[Responsive UI - Bootstrap 5]
        AuthCtx[Auth Context & JWT/Token Store]
        CartCtx[Cart & Sync State]
        RoleSwitcher[1-Click Demo Persona Switcher]
    end

    subgraph API ["API & Backend Layer (Django REST Framework)"]
        Router[DRF ViewSets & Routers]
        Perms[Role-Based Permission Enforcer]
        Audit[Security & Action Audit Logger]
        
        subgraph AI ["Machine Learning Engine"]
            TFIDF[TF-IDF Content Similarity]
            CoOccur[Order Co-Occurrence Matrix]
            KMeans[RFM K-Means Segmentation]
            Trending[Bayesian Sales Velocity]
        end
    end

    subgraph Data ["Persistence Layer (PostgreSQL)"]
        UsersDB[(Users, Profiles & Audit Logs)]
        CatalogDB[(Categories, Products & Stock Logs)]
        OrdersDB[(Carts, Orders, Payments & Receipts)]
        AnalyticsDB[(Activity Logs & Segments)]
    end

    UI <--> Router
    Router --> Perms
    Perms --> Audit
    Router <--> AI
    AI <--> CatalogDB
    AI <--> OrdersDB
    Router <--> UsersDB
    Router <--> OrdersDB
    Router <--> AnalyticsDB
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.12+ installed
- Node.js 18+ and npm installed
- PostgreSQL installed and running on port 5432

### 1. Database Setup
Ensure PostgreSQL is running and the database exists:
```sql
CREATE DATABASE ai_online_selling_db;
```
Configure your credentials in `backend/.env` (example provided in repository).

### 2. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python seed_data.py
python manage.py runserver 127.0.0.1:8000
```

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
Open **`http://127.0.0.1:5173/`** in your browser.

---

## 👥 Demo Credentials

For quick evaluation during viva/presentation, use the floating **"Demo Role Switcher"** at the bottom-right of the screen, or log in manually:

| Role | Username | Password | Access Highlights |
| :--- | :--- | :--- | :--- |
| **Customer** | `abebe` | `customer123` | Browse catalog, AI recommendations, Cart, Checkout, Upload CBE/Telebirr receipt, View digital receipts |
| **Store Manager** | `manager` | `manager123` | Analytics dashboard, Verify payments, Update order statuses, Adjust inventory, View K-Means customer segments |
| **Administrator** | `admin` | `admin123` | Manage user accounts, assign roles, view system-wide audit logs |

---

## 🧪 Verification & Automated Testing

Run the automated test runner to test all 13 core end-to-end endpoints:
```powershell
cd backend
.\.venv\Scripts\python.exe test_all_endpoints.py
```
**Result:** 13/13 Integration tests passing (Authentication, Product Catalog, TF-IDF Recommendations, Co-Occurrence Matrix, K-Means Clustering, Cart/Checkout, Payment Upload, Manager Verification, Digital Receipt, Dashboard Metrics, Audit Logs).

---

## 📚 Project Documentation

- [System Architecture & ML Model Details](file:///documentation/ARCHITECTURE.md)
- [Step-by-Step Run & Installation Guide](file:///documentation/RUN_INSTRUCTIONS.md)
- [Full Cloud Deployment Guide (Render)](file:///documentation/DEPLOYMENT_GUIDE.md)
- [University Viva & Presentation Defense Guide](file:///documentation/PRESENTATION_GUIDE.md)

---
*Developed with pride for the Information Systems Final-Year Degree Examination.*
