import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const GUEST_CART_STORAGE_KEY = 'ethio_guest_cart';

const loadGuestCart = () => {
  try {
    const saved = localStorage.getItem(GUEST_CART_STORAGE_KEY) || localStorage.getItem('nexus_guest_cart');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // fallback
  }
  return { items: [], total_price: '0.00', total_items: 0 };
};

const saveGuestCart = (cart) => {
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('Failed to save guest cart', err);
  }
};

export const CartProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [cart, setCart] = useState(loadGuestCart);
  const [loading, setLoading] = useState(false);

  // Sync guest cart to backend upon login
  const syncGuestCartToBackend = async (guestCart) => {
    if (user?.role === 'admin') return;
    if (!guestCart.items || guestCart.items.length === 0) return;
    try {
      for (const item of guestCart.items) {
        const pid = item.product_id || item.product?.id;
        if (pid) {
          await api.post('orders/cart/', {
            product_id: pid,
            quantity: item.quantity || 1,
          });
        }
      }
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to sync guest cart items to user account:', err);
    }
  };

  const fetchCart = useCallback(async () => {
    if (token && user?.role === 'admin') {
      // Administrators have personal shopping disabled
      setCart({ items: [], total_price: '0.00', total_items: 0 });
      return;
    }

    if (token && user?.role === 'customer') {
      try {
        setLoading(true);
        // If guest cart exists, sync first
        const guest = loadGuestCart();
        if (guest.items && guest.items.length > 0) {
          await syncGuestCartToBackend(guest);
        }
        const res = await api.get('orders/cart/');
        setCart(res.data);
      } catch (err) {
        console.error('Failed to load server cart', err);
      } finally {
        setLoading(false);
      }
    } else if (!token || user?.role !== 'admin') {
      // Guest mode (unauthenticated)
      const guest = loadGuestCart();
      setCart(guest);
    } else {
      setCart({ items: [], total_price: '0.00', total_items: 0 });
    }
  }, [token, user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productOrId, quantity = 1, productObj = null) => {
    if (user?.role === 'admin') {
      throw new Error('Administrators are restricted from personal shopping and cart operations.');
    }

    const productId = typeof productOrId === 'object' && productOrId !== null ? productOrId.id : productOrId;
    const resolvedProduct = typeof productOrId === 'object' && productOrId !== null ? productOrId : productObj;

    if (token && user?.role === 'customer') {
      // Authenticated server cart
      const res = await api.post('orders/cart/', { product_id: productId, quantity });
      setCart(res.data);
      return res.data;
    } else {
      // Guest local cart
      const current = loadGuestCart();
      const existingIdx = current.items.findIndex(
        (it) => (it.product_id || it.product?.id) === productId
      );

      let updatedItems = [...current.items];
      if (existingIdx >= 0) {
        const item = updatedItems[existingIdx];
        const newQty = item.quantity + quantity;
        const price = Number(item.product?.price || 0);
        updatedItems[existingIdx] = {
          ...item,
          quantity: newQty,
          subtotal: (price * newQty).toFixed(2),
        };
      } else {
        const price = Number(resolvedProduct?.price || 0);
        const newItem = {
          id: `guest-${productId}-${Date.now()}`,
          product: resolvedProduct || { id: productId, name: 'Product', price: price },
          product_id: productId,
          quantity: quantity,
          subtotal: (price * quantity).toFixed(2),
          added_at: new Date().toISOString(),
        };
        updatedItems.push(newItem);
      }

      const totalItems = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
      const totalPrice = updatedItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0).toFixed(2);
      const newCart = { items: updatedItems, total_items: totalItems, total_price: totalPrice };
      saveGuestCart(newCart);
      setCart(newCart);
      return newCart;
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (user?.role === 'admin') {
      throw new Error('Administrators cannot modify cart.');
    }

    if (token && user?.role === 'customer') {
      const res = await api.put('orders/cart/', { item_id: itemId, quantity });
      setCart(res.data);
      return res.data;
    } else {
      const current = loadGuestCart();
      let updatedItems = current.items.map((it) => {
        if (it.id === itemId) {
          const price = Number(it.product?.price || 0);
          return {
            ...it,
            quantity: quantity,
            subtotal: (price * quantity).toFixed(2),
          };
        }
        return it;
      });

      const totalItems = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
      const totalPrice = updatedItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0).toFixed(2);
      const newCart = { items: updatedItems, total_items: totalItems, total_price: totalPrice };
      saveGuestCart(newCart);
      setCart(newCart);
      return newCart;
    }
  };

  const removeFromCart = async (itemId) => {
    if (user?.role === 'admin') {
      throw new Error('Administrators cannot modify cart.');
    }

    if (token && user?.role === 'customer') {
      const res = await api.delete(`orders/cart/`, { data: { item_id: itemId } });
      setCart(res.data);
      return res.data;
    } else {
      const current = loadGuestCart();
      const updatedItems = current.items.filter((it) => it.id !== itemId);
      const totalItems = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
      const totalPrice = updatedItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0).toFixed(2);
      const newCart = { items: updatedItems, total_items: totalItems, total_price: totalPrice };
      saveGuestCart(newCart);
      setCart(newCart);
      return newCart;
    }
  };

  const clearCart = async () => {
    if (user?.role === 'admin') {
      setCart({ items: [], total_price: '0.00', total_items: 0 });
      return;
    }

    if (token && user?.role === 'customer') {
      const res = await api.delete(`orders/cart/`);
      setCart(res.data);
      return res.data;
    } else {
      const emptyCart = { items: [], total_price: '0.00', total_items: 0 };
      saveGuestCart(emptyCart);
      setCart(emptyCart);
      return emptyCart;
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount: user?.role === 'admin' ? 0 : (cart.total_items || 0),
        cartTotal: user?.role === 'admin' ? '0.00' : (cart.total_price || '0.00'),
        loading,
        fetchCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
