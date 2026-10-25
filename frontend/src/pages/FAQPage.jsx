import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQPage = () => {
  const [activeCategory, setActiveCategory] = useState('payments');

  const faqs = {
    payments: [
      {
        q: 'How does payment with Chapa work?',
        a: 'When you select "Pay with Chapa" during checkout, NexusStore AI connects to the secure Chapa payment gateway. You are redirected to a verified payment interface supporting local banks and Telebirr. Once completed, Chapa immediately notifies our Django backend, our server validates the transaction amount and currency (ETB), marks your order as paid, and issues your verifiable digital receipt instantly.'
      },
      {
        q: 'Can I pay via manual CBE or Telebirr transfer?',
        a: 'Yes! NexusStore AI supports manual bank transfers as an intentional alternative payment method. After placing your order, visit your Order Detail page, upload your transfer screenshot, enter your transaction reference ID, and submit. A Store Manager will review your evidence and approve it.'
      },
      {
        q: 'How do digital receipts work?',
        a: 'Once your payment is confirmed (either automatically by Chapa or verified by a Store Manager), the system generates an official tamper-proof digital receipt with a unique receipt code (e.g., RCP-20261021-XXXXXX). You can view, download, or print it anytime from your Orders page.'
      }
    ],
    shipping: [
      {
        q: 'What are the delivery options and fees?',
        a: 'We offer three shipping tiers: 1) Standard Addis Ababa City Dispatch (50 ETB, 1-2 business days), 2) Addis Ababa Express Same-Day Delivery (100 ETB), and 3) Regional Insured Courier to Hawassa, Adama, Bahir Dar, and regional hubs (150 ETB, 2-3 business days).'
      },
      {
        q: 'How can I track my package?',
        a: 'Visit our "Track Order" page in the navigation bar. Enter your unique order number (e.g., ORD-20261021-XXXXXX) to view real-time shipping milestones from preparation to courier dispatch and doorstep arrival.'
      }
    ],
    ai: [
      {
        q: 'How do AI recommendations work on NexusStore AI?',
        a: 'Our recommendation engine uses three algorithmic models built with Scikit-learn: 1) Content-Based TF-IDF and Cosine Similarity, which analyzes product specs and descriptions to suggest contextually similar tech, 2) Order Item Co-occurrence Matrix, which computes what previous customers bought together, and 3) RFM K-Means clustering, which helps managers group customer buying habits into VIP, regular, and growing shopper segments.'
      },
      {
        q: 'Can anonymous visitors get recommendations?',
        a: 'Yes! For visitors who have not logged in, our AI engine falls back to trending velocity algorithms based on real order frequencies and review ratings so you always discover the most popular hardware.'
      }
    ],
    orders: [
      {
        q: 'Can I browse and save products without an account?',
        a: 'Absolutely! You can browse all products, filter by category or price, search, add items to your cart, and maintain a wishlist without registering. You only need to sign in when you are ready to place an order or view your personal order history.'
      },
      {
        q: 'What is the return and warranty policy?',
        a: 'All electronics purchased through NexusStore AI carry an official 7-day hassle-free replacement warranty for defective hardware. Visit our Returns page for full instructions.'
      }
    ]
  };

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-5">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-question-circle-fill me-1"></i> Help Center & FAQs
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-slate-500 text-sm">
          Everything you need to know about shopping, Chapa payments, order tracking, and AI features on EthioTech Market.
        </p>
      </div>

      {/* Category Pills */}
      <div className="d-flex justify-content-center flex-wrap gap-2 mb-5">
        <button
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeCategory === 'payments' ? 'btn-ethio-primary text-white shadow-sm' : 'btn-light text-slate-700'
          }`}
          onClick={() => setActiveCategory('payments')}
        >
          <i className="bi bi-wallet2 me-1.5"></i> Payments & Chapa
        </button>
        <button
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeCategory === 'shipping' ? 'btn-ethio-primary text-white shadow-sm' : 'btn-light text-slate-700'
          }`}
          onClick={() => setActiveCategory('shipping')}
        >
          <i className="bi bi-truck me-1.5"></i> Shipping & Delivery
        </button>
        <button
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeCategory === 'ai' ? 'btn-ethio-primary text-white shadow-sm' : 'btn-light text-slate-700'
          }`}
          onClick={() => setActiveCategory('ai')}
        >
          <i className="bi bi-cpu me-1.5"></i> AI Recommendations
        </button>
        <button
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeCategory === 'orders' ? 'btn-ethio-primary text-white shadow-sm' : 'btn-light text-slate-700'
          }`}
          onClick={() => setActiveCategory('orders')}
        >
          <i className="bi bi-bag-check me-1.5"></i> Orders & Accounts
        </button>
      </div>

      {/* Accordion list */}
      <div className="max-w-3xl mx-auto mb-5">
        <div className="accordion accordion-flush" id="faqAccordion">
          {faqs[activeCategory].map((faq, idx) => (
            <div key={idx} className="accordion-item mb-3 border rounded-3xl overflow-hidden shadow-sm bg-white">
              <h2 className="accordion-header" id={`flush-heading-${idx}`}>
                <button
                  className="accordion-button collapsed fw-bold text-slate-900 text-sm py-3 px-4"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#flush-collapse-${idx}`}
                  aria-expanded="false"
                  aria-controls={`flush-collapse-${idx}`}
                >
                  {faq.q}
                </button>
              </h2>
              <div
                id={`flush-collapse-${idx}`}
                className="accordion-collapse collapse"
                aria-labelledby={`flush-heading-${idx}`}
                data-bs-parent="#faqAccordion"
              >
                <div className="accordion-body text-slate-600 text-xs px-4 pb-4" style={{ lineHeight: '1.7' }}>
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help box */}
      <div className="card border-0 shadow-sm rounded-4 p-4 text-center bg-slate-50 border border-slate-200 max-w-xl mx-auto">
        <h5 className="fw-bolder text-slate-900 mb-1">Still have questions?</h5>
        <p className="text-slate-500 text-xs mb-3">
          Our Addis Ababa support team is available via chat, email, or phone.
        </p>
        <div>
          <Link to="/contact" className="btn btn-primary rounded-full px-4 py-2 text-xs font-bold">
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
