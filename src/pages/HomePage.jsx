import React, { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categoryName } from '@/i18n/helpers';
import { products as productsApi, users as usersApi } from '@/api/client';
import useAuthStore from '@/context/authStore';
import { ProductCard, ProductGridSkeleton, EmptyState } from '@/components/ui';
import PriceTag from '@/components/PriceTag';
import {
  ShieldPlus, Flame, Pill, Scale, Flower2, HeartPulse, ArrowRight, Box, Check,
} from 'lucide-react';

// Category ids match the `category` query the products API already accepts.
// Names and descriptions live in the locale files: categories.<id>.name / .desc
const CATEGORIES = [
  { id: 'immunity', Icon: ShieldPlus },
  { id: 'energy',   Icon: Flame },
  { id: 'vitamins', Icon: Pill },
  { id: 'weight',   Icon: Scale },
  { id: 'beauty',   Icon: Flower2 },
  { id: 'general',  Icon: HeartPulse },
];

// CONTENT TO CONFIRM WITH THE OWNER before launch: home.delivery (cities
// come from the previous homepage copy). Delivery speed, customer counts
// and "100% natural" were removed: nothing in the codebase backs them up.
const STEPS = ['step1', 'step2', 'step3'];

const CategoryRow = memo(function CategoryRow({ cat }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link to={`/products?category=${cat.id}`} className="ledger-row">
        <cat.Icon className="ledger-icon" size={24} strokeWidth={1.8} aria-hidden="true" />
        <span>
          <span className="ledger-name">{t(`categories.${cat.id}.name`)}</span>
          <span className="ledger-desc">{t(`categories.${cat.id}.desc`)}</span>
        </span>
        <ArrowRight className="ledger-go icon-dir" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
});

// Hero panel shows a real product from the API: no stock photo, no invented stats.
const HeroProduct = memo(function HeroProduct({ product }) {
  const { t } = useTranslation();
  const price = product.pwywEnabled
    ? product.pwywTiers?.find((t) => t.isDefault)?.amount
    : product.price;
  return (
    <aside aria-labelledby="hero-product-label">
      <h2 id="hero-product-label" className="sr-only">{t('home.featuredLabel')}</h2>
      <Link to={`/products/${product.slug || product._id}`} className="hf">
        <div className="hf-media">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt="" width="640" height="480" fetchPriority="high" decoding="async" />
          ) : (
            <Box size={56} strokeWidth={1.4} aria-hidden="true" />
          )}
        </div>
        <div className="hf-body">
          <span className="hf-cat" style={{ textTransform: 'capitalize' }}>{categoryName(t, product.category)}</span>
          <span className="hf-name">{product.name}</span>
          <div className="hf-foot">
            <PriceTag amount={price} size="lg" />
            <span className="link-action" style={{ textDecoration: 'none' }}>
              {t('home.viewProduct')} <ArrowRight className="icon-dir" size={16} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </aside>
  );
});

function EmailSignup() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  const subscribe = async () => {
    setStatus('sending');
    try {
      // Same endpoint and payload the Profile > Newsletter tab uses.
      await usersApi.subscribeNewsletter({ subscribe: true });
      setStatus('done');
    } catch (err) {
      console.error('Newsletter subscribe failed:', err);
      setStatus('error');
    }
  };

  return (
    <div className="signup">
      <div>
        <h2>{t('home.signupTitle')}</h2>
        <p>{t('home.signupBody')}</p>
      </div>
      <div className="signup-actions">
        {!isAuthenticated ? (
          <>
            <Link to="/login" className="btn btn-primary">{t('home.loginSubscribe')}</Link>
            <Link to="/register" className="btn btn-outline">{t('footer.createAccount')}</Link>
          </>
        ) : status === 'done' ? (
          <p className="signup-msg" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 600 }}>
            <Check size={18} aria-hidden="true" /> {t('home.subscribed')}
          </p>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={subscribe} disabled={status === 'sending'}>
              {status === 'sending' ? t('home.subscribing') : t('home.subscribe')}
            </button>
            {status === 'error' && (
              <p className="signup-msg" role="alert" style={{ color: 'var(--danger)' }}>
                {t('home.subscribeError')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    productsApi.list({ featured: true, limit: 6 })
      .then(({ data }) => setFeatured(data.products || []))
      .catch((err) => { console.error('Failed to load featured products:', err); setFeatured([]); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const heroProduct = featured[0];
  const gridProducts = featured.slice(1, 5);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className={`container hero-grid ${heroProduct ? '' : 'hero-grid--solo'}`}>
          <div className="hero-copy">
            <h1 id="hero-title">{t('home.title')}</h1>
            <p className="hero-lede">{t('home.lede')}</p>
            <div className="hero-cta">
              <Link to="/products" className="btn btn-primary btn-lg">{t('home.ctaShop')}</Link>
              <Link to="/products?featured=true" className="btn btn-outline btn-lg">{t('home.ctaBest')}</Link>
            </div>
            <p className="hero-note">{t('home.delivery')}</p>
          </div>
          {heroProduct && <HeroProduct product={heroProduct} />}
        </div>
      </section>

      <section className="sec" aria-labelledby="goals-title" style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="container">
          <div className="sec-head">
            <h2 id="goals-title">{t('home.goalsTitle')}</h2>
            <p>{t('home.goalsSub')}</p>
          </div>
          <ul className="ledger">
            {CATEGORIES.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
          </ul>
        </div>
      </section>

      <section className="sec" aria-labelledby="featured-title">
        <div className="container">
          <div className="sec-head">
            <h2 id="featured-title">{t('home.featuredTitle')}</h2>
            <Link to="/products" className="link-action">{t('home.seeAll')} <ArrowRight className="icon-dir" size={16} aria-hidden="true" /></Link>
          </div>

          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : error ? (
            <div className="notice" role="alert">
              <p>{t('home.featuredError')}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={load}>{t('home.tryAgain')}</button>
            </div>
          ) : featured.length === 0 ? (
            <EmptyState
              title={t('home.noFeatured')}
              message={t('home.noFeaturedMsg')}
              action={<Link to="/products" className="btn btn-outline">{t('home.browseAll')}</Link>}
            />
          ) : gridProducts.length > 0 ? (
            <div className="product-grid">
              {gridProducts.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec" aria-labelledby="how-title">
        <div className="container">
          <div className="sec-head">
            <h2 id="how-title">{t('home.howTitle')}</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s}>
                <h3>{t(`home.${s}Title`)}</h3>
                <p>{t(`home.${s}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec" aria-label={t('home.emailUpdates')}>
        <div className="container">
          <EmailSignup />
        </div>
      </section>
    </>
  );
}
