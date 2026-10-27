import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { promoCodes } from '@/api/client';
import { Plus, Pencil, Power, Search, Tag, Trash2 } from 'lucide-react';

const EMPTY_DRAFT = { code: '', discountPercent: '', usageLimit: '', expiresAt: '' };

function unwrapPromoList(response) {
  const body = response?.data?.data ?? response?.data ?? response ?? {};
  const list = body.promoCodes ?? body.promos ?? body.coupons ?? body.items ?? body.results ?? body;
  return Array.isArray(list) ? list : [];
}

function formatDate(value) {
  if (!value) return 'No expiry';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function getExpiryValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (data?.errors?.length) return data.errors.map((item) => item.msg).join(', ');
  return data?.message || data?.error || fallback;
}

export default function AdminPromoCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await promoCodes.list();
      setCodes(unwrapPromoList(response));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load promo codes'));
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    promoCodes.list()
      .then((response) => {
        if (!cancelled) setCodes(unwrapPromoList(response));
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(getErrorMessage(error, 'Failed to load promo codes'));
        setCodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return codes;
    return codes.filter((item) => String(item.code ?? '').toLowerCase().includes(query));
  }, [codes, search]);

  function startCreate() {
    setDraft(EMPTY_DRAFT);
    setEditing('new');
  }

  function startEdit(item) {
    setDraft({
      code: String(item.code ?? ''),
      discountPercent: String(item.discountPercent ?? ''),
      usageLimit: String(item.usageLimit ?? item.maxUses ?? ''),
      expiresAt: getExpiryValue(item.expiresAt),
    });
    setEditing(item);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  }

  async function submitDraft(event) {
    event.preventDefault();
    const code = draft.code.trim().toUpperCase();
    const discountPercent = Number(draft.discountPercent);

    if (!code) {
      toast.error('Promo code is required');
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      toast.error('Discount must be between 1% and 100%');
      return;
    }
    const usageLimit = draft.usageLimit.trim() === '' ? null : Number(draft.usageLimit);
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
      toast.error('Usage limit must be a whole number greater than zero');
      return;
    }

    const payload = {
     code,
     discountPercent,
     usageLimit,
     expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T23:59:59`).toISOString() : null,
};
    setSaving(true);
    try {
      if (editing === 'new') {
        await promoCodes.create(payload);
        toast.success(`${code} created`);
      } else {
        await promoCodes.update(editing._id ?? editing.id, payload);
        toast.success(`${code} updated`);
      }
      cancelEdit();
      await loadCodes();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save promo code'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCode(item) {
    const id = item._id ?? item.id;
    setWorkingId(id);
    try {
      
      await promoCodes.toggleActive(id);
      toast.success(`${item.code} ${item.isActive === false ? 'activated' : 'deactivated'}`);
      await loadCodes();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update promo code'));
    } finally {
      setWorkingId('');
    }
  }

  async function deleteCode(item) {
    const id = item._id ?? item.id;
    if (!window.confirm(`Delete promo code ${item.code}? This can't be undone.`)) return;
    setWorkingId(id);
    try {
      await promoCodes.delete(id);
      toast.success(`${item.code} deleted`);
      await loadCodes();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete promo code'));
    } finally {
      setWorkingId('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1>Promo Codes</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>
            Create and manage percentage discounts available at checkout.
          </p>
        </div>
        <button className="btn btn-primary" onClick={startCreate} type="button">
          <Plus size={16} strokeWidth={2} />
          Create promo code
        </button>
      </div>

      {editing && (
        <form className="admin-card" onSubmit={submitDraft}>
          <h2 style={{ color: 'var(--admin-text)', fontSize: 17, marginBottom: 'var(--space-4)' }}>
            {editing === 'new' ? 'New promo code' : `Edit ${editing.code}`}
          </h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label htmlFor="promo-code">Code</label>
              <input
                id="promo-code"
                className="admin-input"
                value={draft.code}
                onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-discount">Discount percentage</label>
              <input
                id="promo-discount"
                className="admin-input"
                type="number"
                min="1"
                max="100"
                step="0.01"
                value={draft.discountPercent}
                onChange={(event) => setDraft((current) => ({ ...current, discountPercent: event.target.value }))}
                placeholder="10"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-expiry">Expiry date (optional)</label>
              <input
                id="promo-expiry"
                className="admin-input"
                type="date"
                value={draft.expiresAt}
                onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-usage-limit">Maximum uses (optional)</label>
              <input
                id="promo-usage-limit"
                className="admin-input"
                type="number"
                min="1"
                step="1"
                value={draft.usageLimit}
                onChange={(event) => setDraft((current) => ({ ...current, usageLimit: event.target.value }))}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-5)' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Create code' : 'Save changes'}
            </button>
            <button className="btn btn-outline" type="button" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--space-3) var(--space-4)' }}>
        <Search size={17} color="var(--admin-muted)" aria-hidden="true" />
        <input
          className="admin-input"
          aria-label="Search promo codes"
          placeholder="Search promo codes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ border: 0, padding: 0, boxShadow: 'none' }}
        />
        <span style={{ color: 'var(--admin-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{filteredCodes.length} codes</span>
      </div>

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Usage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>Loading promo codes…</td></tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                    <Tag size={20} style={{ display: 'block', margin: '0 auto 8px' }} aria-hidden="true" />
                    {search ? 'No matching promo codes' : 'No promo codes yet'}
                  </td>
                </tr>
              ) : filteredCodes.map((item) => {
                const id = item._id ?? item.id;
                const active = item.isActive !== false;
                const used = item.usedCount ?? item.usageCount ?? item.timesUsed;
                const limit = item.usageLimit ?? item.maxUses;
                return (
                  <tr key={id ?? item.code}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.code}</td>
                    <td>{Number(item.discountPercent)}%</td>
                    <td>{formatDate(item.expiresAt)}</td>
                    <td><span className={`badge ${active ? 'badge-green' : 'badge-gray'}`}>{active ? 'Active' : 'Inactive'}</span></td>
                    <td>{used == null ? '—' : `${used}${limit == null ? '' : ` / ${limit}`}`}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn" type="button" title="Edit promo code" aria-label={`Edit ${item.code}`} onClick={() => startEdit(item)}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button className="icon-btn" type="button" title={active ? 'Deactivate promo code' : 'Activate promo code'} aria-label={`${active ? 'Deactivate' : 'Activate'} ${item.code}`} disabled={workingId === id} onClick={() => toggleCode(item)}>
                          <Power size={15} aria-hidden="true" />
                        </button>
                        <button className="icon-btn" type="button" title="Delete promo code" aria-label={`Delete ${item.code}`} disabled={workingId === id} onClick={() => deleteCode(item)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}