import React, { memo, useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/context/authStore';
import useCartStore, { selectCartCount } from '@/context/cartStore';
import ThemeToggle from '@/components/ThemeToggle';
import CurrencySwitcher from '@/components/CurrencySwitcher';
import NotificationBell from '@/components/NotificationBell';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  ShoppingBag, Package, Heart, User, Settings, Leaf, Menu, X,HomeIcon,
} from 'lucide-react';
import './StorefrontLayout.css';

// Hoisted so memoised footer lists receive stable props.
// `labelKey` values are translation keys, resolved at render time.
const SHOP_LINKS = [
  { to: '/products?category=immunity', labelKey: 'categories.immunity.name' },
  { to: '/products?category=energy', labelKey: 'categories.energy.name' },
  { to: '/products?category=vitamins', labelKey: 'categories.vitamins.name' },
  { to: '/products?category=beauty', labelKey: 'categories.beauty.name' },
];
const ACCOUNT_LINKS = [
  { to: '/profile', labelKey: 'nav.myProfile' },
  { to: '/orders', labelKey: 'nav.orders' },
  { to: '/wishlist', labelKey: 'nav.wishlist' },
  { to: '/register', labelKey: 'footer.createAccount' },
];
// Only pages that exist. FAQ, shipping, returns and contact pages are
// not built yet; add them here when they are (no dead '#' links).
const INFO_LINKS = [{ to: '/privacy-policy', labelKey: 'footer.privacy' }];

const NavLink = memo(function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
  return (
    <Link to={to} className="sf-nav-link" aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
});

const FooterLinks = memo(function FooterLinks({ links }) {
  const { t } = useTranslation();
  return (
    <ul className="sf-footer-links">
      {links.map((l) => (
        <li key={l.to}><Link to={l.to}>{t(l.labelKey)}</Link></li>
      ))}
    </ul>
  );
});

export default function StorefrontLayout() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const count = useCartStore(selectCartCount);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Lock body scroll and allow Escape to close while the mobile menu is open
  useEffect(() => {
    if (!menuOpen) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success(t('nav.loggedOut'));
    navigate('/');
  };

  const mobileLinks = [
    { to: '/products', label: t('nav.shop'), Icon: ShoppingBag },
    { to: '/', label: t('Home'), Icon: HomeIcon },
    ...(isAuthenticated
      ? [
          { to: '/orders', label: t('nav.myOrders'), Icon: Package },
          { to: '/wishlist', label: t('nav.wishlist'), Icon: Heart },
          { to: '/profile', label: t('nav.myProfile'), Icon: User },
        ]
      : []),
    ...(user?.role === 'admin' ? [{ to: '/admin/dashboard', label: t('nav.adminDashboard'), Icon: Settings }] : []),
  ];

  return (
    <div className="storefront-layout">
      <a href="#main" className="skip-link">{t('nav.skip')}</a>

      <header className="sf-header">
        <div className="container sf-header-inner">
          <Link to="/" className="sf-logo">
            <Leaf size={22} strokeWidth={1.8} aria-hidden="true" />
            <span className="sf-logo-text">Winners Health</span>
          </Link>

          <nav className="sf-nav" aria-label={t('nav.main')}>
             <NavLink to="/">Home</NavLink>
            <NavLink to="/products">{t('nav.shop')}</NavLink>
            {isAuthenticated && <NavLink to="/orders">{t('nav.orders')}</NavLink>}
            {isAuthenticated && <NavLink to="/wishlist">{t('nav.wishlist')}</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin/dashboard">{t('nav.admin')}</NavLink>}
          </nav>

          <div className="sf-actions">
            <LanguageSwitcher className="sf-lang" />
            <CurrencySwitcher />
            <ThemeToggle />
            {isAuthenticated && <NotificationBell />}
            <Link to="/cart" className="sf-icon-btn" aria-label={count > 0 ? t('nav.cartItems', { n: count }) : t('nav.cartEmpty')}>
              <ShoppingBag size={22} strokeWidth={1.8} aria-hidden="true" />
              {count > 0 && <span className="sf-cart-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
            </Link>

            {isAuthenticated ? (
              <div className="sf-auth">
                <Link to="/profile" aria-label={t('nav.myProfile')}>
                  <div className="sf-avatar" aria-hidden="true">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>{t('nav.signOut')}</button>
              </div>
            ) : (
              <div className="sf-auth">
                <Link to="/login" className="btn btn-outline btn-sm">{t('nav.logIn')}</Link>
                <Link to="/register" className="btn btn-primary btn-sm">{t('nav.signUp')}</Link>
              </div>
            )}

            <button
              type="button"
              className="sf-icon-btn sf-menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
              aria-expanded={menuOpen}
              aria-controls="sf-mobile-menu"
            >
              {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav id="sf-mobile-menu" className={`sf-mobile-panel ${menuOpen ? 'is-open' : ''}`} aria-label={t('nav.mobile')}>
          <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {mobileLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="sf-mobile-link"
                aria-current={pathname.startsWith(item.to) ? 'page' : undefined}
              >
                <item.Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
            <LanguageSwitcher className="sf-lang-mobile" />
            <div className="sf-mobile-auth">
              {isAuthenticated ? (
                <button type="button" className="btn btn-outline btn-full" onClick={handleLogout}>{t('nav.signOut')}</button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link to="/login" className="btn btn-outline" style={{ flex: 1 }}>{t('nav.logIn')}</Link>
                  <Link to="/register" className="btn btn-primary" style={{ flex: 1 }}>{t('nav.signUp')}</Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1} style={{ flex: 1, outline: 'none' }}>
        <Outlet />
      </main>

      <footer className="sf-footer">
        <div className="container">
          <div className="sf-footer-grid">
            <div>
              <div className="sf-footer-brand">
                <Leaf size={22} strokeWidth={1.8} aria-hidden="true" />
                <span>Winners Health</span>
              </div>
              <p className="sf-footer-desc">{t('footer.desc')}</p>
            </div>
            <nav aria-label={t('footer.shop')}>
              <h2>{t('footer.shop')}</h2>
              <FooterLinks links={SHOP_LINKS} />
            </nav>
            <nav aria-label={t('footer.account')}>
              <h2>{t('footer.account')}</h2>
              <FooterLinks links={ACCOUNT_LINKS} />
            </nav>
            <nav aria-label={t('footer.info')}>
              <h2>{t('footer.info')}</h2>
              <FooterLinks links={INFO_LINKS} />
            </nav>
          </div>
          <div className="sf-footer-bottom">{t('footer.rights', { year: new Date().getFullYear() })}</div>
        </div>
      </footer>
    </div>
  );
}
