import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { products as productsApi } from '@/api/client';
import { ProductCard, ProductGridSkeleton, EmptyState, Pagination } from '@/components/ui';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { categoryName } from '@/i18n/helpers';

const CATEGORIES = ['immunity', 'energy', 'vitamins', 'weight', 'beauty', 'general'];
// Sort values go to the API unchanged; labels come from sort.<labelKey>.
const SORTS = [
  { value: '-createdAt', labelKey: 'newest' },
  { value: '-rating',    labelKey: 'rating' },
  { value: '-totalSold', labelKey: 'sold' },
  { value: 'price',      labelKey: 'priceAsc' },
  { value: '-price',     labelKey: 'priceDesc' },
];

export default function ProductsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const searchTimer = useRef(null);

  const category = params.get('category') || '';
  const search   = params.get('search')   || '';
  const sort     = params.get('sort')     || '-createdAt';
  const page     = parseInt(params.get('page') || '1', 10);
  const featured = params.get('featured') || '';

  const set = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  // Debounce typing so each keystroke doesn't fire a request
  const onSearchChange = (e) => {
    const value = e.target.value;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => set('search', value), 300);
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const fetchProducts = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const q = { sort, page, limit: 12 };
    if (category) q.category = category;
    if (search)   q.search   = search;
    if (featured) q.featured = featured;

    productsApi.list(q, { signal: controller.signal })
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        console.error('Failed to load products:', err);
        setError(err);
        setData(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, [category, search, sort, page, featured]);

  useEffect(() => fetchProducts(), [fetchProducts]);

  const title = category ? categoryName(t, category) : featured ? t('products.bestsellers') : t('products.all');
  const total = data?.pagination?.total || 0;

  return (
    <div style={{ minHeight: '80vh' }}>
      <div className="page-title-block">
        <div className="container">
          <h1>{title}</h1>
          <p aria-live="polite">
            {data ? t('products.count', { n: total }) : t('products.explore')}
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
        <div className="filters" role="search">
          <div className="filter-search">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              className="input"
              type="search"
              aria-label={t('products.search')}
              placeholder={t('products.search')}
              defaultValue={search}
              onChange={onSearchChange}
            />
          </div>
          <select
            className="input filter-select"
            aria-label={t('products.sort')}
            value={sort}
            onChange={(e) => set('sort', e.target.value)}
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{t(`sort.${s.labelKey}`)}</option>)}
          </select>
          {(category || search || featured) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({})}>
              <X size={16} strokeWidth={2.2} aria-hidden="true" /> {t('products.clear')}
            </button>
          )}
        </div>

        <div className="chips" role="group" aria-label={t('products.filterGoal')}>
          <button type="button" className="chip" aria-pressed={!category} onClick={() => set('category', '')}>{t('products.allChip')}</button>
          {CATEGORIES.map((c) => (
            <button type="button" key={c} className="chip" aria-pressed={category === c} onClick={() => set('category', c)}>
              {categoryName(t, c)}
            </button>
          ))}
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : error ? (
          <div className="notice" role="alert">
            <p>{t('products.loadError')}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={fetchProducts}>{t('home.tryAgain')}</button>
          </div>
        ) : data?.products?.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t('products.noMatch')}
            message={t('products.noMatchMsg')}
            action={<button type="button" className="btn btn-outline" onClick={() => setParams({})}>{t('products.clear')}</button>}
          />
        ) : (
          <>
            <div className="product-grid">
              {data?.products?.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
            <Pagination
              page={page}
              pages={data?.pagination?.pages || 1}
              onPage={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', p);
                setParams(next);
                window.scrollTo({ top: 0 });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
