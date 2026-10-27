// src/pages/admin/Settings.jsx
//
// CHANGELOG (recent):
// - RESPONSIVE: all grids/rows now use `.st-*` classes (styles injected at the
//   bottom of the component). On ≤768px every field/component stacks to a single
//   column, the tab list becomes a horizontal scroller, buttons go full-width,
//   and inputs use 16px text so iOS doesn't zoom on focus.
// - SHIPPING FIXES:
//   1. Zone cards were keyed by country|state|city, so typing in those inputs
//      changed the key → card remounted → input lost focus every keystroke.
//      Zones now carry a stable client-only `_uid` (stripped before saving).
//   2. EMPTY_FORM.domesticCap was `[5000]` (an array). Now `5000`.
//   3. parseZone: a server-side freeThreshold of 0 is normalised to null
//      ("never free"), matching the documented rule.
//   4. After a successful save we re-fetch SILENTLY (no full-page "Loading…"
//      flash, no unmounting of inputs). If that re-fetch fails, the save is
//      still reported as successful and the form is NOT put into the blocking
//      load-error state.
//   5. Loader tolerates alternate server keys (standardFee, freeShippingThreshold,
//      shippingZones) and a response wrapped as { data } or { data: { settings } }.
//   6. Saving is blocked (with a clear message) if the "Add Zone" form has
//      half-filled values that were never added — previously those silently
//      never reached the server, which looked like "data not returned".
// - Payments tab is read-only info. Nomba keys live in server env vars.
// - Zone freeThreshold: empty OR 0 ⇒ never free. For always-free set price to 0.
// - Domestic Fee Cap: 0 means "no cap". Checkout must use `> 0` guard.
// - NumberInput keeps local string state while typing; commits on blur.
// - Save is blocked while initial load failed (prevents wiping with defaults).
// - In-flight GET is aborted on unmount / re-fetch.
// - Unsaved-changes guard fires on full page unload.

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Store, CreditCard, Truck, Mail, Bell, Lock } from 'lucide-react';

// ── Webhook URL base ────────────────────────────────────────────────────────
const SERVER_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : window.location.origin;

// ── Sentinel for masked credential fields (used by smtpPass) ────────────────
const MASKED = '***';
function isMasked(v) { return !v || String(v).trim() === MASKED; }

