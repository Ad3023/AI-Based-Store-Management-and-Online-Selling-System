import React, { createContext, useContext, useState, useEffect } from 'react';

const CompareContext = createContext();

export const CompareProvider = ({ children }) => {
  const [compareList, setCompareList] = useState(() => {
    try {
      const saved = localStorage.getItem('ethio_compare_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ethio_compare_list', JSON.stringify(compareList));
    } catch (err) {
      console.error('Failed to save compare list', err);
    }
  }, [compareList]);

  const addToCompare = (product) => {
    if (!product) return;
    setCompareList((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      if (prev.length >= 4) {
        alert("You can compare up to 4 products at a time. Please remove one before adding another.");
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeFromCompare = (productId) => {
    setCompareList((prev) => prev.filter((p) => p.id !== productId));
  };

  const clearCompare = () => {
    setCompareList([]);
  };

  const isInCompare = (productId) => {
    return compareList.some((p) => p.id === productId);
  };

  const toggleCompare = (product) => {
    if (isInCompare(product.id)) {
      removeFromCompare(product.id);
    } else {
      addToCompare(product);
    }
  };

  return (
    <CompareContext.Provider
      value={{
        compareList,
        compareCount: compareList.length,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        toggleCompare,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
};

export default CompareContext;
