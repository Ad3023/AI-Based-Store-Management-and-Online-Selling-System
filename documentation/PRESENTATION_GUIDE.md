# Final-Year Project Presentation & Viva Defense Guide

> **Project:** AI-Based Store Management & Online Selling System with Intelligent Product Recommendation  
> **Target Audience:** University Examination Committee, Internal/External Examiners, Project Supervisor  
> **Prepared For:** Academic Defense & Demonstration  

---

## 🎯 1. Presentation Structure (15–20 Minute Allocation)

| Section | Recommended Time | Core Objective |
| :--- | :---: | :--- |
| **1. Introduction & Problem Statement** | 3 mins | Explain limitations of standard e-commerce in handling manual payments and cold-start recommendations. |
| **2. Proposed Solution & Architecture** | 3 mins | Highlight the 3-tier architecture, PostgreSQL data model, and Scikit-learn ML pipeline. |
| **3. Live System Demonstration** | 8 mins | Step through Customer, Store Manager, and Administrator personas using the 1-Click Role Switcher. |
| **4. Technical Innovations & Impact** | 2 mins | Explain TF-IDF, Co-occurrence matrix, RFM K-Means clustering, and atomic transactions. |
| **5. Examiner Q&A Session** | 4 mins | Confidently defend technical, algorithmic, and architectural decisions. |

---

## 🎬 2. Step-by-Step Live Demonstration Script

> 💡 **Presentation Tip:** Keep the browser open at `http://127.0.0.1:5173/`. You can use the floating **"Demo Role Switcher"** at the bottom-right corner of the screen to switch personas instantly without typing passwords during the live presentation.

---

### Step 1: The Customer Experience (Persona: `Abebe`)

1. **Homepage & Catalog:**
   - Click **"Customer (Abebe)"** on the Role Switcher.
   - Point out the modern, responsive interface, hero banner, category pills, and **Trending Products** calculated from real sales velocity.
2. **AI Recommendation in Action:**
   - Click on the product: **"Keychron K2 Pro QMK Wireless Mechanical Keyboard"**.
   - Scroll down to the **"Frequently Bought Together"** section:
     - *Explaining to examiners:* "Here, our system computed association rules from completed customer orders. It suggests the *Ergonomic Memory Foam Wrist Rest* and *Logitech MX Master 3S* because previous buyers bought them together."
   - Scroll to **"Similar Products You May Like"**:
     - *Explaining to examiners:* "This is powered by our Scikit-learn **TF-IDF vectorizer and Cosine Similarity model**. It analyzed the description, brand, and specifications to recommend contextually similar tech accessories."
3. **Shopping Cart & Checkout:**
   - Click **"Add to Cart"**.
   - Navigate to the **Cart** (`/cart`), demonstrate quantity adjustment and real-time subtotal calculation.
   - Click **"Proceed to Checkout"**.
   - Fill in shipping address details, choose **Commercial Bank of Ethiopia (CBE)** or **Telebirr**, and click **"Place Order"**.
   - The system creates the order under status `PENDING_PAYMENT` with an atomic transaction that decrements stock.
4. **Payment Evidence Submission:**
   - The user is redirected to the **Order Detail Page**.
   - Point out the alert: *"Payment Evidence Required"*.
   - Fill in the bank reference (e.g., `CBE-TX-99881122`), attach a receipt screenshot, and click **"Upload Payment Evidence"**.
   - The order status dynamically transitions to `PAYMENT_SUBMITTED`.

---

### Step 2: Store Manager Portal (Persona: `Store Manager`)

1. **Switch Persona:**
   - Click **"Store Manager"** on the floating Demo Switcher.
   - Notice how the navbar immediately updates to display manager navigation: **"Store Manager Dashboard"**.
2. **Analytics & Performance Overview:**
   - Navigate to `/manager`.
   - Point out key performance indicators (KPIs): Total Revenue, Total Orders, Active Catalog Items, and Low-Stock Warnings.
   - Show the interactive **Revenue Over Time (Line Chart)** and **Sales by Category (Doughnut Chart)** powered by Chart.js.
3. **Payment Verification Modal & Digital Receipt Trigger:**
   - Navigate to **"Orders & Payments"** (`/manager/orders`).
   - Find the order submitted by Abebe (status: `PAYMENT_SUBMITTED`).
   - Click **"Review Payment Evidence"**.
   - A modal opens showing the customer's transfer screenshot, bank name, reference ID, and amount.
   - Click **"Approve Payment"**.
   - *Explaining to examiners:* "Upon approval, the system transitions the order to `PAID`, writes an immutable record to the `accounts_auditlog` table, sends an in-app notification to the customer, and generates an official verifiable Digital Receipt."
4. **Inventory & Stock Management:**
   - Navigate to **"Inventory"** (`/manager/inventory`).
   - Demonstrate quick stock adjustment (Restock / Adjustment).
   - Point out how each adjustment is tied to a user ID and movement reason in the `StockMovement` table.
