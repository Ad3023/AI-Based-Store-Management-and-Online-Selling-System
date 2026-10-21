// Curated ultra-high-resolution electronics imagery for NexusStore AI
// Reliable, high-performance WebP images with transparent or dark tech styling

export const PRODUCT_IMAGE_MAP = {
  // Keychron Keyboard
  12: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
  // Logitech MX Master 3S
  11: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
  // Anker 737 Power Bank
  10: 'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?w=800&auto=format&fit=crop&q=80',
  // Galaxy Watch 6
  9: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80',
  // Apple Watch Ultra 2
  8: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
  // AirPods Pro 2
  7: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
  // Sony WH-1000XM5
  6: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
  // Dell XPS 15 OLED
  5: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
  // MacBook Pro 14 M3
  4: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
  // iPad Air 11-inch
  3: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80',
  // Galaxy S24 Ultra
  2: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&auto=format&fit=crop&q=80',
  // iPhone 15 Pro Max
  1: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
};

export const CATEGORY_IMAGE_MAP = {
  'Smartphones & Tablets': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
  'Laptops & Computers': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80',
  'Audio & Headphones': 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
  'Smart Wearables': 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
  'Accessories & Gadgets': 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
};

export const CATEGORY_ICON_MAP = {
  'Smartphones & Tablets': 'bi-phone',
  'Laptops & Computers': 'bi-laptop',
  'Audio & Headphones': 'bi-headphones',
  'Smart Wearables': 'bi-smartwatch',
  'Accessories & Gadgets': 'bi-plug-fill',
};

export const getProductImage = (product) => {
  if (product?.image) return product.image;
  if (product?.id && PRODUCT_IMAGE_MAP[product.id]) return PRODUCT_IMAGE_MAP[product.id];

  // Match by keyword in name if id is not directly mapped
  const name = (product?.name || '').toLowerCase();
  if (name.includes('iphone') || name.includes('galaxy s') || name.includes('phone')) {
    return 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('ipad') || name.includes('tablet')) {
    return 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('macbook') || name.includes('laptop') || name.includes('xps')) {
    return 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('airpods') || name.includes('wh-1000') || name.includes('headphone') || name.includes('audio')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('watch') || name.includes('wearable')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('keyboard')) {
    return 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('mouse')) {
    return 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('power bank') || name.includes('charger')) {
    return 'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?w=800&auto=format&fit=crop&q=80';
  }

  // Fallback by category
  if (product?.category_name && CATEGORY_IMAGE_MAP[product.category_name]) {
    return CATEGORY_IMAGE_MAP[product.category_name];
  }

  return 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&auto=format&fit=crop&q=80';
};
