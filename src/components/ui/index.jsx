import React, { memo, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useCartStore from '@/context/cartStore';
import { users as usersApi } from '@/api/client';
import useAuthStore from '@/context/authStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { categoryName, statusName } from '@/i18n/helpers';
import {
  Box, Heart, Check, ChevronLeft, ChevronRight, Leaf, ShoppingCart, Star, X,
} from 'lucide-react';
import { trackAddToCart, generateEventId } from '@/lib/metaPixel';
import PriceTag from '@/components/PriceTag';

// ── ProductCard ───────────────────────────────────────────────────
// Memoised: product objects come from list state and stay referentially
// stable between renders, so unrelated parent updates (filters typing,
// cart badge, etc.) no longer re-render every card.
// Structure: <article> with a stretched title link; the wishlist and
// add-to-cart buttons are siblings of the link (no button-inside-anchor).
export const ProductCard = memo(function ProductCard({ product }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [wishlisted, setWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);

  const href = `/products/${product.slug || product._id}`;

  const handleWishlist = async () => {
    if (!isAuthenticated) { toast.error(t('card.wishLogin')); return; }
    try {
      await usersApi.toggleWishlist(product._id);
      setWishlisted((w) => !w);
      toast.success(wishlisted ? t('card.wishRemoved') : t('card.wishAdded'));
    } catch (_) {
      toast.error(t('card.wishError'));
    }
  };

  const handleAddToCart = () => {
    if (product.pwywEnabled) { navigate(href); return; }
    if (adding) return; // guard against rapid repeat clicks
    setAdding(true);
    addItem(product);
    trackAddToCart(product, 1, generateEventId());
    toast.success(t('card.toastAdded', { name: product.name }), {
      icon: <Check size={18} strokeWidth={2.5} color="var(--success)" />,
    });
    setTimeout(() => setAdding(false), 600);
  };

  const discount = !product.pwywEnabled && product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const outOfStock = product.stock === 0;
  const label = product.pwywEnabled ? t('card.chooseAmount')
    : adding ? t('card.added')
    : outOfStock ? t('card.outOfStock')
    : t('card.add');

  return (
    <article className="pc">
      <div className="pc-media">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" loading="lazy" decoding="async" width="480" height="480" />
        ) : (
          <Box size={48} strokeWidth={1.5} aria-hidden="true" />
        )}

        <div className="product-card-badges">
          {!product.pwywEnabled && product.badge && (
            <span className="badge badge-forest">{product.badge}</span>
          )}
          {discount > 0 && (
            <span className="badge badge-amber">{t('card.off', { n: discount })}</span>
          )}
        </div>

        <button
          type="button"
          className="pc-wish"
          onClick={handleWishlist}
          aria-label={wishlisted ? t('card.wishRemove', { name: product.name }) : t('card.wishAdd', { name: product.name })}
          aria-pressed={wishlisted}
        >
          <span className="pc-wish-dot">
            <Heart size={16} strokeWidth={2} fill={wishlisted ? 'currentColor' : 'none'} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="pc-body">
        <div className="pc-cat">{categoryName(t, product.category)}</div>
        <h3 className="pc-title">
          <Link to={href} className="pc-link">{product.name}</Link>
        </h3>

        {product.numReviews > 0 && (
          <div className="pc-rating" role="img" aria-label={t('card.rating', { rating: Number(product.rating || 0).toFixed(1), n: product.numReviews })}>
            <Star size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            <span aria-hidden="true">{Number(product.rating || 0).toFixed(1)} ({product.numReviews})</span>
          </div>
        )}

        <div className="pc-price">
          <PriceTag
            amount={product.pwywEnabled
              ? product.pwywTiers?.find((tier) => tier.isDefault)?.amount
              : product.price}
            size="md"
          />
        </div>

        {product.stock <= 10 && product.stock > 0 && (
          <div className="pc-stock pc-stock--low">{t('card.onlyLeft', { n: product.stock })}</div>
        )}
        {outOfStock && <div className="pc-stock pc-stock--out">{t('card.unavailable')}</div>}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={outOfStock || adding}
          className="btn btn-primary btn-sm"
        >
          {adding ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <ShoppingCart size={16} strokeWidth={2} aria-hidden="true" />}
          <span>{label}</span>
        </button>
      </div>
    </article>
  );
});

