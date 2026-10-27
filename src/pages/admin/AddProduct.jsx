import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createProduct, updateProduct, uploadProductImage, getProductById } from '../../api/adminApi';
import { ImagePlus } from 'lucide-react';

const EMPTY = {
  name: '', shortDescription: '', description: '',
  ingredients: '', benefits: '', howToUse: '',
  price: '', originalPrice: '', stock: '', servings: '',
  category: 'immunity', badge: '', tags: '',
  nafdac: '', isFeatured: false, isActive: true,
  pwywEnabled: false, pwywTiers: [],
};

const BADGE_OPTIONS = ['', 'Best Selling', 'New', 'Sale', 'Top Rated'];
const CATEGORIES = ['immunity', 'vitamins', 'beauty', 'energy', 'weight', 'general'];
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getTierErrors(form) {
  if (!form.pwywEnabled) return [];

  const tiers = Array.isArray(form.pwywTiers) ? form.pwywTiers : [];
  const errors = [];
  if (tiers.length < 2 || tiers.length > 5) {
    errors.push('Add between 2 and 5 tiers');
  }

  const labels = tiers.map((tier) => String(tier.label || '').trim().toLowerCase());
  if (labels.some((label) => !label) || new Set(labels).size !== labels.length) {
    errors.push('Tier labels must be present and unique');
  }

  const floor = Number(form.price);
  if (tiers.some((tier) => !Number.isFinite(Number(tier.amount)) || Number(tier.amount) < floor)) {
    errors.push('Each tier amount must be at least the product price');
  }

  if (tiers.filter((tier) => tier.isDefault).length !== 1) {
    errors.push('Choose exactly one default tier');
  }

  return errors;
}

/** Client-side UX validation only — API must still validate. */
function validateForm(form, files) {
  const name = String(form.name || '').trim();
  if (!name || name.length > 150) {
    return 'Product name is required (max 150 characters)';
  }

  const shortDescription = String(form.shortDescription || '').trim();
  if (!shortDescription || shortDescription.length > 300) {
    return 'Short description is required (max 300 characters)';
  }

  if (String(form.description || '').length > 5000) {
    return 'Description must be at most 5000 characters';
  }
  const price = Number(form.price);
  // Reject 0, negatives, "0000", empty
  if (!Number.isFinite(price) || price <= 0) {
    return 'Price must be greater than 0';
  }

  const tierErrors = getTierErrors(form);
  if (tierErrors.length) return tierErrors[0];

  if (form.originalPrice !== '' && form.originalPrice != null) {
    const originalPrice = Number(form.originalPrice);
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      return 'Original price must be greater than 0';
    }
    if (originalPrice < price) {
      return 'Original price should be ≥ selling price';
    }
  }

  // Stock: allow 0 (out of stock), block negatives and decimals
  if (form.stock === '' || form.stock == null) {
    return 'Stock is required';
  }
  const stock = Number(form.stock);
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 1) {
    return 'Stock must be a whole number ≥ 1';
  }

  if (form.servings !== '' && form.servings != null) {
    const servings = Number(form.servings);
    if (!Number.isInteger(servings) || servings < 0) {
      return 'Servings must be a whole number ≥ 0';
    }
  }

  if (!CATEGORIES.includes(form.category)) {
    return 'Invalid category';
  }

  if (form.badge && !BADGE_OPTIONS.includes(form.badge)) {
    return 'Invalid badge';
  }

  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) {
      return `Image "${f.name}" exceeds 5MB`;
    }
    if (!IMAGE_TYPES.includes(f.type)) {
      return `Image "${f.name}" must be JPEG, PNG, or WebP`;
    }
  }

  return null;
}