// ── Email regex ─────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Stable client-side ids for zone rows (never sent to the server) ─────────
let _zoneCounter = 0;
function newUid() {
  _zoneCounter += 1;
  return `z${_zoneCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'store',         Icon: Store,      label: 'Store'         },
  { id: 'payments',      Icon: CreditCard, label: 'Payments'      },
  { id: 'shipping',      Icon: Truck,      label: 'Shipping'      },
  { id: 'email',         Icon: Mail,       label: 'Email'         },
  { id: 'notifications', Icon: Bell,       label: 'Notifications' },
  { id: 'security',      Icon: Lock,       label: 'Security'      },
];

const NOTIFICATIONS = [
  { id: 'lowStock',    label: 'Low stock alerts'    },
  { id: 'newOrder',    label: 'New order placed'    },
  { id: 'orderStatus', label: 'Order status update' },
  { id: 'newCustomer', label: 'New customer signup' },
  { id: 'payment',     label: 'Payment received'    },
  { id: 'review',      label: 'Review submitted'    },
];

const SECURITY_SETTINGS = [
  { id: '2fa',         label: 'Two-factor authentication' },
  { id: 'login_alert', label: 'Login email alerts'        },
  { id: 'force_https', label: 'Force HTTPS'               },
];

// Zone country autocomplete suggestions (open-ended; admin can type any value)
const ZONE_COUNTRY_SUGGESTIONS = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States',
  'United Kingdom', 'Canada', 'Cameroon', 'Senegal', 'Ivory Coast',
  'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Egypt',
  'Germany', 'France', 'Netherlands', 'Australia', 'India',
];

// Normalise a zone from either legacy { name, price } or new shape.
// Legacy zones are treated as Nigerian states — matches the migration path.
function parseZone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hasStructured = raw.country != null || raw.state != null || raw.city != null;

  // 0 / empty / invalid ⇒ null ("never free")
  let freeThreshold = null;
  if (raw.freeThreshold != null && raw.freeThreshold !== '') {
    const n = Number(raw.freeThreshold);
    freeThreshold = Number.isFinite(n) && n > 0 ? n : null;
  }

  return {
    _uid:          newUid(),
    country:       String(raw.country ?? 'Nigeria').trim(),
    state:         hasStructured ? (raw.state ? String(raw.state).trim() : '') : String(raw.name ?? '').trim(),
    city:          hasStructured ? (raw.city  ? String(raw.city).trim()  : '') : '',
    price:         Math.max(0, Number(raw.price) || 0),
    freeThreshold,
  };
}

function zoneKey(country, state, city) {
  return [
    String(country || '').toLowerCase().trim(),
    String(state   || '').toLowerCase().trim(),
    String(city    || '').toLowerCase().trim(),
  ].join('|');
}

// `payments` intentionally omitted — those keys live in server env vars.
const EMPTY_FORM = {
  store:    { name: '', email: '', phone: '', address: '', currency: '', nafdac: '', cac: '' },
  shipping: {
    fee: 0, freeThreshold: 0, domesticCap: 5000,
    internationalEnabled: false, zones: [],
  },
  notifications: {
    lowStockThreshold: 0,
    lowStock: false, newOrder: false, orderStatus: false,
    newCustomer: false, payment: false, review: false,
  },
  email:    { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' },
  security: {},
  currentPassword: '', newPassword: '', confirmPassword: '',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab,              setTab]              = useState('store');
  const [saving,           setSaving]           = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [loadError,        setLoadError]        = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form,             setForm]             = useState(EMPTY_FORM);

  // Add-zone input state (strings so free-form typing is always safe)
  const [newZoneCountry,       setNewZoneCountry]       = useState('Nigeria');
  const [newZoneState,         setNewZoneState]         = useState('');
  const [newZoneCity,          setNewZoneCity]          = useState('');
  const [newZonePrice,         setNewZonePrice]         = useState('');
  const [newZoneFreeThreshold, setNewZoneFreeThreshold] = useState('');

  const redirectTimerRef = useRef(null);
  const abortRef         = useRef(null);
  const isDirtyRef       = useRef(false);

  function markDirty() { isDirtyRef.current = true; }

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Cancel in-flight load + redirect timer on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => { loadSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load ──────────────────────────────────────────────────────────────────

  /**
   * @param {{ silent?: boolean }} opts
   *   silent: refresh after a save — no full-page loader, and a failure does
   *   not put the page into the blocking load-error state.
   * Returns true on success.
   */
  async function loadSettings({ silent = false } = {}) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }

    try {
      const res = await api.get('/admin/settings', { signal: controller.signal });
      if (controller.signal.aborted) return false;

      // Accept: { data: {...settings} } | { data: { settings } } | {...settings}
      const body     = res?.data;
      const unwrapped = body?.data ?? body ?? {};
      const settings  = unwrapped?.settings ?? unwrapped;
      const nextShipping = settings.shipping ?? {};

      const rawZones = Array.isArray(nextShipping.zones)
        ? nextShipping.zones
        : Array.isArray(nextShipping.shippingZones) ? nextShipping.shippingZones : [];

      setForm(prev => ({
        ...prev,
        store: { ...prev.store, ...settings.store },
        // `payments` is not merged — the admin UI never reads or writes it.
        shipping: {
          fee:                  Math.max(0, Number(nextShipping.fee ?? nextShipping.standardFee ?? 0) || 0),
          freeThreshold:        Math.max(0, Number(nextShipping.freeThreshold ?? nextShipping.freeShippingThreshold ?? 0) || 0),
          domesticCap:          Math.max(0, Number(nextShipping.domesticCap ?? 5000) || 0),
          internationalEnabled: Boolean(nextShipping.internationalEnabled),
          zones:                rawZones.map(parseZone).filter(Boolean),
        },
        notifications: { ...prev.notifications, ...settings.notifications },
        // Never pre-fill password from server data
        email: { ...prev.email, ...settings.email, smtpPass: '' },
      }));

      isDirtyRef.current = false;
      return true;
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return false;
      console.error('Failed to load settings:', err);
      if (silent) {
        toast.error('Saved, but the latest settings could not be refreshed. Reload the page to confirm.');
      } else {
        setLoadError(true);
        toast.error('Failed to load settings — saving is disabled until a successful reload.');
      }
      return false;
    } finally {
      if (!silent && !controller.signal.aborted) setLoading(false);
    }
  }

  // ── Form update helpers ──────────────────────────────────────────────────

  function updateStore(key, value)         { markDirty(); setForm(prev => ({ ...prev, store:         { ...prev.store,         [key]: value } })); }
  function updateEmail(key, value)         { markDirty(); setForm(prev => ({ ...prev, email:         { ...prev.email,         [key]: value } })); }
  function updateNotification(key, value)  { markDirty(); setForm(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } })); }

  function updateShippingField(key, value) {
    markDirty();
    setForm(prev => ({ ...prev, shipping: { ...prev.shipping, [key]: value } }));
  }
  function updateShippingToggle(key, value) {
    markDirty();
    setForm(prev => ({ ...prev, shipping: { ...prev.shipping, [key]: Boolean(value) } }));
  }
  // Zones are addressed by stable _uid (not array index) so edits/removals
  // can never hit the wrong row.
  function updateZoneField(uid, field, value) {
    markDirty();
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: prev.shipping.zones.map(z => (z._uid === uid ? { ...z, [field]: value } : z)),
      },
    }));
  }
  function removeShippingZone(uid) {
    markDirty();
    setForm(prev => ({
      ...prev,
      shipping: { ...prev.shipping, zones: prev.shipping.zones.filter(z => z._uid !== uid) },
    }));
  }
  function updatePasswordField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ── Add zone ──────────────────────────────────────────────────────────────

  function addShippingZone() {
    const country  = newZoneCountry.trim();
    const stateVal = newZoneState.trim();
    const cityVal  = newZoneCity.trim();

    if (!country) { toast.error('Country is required for a shipping zone'); return; }
    if (cityVal && !stateVal) { toast.error('State is required when a city is specified'); return; }

    const parsedPrice = Number(newZonePrice.trim());
    if (!newZonePrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error('Zone price must be a valid non-negative number');
      return;
    }

    let parsedFreeThreshold = null;
    if (newZoneFreeThreshold.trim()) {
      const n = Number(newZoneFreeThreshold.trim());
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Free shipping threshold must be a valid non-negative number');
        return;
      }
      // 0 is ambiguous — treat as "never free" for safety
      parsedFreeThreshold = n > 0 ? n : null;
    }

    const k = zoneKey(country, stateVal, cityVal);
    if (form.shipping.zones.some(z => zoneKey(z.country, z.state || '', z.city || '') === k)) {
      toast.error('A zone with that country/state/city already exists');
      return;
    }

    markDirty();
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: [
          ...prev.shipping.zones,
          {
            _uid:          newUid(),
            country,
            state:         stateVal || '',
            city:          cityVal  || '',
            price:         Math.max(0, parsedPrice),
            freeThreshold: parsedFreeThreshold,
          },
        ],
      },
    }));

    // Keep country for fast consecutive adds
    setNewZoneState('');
    setNewZoneCity('');
    setNewZonePrice('');
    setNewZoneFreeThreshold('');
  }

  // ── Shipping validation ───────────────────────────────────────────────────

  function validateShippingConfig() {
    const fee       = Number(form.shipping.fee);
    const threshold = Number(form.shipping.freeThreshold);
    const cap       = Number(form.shipping.domesticCap);

    if (!Number.isFinite(fee)       || fee       < 0) return 'Shipping fee must be a valid non-negative number.';
    if (!Number.isFinite(threshold) || threshold < 0) return 'Free shipping threshold must be a valid non-negative number.';
    if (!Number.isFinite(cap)       || cap       < 0) return 'Domestic fee cap must be a valid non-negative number.';

    const seen = new Set();
    for (const zone of form.shipping.zones) {
      const zc = String(zone.country ?? '').trim();
      const zs = String(zone.state   ?? '').trim();
      const zy = String(zone.city    ?? '').trim();
      const zp = Number(zone.price);

      if (!zc) return 'Every shipping zone needs a country.';
      if (zy && !zs) return `Zone "${zc}" has a city but no state — state is required.`;
      if (!Number.isFinite(zp) || zp < 0) return `Zone "${zc}${zs ? ' / ' + zs : ''}" must have a valid non-negative price.`;
      if (zone.freeThreshold != null && (!Number.isFinite(Number(zone.freeThreshold)) || Number(zone.freeThreshold) < 0)) {
        return `Zone "${zc}" has an invalid free shipping threshold.`;
      }

      const k = zoneKey(zc, zs, zy);
      if (seen.has(k)) return `Duplicate zone: ${zc}${zs ? ' / ' + zs : ''}${zy ? ' / ' + zy : ''}`;
      seen.add(k);
    }

    if (form.shipping.internationalEnabled) {
      const hasIntl = form.shipping.zones.some(z => String(z.country ?? '').toLowerCase().trim() !== 'nigeria');
      if (!hasIntl) return 'International shipping is enabled but no non-Nigeria zones are configured. Add a zone or disable the toggle.';
    }

    return '';
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function saveSettings() {
    if (loadError) {
      toast.error('Settings failed to load. Refresh the page before saving.');
      return;
    }

    const storeName  = form.store.name.trim();
    const storeEmail = form.store.email.trim();

    if (!storeName) { setTab('store'); toast.error('Store name is required'); return; }
    if (!storeEmail || !EMAIL_RE.test(storeEmail)) { setTab('store'); toast.error('Valid store email is required'); return; }

    // A half-filled "Add Zone" form would never be saved — tell the admin.
    if (newZonePrice.trim() || newZoneState.trim() || newZoneCity.trim() || newZoneFreeThreshold.trim()) {
      setTab('shipping');
      toast.error('You have a zone in the "Add Zone" form that has not been added. Click "Add Zone" (or clear the fields) before saving.');
      return;
    }

    const validationError = validateShippingConfig();
    if (validationError) { setTab('shipping'); toast.error(validationError); return; }

    // Only include smtpPass when the admin entered a new value.
    // Nomba keys are env-managed; the `payments` field is not sent at all.
    const emailPayload = {
      smtpHost: form.email.smtpHost,
      smtpPort: Number(form.email.smtpPort) || 587,
      smtpUser: form.email.smtpUser,
    };
    if (!isMasked(form.email.smtpPass)) emailPayload.smtpPass = form.email.smtpPass;

    setSaving(true);
    try {
      await api.post('/admin/settings', {
        store: {
          ...form.store,
          name:  storeName,
          email: storeEmail,
        },
        shipping: {
          fee:                  Number(form.shipping.fee)           || 0,
          freeThreshold:        Number(form.shipping.freeThreshold) || 0,
          domesticCap:          Number(form.shipping.domesticCap)   || 0,
          internationalEnabled: Boolean(form.shipping.internationalEnabled),
          // `_uid` is client-only and intentionally NOT sent.
          zones: form.shipping.zones.map(z => ({
            country:       String(z.country).trim(),
            state:         z.state ? String(z.state).trim() : null,
            city:          z.city  ? String(z.city).trim()  : null,
            price:         Number(z.price) || 0,
            freeThreshold: z.freeThreshold != null && Number(z.freeThreshold) > 0 ? Number(z.freeThreshold) : null,
          })),
        },
        notifications: form.notifications,
        email: emailPayload,
      });

      toast.success('Settings saved successfully!');
      isDirtyRef.current = false;
      // Silent refresh: pulls what the server actually stored back into the form.
      await loadSettings({ silent: true });
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────

  async function changePassword() {
    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword) { toast.error('Please enter your current password'); return; }
    if (!newPassword || newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one letter and one number');
      return;
    }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    if (newPassword === currentPassword) { toast.error('New password must be different from your current password'); return; }

    setChangingPassword(true);
    try {
      await api.put('/admin/settings/password', { currentPassword, newPassword });
      toast.success('Password changed successfully! You will be logged out shortly.');
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));

      redirectTimerRef.current = setTimeout(() => {
        window.location.href = '/admin-login?passwordChanged=true';
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }

  // ── Test email ────────────────────────────────────────────────────────────

  async function sendTestEmail() {
    const email = form.store.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      toast.error('Enter a valid store email before sending a test');
      return;
    }
    try {
      await api.post('/admin/settings/test-email', { email });
      toast.success('Test email sent successfully!');
    } catch {
      toast.error('Failed to send test email');
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Loading settings…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          padding: '16px 20px',
          background: 'rgba(231,76,60,.08)',
          border: '1px solid rgba(231,76,60,.3)',
          borderRadius: 8,
          color: 'var(--danger)',
          lineHeight: 1.6,
        }}>
          ⚠️ Settings failed to load from the server. Saving is disabled to prevent overwriting
          your existing configuration with blank defaults.{' '}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, marginLeft: 8 }}
            onClick={() => loadSettings()}
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isSaveDisabled = saving || changingPassword || loadError;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="st-root">
      <style>{RESPONSIVE_CSS}</style>

      <datalist id="zone-countries-list">
        {ZONE_COUNTRY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
      </datalist>

      <div className="page-header st-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Configure your store preferences</p>
        </div>
        <button
          className="btn btn-primary st-save"
          onClick={saveSettings}
          disabled={isSaveDisabled}
          type="button"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="st-layout">
        <div className="card st-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map(t => (
            <div
              key={t.id}
              role="tab"
              tabIndex={0}
              aria-selected={tab === t.id}
              className={`nav-item settings-tab-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab(t.id); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <t.Icon size={16} strokeWidth={1.8} aria-hidden="true" /> {t.label}
            </div>
          ))}
        </div>

        <div className="st-content">

          {/* ── Store ───────────────────────────────────────────────────── */}
          {tab === 'store' && (
            <>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>Store Information</div>
                <div className="st-grid-2">
                  <FormField label="Store Name"    value={form.store.name}     onChange={v => updateStore('name', v)}     placeholder="Your store name"         required />
                  <FormField label="Store Email"   value={form.store.email}    onChange={v => updateStore('email', v)}    type="email" placeholder="admin@yourstore.ng" required />
                  <FormField label="Support Phone" value={form.store.phone}    onChange={v => updateStore('phone', v)}    placeholder="+234 800 000 0000" />
                  <FormField label="Store Address" value={form.store.address}  onChange={v => updateStore('address', v)}  placeholder="City, Country" />
                  <FormField label="Currency"      value={form.store.currency} onChange={v => updateStore('currency', v)} placeholder="NGN" />
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>NAFDAC & Compliance</div>
                <div className="st-grid-2">
                  <FormField label="NAFDAC Number"       value={form.store.nafdac} onChange={v => updateStore('nafdac', v)} placeholder="NAFDAC/FD-001" />
                  <FormField label="CAC Business Number" value={form.store.cac}    onChange={v => updateStore('cac', v)}    placeholder="RC-1234567" />
                </div>
              </div>
            </>
          )}

          {/* ── Payments (read-only) ─────────────────────────────────────── */}
          {tab === 'payments' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Nomba Payment Gateway</div>

              <div style={{
                padding: '12px 16px',
                background: 'rgba(0,200,150,.06)',
                border: '1px solid rgba(0,200,150,.2)',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--muted)',
                lineHeight: 1.6,
              }}>
                🔒 Nomba API keys are managed securely via environment variables on the server
                (<code>NOMBA_PUBLIC_KEY</code>, <code>NOMBA_WEBHOOK_SECRET</code>) and cannot be
                edited from this dashboard. Update them in your hosting provider's environment
                settings and redeploy.
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Webhook URL (copy this to your Nomba dashboard)
                </div>
                <div style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--accent)',
                  wordBreak: 'break-all',
                }}>
                  {SERVER_ORIGIN}/webhooks/nomba
                </div>
                {SERVER_ORIGIN === window.location.origin && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    ⚠️ Showing browser origin (local dev fallback). Set{' '}
                    <code>VITE_API_BASE_URL</code> in <code>.env.production</code> to display the
                    real API host.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Email ───────────────────────────────────────────────────── */}
          {tab === 'email' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Email (SMTP / Nodemailer)</div>
              <div className="st-grid-2">
                <FormField label="SMTP Host" value={form.email.smtpHost}         onChange={v => updateEmail('smtpHost', v)}                       placeholder="smtp.gmail.com" />
                <FormField label="SMTP Port" value={String(form.email.smtpPort)} onChange={v => updateEmail('smtpPort', Number(v) || 587)} type="number" />
                <FormField label="SMTP User" value={form.email.smtpUser}         onChange={v => updateEmail('smtpUser', v)}                       placeholder="you@gmail.com" />
                <FormField
                  label="SMTP Password"
                  value={form.email.smtpPass}
                  onChange={v => updateEmail('smtpPass', v)}
                  type="password"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-ghost st-btn-block-mobile" style={{ fontSize: 12 }} onClick={sendTestEmail} type="button">
                  Send Test Email
                </button>
              </div>
            </div>
          )}

          {/* ── Notifications ───────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Notification Preferences</div>
              {NOTIFICATIONS.map(({ id, label }) => (
                <div key={id} className="st-toggle-row">
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle label={label} checked={form.notifications[id] || false} onChange={checked => updateNotification(id, checked)} />
                </div>
              ))}
              <div className="form-field" style={{ marginTop: 16 }}>
                <label>Low Stock Threshold</label>
                <input
                  type="number"
                  value={form.notifications.lowStockThreshold}
                  onChange={e => updateNotification('lowStockThreshold', Number(e.target.value) || 0)}
                  style={{ maxWidth: 160 }}
                />
              </div>
            </div>
          )}

          {/* ── Security ────────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Security Settings</div>

              <div style={{
                padding: '12px 16px',
                background: 'rgba(224,160,62,.08)',
                border: '1px solid rgba(224,160,62,.35)',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.6,
              }}>
                🚧 <strong>These controls are not yet active.</strong>{' '}
                <code>models/Settings.js</code> has no <code>security</code> section — values will
                not persist until server support is added. Toggles are shown read-only to prevent
                false confidence.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SECURITY_SETTINGS.map(({ id, label }) => (
                  <div key={id} className="st-toggle-row" style={{ opacity: 0.45, pointerEvents: 'none' }}>
                    <span style={{ fontSize: 13 }}>{label}</span>
                    <Toggle label={label} checked={form.security[id] || false} onChange={() => {}} />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Change Admin Password</div>
                <div className="st-password-form">
                  <div className="form-field">
                    <label>Current Password <span style={{ color: '#e74c3c' }}>*</span></label>
                    <input
                      type="password"
                      value={form.currentPassword}
                      onChange={e => updatePasswordField('currentPassword', e.target.value)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="form-field">
                    <label>New Password <span style={{ color: '#e74c3c' }}>*</span></label>
                    <input
                      type="password"
                      value={form.newPassword}
                      onChange={e => updatePasswordField('newPassword', e.target.value)}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Must be at least 8 characters with letters and numbers
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Confirm Password <span style={{ color: '#e74c3c' }}>*</span></label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => updatePasswordField('confirmPassword', e.target.value)}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    className="btn btn-primary st-btn-block-mobile"
                    onClick={changePassword}
                    disabled={changingPassword}
                    style={{ alignSelf: 'flex-start', marginTop: 8 }}
                    type="button"
                  >
                    {changingPassword ? 'Updating Password…' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Shipping ────────────────────────────────────────────────── */}
          {tab === 'shipping' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>Shipping Configuration</div>
              <div style={{
                padding: '10px 14px',
                background: 'rgba(0,200,150,.06)',
                border: '1px solid rgba(0,200,150,.2)',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.6,
              }}>
                Domestic fields apply to Nigeria. <strong>Domestic Fee Cap: 0 = no cap</strong>{' '}
                (any positive number is the ceiling for Nigerian zones). International shipping
                must be enabled AND have at least one non-Nigeria zone — otherwise non-Nigeria
                addresses are blocked at checkout. To make a zone always ship free, set its
                price to 0 rather than its free threshold.
              </div>

              {/* Domestic block */}
              <SectionLabel>Domestic (Nigeria)</SectionLabel>
              <div className="st-grid-3" style={{ marginBottom: 20 }}>
                <NumberFormField
                  label="Shipping Fee (₦)"
                  value={form.shipping.fee}
                  onChange={v => updateShippingField('fee', v)}
                  placeholder="5000"
                />
                <NumberFormField
                  label="Free Shipping Threshold (₦)"
                  value={form.shipping.freeThreshold}
                  onChange={v => updateShippingField('freeThreshold', v)}
                  placeholder="60000"
                />
                <NumberFormField
                  label="Domestic Fee Cap (₦, 0 = no cap)"
                  value={form.shipping.domesticCap}
                  onChange={v => updateShippingField('domesticCap', v)}
                  placeholder="5000"
                />
              </div>

              {/* International toggle */}
              <div className="st-toggle-row st-intl" style={{
                borderTop: '1px solid var(--border)',
                marginBottom: 20,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Enable international shipping</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    When off, customers outside Nigeria cannot complete checkout.
                    Requires at least one non-Nigeria zone below.
                  </div>
                </div>
                <Toggle
                  label="Enable international shipping"
                  checked={!!form.shipping.internationalEnabled}
                  onChange={checked => updateShippingToggle('internationalEnabled', checked)}
                />
              </div>

              {/* Add zone */}
              <SectionLabel>Add Zone</SectionLabel>
              <div className="st-grid-3" style={{ marginBottom: 10 }}>
                <div className="form-field">
                  <label style={{ fontSize: 11 }}>Country *</label>
                  <input
                    className="input"
                    list="zone-countries-list"
                    placeholder="e.g. Nigeria"
                    value={newZoneCountry}
                    onChange={e => setNewZoneCountry(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label style={{ fontSize: 11 }}>State (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. Lagos"
                    value={newZoneState}
                    onChange={e => setNewZoneState(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label style={{ fontSize: 11 }}>City (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. Ikeja"
                    value={newZoneCity}
                    onChange={e => setNewZoneCity(e.target.value)}
                  />
                </div>
              </div>
              <div className="st-grid-zone" style={{ marginBottom: 20 }}>
                <div className="form-field">
                  <label style={{ fontSize: 11 }}>Price (₦) *</label>
                  <input className="input" type="number" min={0} inputMode="decimal" placeholder="2500" value={newZonePrice} onChange={e => setNewZonePrice(e.target.value)} />
                </div>
                <div className="form-field">
                  <label style={{ fontSize: 11 }}>Free threshold (₦, empty = never free)</label>
                  <input className="input" type="number" min={0} inputMode="decimal" placeholder="never free" value={newZoneFreeThreshold} onChange={e => setNewZoneFreeThreshold(e.target.value)} />
                </div>
                <button className="btn btn-primary st-zone-btn" type="button" onClick={addShippingZone}>
                  Add Zone
                </button>
              </div>

              {/* Zone list */}
              <SectionLabel>Zones ({form.shipping.zones.length})</SectionLabel>

              {form.shipping.zones.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
                  No shipping zones configured yet.
                </div>
              ) : (
                form.shipping.zones.map(zone => (
                  <div
                    key={zone._uid}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 10,
                      background: 'var(--surface2)',
                    }}
                  >
                    <div className="st-grid-3" style={{ marginBottom: 10 }}>
                      <div className="form-field">
                        <label style={{ fontSize: 11 }}>Country</label>
                        <input
                          className="input"
                          list="zone-countries-list"
                          placeholder="e.g. Nigeria"
                          value={zone.country}
                          onChange={e => updateZoneField(zone._uid, 'country', e.target.value)}
                        />
                      </div>
                      <div className="form-field">
                        <label style={{ fontSize: 11 }}>State</label>
                        <input
                          className="input"
                          placeholder="(country-wide if empty)"
                          value={zone.state || ''}
                          onChange={e => updateZoneField(zone._uid, 'state', e.target.value)}
                        />
                      </div>
                      <div className="form-field">
                        <label style={{ fontSize: 11 }}>City</label>
                        <input
                          className="input"
                          placeholder="(state-wide if empty)"
                          value={zone.city || ''}
                          onChange={e => updateZoneField(zone._uid, 'city', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="st-grid-zone">
                      <div className="form-field">
                        <label style={{ fontSize: 11 }}>Price (₦)</label>
                        <NumberInput
                          className="input"
                          value={zone.price}
                          onChange={v => updateZoneField(zone._uid, 'price', Math.max(0, Number(v) || 0))}
                          placeholder="2500"
                        />
                      </div>
                      <div className="form-field">
                        <label style={{ fontSize: 11 }}>Free threshold (₦, empty = never free)</label>
                        <NumberInput
                          className="input"
                          value={zone.freeThreshold ?? ''}
                          onChange={v => {
                            // Empty or 0 ⇒ never free (safe default).
                            // To make a zone always ship free, set its price to 0 instead.
                            if (v === '' || v == null) return updateZoneField(zone._uid, 'freeThreshold', null);
                            const n = Number(v);
                            updateZoneField(zone._uid, 'freeThreshold', Number.isFinite(n) && n > 0 ? n : null);
                          }}
                          allowEmpty
                          placeholder="never free"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm st-zone-btn"
                        onClick={() => removeShippingZone(zone._uid)}
                        style={{ color: 'var(--danger)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── RESPONSIVE STYLES ───────────────────────────────────────────────────────
// Scoped under .st-root. Breakpoint: 768px. Everything stacks below it.

const RESPONSIVE_CSS = `
.st-root { min-width: 0; max-width: 100%; }
.st-root *, .st-root *::before, .st-root *::after { box-sizing: border-box; }

.st-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}

.st-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.st-tabs { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.st-content { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

.st-grid-2    { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.st-grid-3    { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.st-grid-zone { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: end; }
.st-zone-btn  { margin-bottom: 1px; }

.st-password-form { display: flex; flex-direction: column; gap: 12px; max-width: 400px; }

.st-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border);
}

.st-root .form-field { min-width: 0; }
.st-root .form-field input,
.st-root .form-field select,
.st-root .form-field textarea { width: 100%; max-width: 100%; }
.st-root code { word-break: break-word; }

@media (max-width: 768px) {
  .st-layout { grid-template-columns: minmax(0, 1fr); gap: 12px; }

  /* Tabs become a horizontal scroll strip above the content */
  .st-tabs {
    flex-direction: row; overflow-x: auto; gap: 4px;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .st-tabs::-webkit-scrollbar { display: none; }
  .st-tabs .nav-item { flex: 0 0 auto; white-space: nowrap; }

  /* Every grid stacks into one column */
  .st-grid-2, .st-grid-3, .st-grid-zone { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .st-zone-btn { width: 100%; margin-bottom: 0; }

  /* Header: title on top, full-width save button below */
  .st-header { flex-direction: column; align-items: stretch; }
  .st-save { width: 100%; }

  .st-btn-block-mobile { width: 100%; align-self: stretch !important; }
  .st-password-form { max-width: none; }

  /* 16px prevents iOS Safari zooming into inputs; taller tap targets */
  .st-root input, .st-root select, .st-root textarea { font-size: 16px; min-height: 42px; }
  .st-root .btn { min-height: 42px; }
}
`;

// ── COMPONENTS ──────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: 'var(--muted)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder, required = false }) {
  return (
    <div className="form-field">
      <label>
        {label}
        {required && <span style={{ color: '#e74c3c', marginLeft: 4 }}>*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * NumberInput — keeps a local string while typing so mid-edit states like "",
 * "5.", "0.0" don't get clamped on every keystroke. Commits on blur.
 *
 * Props:
 *   value       — controlled numeric (or null/empty for "unset")
 *   onChange    — called with a number, or '' when allowEmpty and cleared
 *   allowEmpty  — clearing the field calls onChange('') rather than onChange(0)
 */
function NumberInput({ value, onChange, placeholder = '0', allowEmpty = false, className = '' }) {
  const toDisplay = (v) => (v === null || v === undefined || v === '') ? '' : String(v);
  const [local, setLocal] = useState(() => toDisplay(value));

  // Re-sync when the parent changes `value` (e.g. after a save/reload)
  useEffect(() => {
    setLocal(toDisplay(value));
  }, [value]);

  function commit(raw) {
    if (allowEmpty && (raw === '' || raw === null || raw === undefined)) {
      setLocal('');
      onChange('');
      return;
    }
    const n    = Number(raw);
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    setLocal(String(safe));
    onChange(safe);
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      className={className}
      placeholder={placeholder}
      value={local}
      min={0}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function NumberFormField({ label, value, onChange, placeholder, required = false }) {
  return (
    <div className="form-field">
      <label>
        {label}
        {required && <span style={{ color: '#e74c3c', marginLeft: 4 }}>*</span>}
      </label>
      <NumberInput value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div
      onClick={() => onChange?.(!checked)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange?.(!checked); } }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      style={{
        width: 36,
        height: 20,
        background: checked ? 'var(--accent)' : 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        position: 'relative',
        transition: 'background .2s',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 14,
        height: 14,
        background: '#fff',
        borderRadius: '50%',
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}