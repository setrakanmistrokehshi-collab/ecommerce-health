// src/config/permissions.js
// Mirrors backend/config/permissions.js — keep these in sync.

export const PERMISSIONS = {
  DASHBOARD_VIEW:    'dashboard.view',

  ORDERS_VIEW:       'orders.view',
  ORDERS_UPDATE:     'orders.update',
  ORDERS_NOTIFY:     'orders.notify',
  PAYMENT_FOLLOW_UP: 'payments.follow_up',

  PRODUCTS_VIEW:     'products.view',
  PRODUCTS_CREATE:   'products.create',
  PRODUCTS_UPDATE:   'products.update',
  PRODUCTS_DELETE:   'products.delete',
  PRODUCTS_STOCK:    'products.stock',
  PRODUCTS_IMAGES:   'products.images',

  CATEGORIES_VIEW:   'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',

  CUSTOMERS_VIEW:    'customers.view',
  CUSTOMERS_UPDATE:  'customers.update',
  CUSTOMERS_DELETE:  'customers.delete',

  REVIEWS_VIEW:      'reviews.view',
  REVIEWS_MODERATE:  'reviews.moderate',
  REVIEWS_DELETE:    'reviews.delete',

  REPORTS_VIEW:      'reports.view',

  SETTINGS_VIEW:     'settings.view',
  SETTINGS_UPDATE:   'settings.update',

  STAFF_VIEW:        'staff.view',
  STAFF_MANAGE:      'staff.manage',
};

export const ROLE_LABELS = {
  super_admin:     'Super Admin',
  product_manager: 'Product Manager',
  order_manager:   'Order Manager',
  support_agent:   'Support Agent',
};