export default function AddProduct() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;

    setLoading(true);
    getProductById(id)
      .then((res) => {
        const p = res?.data?.product || res?.product || res?.data || res;
        if (!p) return;

        setForm({
          name: p.name || '',
          shortDescription: p.shortDescription || '',
          description: p.description || '',
          ingredients: (p.ingredients || []).join(', '),
          benefits: (p.benefits || []).join(', '),
          howToUse: p.howToUse || '',
          price: p.price ?? '',
          originalPrice: p.originalPrice ?? '',
          stock: p.stock ?? '',
          servings: p.servings ?? '',
          category: p.category || 'immunity',
          badge: p.badge || '',
          tags: (p.tags || []).join(', '),
          nafdac: p.nafdac || '',
          isFeatured: !!p.isFeatured,
          isActive: p.isActive !== false,
          pwywEnabled: !!p.pwywEnabled,
          pwywTiers: Array.isArray(p.pwywTiers)
            ? p.pwywTiers.map((tier) => ({ ...tier, amount: String(tier.amount ?? '') }))
            : [],
        });

        setExistingImages(p.images || []);
      })
      .catch(() => toast.error('Failed to load product'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setTier(index, key, value) {
    setForm((current) => ({
      ...current,
      pwywTiers: current.pwywTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [key]: value } : tier
      ),
    }));
  }

  function togglePwyw(enabled) {
    setForm((current) => ({
      ...current,
      pwywEnabled: enabled,
      pwywTiers: enabled && current.pwywTiers.length < 2
        ? [
            { label: 'Standard', amount: String(current.price || ''), isDefault: true },
            { label: 'Supporter', amount: String(current.price || ''), isDefault: false },
          ]
        : current.pwywTiers,
    }));
  }

  function handleFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const remainingSlots = 5 - files.length;
    if (remainingSlots <= 0) {
      toast.error('Maximum 5 new images');
      return;
    }

    const accepted = [];
    for (const f of incoming.slice(0, remainingSlots)) {
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`"${f.name}" exceeds 5MB`);
        continue;
      }
      if (!IMAGE_TYPES.includes(f.type)) {
        toast.error(`"${f.name}" must be JPEG, PNG, or WebP`);
        continue;
      }
      accepted.push(f);
    }
    if (!accepted.length) return;

    setFiles((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [
      ...prev,
      ...accepted.map((f) => URL.createObjectURL(f)),
    ]);
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearNewFiles() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
  }

  async function handleSubmit(status = 'active') {
    const error = validateForm(form, files);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: String(form.name).trim(),
        shortDescription: String(form.shortDescription).trim(),
        description: String(form.description || '').trim(),
        howToUse: String(form.howToUse || '').trim(),
        nafdac: String(form.nafdac || '').trim(),
        category: form.category,
        badge: form.badge || undefined,
        price: Number(form.price),
        originalPrice:
          form.originalPrice !== '' && form.originalPrice != null
            ? Number(form.originalPrice)
            : undefined,
        stock: Number(form.stock),
        servings:
          form.servings !== '' && form.servings != null
            ? Number(form.servings)
            : undefined,
        ingredients: String(form.ingredients || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        benefits: String(form.benefits || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: String(form.tags || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isFeatured: Boolean(form.isFeatured),
        isActive: status === 'active',
        pwywEnabled: Boolean(form.pwywEnabled),
        pwywTiers: form.pwywEnabled
          ? form.pwywTiers.map((tier) => ({
              label: String(tier.label || '').trim(),
              amount: Number(tier.amount),
              isDefault: Boolean(tier.isDefault),
            }))
          : [],
      };

      let saved;
      if (isEdit) {
        saved = await updateProduct(id, payload);
        toast.success('Product updated');
      } else {
        saved = await createProduct(payload);
        toast.success('Product created');
      }

      const productId =
        saved?.data?.product?._id ||
        saved?.product?._id ||
        saved?.data?._id ||
        saved?._id ||
        id;

      if (files.length && productId) {
        const uploadToast = toast.loading(`Uploading ${files.length} image(s)…`);
        try {
          const fd = new FormData();
          files.forEach((f) => fd.append('images', f));
          await uploadProductImage(productId, fd);
          toast.success(`${files.length} image(s) uploaded`, { id: uploadToast });
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          toast.error(
            'Product saved but image upload failed. Try adding images again from Edit.',
            { id: uploadToast }
          );
        }
      }

      navigate('/admin/products');
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading product…</div>;
  }

  return (
    <>
      <style>{`
        .add-product-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }
        .add-product-pricing {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .add-product-header {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        @media (min-width: 900px) {
          .add-product-layout {
            grid-template-columns: 1fr 320px;
          }
          .add-product-pricing {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div className="page-header add-product-header">
        <div>
          <h1>{isEdit ? 'Edit Product' : 'Add Product'}</h1>
          <p>{isEdit ? `Editing product #${id}` : 'Create a new product listing'}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/admin/products')}
        >
          ← Back
        </button>
      </div>

      <div className="add-product-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Product Information</div>
            <Field
              label="Product Name *"
              value={form.name}
              onChange={(v) => set('name', v)}
              placeholder="e.g. Greens Plus Daily Formula"
              maxLength={150}
            />
            <Field
              label="Short Description *"
              value={form.shortDescription}
              onChange={(v) => set('shortDescription', v)}
              placeholder="One-line summary"
              maxLength={300}
            />
            <div className="form-field">
              <label>Full Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Detailed description…"
                maxLength={5000}
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <Field
              label="Ingredients (comma separated)"
              value={form.ingredients}
              onChange={(v) => set('ingredients', v)}
            />
            <Field
              label="Benefits (comma separated)"
              value={form.benefits}
              onChange={(v) => set('benefits', v)}
            />
            <Field
              label="How To Use"
              value={form.howToUse}
              onChange={(v) => set('howToUse', v)}
            />
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Pricing & Stock</div>
            <div className="add-product-pricing">
              <Field
                label="Price (₦) *"
                value={form.price}
                onChange={(v) => set('price', v)}
                type="number"
                min={0}
                step="0.01"
              />
              <Field
                label="Original Price (₦)"
                value={form.originalPrice}
                onChange={(v) => set('originalPrice', v)}
                type="number"
                min={0}
                step="0.01"
              />
              <Field
                label="Stock Quantity *"
                value={form.stock}
                onChange={(v) => set('stock', v)}
                type="number"
                min={1}
                step="1"
              />
              <Field
                label="Servings Per Pack"
                value={form.servings}
                onChange={(v) => set('servings', v)}
                type="number"
                min={0}
                step="1"
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <Toggle
                label="Enable Pay What You Want"
                checked={form.pwywEnabled}
                onChange={togglePwyw}
              />
            </div>
            {form.pwywEnabled && (
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  The lowest amount is the product&apos;s real price. Higher amounts are optional support.
                </p>
                {form.pwywTiers.map((tier, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(110px, 0.7fr) auto auto', gap: 8, alignItems: 'end' }}>
                    <Field
                      label={`Tier ${index + 1} label`}
                      value={tier.label}
                      onChange={(value) => setTier(index, 'label', value)}
                    />
                    <Field
                      label="Amount (₦)"
                      value={tier.amount}
                      onChange={(value) => setTier(index, 'amount', value)}
                      type="number"
                      min={form.price || 0}
                      step="0.01"
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 38, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <input
                        type="radio"
                        name="pwyw-default-tier"
                        checked={Boolean(tier.isDefault)}
                        onChange={() => setForm((current) => ({
                          ...current,
                          pwywTiers: current.pwywTiers.map((entry, tierIndex) => ({
                            ...entry,
                            isDefault: tierIndex === index,
                          })),
                        }))}
                      />
                      Default
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={form.pwywTiers.length <= 2}
                      onClick={() => setForm((current) => ({
                        ...current,
                        pwywTiers: current.pwywTiers.filter((_, tierIndex) => tierIndex !== index),
                      }))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={form.pwywTiers.length >= 5}
                  onClick={() => setForm((current) => ({
                    ...current,
                    pwywTiers: [...current.pwywTiers, {
                      label: '', amount: String(current.price || ''), isDefault: false,
                    }],
                  }))}
                  style={{ justifySelf: 'start' }}
                >
                  Add tier
                </button>
                {getTierErrors(form).map((message) => (
                  <div key={message} role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>
                    {message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Tags & Compliance</div>
            <Field
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(v) => set('tags', v)}
            />
            <Field
              label="NAFDAC Number"
              value={form.nafdac}
              onChange={(v) => set('nafdac', v)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>
              Product Images
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                {existingImages.length + files.length}/10 total · {files.length} new
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => document.getElementById('file-input')?.click()}
              style={{
                border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: drag ? 'rgba(0,200,150,.04)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <ImagePlus size={26} strokeWidth={1.6} color="var(--muted)" aria-hidden="true" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Drop images or click to browse</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                JPEG, PNG, WebP · Max 5MB · Up to 5 new
              </div>
            </div>

            <input
              id="file-input"
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />

            {(existingImages.length > 0 || previews.length > 0) && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {existingImages.map((src, i) => (
                  <div key={`exist-${i}`} style={{ position: 'relative', width: 72, height: 72 }}>
                    <img
                      src={src}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        left: 2,
                        fontSize: 9,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}
                    >
                      SAVED
                    </span>
                  </div>
                ))}

                {previews.map((src, i) => (
                  <div key={`new-${i}`} style={{ position: 'relative', width: 72, height: 72 }}>
                    <img
                      src={src}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#f87171',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                    {i === 0 && existingImages.length === 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          fontSize: 9,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          padding: '1px 4px',
                          borderRadius: 3,
                        }}
                      >
                        MAIN
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {previews.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8, fontSize: 12 }}
                onClick={clearNewFiles}
              >
                Clear new images
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Category & Badge</div>
            <div className="form-field">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Badge</label>
              <select
                value={form.badge}
                onChange={(e) => set('badge', e.target.value)}
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              >
                {BADGE_OPTIONS.map((b) => (
                  <option key={b || 'none'} value={b}>
                    {b || 'None'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <Toggle
                label="Featured product"
                checked={form.isFeatured}
                onChange={(v) => set('isFeatured', v)}
              />
              <Toggle
                label="Active / visible in store"
                checked={form.isActive}
                onChange={(v) => set('isActive', v)}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: 13 }}
            onClick={() => handleSubmit('active')}
            disabled={saving}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Product'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%' }}
            onClick={() => handleSubmit('draft')}
            disabled={saving}
          >
            Save as Draft
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, min, step, maxLength }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        min={min}
        step={step}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          background: checked ? 'var(--accent)' : 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 14,
            height: 14,
            background: '#fff',
            borderRadius: '50%',
          }}
        />
      </div>
      {label}
    </label>
  );
}