5. **AI Customer Segmentation (RFM + K-Means):**
   - Navigate to **"AI Customer Segments"** (`/manager/segmentation`).
   - *Explaining to examiners:* "Here is one of our primary machine learning contributions. The system extracts Recency, Frequency, and Monetary (RFM) metrics from the PostgreSQL database, standardizes them with `StandardScaler`, and applies the **K-Means clustering algorithm** to segment our shoppers into distinct behavioral tiers: *VIP Champions*, *Loyal Regulars*, *Potential Loyalists*, and *At-Risk Customers*."
   - Click **"Re-train / Run Segmentation"** to demonstrate live calculation.
6. **Data Export:**
   - Navigate to **"Reports & Export"** (`/manager/reports`).
   - Demonstrate one-click **Export Sales Report (CSV)** and **Export Inventory Audit (CSV)**.

---

### Step 3: Verified Digital Receipt Inspection (Persona: `Abebe`)

1. Switch back to **"Customer (Abebe)"**.
2. Click the bell icon in the navbar—show the new notification: *"Payment approved for order #ORD-XXXX! Official receipt generated."*
3. Open the order, then click **"View Official Receipt"** (`/orders/{id}/receipt`).
4. Show the formal digital receipt with:
   - Official Store Header & Verification Seal
   - Unique Receipt Number (`RCP-XXXX`)
   - Order Reference & Payment Method
   - Itemized table with quantities and totals
   - Authorized manager stamp
5. Click **"Print / Save PDF"** to preview the clean, professional print layout.

---

### Step 4: Administrator Capabilities (Persona: `Admin`)

1. Switch to **"Administrator"**.
2. Navigate to **"User Management"** (`/admin/users`).
3. Point out role-based account control: Administrators can promote users to Store Managers or demote them.
4. Open the **System Audit Logs** tab to show the immutable security ledger of all payment approvals, logins, and inventory changes.

---

## 💡 3. Anticipated Viva Defense Questions & Academic Answers

### Q1: Why did you choose TF-IDF and Cosine Similarity for recommendations instead of deep learning (e.g., neural collaborative filtering or transformers)?
> **Answer:**  
> "In an e-commerce catalog of early to mid-size inventory, text and metadata are the most informative features, and deep neural networks suffer severely from the **cold-start problem** when user interaction matrices are sparse. TF-IDF paired with Cosine Similarity provides deterministic, highly explainable, and computationally efficient recommendations ($O(N \cdot M)$ complexity) that run natively on catalog attributes without requiring millions of training epochs or dedicated GPU infrastructure."

---

### Q2: How does the system handle the 'Cold Start' problem for new users or new products?
> **Answer:**  
> "We implemented a tiered fallback strategy:
> 1. For a **new product** with zero purchase history, the **TF-IDF content-based model** matches its title, description, and tags against existing items immediately upon creation.
> 2. For a **new customer** who has placed zero orders, the system falls back to **Sales Velocity Trending Recommendations** (weighted by sales count, view count, and average rating) until sufficient interaction signals are captured in `recommendations_customeractivity`."

---

### Q3: How is the 'Frequently Bought Together' logic calculated?
> **Answer:**  
> "It is based on an **Order Item Co-Occurrence Matrix**. When querying recommendations for product $A$, the system looks across all completed orders containing product $A$ and aggregates the frequency of all other products $B$ within the same order. It normalizes this by total co-appearances to compute a conditional probability score:
> $$\text{Score}(B \mid A) = \frac{\text{Count}(A \cap B)}{\text{Count}(A)}$$
> The top products with the highest association scores are returned."

---

### Q4: How did you implement and evaluate the K-Means Customer Segmentation?
> **Answer:**  
> "We implemented the standard **RFM (Recency, Frequency, Monetary)** model:
> - **Recency:** Days elapsed since the last order.
> - **Frequency:** Count of unique completed orders.
> - **Monetary:** Total gross revenue spent by the customer.
> 
> Because monetary values are measured in hundreds of dollars while frequency is small single digits, we normalized the features using Scikit-learn's `StandardScaler` ($z = (x - \mu)/\sigma$). We then fit a `KMeans` model with $k=4$ clusters. The clusters naturally map to *VIP Champions*, *Loyal Regulars*, *Potential Loyalists*, and *At-Risk Customers*, allowing store managers to devise targeted marketing discounts."

---

### Q5: How do you prevent race conditions or stock overselling during simultaneous checkouts?
> **Answer:**  
> "In `backend/orders/views.py`, the checkout process is wrapped inside a database transaction using Django's `transaction.atomic()`. Furthermore, during cart item iteration, each product row is locked at the PostgreSQL level using `select_for_update()`. This ensures that two concurrent shoppers cannot purchase the last unit of an item simultaneously; the second transaction will either wait or receive an `InsufficientStock` exception."

---

### Q6: Why did you implement manual payment evidence upload rather than a mock credit card form?
> **Answer:**  
> "In real-world developing markets such as Ethiopia, local banking apps (Telebirr, CBE Birr, Awash Bank) require manual fund transfers where customers submit transaction screenshots and reference numbers. Our architecture solves this exact business problem by introducing an end-to-end verification lifecycle:
> 1. Customer uploads receipt image and reference code.
> 2. Store Manager reviews proof in an image verification modal.
> 3. Store Manager approves/rejects with audit logging.
> 4. Verified orders trigger an official Digital Receipt with printable invoice formatting."
