// src/components/admin/AdminLayout.jsx
import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../../pages/admin/Admin.css';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { admin, orders } from '@/api/client';
import { logoutPush } from '@/lib/onesignal';
import {
  LayoutDashboard, ShoppingCart, Users, TrendingUp, Plus, Package,
  Star, Tag, ShieldCheck, Settings as SettingsIcon, LogOut, Menu,
  Search, AlertTriangle, Wallet, Leaf,
} from 'lucide-react';

const NAV_BASE = [
  { section: 'Main' },
  { to: '/admin', end: true, Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/orders', Icon: ShoppingCart, label: 'Orders', badgeKey: 'pendingOrders' },
  { to: '/admin/customers', Icon: Users, label: 'Customers' },
  { to: '/admin/reports', Icon: TrendingUp, label: 'Reports' },
  { section: 'Product' },
  { to: '/admin/products/add', Icon: Plus, label: 'Add Product' },
  { to: '/admin/products', Icon: Package, label: 'Product List' },
  { to: '/admin/reviews', Icon: Star, label: 'Reviews', badgeKey: 'pendingReviews' },
  { to: '/admin/categories', Icon: Tag, label: 'Categories' },
  { to: '/admin/promo-codes', Icon: Tag, label: 'Promo Codes' },
  { section: 'Admin' },
  { to: '/admin/users', Icon: ShieldCheck, label: 'AdminUsers' },
  { to: '/admin/settings', Icon: SettingsIcon, label: 'Settings' },
  { to: '/admin/currencies', Icon: Wallet, label: 'Currencies' },
  { to: '/admin/monitoring', Icon: AlertTriangle, label: 'Monitoring' },
];

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res ?? null;
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [badges, setBadges] = useState({ pendingOrders: 0, pendingReviews: 0 });

  const navigate = useNavigate();

  const loadAdminBadges = useCallback(async () => {
      let pendingOrders = 0;
      let pendingReviews = 0;
      // 2) Live counts from stats + orders + reviews
      const tasks = [];

      if (typeof admin.dashboard === 'function') {
        tasks.push(
          admin.dashboard('7d').then((r) => {
            const stats = unwrap(r);
            pendingOrders = Number(
              stats?.pendingOrders ?? stats?.pending ?? 0
            );
          }).catch(() => {})
        );
      }

      if (typeof orders.all === 'function') {
        tasks.push(
          orders.all({ status: 'pending', limit: 1 }).then((r) => {
            const body = unwrap(r);
            // prefer explicit total from pagination
            const total =
              body?.total ??
              body?.pagination?.total ??
              (Array.isArray(body?.orders) ? body.orders.length : null);
            if (total != null) pendingOrders = Number(total) || pendingOrders;
          }).catch(() => {})
        );
      }

      if (admin.reviews?.list) {
        tasks.push(
          admin.reviews.list({ status: 'pending', limit: 1 }).then((r) => {
            const body = unwrap(r);
            pendingReviews = Number(
              body?.total ??
              body?.pagination?.total ??
              body?.count ??
              (Array.isArray(body?.reviews) ? body.reviews.length : 0)
            );
          }).catch(() => {})
        );
      }

      await Promise.all(tasks);

      setBadges({ pendingOrders, pendingReviews });
  }, []);

  useEffect(() => {
    loadAdminBadges();
    const id = setInterval(loadAdminBadges, 60_000);
    return () => clearInterval(id);
  }, [loadAdminBadges]);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/admin/orders?search=${encodeURIComponent(search.trim())}`);
    }
  }

  function handleLogout() {
    void logoutPush();
    localStorage.removeItem('vc_access');
    localStorage.removeItem('vc_refresh');
    navigate('/admin-login');
  }

  let adminName = 'Admin';
  try {
    const token = localStorage.getItem('vc_access');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      adminName = payload.name ?? 'Admin';
    }
  } catch { /* ignore */ }

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">
            <Leaf size={20} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="logo-text">
            Winners<span>Admin</span>
          </div>
        </div>

        <nav>
          {NAV_BASE.map((item, i) => {
            if (item.section) {
              return (
                <div key={`sec-${item.section}`} className="sidebar-section">
                  {item.section}
                </div>
              );
            }
            const badgeVal = item.badgeKey ? badges[item.badgeKey] : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">
                  <item.Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                {item.label}
                {badgeVal > 0 && (
                  <span className="nav-badge">
                    {badgeVal > 99 ? '99+' : badgeVal}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div
            className="nav-item"
            onClick={handleLogout}
            style={{ color: 'var(--danger)' }}
            role="button"
          >
            <span className="nav-icon">
              <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
            </span>
            Logout
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px 0' }}>
            <div className="avatar" style={{ fontSize: 13 }}>
              {adminName[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{adminName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Admin</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
            type="button"
          >
            <Menu size={20} strokeWidth={2} />
          </button>

          <form onSubmit={handleSearch} className="search-wrap">
            <span className="search-icon">
              <Search size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <input
              type="text"
              placeholder="Search orders, products, customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div className="header-actions">
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/admin/products/add')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} strokeWidth={2.2} /> Add Product
            </button>

            <NotificationBell />

            <div
              className="icon-btn"
              onClick={() => navigate('/admin/settings')}
              aria-label="Settings"
              role="button"
            >
              <SettingsIcon size={18} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div
              className="avatar"
              style={{ width: 34, height: 34, fontSize: 13, cursor: 'pointer' }}
            >
              {adminName[0]}
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>

        <footer className="admin-footer">
          <div>
            Winners Admin ·{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <div className="footer-links">
            <a href="/help">Help Center</a>
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </footer>
      </div>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99 }}
        />
      )}
    </div>
  );
}