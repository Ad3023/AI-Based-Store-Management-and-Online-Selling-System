import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useCart } from '../context/CartContext';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const AIShoppingAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "Hello! I am your Ethio Tech Market AI Personal Shopping Assistant. Tell me what you're looking for, your budget in ETB, or ask me to recommend and compare hardware in our catalog.",
      products: [],
      suggestions: [
        "Laptops for programming under ETB 80,000",
        "Smartphones with best camera",
        "Noise-cancelling headphones for travel",
        "Accessories under ETB 5,000"
      ]
    }
  ]);
  const [cartSuccessMessage, setCartSuccessMessage] = useState('');

  const { addToCart } = useCart();
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    // Add user message
    const newMessages = [...messages, { sender: 'user', text: textToSend }];
    setMessages(newMessages);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.post('recommendations/assistant/', { query: textToSend });
      setMessages([
        ...newMessages,
        {
          sender: 'assistant',
          text: res.data.response,
          products: res.data.products || [],
          suggestions: res.data.suggestions || []
        }
      ]);
    } catch (err) {
      console.error('AI assistant error:', err);
      setMessages([
        ...newMessages,
        {
          sender: 'assistant',
          text: "I'm having trouble connecting to the catalog right now. Please try again or browse our full shop catalog.",
          products: [],
          suggestions: ["Show all products", "Smartphones", "Laptops"]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCartConfirm = async (product) => {
    try {
      await addToCart(product, 1);
      setCartSuccessMessage(`Added ${product.name} to cart!`);
      setTimeout(() => setCartSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        sender: 'assistant',
        text: "Conversation reset. How can I help you discover technology today?",
        products: [],
        suggestions: [
          "Laptops for programming under ETB 80,000",
          "Smartphones with best camera",
          "Wireless earbuds with long battery",
          "Compare top laptop deals"
        ]
      }
    ]);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div
        className="position-fixed end-0 bottom-0 mb-4 me-4 z-3"
        style={{ zIndex: 1040 }}
      >
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="btn rounded-pill px-3.5 py-2.5 text-white d-flex align-items-center gap-2 shadow-lg border-0 transition-all hover:scale-105"
            style={{
              backgroundColor: '#1b64da',
              backgroundImage: 'linear-gradient(135deg, #1b64da 0%, #00a8ff 100%)',
              boxShadow: '0 8px 25px rgba(27, 100, 218, 0.45)',
            }}
            aria-label="Open AI Shopping Assistant"
          >
            <div
              className="rounded-circle d-flex align-items-center justify-content-center bg-white text-primary"
              style={{ width: '28px', height: '28px' }}
            >
              <i className="bi bi-stars fs-6"></i>
            </div>
            <span className="fw-bold text-xs">AI Assistant</span>
            <span
              className="badge rounded-pill bg-warning text-dark text-[9px] px-1.5 py-0.5 fw-bold"
              style={{ letterSpacing: '0.02em' }}
            >
              ETB
            </span>
          </button>
        )}
      </div>

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div
          className="position-fixed end-0 bottom-0 mb-3 me-3 me-md-4 rounded-4 shadow-2xl overflow-hidden d-flex flex-column z-3 border border-dark border-opacity-20 animate-fadeIn"
          style={{
            zIndex: 1050,
            width: '380px',
            maxWidth: '94vw',
            height: '560px',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 50px rgba(11, 26, 45, 0.35)',
          }}
        >
          {/* Header */}
          <div
            className="p-3 text-white d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#0c1e33', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{ width: '32px', height: '32px', backgroundColor: '#1b64da' }}
              >
                <i className="bi bi-robot text-xs"></i>
              </div>
              <div>
                <h6 className="fw-bold text-xs mb-0 text-white">Ethio Tech AI Assistant</h6>
                <div className="d-flex align-items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="badge rounded-circle p-1 bg-emerald-400"></span>
                  <span>Grounded in Real Catalog</span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="btn btn-sm text-slate-400 hover:text-white p-1"
                title="Reset Conversation"
                aria-label="Reset Conversation"
              >
                <i className="bi bi-arrow-counterclockwise fs-6"></i>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-sm text-slate-400 hover:text-white p-1"
                title="Close Assistant"
                aria-label="Close Assistant"
              >
                <i className="bi bi-x-lg fs-6"></i>
              </button>
            </div>
          </div>

          {/* Cart Confirmation Notice */}
          {cartSuccessMessage && (
            <div className="bg-emerald-600 text-white text-[11px] py-1 px-3 d-flex align-items-center justify-content-between">
              <span><i className="bi bi-check-circle-fill me-1"></i> {cartSuccessMessage}</span>
              <Link to="/cart" className="text-white text-decoration-underline fw-bold">Cart &rarr;</Link>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-grow-1 p-3 overflow-y-auto bg-slate-50 d-flex flex-column gap-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`d-flex flex-column ${msg.sender === 'user' ? 'align-items-end' : 'align-items-start'}`}
              >
                {/* Bubble */}
                <div
                  className={`p-3 rounded-4 text-xs ${
                    msg.sender === 'user'
                      ? 'text-white rounded-bottom-end-0'
                      : 'text-slate-800 bg-white shadow-sm border border-slate-200 rounded-bottom-start-0'
                  }`}
                  style={{
                    maxWidth: '88%',
                    backgroundColor: msg.sender === 'user' ? '#1b64da' : '#ffffff',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {msg.text}
                </div>

                {/* Embedded Real Products (if any) */}
                {msg.products && msg.products.length > 0 && (
                  <div className="d-flex flex-column gap-2 mt-2 w-100" style={{ maxWidth: '94%' }}>
                    {msg.products.map((p) => (
                      <div
                        key={p.id}
                        className="card border border-slate-200 shadow-sm rounded-3 p-2 bg-white d-flex flex-row align-items-center gap-2"
                      >
                        <img
                          src={getProductImage(p)}
                          alt={p.name}
                          className="rounded-2 object-fit-cover flex-shrink-0 border"
                          style={{ width: '48px', height: '48px' }}
                        />
                        <div className="flex-grow-1 min-w-0">
                          <Link
                            to={`/products/${p.slug || p.id}`}
                            className="text-decoration-none text-slate-900 fw-bold text-xs d-block text-truncate"
                            onClick={() => setIsOpen(false)}
                          >
                            {p.name}
                          </Link>
                          <div className="d-flex align-items-center justify-content-between mt-1">
                            <span className="fw-bolder text-primary text-xs">
                              {formatETB(p.current_price || p.price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddToCartConfirm(p)}
                              disabled={p.stock === 0}
                              className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-0 text-[10px] fw-bold"
                            >
                              {p.stock > 0 ? '+ Add' : 'Out'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && idx === messages.length - 1 && !loading && (
                  <div className="d-flex flex-wrap gap-1 mt-2" style={{ maxWidth: '95%' }}>
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSend(sug)}
                        className="btn btn-outline-secondary btn-sm rounded-pill text-[10px] px-2.5 py-0.5 text-slate-600 bg-white"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="d-flex align-items-center gap-2 text-slate-500 text-xs py-2">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>Checking catalog prices, specs &amp; stock...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-top border-slate-200 d-flex align-items-center gap-1.5"
          >
            <input
              type="text"
              className="form-control rounded-pill text-xs py-2 px-3 border-slate-300"
              placeholder="Ask for programming laptops, camera phones..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center text-white p-2"
              style={{ width: '36px', height: '36px', backgroundColor: '#1b64da' }}
              aria-label="Send query"
            >
              <i className="bi bi-send-fill text-xs"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIShoppingAssistant;
