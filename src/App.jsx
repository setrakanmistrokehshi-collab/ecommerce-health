import React, { useEffect, useLayoutEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from '@/context/authStore';
import { ROLES } from '@/constants/roles';

// ─────────────────────────────────────────────
// THEME INITIALIZATION (prevent flash on load)
// ─────────────────────────────────────────────
(() => {
  const saved = localStorage.getItem('theme');
  const isDark = saved
    ? saved === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
})();

// Layouts
import StorefrontLayout from '@/components/layout/StorefrontLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import { ResetPasswordPage } from './pages/LoginPage';
import { AutoLogoutManager } from './components/AutoLogoutManager';
import { AutoLogoutCountdown } from './components/AutoLogoutCountdown';
import CookieConsentBanner, { getConsent } from '@/components/CookieConsentBanner';
import { initIfConsented } from '@/lib/metaPixel';
import useCurrencyStore from '@/context/currencyStore';
import { initPush } from '@/lib/onesignal';

// Pages (storefront)
import HomePage from '@/pages/HomePage';
import ProductsPage from '@/pages/ProductsPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import CartPage from '@/pages/CartPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrderSuccessPage from '@/pages/OrderSuccessPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProfilePage from '@/pages/ProfilePage';
import OrdersPage from '@/pages/OrdersPage';
import WishlistPage from '@/pages/WishlistPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import { products } from '@/api/client';
//import { OAuthCallbackPage } from '@/hooks/GoogleAuth';

import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import AddProduct from '@/pages/admin/AddProduct';
import Customers from '@/pages/admin/Customers';
import Orders from '@/pages/admin/Orders';
import Reports from '@/pages/admin/Reports';
import Reviews from '@/pages/admin/Reviews';
import Categories from '@/pages/admin/Categories';
import EditUserRole from '@/pages/admin/EditUserRole';
import Settings from '@/pages/admin/Settings';
import AdminCurrencies from '@/pages/admin/AdminCurrencies';
import AdminMonitoring from '@/pages/admin/AdminMonitoring';
import AdminPromoCodes from '@/pages/admin/AdminPromoCodes';
products.list({ page: 1, limit: 12 }).catch(() => {});
products.list({ page: 1, limit: 12, featured: true }).catch(() => {});


// ─────────────────────────────────────────────
// LOADING
// ─────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      color: 'var(--text-muted)',
    }} role="status">
      Loading…
    </div>
  );
}

// ─────────────────────────────────────────────
// GUARDS
// ─────────────────────────────────────────────
function RequireAuth() {
  const { isAuthenticated, isHydrated } = useAuthStore();

  if (!isHydrated) return <LoadingScreen />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireAdmin() {
  const { isAuthenticated, user, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }

  const allowedRoles = [
    ROLES.SUPER_ADMIN,
    ROLES.PRODUCT_MANAGER,
    ROLES.ORDER_MANAGER,
    ROLES.SUPPORT,
  ];

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function RedirectIfAuth() {
  const { isAuthenticated, isHydrated, user } = useAuthStore();

  if (!isHydrated) return <LoadingScreen />;
  
  // If authenticated, redirect to appropriate dashboard based on role
  if (isAuthenticated) {
    const adminRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.PRODUCT_MANAGER,
      ROLES.ORDER_MANAGER,
      ROLES.SUPPORT,
    ];
    
    // Redirect admin users to admin dashboard
    if (adminRoles.includes(user?.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    
    // Regular users go to home page
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────
function ScrollToTop() {
  const location = useLocation();

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const target = location.hash
      ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
      : null;

    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, location.hash]);

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <ScrollToTop />,
    children: [
      {
        element: <StorefrontLayout />,
        children: [
          { index: true, path: '/', element: <HomePage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:slug', element: <ProductDetailPage /> },
          { path: 'cart', element: <CartPage /> },
          { path: 'privacy-policy', element: <PrivacyPolicyPage /> },

          {
            element: <RequireAuth />,
            children: [
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'orders/:id', element: <OrdersPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'order-success', element: <OrderSuccessPage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'wishlist', element: <WishlistPage /> },
            ],
          },
        ],
      },

      {
        element: <RedirectIfAuth />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },

      {
        path: 'admin-login',
        element: <AdminLoginPage />,
      },

      {
        element: <RequireAdmin />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <AdminDashboard /> },
              { path: 'analytics', element: <AdminAnalytics /> },
              { path: 'products', element: <AdminProducts /> },
              { path: 'products/add', element: <AddProduct /> },
              { path: 'orders/:id', element: <AdminOrders /> },
              { path: 'orders', element: <AdminOrders /> },
              { path: 'orders-list', element: <Orders /> },
              { path: 'users', element: <AdminUsers /> },
              { path: 'users/:id/role', element: <EditUserRole /> },
              { path: 'customers', element: <Customers /> },
              { path: 'reports', element: <Reports /> },
              { path: 'reviews', element: <Reviews /> },
              { path: 'categories', element: <Categories /> },
              { path: 'promo-codes', element: <AdminPromoCodes /> },
              { path: 'settings', element: <Settings /> },
              { path: 'currencies', element: <AdminCurrencies /> },
              { path: 'monitoring', element: <AdminMonitoring /> },
            ],
          },
        ],
      },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchCurrencies = useCurrencyStore((s) => s.fetchCurrencies);

  useEffect(() => {
    void initPush();
    fetchMe();

    const handler = () => {
      logout();
      window.location.href = '/login?expired=1';
    };

    window.addEventListener('vc:session-expired', handler);
    return () => window.removeEventListener('vc:session-expired', handler);
  }, [fetchMe, logout]);

  // Fetches available currencies + rates once on app load. Not
  // re-fetched on navigation — rates are admin-set and don't change
  // mid-session; a full page reload (or the checkout flow itself,
  // which re-validates server-side regardless) picks up any update.
  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  // Loads the Meta Pixel only if consent was already given (e.g. a
  // returning visitor), and re-checks whenever the banner's choice
  // changes — so accepting cookies mid-session starts tracking
  // immediately without needing a page reload.
  useEffect(() => {
    initIfConsented();
    const onConsentChange = () => initIfConsented();
    window.addEventListener('cookieconsentchange', onConsentChange);
    return () => window.removeEventListener('cookieconsentchange', onConsentChange);
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <CookieConsentBanner />
      
      {/* 👇 ADD AUTO-LOGOUT COMPONENTS HERE - ONLY WHEN AUTHENTICATED */}
      {isAuthenticated && (
        <>
          <AutoLogoutManager />
          <AutoLogoutCountdown />
        </>
      )}
      
      <RouterProvider router={router} />
    </>
  );
}