import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { categoryName } from '@/i18n/helpers';
import { Link, useNavigate } from 'react-router-dom';
import useCartStore from '@/context/cartStore';
import useAuthStore from '@/context/authStore';
import { EmptyState } from '@/components/ui';
import PriceTag from '@/components/PriceTag';
import {
  calculateShippingNaira as calculateShipping,
  FREE_SHIPPING_THRESHOLD_NAIRA,
} from '@/config/cartMoney';
import toast from 'react-hot-toast';
import { ShoppingCart, Box, Minus, Plus, X, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import useRevalidateCart from '@/hooks/useRevalidateCart';

export default function CartPage() {
  const { t } = useTranslation();
  const { items, removeItem, updateQty, clear } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const { changes: priceChanges } = useRevalidateCart();

  // Cart items come from Product.price, which is plain Naira — see
  // config/cartMoney.js for why this uses different helpers than
  // OrdersPage (which formats real Order documents, genuinely in kobo).
  const subtotal = items.reduce((sum, item) => sum + (item.pwywEnabled
    ? Number(item.lineTotal ?? item.price * item.quantity) || 0
    : item.price * item.quantity), 0);
  const shipping = calculateShipping(subtotal);
  const total     = subtotal + shipping;
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_NAIRA) * 100));

  const handleRemove = (item) => {
    removeItem(item.cartKey || item._id);
    toast.success(t('cart.removed', { name: item.name }), {
      icon: <Trash2 size={18} strokeWidth={2} color="var(--rust)" />,
    });
  };

  const handleClear = () => {
    if (items.length === 0) return;
    clear();
    toast.success(t('cart.cleared'));
  };

  if (items.length === 0) return (
    <div style={{ padding: 'var(--space-8) 0' }}>
      <div className='container'>
        <EmptyState
          icon={ShoppingCart}
          title={t('cart.emptyTitle')}
          message={t('cart.emptyMsg')}
          action={<Link to='/products' className='btn btn-primary'>{t('cart.shopNow')}</Link>}
        />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <div className='container'>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 'var(--space-8)', color: 'var(--forest)' }}>
          {t('cart.title', { n: items.length })}
        </h1>

            {!items.some((item) => item.pwywEnabled) && priceChanges?.priceChanges?.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--warning-bg, rgba(224,160,62,0.12))',
            border: '1px solid var(--warning)', borderRadius: 'var(--radius)',
            padding: 'var(--space-4)', marginBottom: 'var(--space-6)',
          }}>
            <AlertTriangle size={18} strokeWidth={2} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div style={{ fontSize: 14, color: 'var(--forest)' }}>
              <strong>{t('cart.priceChanged')}</strong> {t('cart.priceChangedBody')}
            </div>
          </div>
        )}

        <div className='cart-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--space-8)', alignItems: 'start' }}>
          {/* Items */}
          <div className='card'>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-light)' }}>
              <button className='btn btn-ghost btn-sm' onClick={handleClear}>{t('cart.clearAll')}</button>
            </div>
            {items.map((item) => (
              <div key={item.cartKey || item.lineId || item._id} className='cart-item' style={{
                display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-5)',
                borderBottom: '1px solid var(--border-light)',
                alignItems: 'center',
              }}>
                {/* Image */}
                <div className='cart-item-image' style={{
                  width: 80, height: 80, borderRadius: 'var(--radius)',
                  background: 'var(--parchment)', overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.images?.[0]
                    ? <img src={item.images[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Box size={32} strokeWidth={1.5} color="var(--sage)" aria-hidden="true" />
                  }
                </div>

                {/* Info */}
                <div className='cart-item-info' style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/products/${item.slug || item._id}`} style={{
                    fontWeight: 600, color: 'var(--forest)', fontSize: 15,
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </Link>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{categoryName(t, item.category)}</div>
                  {item.chosenTierLabel && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{item.chosenTierLabel}</div>
                  )}
                  {item.stale && (
                    <div style={{ marginTop: 8, color: 'var(--error)', fontSize: 13 }}>
                      <div>{t('cart.stale')}</div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 4, paddingInlineStart: 0 }}
                        onClick={() => {
                          const params = new URLSearchParams({
                            tierId: String(item.chosenTierId || ''),
                            reselect: item.cartKey || item.lineId || String(item._id),
                            qty: String(item.quantity),
                          });
                          navigate(`/products/${item.slug || item._id}?${params.toString()}`);
                        }}
                      >
                        {t('cart.chooseAgain')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Qty + Price */}
                <div className='cart-item-qtyprice' style={{ display: 'contents' }}>
                  {/* Qty */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0 }}>
                    <button
                      onClick={() => updateQty(item.cartKey || item._id, item.quantity - 1)}
                      aria-label={t('cart.decrease')}
                      style={{ width: 34, height: 36, cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest)' }}
                    >
                      <Minus size={14} strokeWidth={2.2} />
                    </button>
                    <span style={{ width: 34, textAlign: 'center', fontWeight: 600, color: 'var(--forest)' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.cartKey || item._id, item.quantity + 1)}
                      aria-label={t('cart.increase')}
                      style={{ width: 34, height: 36, cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest)' }}
                    >
                      <Plus size={14} strokeWidth={2.2} />
                    </button>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'end', minWidth: 100, flexShrink: 0 }}>
                    <div>
                      <PriceTag
                        amount={item.pwywEnabled
                          ? Number(item.lineTotal ?? item.price * item.quantity)
                          : item.price * item.quantity}
                        size="md"
                      />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {t('cart.unitPrice')}: <PriceTag amount={item.unitPrice ?? item.price} size="sm" muted />
                    </div>
                  </div>
                </div>

                <button
                  className='cart-item-remove'
                  onClick={() => handleRemove(item)}
                  aria-label={t('cart.remove', { name: item.name })}
                  style={{
                    color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none',
                    padding: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className='card cart-summary' style={{ padding: 'var(--space-6)', position: 'sticky', top: 80 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 'var(--space-4)', color: 'var(--forest)' }}>{t('cart.summary')}</h2>

            {/* Free-shipping progress bar */}
            <div style={{
              height: 6, borderRadius: 'var(--radius-full)', background: 'var(--card-2)',
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%', width: `${freeShippingProgress}%`,
                background: 'var(--sage)', borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            {shipping > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
                <Trans
                  i18nKey="cart.addForFree"
                  components={{ price: <PriceTag amount={FREE_SHIPPING_THRESHOLD_NAIRA - subtotal} size="sm" muted /> }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: 'var(--muted)' }}>
                <span>{t('cart.subtotal')}</span><PriceTag amount={subtotal} size="sm" muted />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: 'var(--muted)' }}>
                <span>{t('cart.shipping')}</span>
                {shipping === 0
                  ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{t('cart.free')}</span>
                  : <PriceTag amount={shipping} size="sm" muted />}
              </div>
              <hr className='divider' style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 18, color: 'var(--forest)' }}>
                <span>{t('cart.total')}</span><PriceTag amount={total} size="lg" strike={false} />
              </div>
            </div>

            <button
              className='btn btn-primary btn-full btn-lg'
              style={{ marginTop: 'var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => isAuthenticated ? navigate('/checkout') : navigate('/login?redirect=/checkout')}
              disabled={items.some((item) => item.stale)}
            >
              {isAuthenticated ? t('cart.checkout') : t('cart.loginCheckout')}
              <ArrowRight className="icon-dir" size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <Link to='/products' className='btn btn-ghost btn-full' style={{ marginTop: 8, textAlign: 'center' }}>
              {t('cart.continue')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}