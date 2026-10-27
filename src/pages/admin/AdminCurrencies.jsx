// src/pages/admin/AdminCurrencies.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Plus, Pencil, Trash2, Power, AlertTriangle } from 'lucide-react';

const EMPTY_DRAFT = { code: '', name: '', symbol: '', rate: '' };
// Matches Currency.STALE_AFTER_DAYS in models/Currency.js — the admin
// list route doesn't compute isStale server-side (only the public
// GET / route does), so it's derived here from lastUpdatedAt instead.
const STALE_AFTER_DAYS = 7;

function isStale(currency) {
  if (currency.code === 'NGN' || !currency.lastUpdatedAt) return false;
  const ms = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(currency.lastUpdatedAt).getTime() > ms;
}

// Pulls a readable message out of either error shape this API returns:
// - express-validator 422s: { errors: [{ msg, path, ... }, ...] }
// - AppError-thrown errors: whatever your global error handler formats
//   them as (commonly { message } or { error }) — covered as fallbacks.
function extractError(err, fallback) {
  const data = err.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.msg).join(', ');
  return data?.message || data?.error || fallback;
}

export default function AdminCurrencies() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // null = not editing/creating. 'new' = create form. An object = editing that currency.
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/currencies/admin');
      setCurrencies(data.currencies ?? []);
    } catch (err) {
      console.error('Failed to load currencies:', err);
      toast.error(extractError(err, 'Failed to load currencies'));
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setDraft(EMPTY_DRAFT);
    setEditing('new');
  }

  function startEdit(currency) {
    setDraft({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      rate: String(currency.rate),
    });
    setEditing(currency);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  }

  async function submitDraft() {
    const rateNum = parseFloat(draft.rate);

    if (editing === 'new' && (!draft.code || draft.code.length !== 3)) {
      toast.error('Currency code must be exactly 3 letters (e.g. USD)');
      return;
    }
    if (!draft.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!draft.symbol.trim()) {
      toast.error('Symbol is required');
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      toast.error('Rate must be a positive number');
      return;
    }

    setSaving(true);
    try {
      if (editing === 'new') {
        // POST /admin upserts by code — re-adding an existing code
        // updates it rather than erroring, matching the real route's
        // findOneAndUpdate(..., { upsert: true }) behavior.
        await api.post('/currencies/admin', {
          code: draft.code.toUpperCase(),
          name: draft.name,
          symbol: draft.symbol,
          rate: rateNum,
        });
        toast.success(`${draft.code.toUpperCase()} saved`);
      } else {
        // Real backend has no PUT /admin/:id — updates go through
        // PATCH /admin/:code (code, not Mongo _id, is the key).
        await api.patch(`/currencies/admin/${editing.code}`, {
          name: draft.name,
          symbol: draft.symbol,
          rate: rateNum,
        });
        toast.success(`${editing.code} updated`);
      }
      cancelEdit();
      await load();
    } catch (err) {
      toast.error(extractError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(currency) {
    try {
      // No dedicated /toggle route exists — flip isActive through the
      // same general PATCH /admin/:code used for edits.
      await api.patch(`/currencies/admin/${currency.code}`, {
        isActive: !currency.isActive,
      });
      toast.success(`${currency.code} ${currency.isActive ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err) {
      toast.error(extractError(err, 'Toggle failed'));
    }
  }

  async function remove(currency) {
    if (!window.confirm(`Delete ${currency.code}? This can't be undone. Existing orders keep their own snapshot and won't be affected.`)) {
      return;
    }
    try {
      await api.delete(`/currencies/admin/${currency.code}`);
      toast.success(`${currency.code} deleted`);
      await load();
    } catch (err) {
      toast.error(extractError(err, 'Delete failed'));
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--admin-muted)', padding: 40, textAlign: 'center' }}>
        Loading currencies…
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Currencies</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>
            Manage which currencies customers can check out in. Rates are set manually —
            they don't update on their own, so keep them current.
          </p>
        </div>
        <button className="btn btn-primary" onClick={startCreate} type="button">
          <Plus size={16} strokeWidth={2} style={{ marginRight: 4 }} />
          Add Currency
        </button>
      </div>

      {editing && (
        <div className="admin-card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ color: 'var(--admin-text)', fontSize: 16, marginBottom: 'var(--space-4)' }}>
            {editing === 'new' ? 'Add Currency' : `Edit ${editing.code}`}
          </h3>
          <div className="form-grid-2">
            <div className="form-field">
              <label>Code</label>
              <input
                className="admin-input"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase().slice(0, 3) }))}
                placeholder="USD"
                disabled={editing !== 'new'}
                maxLength={3}
              />
            </div>
            <div className="form-field">
              <label>Name</label>
              <input
                className="admin-input"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="US Dollar"
              />
            </div>
            <div className="form-field">
              <label>Symbol</label>
              <input
                className="admin-input"
                value={draft.symbol}
                onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value }))}
                placeholder="$"
              />
            </div>
            <div className="form-field">
              <label>Rate (units of {draft.code || 'this currency'} per 1 NGN)</label>
              <input
                className="admin-input"
                type="number"
                step="any"
                value={draft.rate}
                onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                placeholder="0.00062"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-5)' }}>
            <button className="btn btn-primary" onClick={submitDraft} disabled={saving} type="button">
              {saving ? 'Saving…' : editing === 'new' ? 'Save' : 'Save Changes'}
            </button>
            <button className="btn btn-outline" onClick={cancelEdit} type="button" disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Symbol</th>
                <th>Rate</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.symbol}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{c.rate}</td>
                  <td>
                    <span className={`badge ${c.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {isStale(c) && (
                      <span
                        className="badge badge-amber"
                        style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title={`Rate hasn't been updated in over ${STALE_AFTER_DAYS} days`}
                      >
                        <AlertTriangle size={11} strokeWidth={2} aria-hidden="true" />
                        Stale
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                    {c.lastUpdatedAt
                      ? new Date(c.lastUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                    {c.updatedBy?.name ?? '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(c)}
                        type="button"
                        title="Edit"
                      >
                        <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                      {c.code !== 'NGN' && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleActive(c)}
                            type="button"
                            title={c.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => remove(c)}
                            type="button"
                            title="Delete"
                            style={{ color: 'var(--error)' }}
                          >
                            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}