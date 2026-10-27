import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { products as productsApi } from '@/api/client';
import useCartStore from '@/context/cartStore';
import useAuthStore from '@/context/authStore';
import { PageLoader } from '@/components/ui';
import RecommendedProducts from '@/components/RecommendedProducts';
import PriceTag from '@/components/PriceTag';
import TierSelector from '@/components/TierSelector';
import useCurrencyStore from '@/context/currencyStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { categoryName } from '@/i18n/helpers';
import { useForm } from 'react-hook-form';
import { Check, ChevronLeft, Lock, Box } from 'lucide-react';
import { trackViewContent, trackAddToCart, generateEventId } from '@/lib/metaPixel';

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTierId = searchParams.get('tierId');
  const reselectKey = searchParams.get('reselect');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(() => Math.max(1, Number(searchParams.get('qty')) || 1));
  const [activeImage, setActiveImage] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tierSelection, setTierSelection] = useState({ productId: '', tierId: '' });

  const addItem = useCartStore((s) => s.addItem);
  const replaceStaleItem = useCartStore((s) => s.replaceStaleItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currency = useCurrencyStore((s) => s.getCurrent());

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const images = product?.images || [];
  const mainImageRef = useRef(null);
  const dragState = useRef({ startX: 0, dragging: false });

  useEffect(() => {
    setLoading(true);
    productsApi.get(slug)
      .then(({ data }) => {
        setProduct(data.product);
        setActiveImage(0);
        if (data.product) trackViewContent(data.product, generateEventId());
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Image navigation ────────────────────────────────────────────
  const goToImage = (index) => {
    if (images.length === 0) return;
    const next = ((index % images.length) + images.length) % images.length;
    setActiveImage(next);
  };

  const goPrev = () => goToImage(activeImage - 1);
  const goNext = () => goToImage(activeImage + 1);

  // Keyboard support
  const handleKeyDown = (e) => {
    if (images.length <= 1) return;
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
  };

  // Simple swipe / drag
  const handlePointerDown = (e) => {
    if (images.length <= 1) return;
    dragState.current = { startX: e.clientX, dragging: true };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e) => {
    if (!dragState.current.dragging) return;
    const diff = e.clientX - dragState.current.startX;
    if (diff > 50) goPrev();
    if (diff < -50) goNext();
    dragState.current.dragging = false;
  };

  // ── Cart & Review handlers ──────────────────────────────────────
  // addingRef (not state) gates rapid repeat clicks so a burst of taps
  // on "Add to Cart" collapses to a single addItem call + single toast,
  // instead of queueing one of each per click.
  const addingRef = useRef(false);
  const addConfiguredItem = () => {
    if (product.pwywEnabled) {
      const selected = product.pwywTiers?.find((tier) => String(tier.id) === String(selectedTierId));
      if (!selected) {
        toast.error(t('pdp.chooseAmount'));
        return false;
      }
      if (reselectKey) {
        replaceStaleItem(reselectKey, product, qty, selected.id);
      } else {
        addItem(product, qty, selected.id);
      }
      return true;
    }
    addItem(product, qty);
    return true;
  };

  const handleAddToCart = () => {
    if (addingRef.current) return;
    if (!addConfiguredItem()) return;
    addingRef.current = true;
    trackAddToCart(product, qty, generateEventId());
    toast.success(t('pdp.addedQty', { qty, name: product.name }), {
      icon: <Check size={18} strokeWidth={2.5} color="var(--success)" />,
    });
    setTimeout(() => { addingRef.current = false; }, 500);
  };

  const handleCheckout = () => {
    if (!addConfiguredItem()) return;
    navigate('/checkout');
  };

  const handleLoginRedirect = () => {
    navigate('/login', { state: { from: `/products/${slug}` } });
  };

  const onReview = async (data) => {
    try {
      await productsApi.addReview(product._id, data);
      toast.success(t('pdp.reviewSubmitted'));
      reset();
      setReviewOpen(false);
      const res = await productsApi.get(slug);
      setProduct(res.data.product);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('pdp.reviewFailed'));
    }
  };

  if (loading) return <PageLoader />;

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-20)' }}>
        <h2>{t('pdp.notFound')}</h2>
        <Link to="/products" className="btn btn-outline" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft className="icon-dir" size={16} strokeWidth={2} aria-hidden="true" /> {t('pdp.back')}
        </Link>
      </div>
    );
  }

  const tiers = product.pwywTiers || [];
  const requestedTier = tiers.find((tier) => String(tier.id) === String(requestedTierId));
  const defaultTier = tiers.find((tier) => tier.isDefault);
  const selectedTierId = String(
    tierSelection.productId === String(product._id)
      ? tierSelection.tierId
      : (requestedTier || defaultTier || tiers[0])?.id || ''
  );

  const discount = !product.pwywEnabled && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div className="pdp-page">
      <style>{`
        .pdp-page { padding: var(--space-8) 0 var(--space-16); }
        .pdp-back-link {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: var(--space-6);
          display: inline-block;
        }
        .pdp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-12);
          align-items: start;
        }

        /* ── Main Image Viewer ── */
        .pdp-main-image {
          position: relative;
          aspect-ratio: 1;
          border-radius: var(--radius-lg);
          background: var(--border-light);
          overflow: hidden;
          border: 1px solid var(--border-light);
          user-select: none;
          touch-action: pan-y;
          cursor: grab;
        }
        .pdp-main-image:active { cursor: grabbing; }
        .pdp-main-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.25s ease;
        }
        .pdp-image-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        .pdp-image-fallback svg {
          width: 120px;
          height: 120px;
        }

        /* Arrows */
        .pdp-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.92);
          color: var(--forest-deep);
          font-size: 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 5;
          transition: background 0.15s;
        }
        .pdp-arrow:hover { background: #fff; }
        .pdp-arrow.prev { left: 12px; }
        .pdp-arrow.next { right: 12px; }

        /* Dots */
        .pdp-dots {
          position: absolute;
          bottom: 14px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 7px;
          z-index: 5;
        }
        .pdp-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.55);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pdp-dot.active {
          background: #fff;
          transform: scale(1.35);
        }

        /* Thumbnails */
        .pdp-thumbs {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .pdp-thumb {
          width: 72px;
          height: 72px;
          border-radius: var(--radius);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid var(--border-light);
          padding: 0;
          background: none;
          transition: border-color 0.2s, transform 0.15s;
        }
        .pdp-thumb:hover {
          transform: translateY(-2px);
        }
        .pdp-thumb.active {
          border-color: var(--sage);
          box-shadow: 0 0 0 1px var(--sage);
        }
        .pdp-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ── Rest of styles (unchanged) ── */
        .pdp-info { display: flex; flex-direction: column; gap: var(--space-5); }
        .pdp-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .pdp-title {
          font-family: var(--font-display);
          font-size: clamp(24px, 3.5vw, 36px);
          color: var(--forest-deep);
          line-height: 1.2;
        }
        .pdp-rating-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pdp-stars { display: flex; gap: 2px; }
        .pdp-star { font-size: 18px; color: var(--border); }
        .pdp-star.filled { color: var(--amber); }
        .pdp-rating-value { color: var(--forest); font-weight: 600; }
        .pdp-review-count { color: var(--muted); font-size: 14px; }
        .pdp-price-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .pdp-price {
          font-size: clamp(28px, 4vw, 32px);
          font-weight: 700;
          color: var(--forest);
          font-family: var(--font-display);
        }
        .pdp-original-price {
          font-size: clamp(16px, 2vw, 18px);
          color: var(--muted);
          text-decoration: line-through;
        }
        .pdp-description { color: var(--muted); line-height: 1.7; }
        .pdp-benefits h4 { font-weight: 600; color: var(--forest-deep); margin-bottom: 8px; }
        .pdp-benefits ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .pdp-benefits li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: var(--charcoal); }
        .pdp-benefits li span { color: var(--sage); margin-top: 2px; }
        .pdp-stock-row { display: flex; align-items: center; gap: 8px; }
        .pdp-stock-dot { width: 8px; height: 8px; border-radius: 50%; }
        .pdp-stock-text { font-size: 14px; color: var(--muted); }
        .pdp-qty-selector {
          display: flex; align-items: center;
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          width: fit-content;
          margin-bottom: var(--space-3);
        }
        .pdp-qty-btn {
          width: 40px; height: 44px; font-size: 18px;
          cursor: pointer; background: none; border: none; color: var(--forest);
        }
        .pdp-qty-value { width: 40px; text-align: center; font-weight: 600; }
        .pdp-actions-row { display: flex; gap: 10px; width: 100%; }
        .pdp-add-to-cart-btn { flex: 1; padding: 12px 20px; font-size: 16px; }
        .pdp-checkout-btn {
          padding: 0 24px;
          background: var(--amber);
          color: white;
          border: none;
          border-radius: var(--radius);
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-size: 14px;
          transition: background 0.2s, opacity 0.2s, transform 0.2s;
        }
        .pdp-checkout-btn:hover { background: var(--sage-dark); }
        .pdp-checkout-btn.login { opacity: 0.75; }
        .pdp-checkout-btn.login:hover { opacity: 1; transform: scale(1.02); background: var(--sage-dark); }
        .pdp-detail-toggle { border-top: 1px solid var(--border-light); padding-top: var(--space-4); }
        .pdp-detail-toggle summary { cursor: pointer; font-weight: 600; color: var(--forest); font-size: 14px; }
        .pdp-detail-toggle p { margin-top: 8px; font-size: 14px; color: var(--muted); line-height: 1.7; }
        .pdp-reviews-section { margin-top: var(--space-16); }
        .pdp-reviews-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: var(--space-8); flex-wrap: wrap; gap: var(--space-3);
        }
        .pdp-reviews-title { font-family: var(--font-display); font-size: clamp(22px, 3vw, 28px); }
        .pdp-write-review-btn { font-size: clamp(12px, 1.5vw, 14px); }
        .pdp-review-form { padding: var(--space-6); margin-bottom: var(--space-6); }
        .pdp-review-form h3 { font-family: var(--font-display); margin-bottom: var(--space-4); }
        .pdp-review-form-fields { display: flex; flex-direction: column; gap: var(--space-4); }
        .pdp-review-list { display: flex; flex-direction: column; gap: var(--space-4); }
        .pdp-review-card { padding: var(--space-5); }
        .pdp-review-card-header {
          display: flex; justify-content: space-between;
          margin-bottom: 8px; flex-wrap: wrap; gap: 8px;
        }
        .pdp-reviewer { display: flex; align-items: center; gap: 10px; }
        .pdp-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--sage); color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px;
        }
        .pdp-reviewer-name { font-weight: 600; color: var(--forest-deep); font-size: 14px; }
        .pdp-review-stars { display: flex; gap: 1px; }
        .pdp-review-stars span { font-size: 14px; color: var(--border); }
        .pdp-review-stars span.filled { color: var(--amber); }
        .pdp-review-title { font-weight: 600; margin-bottom: 4px; }
        .pdp-review-comment { color: var(--muted); font-size: 14px; line-height: 1.6; }
        .pdp-empty-reviews { text-align: center; padding: var(--space-10); color: var(--muted); }

        @media (max-width: 900px) {
          .pdp-grid { gap: var(--space-8); }
        }
        @media (max-width: 768px) {
          .pdp-page { padding: var(--space-5) 0 var(--space-12); }
          .pdp-grid { grid-template-columns: 1fr; gap: var(--space-5); }
          .pdp-image-fallback svg { width: 80px; height: 80px; }
          .pdp-thumb { width: 60px; height: 60px; }
          .pdp-actions-row { flex-direction: column; }
          .pdp-add-to-cart-btn,
          .pdp-checkout-btn { width: 100%; padding: 14px 16px; }
          .pdp-reviews-header { flex-direction: column; align-items: flex-start; }
          .pdp-write-review-btn { width: 100%; }
        }
        @media (max-width: 480px) {
          .pdp-title { font-size: clamp(20px, 6vw, 26px); }
          .pdp-price { font-size: clamp(24px, 7vw, 28px); }
          .pdp-image-fallback svg { width: 64px; height: 64px; }
          .pdp-thumb { width: 52px; height: 52px; }
        }
      `}</style>

      <div className="container">
        <Link to="/products" className="pdp-back-link">
          <ChevronLeft className="icon-dir" size={16} strokeWidth={2} style={{ verticalAlign: -3 }} aria-hidden="true" /> {t('pdp.back')}
        </Link>

        <div className="pdp-grid">
          {/* ── IMAGE SECTION ── */}
          <div>
            {/* Main Image Viewer */}
            <div
              className="pdp-main-image"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              ref={mainImageRef}
            >
              {images.length > 0 ? (
                <img
                  key={activeImage}
                  src={images[activeImage]}
                  alt={t('pdp.imageAlt', { name: product.name, n: activeImage + 1 })}
                  draggable={false}
                />
              ) : (
                <span className="pdp-image-fallback">
                  <Box strokeWidth={1.2} color="var(--sage)" aria-hidden="true" />
                </span>
              )}

              {/* Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="pdp-arrow prev"
                    onClick={goPrev}
                    aria-label={t('pdp.prevImage')}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="pdp-arrow next"
                    onClick={goNext}
                    aria-label={t('pdp.nextImage')}
                  >
                    ›
                  </button>

                  {/* Dots */}
                  <div className="pdp-dots">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`pdp-dot ${i === activeImage ? 'active' : ''}`}
                        onClick={() => goToImage(i)}
                        aria-label={t('pdp.viewImage', { n: i + 1 })}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Previews */}
            {images.length > 1 && (
              <div className="pdp-thumbs">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`pdp-thumb ${i === activeImage ? 'active' : ''}`}
                    onClick={() => goToImage(i)}
                    aria-label={t('pdp.selectImage', { n: i + 1 })}
                  >
                    <img src={img} alt={t('pdp.thumb', { n: i + 1 })} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── PRODUCT INFO (unchanged) ── */}
          <div className="pdp-info">
            <div>
              <div className="pdp-badges">
                <span className="badge badge-green">{categoryName(t, product.category)}</span>
                {!product.pwywEnabled && product.badge && (
                  <span className="badge badge-forest">{product.badge}</span>
                )}
                {discount > 0 && (
                  <span className="badge badge-amber">{t('card.off', { n: discount })}</span>
                )}
              </div>
              <h1 className="pdp-title">
                {product.name}
              </h1>
            </div>

            {product.numReviews > 0 && (
              <div
                className="pdp-rating-row"
                role="img"
                aria-label={t('card.rating', { rating: Number(product.rating || 0).toFixed(1), n: product.numReviews })}
              >
                <div className="pdp-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={`pdp-star ${s <= Math.round(product.rating) ? 'filled' : ''}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="pdp-rating-value">{product.rating}</span>
                <span className="pdp-review-count">
                  ({t('pdp.reviewsLabel', { n: product.numReviews })})
                </span>
              </div>
            )}

            {product.pwywEnabled ? (
              <div className="pdp-price-row">
                <span className="pdp-price">
                  <PriceTag
                    amount={product.pwywTiers?.find((tier) => String(tier.id) === String(selectedTierId))?.amount}
                    size="xl"
                    serif
                  />
                </span>
              </div>
            ) : (
              <div className="pdp-price-row">
                <span className="pdp-price">
                  <PriceTag amount={product.price} size="xl" serif />
                </span>
                {product.originalPrice > product.price && (
                  <span className="pdp-original-price">
                    <PriceTag amount={product.originalPrice} size="sm" muted />
                  </span>
                )}
              </div>
            )}

            {product.pwywEnabled && (
              <TierSelector
                tiers={product.pwywTiers || []}
                value={selectedTierId}
                onChange={(tierId) => setTierSelection({
                  productId: String(product._id),
                  tierId: String(tierId),
                })}
                currency={currency}
              />
            )}

            <p className="pdp-description">{product.description}</p>

            {product.benefits?.length > 0 && (
              <div className="pdp-benefits">
                <h4>{t('pdp.benefits')}</h4>
                <ul>
                  {product.benefits.map((b, i) => (
                    <li key={i}>
                      <span>✓</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pdp-stock-row">
              <span
                className="pdp-stock-dot"
                style={{
                  background:
                    product.stock > 10
                      ? 'var(--success)'
                      : product.stock > 0
                      ? 'var(--warning)'
                      : 'var(--error)',
                }}
              />
              <span className="pdp-stock-text">
                {product.stock === 0
                  ? t('card.outOfStock')
                  : product.stock <= 10
                  ? t('card.onlyLeft', { n: product.stock })
                  : t('pdp.inStock')}
              </span>
            </div>

            {product.stock > 0 && (
              <>
                <div className="pdp-qty-selector">
                  <button
                    className="pdp-qty-btn"
                    type="button"
                    aria-label={t('cart.decrease')}
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    −
                  </button>
                  <span className="pdp-qty-value">{qty}</span>
                  <button
                    className="pdp-qty-btn"
                    type="button"
                    aria-label={t('cart.increase')}
                    onClick={() => setQty(Math.min(product.stock, qty + 1))}
                  >
                    +
                  </button>
                </div>

                <div className="pdp-actions-row">
                  <button
                    className="btn btn-primary pdp-add-to-cart-btn"
                    onClick={handleAddToCart}
                  >
                    {t('card.add')} — <PriceTag
                      amount={product.pwywEnabled
                        ? Number(product.pwywTiers?.find((tier) => String(tier.id) === String(selectedTierId))?.amount) * qty
                        : product.price * qty}
                      size="md"
                      strike={false}
                      color="#ffffff"
                    />
                  </button>

                  {isAuthenticated ? (
                    <button className="pdp-checkout-btn" onClick={handleCheckout}>
                      {t('pdp.checkout')}
                    </button>
                  ) : (
                    <button
                      className="pdp-checkout-btn login"
                      onClick={handleLoginRedirect}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Lock size={15} strokeWidth={2} aria-hidden="true" /> {t('cart.loginCheckout')}
                    </button>
                  )}
                </div>
              </>
            )}

            {product.howToUse && (
              <details className="pdp-detail-toggle">
                <summary>{t('pdp.howToUse')}</summary>
                <p>{product.howToUse}</p>
              </details>
            )}

            {product.ingredients?.length > 0 && (
              <details className="pdp-detail-toggle">
                <summary>{t('pdp.ingredients')}</summary>
                <p>{product.ingredients.join(', ')}</p>
              </details>
            )}
          </div>
        </div>

        {/* ── Reviews Section (unchanged) ── */}
        <div className="pdp-reviews-section">
          <div className="pdp-reviews-header">
            <h2 className="pdp-reviews-title">
              {t('pdp.reviewsTitle', { n: product.numReviews })}
            </h2>
            {isAuthenticated && (
              <button
                className="btn btn-outline pdp-write-review-btn"
                onClick={() => setReviewOpen(!reviewOpen)}
              >
                {reviewOpen ? t('pdp.cancel') : t('pdp.writeReview')}
              </button>
            )}
          </div>

          {reviewOpen && (
            <form
              onSubmit={handleSubmit(onReview)}
              className="card pdp-review-form"
            >
              <h3>{t('pdp.yourReview')}</h3>
              <div className="pdp-review-form-fields">
                <div>
                  <label className="label" htmlFor="review-rating">{t('pdp.rating')} *</label>
                  <select
                    id="review-rating"
                    className="input"
                    style={{ marginTop: 8 }}
                    {...register('rating', {
                      required: t('pdp.ratingRequired'),
                      valueAsNumber: true,
                    })}
                  >
                    <option value="">{t('pdp.selectRating')}</option>
                    {[5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>
                        {t('pdp.starOption', { n: s })}
                      </option>
                    ))}
                  </select>
                  {errors.rating && (
                    <span className="field-error">{errors.rating.message}</span>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="review-title">{t('pdp.reviewTitle')}</label>
                  <input
                    id="review-title"
                    className="input"
                    placeholder={t('pdp.reviewTitlePh')}
                    {...register('title')}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="review-comment">{t('pdp.comment')} *</label>
                  <textarea
                    id="review-comment"
                    className="input"
                    rows={4}
                    placeholder={t('pdp.commentPh')}
                    style={{ resize: 'vertical' }}
                    {...register('comment', {
                      required: t('pdp.commentRequired'),
                      minLength: { value: 10, message: t('pdp.commentMin') },
                    })}
                  />
                  {errors.comment && (
                    <span className="field-error">{errors.comment.message}</span>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('pdp.submitting') : t('pdp.submit')}
                </button>
              </div>
            </form>
          )}

          {product.reviews?.filter((r) => !r.hidden).length === 0 ? (
            <div className="pdp-empty-reviews">{t('pdp.noReviews')}</div>
          ) : (
            <div className="pdp-review-list">
              {product.reviews
                ?.filter((r) => !r.hidden)
                .map((r) => (
                  <div key={r._id} className="card pdp-review-card">
                    <div className="pdp-review-card-header">
                      <div className="pdp-reviewer">
                        <div className="pdp-avatar">
                          {r.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="pdp-reviewer-name">{r.name}</div>
                          {r.verified && (
                            <span className="badge badge-green" style={{ fontSize: 10 }}>
                              {t('pdp.verified')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="pdp-review-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= r.rating ? 'filled' : ''}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    {r.title && <p className="pdp-review-title">{r.title}</p>}
                    <p className="pdp-review-comment">{r.comment}</p>
                  </div>
                ))}
            </div>
          )}
        </div>

        <RecommendedProducts productId={product._id} category={product.category} />
      </div>
    </div>
  );
}