// Same footprint as a real card so loading doesn't shift the layout.
export const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <div className="pc pc-skel" aria-hidden="true">
      <div className="pc-media skeleton" style={{ borderRadius: 0 }} />
      <div className="pc-body">
        <div className="skeleton" style={{ width: '40%' }} />
        <div className="skeleton" style={{ width: '85%', height: 18 }} />
        <div className="skeleton" style={{ width: '30%' }} />
        <div className="skeleton" style={{ height: 40, marginTop: 8 }} />
      </div>
    </div>
  );
});

export const ProductGridSkeleton = memo(function ProductGridSkeleton({ count = 4 }) {
  const { t } = useTranslation();
  return (
    <div className="product-grid" role="status" aria-label={t('ui.loadingProducts')}>
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
});

// ── Spinner ───────────────────────────────────────────────────────
export const Spinner = memo(function Spinner({ size = 24, color = 'var(--sage)' }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
});

// ── PageLoader ────────────────────────────────────────────────────
export const PageLoader = memo(function PageLoader() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('ui.loading')}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}
    >
      <Spinner size={36} />
    </div>
  );
});

// ── Empty state ───────────────────────────────────────────────────
// `action` is JSX (new each render), so memo would never hit: not memoised.
export function EmptyState({ icon: Icon = Leaf, title, message, action }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-16) var(--space-6)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)',
    }}>
      <Icon size={40} strokeWidth={1.5} color="var(--text-muted)" aria-hidden="true" />
      <h3 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h3>
      {message && <p style={{ color: 'var(--text-muted)', maxWidth: 360 }}>{message}</p>}
      {action}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────
// `onPage` is an inline callback at call sites, so memo would never hit.
export function Pagination({ page, pages, onPage }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label={t('ui.pagination')}>
      <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="icon-dir" size={16} strokeWidth={2} aria-hidden="true" /> {t('ui.previous')}
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          type="button"
          key={p}
          className="pager-num"
          onClick={() => onPage(p)}
          aria-current={p === page ? 'page' : undefined}
          aria-label={t('ui.page', { n: p })}
        >
          {p}
        </button>
      ))}
      <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('ui.next')} <ChevronRight className="icon-dir" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </nav>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 520 }) {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <h3 id={titleId} style={{ fontSize: 'var(--fs-lg)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Admin StatCard ────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, trend, color = 'var(--admin-accent)' }) {
  const positive = trend > 0;
  return (
    <div className='admin-card' style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 4, background: color, borderRadius: '0 var(--radius-md) var(--radius-md) 0',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--admin-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--admin-text)', lineHeight: 1, marginBottom: 6 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{sub}</div>}
          {trend !== undefined && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 8, fontSize: 12, fontWeight: 600,
              color: positive ? '#4ade80' : '#f87171',
            }}>
              {positive ? '↑' : '↓'} {Math.abs(trend)}% vs last month
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius)',
            background: `${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order Status Badge ────────────────────────────────────────────
export const OrderStatusBadge = memo(function OrderStatusBadge({ status }) {
  const { t } = useTranslation();
  const classes = {
    pending: 'badge-amber',
    paid: 'badge-green',
    processing: 'badge-green',
    shipped: 'badge-forest',
    delivered: 'badge-green',
    cancelled: 'badge-red',
    refunded: 'badge-gray',
  };
  return <span className={`badge ${classes[status] || 'badge-gray'}`}>{statusName(t, status)}</span>;
});

// ── Input with label wrapper ──────────────────────────────────────
export function Field({ label, error, children, id }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label className='label' htmlFor={id}>{label}</label>}
      {children}
      {error && <span className='field-error' id={id ? `${id}-error` : undefined} role="alert">{error}</span>}
    </div>
  );
}
