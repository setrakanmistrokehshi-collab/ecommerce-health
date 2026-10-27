/**
 * src/api/adminApi.js
 *
 * Admin-specific API calls.
 * Uses the same Axios instance from api.js — inherits:
 *   ✅ JWT auto-attach (vc_access key)
 *   ✅ Auto refresh-token on 401
 *   ✅ Session-expired event dispatch
 *   ✅ 15s timeout

 */

import api from '../api/client';

// ── DASHBOARD ─────────────────────────────────────────────────────
export const getDashboardStats = (period = '7d') =>
  api.get('/admin/stats', { params: { period } }).then(r => r.data);

// ── REPORTS ──────────────────────────────────────────────────────
export const getRevenueReport = (period = 'monthly') =>
  api.get('/admin/reports/revenue', { params: { period } }).then(r => r.data);

export const getTopProducts = (limit = 9) =>
  api.get('/admin/reports/top-products', { params: { limit } }).then(r => r.data);

// ── ORDERS ───────────────────────────────────────────────────────
export const getOrders = (params = {}) =>
  api.get('/admin/orders', { params }).then(r => r.data);

export const getAdminOrderById = (id) =>
  api.get(`/admin/orders/${id}`).then(r => r.data);

export const updateOrderStatus = (id, status) =>
  api.patch(`/admin/orders/${id}/status`, { status }).then(r => r.data);

export const notifyShipped = (orderId) =>
  api.post(`/admin/orders/${orderId}/notify-shipped`).then(r => r.data);

// ── PRODUCTS ─────────────────────────────────────────────────────
export const getAdminProducts = (params = {}) =>
  api.get('/products', { params }).then(r => r.data);

export const getProductById = (id) =>
  api.get(`/products/${id}`).then(r => r.data);

export const createProduct = (data) =>
  api.post('/products', data).then(r => r.data);

export const updateProduct = (id, data) =>
  api.patch(`/products/${id}`, data).then(r => r.data);

export const deleteProduct = (id) =>
  api.delete(`/products/${id}`).then(r => r.data);

export const uploadProductImage = (id, formData) =>
  api.post(`/products/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const updateProductStock = (id, stock) =>
  api.patch(`/admin/products/${id}/stock`, { stock }).then(r => r.data);


// ✅ ADD THIS: Delete product image
export const deleteProductImage = async (id, imageUrl) => {
  const response = await api.delete(`/products/${id}/images`, {
    data: { imageUrl },
  });
  return response.data;
};

// ── CUSTOMERS ────────────────────────────────────────────────────
export const getCustomers = (params = {}) =>
  api.get('/admin/users', { params }).then(r => r.data);

export const getCustomerById = (id) =>
  api.get(`/admin/users/${id}`).then(r => r.data);

export const updateUserRole = (id, role) =>
  api.patch(`/admin/users/${id}/role`, { role }).then(r => r.data);

export const toggleUserStatus = (id) =>
  api.patch(`/admin/users/${id}/status`).then(r => r.data);

export const deleteUser = (id) =>
  api.delete(`/admin/users/${id}`).then(r => r.data);

// ── REVIEWS ──────────────────────────────────────────────────────
export const getReviews = (params = {}) =>
  api.get('/admin/reviews', { params }).then(r => r.data);

export const approveReview = (id) =>
  api.patch(`/admin/reviews/${id}/approve`).then(r => r.data);

export const rejectReview = (id, reason) =>
  api.patch(`/admin/reviews/${id}/reject`, { reason }).then(r => r.data);

export const deleteReview = (id) =>
  api.delete(`/admin/reviews/${id}`).then(r => r.data);

export const toggleReviewVisibility = (productId, reviewId) =>
  api.patch(`/admin/products/${productId}/reviews/${reviewId}/visibility`).then(r => r.data);

// ── SETTINGS ─────────────────────────────────────────────────────
export const getSettings = () =>
  api.get('/admin/settings').then(r => r.data);

export const updateSettings = (data) =>
  api.post('/admin/settings', data).then(r => r.data);

// ── RECENT ORDERS (dashboard widget) ─────────────────────────────
export const getRecentOrders = (limit = 10) =>
  api.get('/orders/admin/all', { params: { limit, sort: '-createdAt' } }).then(r => r.data);
