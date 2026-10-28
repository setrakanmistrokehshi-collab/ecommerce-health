import axios from 'axios';

// ── Base URL ──────────────────────────────────────────────────────
const ROOT_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.API_BASE_URL;
const API_V1 = `${ROOT_URL}/api/v1`;

// ── Token storage ─────────────────────────────────────────────────
// Access token: localStorage (Authorization header).
// Refresh token: httpOnly cookie set by the API — never stored here.
const TokenStore = {
  get: () => localStorage.getItem('vc_access'),
  set: (t) => {
    if (t) localStorage.setItem('vc_access', t);
    else localStorage.removeItem('vc_access');
  },
  /** @deprecated Refresh is an httpOnly cookie. Always returns null. */
  getRefresh: () => null,
  /** @deprecated No-op for backward compatibility with authStore. */
  setRefresh: () => {},
  clear: () => {
    localStorage.removeItem('vc_access');
    localStorage.removeItem('vc_refresh'); // remove legacy key if present
  },
};

export { TokenStore };

// ── Performance: Request deduplication cache ─────────────────────
const pendingRequests = new Map();

const dedupeRequest = async (config) => {
  const key = `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = api(config).finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
};

// ── Performance: Cache for GET requests ───────────────────────────
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCached = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// ── Axios instance ────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_V1,
  timeout: 61000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly refresh cookie cross-origin
});

// ── Request interceptor ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = TokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor (cookie-based refresh) ───────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get') {
      const key = `${response.config.url}-${JSON.stringify(response.config.params || {})}`;
      setCached(key, response.data);
    }
    return response;
  },
  async (error) => {
    const original = error.config;

    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Avoid infinite loop on the refresh endpoint itself
    if (String(original.url || '').includes('/auth/refresh-token')) {
      TokenStore.clear();
      window.dispatchEvent(new CustomEvent('vc:session-expired'));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Refresh token is sent automatically via httpOnly cookie
      const { data } = await axios.post(
        `${API_V1}/auth/refresh-token`,
        {},
        { withCredentials: true }
      );

      const newToken = data.accessToken;
      if (!newToken) throw new Error('No access token in refresh response');

      TokenStore.set(newToken);
      processQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      TokenStore.clear();
      window.dispatchEvent(new CustomEvent('vc:session-expired'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Helper: extract error message ─────────────────────────────────
export const getApiError = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.errors?.[0]?.msg ||
  err?.message ||
  'Something went wrong';

// ═══════════════════════════════════════════════════════════════════
// AUTH  /auth
// ═══════════════════════════════════════════════════════════════════
export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  adminLogin: (data) => api.post('/auth/admin-login', data),
  /** Cookie-based; optional arg ignored (compat with old call sites). */
  refreshToken: () =>
    api.post('/auth/refresh-token', {}, { withCredentials: true }),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) =>
    api.post('/auth/reset-password', { token, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout', {}, { withCredentials: true }),
  logoutAll: () => api.post('/auth/logout-all', {}, { withCredentials: true }),
};

// ═══════════════════════════════════════════════════════════════════
// PRODUCTS  /products
// ═══════════════════════════════════════════════════════════════════
export const products = {
  list: async (params = {}) => {
    const { page = 1, limit = 12, ...filters } = params;
    const queryParams = { page, limit, ...filters };

    const shouldCache = page <= 3;
    const cacheKey = `products-list-${JSON.stringify(queryParams)}`;

    if (shouldCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const response = await dedupeRequest({
      method: 'get',
      url: '/products',
      params: queryParams,
    });

    if (shouldCache) {
      setCached(cacheKey, response);
    }

    return response;
  },

  get: async (slug) => {
    const cacheKey = `product-${slug}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await api.get(`/products/${slug}`);
    setCached(cacheKey, response);
    return response;
  },

  getById: async (id) => {
    const cacheKey = `product-id-${id}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await api.get(`/products/${id}`);
    setCached(cacheKey, response);
    return response;
  },

  revalidateCart: (productIds) =>
    api.post('/products/revalidate-cart', { productIds }),

  addReview: (id, data) => api.post(`/products/${id}/reviews`, data),

  create: (data) => api.post('/products', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  uploadImage: (id, formData) =>
    api.post(`/products/${id}/images`, formData, {
      headers: { 'Content-Type': undefined },
    }),
  updateStock: (id, stock) => api.patch(`/products/${id}/stock`, { stock }),

  clearCache: () => {
    for (const key of cache.keys()) {
      if (key.startsWith('product-') || key.startsWith('products-')) {
        cache.delete(key);
      }
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// PROMO CODES / COUPONS
// ═══════════════════════════════════════════════════════════════════
export const promoCodes = {
  validate: (code) => api.post('/promo/validate', { code }),
  validateCoupon: (code) => api.post('/coupons/validate', { code }),
  applyToCart: (code) => api.post('/cart/apply-promo', { code }),
  removeFromCart: () => api.delete('/cart/remove-promo'),
  getDiscount: (code) => api.get(`/promo/${code}`),
  list: (params) => api.get('/admin/promo-codes', { params }),
  create: (data) => api.post('/admin/promo-codes', data),
  update: (id, data) => api.patch(`/admin/promo-codes/${id}`, data),
  toggleActive: (id) => api.patch(`/admin/promo-codes/${id}/toggle`),
  delete: (id) => api.delete(`/admin/promo-codes/${id}`),
  getStats: (id) => api.get(`/admin/promo-codes/${id}/stats`),
};

export const coupons = promoCodes;

// ═══════════════════════════════════════════════════════════════════
// ORDERS  /orders
// ═══════════════════════════════════════════════════════════════════
export const orders = {
  myOrders: (params = {}) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  pay: (id, data) => api.post(`/orders/${id}/pay`, data),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  recent: (limit = 10) =>
    api.get('/orders', { params: { limit, sort: '-createdAt' } }),
  all: (params) => api.get('/admin/orders', { params }),
  updateStatus: (id, data) => api.patch(`/admin/orders/${id}/status`, data),
  notifyShipped: (id) => api.post(`/admin/orders/${id}/notify-shipped`),
};

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS  /payments
// ═══════════════════════════════════════════════════════════════════
export const payments = {
  validatePromo: (code) => api.post('/payments/validate-promo', { code }),
  checkout: (data) => api.post('/payments/checkout', data),
  verifyStatus: (reference) =>
    api.get(`/payments/${encodeURIComponent(reference)}/status`),
};

// ═══════════════════════════════════════════════════════════════════
// SHIPPING  /shipping
// ═══════════════════════════════════════════════════════════════════
export const shipping = {
  getConfig: () => api.get('/shipping/config'),
  quote: (data) => api.post('/shipping/quote', data),
};

// ═══════════════════════════════════════════════════════════════════
// CURRENCIES  /currencies
// ═══════════════════════════════════════════════════════════════════
export const currencies = {
  list: () => api.get('/currencies'),
};

// ═══════════════════════════════════════════════════════════════════
// USERS  /users
// ═══════════════════════════════════════════════════════════════════
export const users = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.patch('/users/profile', data),
  changePassword: (data) => api.patch('/users/change-password', data),
  addAddress: (data) => api.post('/users/addresses', data),
  removeAddress: (id) => api.delete(`/users/addresses/${id}`),
  toggleWishlist: (productId) => api.post(`/users/wishlist/${productId}`),
  subscribeNewsletter: (data) => api.post('/users/newsletter', data),
  newsletter: (data) => api.post('/users/newsletter', data),
  getAvailablePromoCodes: () => api.get('/users/promo-codes'),
  validatePromo: (code) => api.post('/promo-codes/validate', { code }),
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN  /admin
// ═══════════════════════════════════════════════════════════════════
export const admin = {
  dashboard: (period = '7d') =>
    api.get('/admin/stats', { params: { period } }),

  revenueAnalytics: (months) =>
    api.get('/admin/reports/revenue', { params: { months } }),

  topProducts: (limit = 10) =>
    api.get('/admin/reports/top-products', { params: { limit } }),

  categoryAnalytics: () => api.get('/admin/stats/categoryBreakdown'),

  notifications: (params) => api.get('/admin/notifications', { params }),
  markNotificationsRead: () => api.patch('/admin/notifications/read-all'),

  allUsers: (params) => api.get('/admin/users', { params }),
  toggleUserStatus: (id) => api.patch(`/admin/users/${id}/status`),
  getCustomerById: (id) => api.get(`/admin/users/${id}`),
  updateUserRole: (id, data) => api.patch(`/admin/users/${id}/role`, data),

  updateStock: (id, stock) =>
    api.patch(`/admin/products/${id}/stock`, { stock }),
  toggleReviewVisibility: (productId, reviewId) =>
    api.patch(`/admin/products/${productId}/reviews/${reviewId}/visibility`),

  reviews: {
    list: (params) => api.get('/admin/reviews', { params }),
    approve: (id) => api.patch(`/admin/reviews/${id}/approve`),
    reject: (id) => api.patch(`/admin/reviews/${id}/reject`),
  },

  notifyShipped: (id) => api.post(`/admin/orders/${id}/notify-shipped`),

  getCategories: () => api.get('/categories'),
  getAdminCategories: (includeInactive) =>
    api.get('/categories/admin', { params: { includeInactive } }),
  createCategory: (data) => api.post('/categories/admin', data),
  updateCategory: (id, data) => api.put(`/categories/admin/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/admin/${id}`),

  changePassword: (data) => api.put('/admin/change-password', data),
  changeAdminPassword: (data) => api.put('/admin/settings/password', data),

  monitoring: (windowMinutes = 60) =>
    api.get('/admin/monitoring', { params: { windowMinutes } }),

  listPromoCodes: (params = {}) => api.get('/admin/promo-codes', { params }),
  createPromoCode: (body) => api.post('/admin/promo-codes', body),
  updatePromoCode: (id, body) => api.patch(`/admin/promo-codes/${id}`, body),
  update: (id, body) => api.put(`/admin/promo-codes/${id}`, body),
  deletePromoCode: (id) => api.delete(`/admin/promo-codes/${id}`),
  toggleActive: (id, isActive) =>
    api.patch(`/admin/promo-codes/${id}/toggle`, { isActive }),
};

// ═══════════════════════════════════════════════════════════════════
// CART  /cart
// ═══════════════════════════════════════════════════════════════════
export const cart = {
  get: () => api.get('/cart'),
  addItem: (data) => api.post('/cart/items', data),
  updateItem: (id, data) => api.patch(`/cart/items/${id}`, data),
  removeItem: (id) => api.delete(`/cart/items/${id}`),
  clear: () => api.delete('/cart'),
  applyPromo: (code) => api.post('/cart/apply-promo', { code }),
  removePromo: () => api.delete('/cart/remove-promo'),
};

// ═══════════════════════════════════════════════════════════════════
// CACHE UTILITIES
// ═══════════════════════════════════════════════════════════════════
export const cacheUtils = {
  clearAll: () => cache.clear(),
  clearProductCache: products.clearCache,
  getCacheSize: () => cache.size,
};

export default api;