import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { products as productsApi } from '@/api/client';
import { ProductCard } from '@/components/ui';

/**
 * "Recommended for you" — shown on the product detail page, directly
 * under Customer Reviews (matches the template's layout).
 *
 * Race-condition note: navigating from one product to another
 * (e.g. clicking a recommended product) re-triggers this effect with
 * a new productId/category before the previous fetch may have
 * resolved. An AbortController tied to each effect run, plus an
 * `active` flag checked before setState, ensures a slow, stale
 * response for the *previous* product can never overwrite state for
 * the product currently being viewed.
 */
export default function RecommendedProducts({ productId, category }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setLoading(true);

    productsApi
      .list(
        { category, limit: 8 },
        { signal: controller.signal }
      )
      .then(({ data }) => {
        if (!active) return;
        const filtered = (data.products || []).filter((p) => p._id !== productId).slice(0, 4);
        setItems(filtered);
      })
      .catch((err) => {
        if (!active || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [productId, category]);

  if (!loading && items.length === 0) return null;

  return (
    <div className="pdp-recommended-section">
      <style>{`
        .pdp-recommended-section {
          margin-top: var(--space-12);
          padding-top: var(--space-10);
          border-top: 1px solid var(--border-light);
        }
        .pdp-recommended-title {
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--forest-deep);
          margin-bottom: var(--space-6);
        }
        .pdp-recommended-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-5);
        }
        .pdp-recommended-skeleton {
          aspect-ratio: 3 / 4;
          border-radius: var(--radius-md);
          background: var(--border-light);
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pdp-recommended-skeleton { animation: none; }
        }
        @media (max-width: 900px) {
          .pdp-recommended-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .pdp-recommended-title { font-size: 19px; }
        }
      `}</style>

      <h2 className="pdp-recommended-title">{t('pdp.related')}</h2>

      <div className="pdp-recommended-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pdp-recommended-skeleton" aria-hidden="true" />
            ))
          : items.map((product, i) => (
              <ProductCard key={product._id} product={product} delay={i * 60} />
            ))}
      </div>
    </div>
  );
}
