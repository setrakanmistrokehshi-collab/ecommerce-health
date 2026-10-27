import React, { useState, useEffect, useCallback } from 'react';
import { products as productsApi, admin as adminApi } from '@/api/client';
import { Modal, Pagination } from '@/components/ui';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Pill } from 'lucide-react';

const CATEGORIES = ['immunity', 'energy', 'vitamins', 'weight', 'beauty', 'general'];

function isInteractiveTarget(el) {
  return el?.closest?.('button, a, input, select, textarea, label');
}

function parseImageInput(value) {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null); // null=closed, {}=create, {..}=edit
  const [viewItem, setViewItem] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [newStock, setNewStock] = useState('');

  const fetchProducts = useCallback(() => {
    setLoading(true);
    productsApi
      .list({ page, limit: 15, search: search || undefined, sort: '-createdAt' })
      .then(({ data }) => {
        setItems(data.products || []);
        setTotal(data.pagination?.total || 0);
        setPages(data.pagination?.pages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This is a soft delete.`)) return;
    try {
      await productsApi.delete(id);
      toast.success('Product deleted');
      fetchProducts();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const handleStockUpdate = async () => {
    try {
      await adminApi.updateStock(stockModal._id, parseInt(newStock, 10));
      toast.success('Stock updated');
      setStockModal(null);
      fetchProducts();
    } catch {
      toast.error('Stock update failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              color: 'var(--admin-text)',
              marginBottom: 4,
            }}
          >
            Products
          </h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>{total} total products</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditItem({})}>
          + New Product
        </button>
      </div>

      {/* Search */}
      <div className="admin-card" style={{ padding: 'var(--space-4)' }}>
        <input
          className="admin-input"
          placeholder="Search products by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 340 }}
        />
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                    No products found
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr
                    key={p._id}
                    onClick={(e) => {
                      if (isInteractiveTarget(e.target)) return;
                      setViewItem(p);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius)',
                            background: 'var(--admin-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {p.thumbnail || p.images?.[0] ? (
                            <img
                              src={p.thumbnail || p.images[0]}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Pill size={17} strokeWidth={1.8} color="var(--admin-muted)" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--admin-text)', fontSize: 14 }}>
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--admin-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: 13, color: 'var(--admin-muted)' }}>
                        {p.category}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
                        ₦{p.price?.toLocaleString()}
                      </div>
                      {p.originalPrice > p.price && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--admin-muted)',
                            textDecoration: 'line-through',
                          }}
                        >
                          ₦{p.originalPrice?.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              p.stock === 0 ? '#f87171' : p.stock <= 10 ? '#fbbf24' : 'var(--admin-accent)',
                          }}
                        >
                          {p.stock}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStockModal(p);
                            setNewStock(String(p.stock));
                          }}
                          style={{
                            fontSize: 11,
                            color: 'var(--admin-muted)',
                            cursor: 'pointer',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--admin-bg)',
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                    <td>
                      {p.numReviews > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#fbbf24', fontSize: 13 }}>★</span>
                          <span style={{ fontSize: 13, color: 'var(--admin-text)' }}>
                            {Number(p.rating).toFixed(1)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>
                            ({p.numReviews})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--admin-muted)', fontSize: 12 }}>No reviews</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background:
                            p.isActive !== false
                              ? 'rgba(122,158,126,0.15)'
                              : 'rgba(248,113,113,0.15)',
                          color: p.isActive !== false ? '#7a9e7e' : '#f87171',
                        }}
                      >
                        {p.isActive !== false ? 'Active' : 'Deleted'}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{ display: 'flex', gap: 6 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setViewItem(p)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(124,92,252,0.1)',
                            color: '#7c5cfc',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItem(p)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(122,158,126,0.1)',
                            color: '#7a9e7e',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p._id, p.name)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(248,113,113,0.1)',
                            color: '#f87171',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--admin-border)' }}>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {/* View modal — no page navigation */}
      {viewItem && (
        <ProductViewModal
          product={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={() => {
            setEditItem(viewItem);
            setViewItem(null);
          }}
        />
      )}

      {/* Product Edit/Create Modal */}
      {editItem !== null && (
        <ProductModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            fetchProducts();
          }}
        />
      )}

      {/* Stock Modal */}
      <Modal
        open={!!stockModal}
        onClose={() => setStockModal(null)}
        title={`Update Stock — ${stockModal?.name}`}
        maxWidth={360}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="label" style={{ color: 'var(--forest)' }}>
              New Stock Count
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              autoFocus
            />
          </div>
          <button type="button" className="btn btn-primary btn-full" onClick={handleStockUpdate}>
            Update Stock
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Product View Modal ───────────────────────────────────────────
function ProductViewModal({ product: p, onClose, onEdit }) {
  const gallery = React.useMemo(() => {
    const fromImages = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (fromImages.length) return fromImages;
    if (p.thumbnail) return [p.thumbnail];
    return [];
  }, [p.images, p.thumbnail]);

  const [activeIdx, setActiveIdx] = React.useState(0);

  // Reset when opening another product
  React.useEffect(() => {
    setActiveIdx(0);
  }, [p._id]);

  const mainSrc = gallery[activeIdx] || null;

  return (
    <Modal open onClose={onClose} title="Product details" maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Main image — contain so it isn’t cropped/zoomed */}
        <div
          style={{
            width: '100%',
            height: 280,
            borderRadius: 'var(--radius-md)',
            background: 'var(--admin-bg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--admin-border)',
          }}
        >
          {mainSrc ? (
            <img
              src={mainSrc}
              alt={p.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain', // full image visible
              }}
            />
          ) : (
            <Pill size={48} strokeWidth={1.5} color="var(--admin-muted)" aria-hidden="true" />
          )}
        </div>

        {/* Thumbnails — click to swap main frame */}
        {gallery.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {gallery.map((src, i) => {
              const active = i === activeIdx;
              return (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  title={`Image ${i + 1}`}
                  style={{
                    padding: 0,
                    border: active
                      ? '2px solid var(--admin-accent, #7a9e7e)'
                      : '1px solid var(--admin-border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    background: 'var(--admin-bg)',
                    opacity: active ? 1 : 0.75,
                  }}
                >
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Title + status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--admin-text)',
                margin: 0,
              }}
            >
              {p.name}
            </h2>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                background:
                  p.isActive !== false
                    ? 'rgba(122,158,126,0.15)'
                    : 'rgba(248,113,113,0.15)',
                color: p.isActive !== false ? '#7a9e7e' : '#f87171',
              }}
            >
              {p.isActive !== false ? 'Active' : 'Deleted'}
            </span>
            {p.badge ? (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b',
                }}
              >
                {p.badge}
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--admin-muted)',
              fontFamily: 'var(--font-mono)',
              marginTop: 4,
            }}
          >
            {p.slug}
          </div>
        </div>

        {/* Price / stock / category */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            background: 'var(--admin-bg)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 4 }}>Price</div>
            <div style={{ fontWeight: 700, color: 'var(--admin-text)', fontSize: 18 }}>
              ₦{Number(p.price || 0).toLocaleString()}
            </div>
            {p.originalPrice > p.price ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--admin-muted)',
                  textDecoration: 'line-through',
                }}
              >
                ₦{Number(p.originalPrice).toLocaleString()}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 4 }}>Stock</div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                color:
                  p.stock === 0 ? '#f87171' : p.stock <= 10 ? '#fbbf24' : 'var(--admin-accent)',
              }}
            >
              {p.stock}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 4 }}>
              Category
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                textTransform: 'capitalize',
                color: 'var(--admin-text)',
              }}
            >
              {p.category || '—'}
            </div>
          </div>
        </div>

        {p.numReviews > 0 ? (
          <div style={{ fontSize: 14, color: 'var(--admin-text)' }}>
            <span style={{ color: '#fbbf24' }}>★</span> {Number(p.rating).toFixed(1)} (
            {p.numReviews} reviews)
            {p.featured ? ' · Featured' : ''}
          </div>
        ) : null}

        {p.description ? (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--admin-muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Description
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--admin-text)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {p.description}
            </p>
          </div>
        ) : null}

        {Array.isArray(p.benefits) && p.benefits.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--admin-muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Benefits
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--admin-text)', fontSize: 14 }}>
              {p.benefits.map((b, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {p.howToUse ? (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--admin-muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              How to use
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--admin-text)' }}>{p.howToUse}</p>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 4 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onEdit}>
            Edit product
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Product Create/Edit Modal ─────────────────────────────────────
function ProductModal({ item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || '',
      originalPrice: item?.originalPrice || '',
      category: item?.category || 'general',
      stock: item?.stock || 0,
      badge: item?.badge || '',
      featured: item?.featured || false,
      benefits: item?.benefits?.join('\n') || '',
      howToUse: item?.howToUse || '',
      images: item?.images?.join('\n') || '',
    },
  });

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      price: Number(data.price),
      originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
      stock: Number(data.stock),
      benefits: data.benefits ? data.benefits.split('\n').filter(Boolean) : [],
      images: parseImageInput(data.images),
    };
    try {
      if (isEdit) {
        await productsApi.update(item._id, payload);
        toast.success('Product updated!');
      } else {
        await productsApi.create(payload);
        toast.success('Product created!');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit: ${item.name}` : 'Create New Product'}
      maxWidth={620}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Product Name *</label>
            <input
              className={`input ${errors.name ? 'error' : ''}`}
              {...register('name', { required: 'Required' })}
            />
          </div>
          <div>
            <label className="label">Price (₦) *</label>
            <input
              className="input"
              type="number"
              min={0}
              {...register('price', { required: 'Required' })}
            />
          </div>
          <div>
            <label className="label">Original Price (₦)</label>
            <input className="input" type="number" min={0} {...register('originalPrice')} />
          </div>
          <div>
            <label className="label">Category *</label>
            <select className="input" {...register('category', { required: 'Required' })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stock</label>
            <input className="input" type="number" min={0} {...register('stock')} />
          </div>
          <div>
            <label className="label">Badge (e.g. New, Hot)</label>
            <input className="input" placeholder="Leave empty for none" {...register('badge')} />
          </div>
        </div>

        <div>
          <label className="label">Description *</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            {...register('description', { required: 'Required' })}
          />
        </div>

        <div>
          <label className="label">Benefits (one per line)</label>
          <textarea
            className="input"
            rows={3}
            placeholder={'Boosts immunity\nIncreases energy\nRich in Vitamin C'}
            style={{ resize: 'vertical' }}
            {...register('benefits')}
          />
        </div>

        <div>
          <label className="label">How to Use</label>
          <input
            className="input"
            placeholder="Take 1 capsule daily with food"
            {...register('howToUse')}
          />
        </div>

        <div>
          <label className="label">Image URLs (one per line, or comma-separated)</label>
          <textarea
            className="input"
            rows={3}
            placeholder={
              'https://res.cloudinary.com/.../image1.jpg\nhttps://res.cloudinary.com/.../image2.jpg\n\nor: url1, url2, url3'
            }
            style={{ resize: 'vertical' }}
            {...register('images')}
          />
          <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginTop: 4 }}>
            Paste one link per line, or separate multiple links with commas — both work now.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="featured" {...register('featured')} />
          <label
            htmlFor="featured"
            style={{ fontSize: 14, cursor: 'pointer', color: 'var(--charcoal)' }}
          >
            Mark as Featured Product
          </label>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ flex: 1 }}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}