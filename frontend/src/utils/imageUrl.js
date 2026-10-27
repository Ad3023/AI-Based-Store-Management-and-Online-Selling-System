/**
 * Helper to resolve media URLs (product images, user avatars) from Django backend
 */
export const getMediaUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const envBackend = import.meta.env.VITE_BACKEND_URL || 
    (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : '');
  const backendOrigin = (envBackend || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  return `${backendOrigin}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const getDefaultAvatar = (name = 'User') => {
  const initial = (name || 'U').charAt(0).toUpperCase();
  // Clean SVG avatar data URI with deep navy background and white text
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="64" fill="%230b1a2d"/><text x="50%" y="54%" font-family="Arial,sans-serif" font-size="52" font-weight="bold" fill="%23ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
};
