
import axios from 'axios';

// ── Base URL ──────────────────────────────────────────────────────
const ROOT_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.API_BASE_URL ;
const API_V1 = `${ROOT_URL}/api/v1`;

// ── Token storage ────────────────────────────────────────────────
const TokenStore = {
  get: () => localStorage.getItem('vc_access'),
   set: (t) => localStorage.setItem('vc_access', t),
  getRefresh: () => localStorage.getItem('vc_refresh'),
  setRefresh: (t) => localStorage.setItem('vc_refresh', t),
  clear: () => {
    localStorage.removeItem('vc_access');
    localStorage.removeItem('vc_refresh');
  },
};

export { TokenStore };

// ── Performance: Request deduplication cache ────────────────────
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

// ── Performance: Cache for GET requests ──────────────────────────
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
});

// ── Request interceptor ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = TokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor ─────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Cache GET requests
    if (response.config.method === 'get') {
      const key = `${response.config.url}-${JSON.stringify(response.config.params || {})}`;
      setCached(key, response.data);
    }
    return response;
  },
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
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
        const refreshToken = TokenStore.getRefresh();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_V1}/auth/refresh-token`, {
          refreshToken,
        });
        const newToken = data.accessToken;
        TokenStore.set(newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
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
    return Promise.reject(error);
  }
);

// ── Helper: extract error message ────────────────────────────────
export const getApiError = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.errors?.[0]?.msg ||
  err?.message ||
  'Something went wrong';

// ═══════════════════════════════════════════════════════════════════
// AUTH  /auth
// ═══════════════════════════════════════════════════════════════════
export const auth = {
  
  //exchangeGoogleCode: (code) => api.post('/auth/google/exchange', { code }),
  //googleAuthUrl: () => `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/google`,

  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  adminLogin: (data) => api.post('/auth/admin-login', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
 resetPassword: ({ token, password }) => api.post('/auth/reset-password', { token, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
};

// ═══════════════════════════════════════════════════════════════════
// PRODUCTS  /products
// ═══════════════════════════════════════════════════════════════════
export const products = {
  // Public
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
  
  // Deliberately NOT cached (unlike list/get/getById above) — this
  // exists specifically to get PRICES AS OF RIGHT NOW for cart items,
  // which are otherwise stuck at whatever price was snapshotted when
  // "Add to Cart" was clicked (see cartStore.js's addItem). Caching
  // this would defeat the entire point of it.
  revalidateCart: (productIds) =>
    api.post('/products/revalidate-cart', { productIds }),
  
  // Mutations
  addReview: (id, data) => api.post(`/products/${id}/reviews`, data),
  
  // Admin
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
// PROMO CODES / COUPONS  /promo or /coupons
// ═══════════════════════════════════════════════════════════════════
export const promoCodes = {
  // Public - Validate a promo code
  validate: (code) => api.post('/promo/validate', { code }),
  // Or if your endpoint is /coupons/validate
  validateCoupon: (code) => api.post('/coupons/validate', { code }),
  
  // Apply to cart/checkout
  applyToCart: (code) => api.post('/cart/apply-promo', { code }),
  removeFromCart: () => api.delete('/cart/remove-promo'),
  
  // Get discount details
  getDiscount: (code) => api.get(`/promo/${code}`),
  
  // Admin - Manage promo codes
  list:         (params) => api.get('/admin/promo-codes', { params }),
  create:       (data)   => api.post('/admin/promo-codes', data),
  update:       (id, data) => api.patch(`/admin/promo-codes/${id}`, data),
  toggleActive: (id)     => api.patch(`/admin/promo-codes/${id}/toggle`),
  delete:       (id)     => api.delete(`/admin/promo-codes/${id}`),
  getStats: (id) => api.get(`/admin/promo-codes/${id}/stats`),
};

// Alias for backward compatibility
export const coupons = promoCodes;

// ═══════════════════════════════════════════════════════════════════
// ORDERS  /orders
// ═══════════════════════════════════════════════════════════════════
export const orders = {
  // Customer
  myOrders: (params = {}) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  pay: (id, data) => api.post(`/orders/${id}/pay`, data),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  recent: (limit = 10) => api.get('/orders', { params: { limit, sort: '-createdAt' } }),
  
  // Admin
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
  // api/client.js
verifyStatus: (reference) =>
  api.get(`/payments/${encodeURIComponent(reference)}/status`),
};

// ===========================================================================
// SHIPPING /shipping
// Dedicated shipping API boundary for diagnosing fee, zone, and location
// resolution independently from admin settings and payment creation.
// ===========================================================================
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
  // Alias: ProfilePage calls usersApi.newsletter(), which did not exist.
  newsletter: (data) => api.post('/users/newsletter', data),
  
  // Get user's available promo codes
  getAvailablePromoCodes: () => api.get('/users/promo-codes'),
  // e.g. on orders or payments client 
validatePromo: (code) =>
  api.post('/promo-codes/validate', { code }),
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN  /admin
// ═══════════════════════════════════════════════════════════════════
export const admin = {
  // Dashboard — pass period so the UI filter works
  dashboard: (period = '7d') =>
    api.get('/admin/stats', { params: { period } }),

  revenueAnalytics: (months) =>
    api.get('/admin/reports/revenue', { params: { months } }),

  topProducts: (limit = 10) =>
    api.get('/admin/reports/top-products', { params: { limit } }),

  categoryAnalytics: () =>
    api.get('/admin/stats/categoryBreakdown'),


  // Notifications (optional — return [] if backend not ready)
notifications: (params) => api.get('/admin/notifications', { params }),
markNotificationsRead: () => api.patch('/admin/notifications/read-all'),

  // Users
  allUsers: (params) => api.get('/admin/users', { params }),
  toggleUserStatus: (id) => api.patch(`/admin/users/${id}/status`),
  getCustomerById: (id) => api.get(`/admin/users/${id}`),
  updateUserRole: (id, data) => api.patch(`/admin/users/${id}/role`, data),
  
  // Products
  updateStock: (id, stock) => api.patch(`/admin/products/${id}/stock`, { stock }),
  toggleReviewVisibility: (productId, reviewId) =>
    api.patch(`/admin/products/${productId}/reviews/${reviewId}/visibility`),
  
  // Reviews
  reviews: {
    list: (params) => api.get('/admin/reviews', { params }),
    approve: (id) => api.patch(`/admin/reviews/${id}/approve`),
    reject: (id) => api.patch(`/admin/reviews/${id}/reject`),
  },
  
  // Orders
  notifyShipped: (id) => api.post(`/admin/orders/${id}/notify-shipped`),
  
  // Categories
  // ── CATEGORIES (CORRECTED PATHS) ──
  // Public
  getCategories: () => api.get('/categories'),
  
  // Admin (paths are /categories/admin, not /admin/categories)
  getAdminCategories: (includeInactive) => 
    api.get('/categories/admin', { params: { includeInactive } }),
  
  createCategory: (data) => api.post('/categories/admin', data),
  
  updateCategory: (id, data) => api.put(`/categories/admin/${id}`, data),
  
  deleteCategory: (id) => api.delete(`/categories/admin/${id}`),
  // Settings
  changePassword: (data) => api.put('/admin/change-password', data),
  changeAdminPassword: (data) => api.put('/admin/settings/password', data),
 
  monitoring: (windowMinutes = 60) =>
    api.get('/admin/monitoring', { params: { windowMinutes } }),

  // list: GET /admin/promo-codes?page=1&limit=20&active=true
listPromoCodes: (params = {}) =>
  api.get('/admin/promo-codes', { params }),

// create
createPromoCode: (body) =>
  api.post('/admin/promo-codes', body),

// update
updatePromoCode: (id, body) =>
  api.patch(`/admin/promo-codes/${id}`, body),

update: (id, body) => api.put(`/admin/promo-codes/${id}`, body),

// soft-delete / deactivate
deletePromoCode: (id) =>
  api.delete(`/admin/promo-codes/${id}`),

toggleActive: (id, isActive) =>
  api.patch(`/admin/promo-codes/${id}/toggle`, { isActive }),
};

// ═══════════════════════════════════════════════════════════════════
// CART  /cart (if using server-side cart)
// ═══════════════════════════════════════════════════════════════════
export const cart = {
  get: () => api.get('/cart'),
  addItem: (data) => api.post('/cart/items', data),
  updateItem: (id, data) => api.patch(`/cart/items/${id}`, data),
  removeItem: (id) => api.delete(`/cart/items/${id}`),
  clear: () => api.delete('/cart'),
  // Promo code integration
  applyPromo: (code) => api.post('/cart/apply-promo', { code }),
  removePromo: () => api.delete('/cart/remove-promo'),
};

// ═══════════════════════════════════════════════════════════════════
// EXPORT CACHE UTILITIES
// ═══════════════════════════════════════════════════════════════════
export const cacheUtils = {
  clearAll: () => cache.clear(),
  clearProductCache: products.clearCache,
  getCacheSize: () => cache.size,
};

export default api;