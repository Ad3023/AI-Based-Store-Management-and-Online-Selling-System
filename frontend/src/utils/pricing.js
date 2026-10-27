/**
 * Shared pricing and promotion evaluation utility for EthioTech Market.
 * 
 * Strict rule: A product ONLY has a discount if authorized by an active admin promotion
 * verified by the backend (product.has_promotion is true AND current_price < price).
 * Never use compare_at_price, mock data, or client calculations as proof of a discount.
 */

export const getProductPricing = (product) => {
  if (!product) {
    return {
      price: 0,
      currentPrice: 0,
      originalPrice: null,
      hasDiscount: false,
      discountLabel: null,
      promotionTitle: null,
      savingsAmount: 0,
    };
  }

  const basePrice = Number(product.price || 0);
  const currentPrice =
    product.current_price !== undefined && product.current_price !== null
      ? Number(product.current_price)
      : basePrice;

  // Strict rule: Only active promotions validated by backend count as discounts!
  const hasPromotion = Boolean(product.has_promotion) && currentPrice < basePrice;

  if (hasPromotion) {
    const savings = basePrice - currentPrice;
    let label = product.discount_label;
    if (!label) {
      const pct = Math.round((savings / basePrice) * 100);
      label = pct > 0 ? `-${pct}%` : null;
    }

    return {
      price: currentPrice, // The actual payable selling price
      currentPrice: currentPrice,
      originalPrice: basePrice, // Strikethrough price
      hasDiscount: true,
      discountLabel: label,
      promotionTitle: product.promotion_title || null,
      savingsAmount: savings,
    };
  }

  // Normal product without active promotion
  return {
    price: basePrice,
    currentPrice: basePrice,
    originalPrice: null,
    hasDiscount: false,
    discountLabel: null,
    promotionTitle: null,
    savingsAmount: 0,
  };
};
