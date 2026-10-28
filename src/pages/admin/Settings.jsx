// src/pages/admin/Settings.jsx
//
// CHANGELOG (this revision: responsive layout + shipping fixes)
// Layout
// - Forms use auto-fit grids (see Settings.css): side by side when there is
//   room, stacked when there is not. Tabs are real buttons and wrap on phones.
// Shipping fixes
// - FIX: zone rows were keyed by their own country/state/city text, so every
//   keystroke in those inputs changed the key, remounted the row and dropped
//   focus. Rows now carry a stable client-side `uid` (never sent to the API).
// - FIX: EMPTY_FORM.shipping.domesticCap was an array ([5000]); now a number.
// - FIX: a stored zone freeThreshold of 0 was kept as 0 on load. 0 now means
//   "never free" everywhere (load, edit, save), matching the page's own rule.
// - FIX: after Save the page re-fetched with the full-screen loader, which
//   unmounted the whole form (and a failed refresh replaced it with the
//   "failed to load" screen even though the save had worked). The refresh is
//   now silent.
// - FIX: NumberInput only committed on blur, so typing then pressing Save or
//   Enter used the old value. It now commits every valid change and only
//   normalises its display on blur.
// - FIX: SMTP port and low-stock threshold snapped back to 587 / 0 as soon as
//   the field was cleared, making them impossible to retype. They now use
//   NumberInput.
// - New: inline hints for zones priced above the domestic cap, and for a
//   standard fee above the cap. Add-zone is a real <form> (Enter submits).
// Accessibility
// - Labels are associated with inputs; switches are keyboard-operable buttons.
// Unchanged contract
// - Payments tab remains read-only (Nomba keys live in server env vars).
// - Domestic Fee Cap: 0 means "no cap". Save stays blocked after a failed load.

import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Store, CreditCard, Truck, Mail, Bell, Lock } from 'lucide-react';
import './Settings.css';

// ── Webhook URL base ────────────────────────────────────────────────────────
const SERVER_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : window.location.origin;

// ── Sentinel for masked credential fields (used by smtpPass) ────────────────
const MASKED = '***';
function isMasked(v) { return !v || String(v).trim() === MASKED; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

// Open-ended suggestions; the admin can type any country.
const ZONE_COUNTRY_SUGGESTIONS = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States',
  'United Kingdom', 'Canada', 'Cameroon', 'Senegal', 'Ivory Coast',
  'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Egypt',
  'Germany', 'France', 'Netherlands', 'Australia', 'India',
];

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

// Stable identity for zone rows (client-only; stripped before saving).
let zoneSeq = 0;
const nextZoneUid = () => `zone-${++zoneSeq}`;

// Free-shipping threshold rule used everywhere: empty or 0 => never free.
function cleanThreshold(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Normalise a zone from either legacy { name, price } or the structured shape.
// Legacy zones are treated as Nigerian states (matches the migration path).
function parseZone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hasStructured = raw.country != null || raw.state != null || raw.city != null;
  return {
    uid:           nextZoneUid(),
    country:       String(raw.country ?? 'Nigeria').trim(),
    state:         hasStructured ? (raw.state ? String(raw.state).trim() : '') : String(raw.name ?? '').trim(),
    city:          hasStructured ? (raw.city  ? String(raw.city).trim()  : '') : '',
    price:         Math.max(0, Number(raw.price) || 0),
    freeThreshold: cleanThreshold(raw.freeThreshold),
  };
}

function zoneKey(country, state, city) {
  return [
    String(country || '').toLowerCase().trim(),
    String(state   || '').toLowerCase().trim(),
    String(city    || '').toLowerCase().trim(),
  ].join('|');
}

const isNigeria = (country) => String(country ?? '').toLowerCase().trim() === 'nigeria';

// `payments` intentionally omitted: those keys live in server env vars.
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

  // Add-zone inputs (strings so free-form typing is always safe)
  const [newZoneCountry,       setNewZoneCountry]       = useState('Nigeria');
  const [newZoneState,         setNewZoneState]         = useState('');
  const [newZoneCity,          setNewZoneCity]          = useState('');
  const [newZonePrice,         setNewZonePrice]         = useState('');
  const [newZoneFreeThreshold, setNewZoneFreeThreshold] = useState('');

  const redirectTimerRef = useRef(null);
  const abortRef         = useRef(null);
  const isDirtyRef       = useRef(false);

  const markDirty = useCallback(() => { isDirtyRef.current = true; }, []);

  // Warn before leaving the page with unsaved changes (full unload only)
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
  // silent=true is used after Save: no full-screen loader, and a failed
  // refresh only warns (the save itself already succeeded).

  async function loadSettings({ silent = false } = {}) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) { setLoading(true); setLoadError(false); }
    try {
      const { data } = await api.get('/admin/settings', { signal: controller.signal });
      if (controller.signal.aborted) return;

      const settings     = data?.data ?? data ?? {};
      const nextShipping = settings.shipping ?? {};

      setForm(prev => ({
        ...prev,
        store: { ...prev.store, ...settings.store },
        // `payments` is not merged: the admin UI never reads or writes it.
        shipping: {
          fee:                  Math.max(0, Number(nextShipping.fee ?? nextShipping.standardFee ?? 0) || 0),
          freeThreshold:        Math.max(0, Number(nextShipping.freeThreshold ?? nextShipping.freeShippingThreshold ?? 0) || 0),
          domesticCap:          Math.max(0, Number(nextShipping.domesticCap ?? 5000) || 0),
          internationalEnabled: Boolean(nextShipping.internationalEnabled),
          zones:                Array.isArray(nextShipping.zones)
                                  ? nextShipping.zones.map(parseZone).filter(Boolean)
                                  : [],
        },
        notifications: { ...prev.notifications, ...settings.notifications },
        // Never pre-fill the password from server data
        email: { ...prev.email, ...settings.email, smtpPass: '' },
      }));

      isDirtyRef.current = false;
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('Failed to load settings:', err);
      if (silent) {
        toast('Saved, but the page could not refresh. Reload to see the stored values.', { icon: '⚠️' });
      } else {
        setLoadError(true);
        toast.error('Failed to load settings. Saving is disabled until a successful reload.');
      }
    } finally {
      if (!silent && !controller.signal.aborted) setLoading(false);
    }
  }

  // ── Form update helpers ──────────────────────────────────────────────────

  function updateStore(key, value)        { markDirty(); setForm(prev => ({ ...prev, store:         { ...prev.store,         [key]: value } })); }
  function updateEmail(key, value)        { markDirty(); setForm(prev => ({ ...prev, email:         { ...prev.email,         [key]: value } })); }
  function updateNotification(key, value) { markDirty(); setForm(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } })); }
  function updateShippingField(key, value){ markDirty(); setForm(prev => ({ ...prev, shipping:      { ...prev.shipping,      [key]: value } })); }
  function updateShippingToggle(key, v)   { updateShippingField(key, Boolean(v)); }
  function updatePasswordField(key, value){ setForm(prev => ({ ...prev, [key]: value })); }

  // Stable callbacks (keyed by uid, not index) so memoised zone rows don't
  // re-render when a sibling changes.
  const updateZoneField = useCallback((uid, field, value) => {
    markDirty();
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: prev.shipping.zones.map(z => (z.uid === uid ? { ...z, [field]: value } : z)),
      },
    }));
  }, [markDirty]);

  const removeShippingZone = useCallback((uid) => {
    markDirty();
    setForm(prev => ({
      ...prev,
      shipping: { ...prev.shipping, zones: prev.shipping.zones.filter(z => z.uid !== uid) },
    }));
  }, [markDirty]);

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
      parsedFreeThreshold = cleanThreshold(n); // 0 => never free
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
            uid:           nextZoneUid(),
            country,
            state:         stateVal,
            city:          cityVal,
            price:         Math.max(0, parsedPrice),
            freeThreshold: parsedFreeThreshold,
          },
        ],
      },
    }));

    // Keep the country for fast consecutive adds
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
      if (zy && !zs) return `Zone "${zc}" has a city but no state. State is required.`;
      if (!Number.isFinite(zp) || zp < 0) return `Zone "${zc}${zs ? ' / ' + zs : ''}" must have a valid non-negative price.`;
      if (zone.freeThreshold != null && zone.freeThreshold !== '' &&
          (!Number.isFinite(Number(zone.freeThreshold)) || Number(zone.freeThreshold) < 0)) {
        return `Zone "${zc}" has an invalid free shipping threshold.`;
      }

      const k = zoneKey(zc, zs, zy);
      if (seen.has(k)) return `Duplicate zone: ${zc}${zs ? ' / ' + zs : ''}${zy ? ' / ' + zy : ''}`;
      seen.add(k);
    }

    if (form.shipping.internationalEnabled) {
      const hasIntl = form.shipping.zones.some(z => !isNigeria(z.country));
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

    if (!storeName) { toast.error('Store name is required'); return; }
    if (!storeEmail || !EMAIL_RE.test(storeEmail)) { toast.error('Valid store email is required'); return; }

    const validationError = validateShippingConfig();
    if (validationError) { toast.error(validationError); return; }

    // Only include smtpPass when the admin entered a new value.
    const emailPayload = {
      smtpHost: form.email.smtpHost,
      smtpPort: Number(form.email.smtpPort) || 587,
      smtpUser: form.email.smtpUser,
    };
    if (!isMasked(form.email.smtpPass)) emailPayload.smtpPass = form.email.smtpPass;

    setSaving(true);
    try {
      await api.post('/admin/settings', {
        store: { ...form.store, name: storeName, email: storeEmail },
        shipping: {
          fee:                  Number(form.shipping.fee)           || 0,
          freeThreshold:        Number(form.shipping.freeThreshold) || 0,
          domesticCap:          Number(form.shipping.domesticCap)   || 0,
          internationalEnabled: Boolean(form.shipping.internationalEnabled),
          zones: form.shipping.zones.map(z => ({     // `uid` is deliberately not sent
            country:       String(z.country).trim(),
            state:         z.state ? String(z.state).trim() : null,
            city:          z.city  ? String(z.city).trim()  : null,
            price:         Number(z.price) || 0,
            freeThreshold: cleanThreshold(z.freeThreshold),
          })),
        },
        notifications: form.notifications,
        email: emailPayload,
      });

      toast.success('Settings saved successfully!');
      isDirtyRef.current = false;
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
      <div role="status" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        Loading settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <div className="set-note set-note--danger" role="alert">
          ⚠️ Settings failed to load from the server. Saving is disabled to prevent overwriting
          your existing configuration with blank defaults.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => loadSettings()} type="button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isSaveDisabled = saving || changingPassword || loadError;
  const { fee, domesticCap } = form.shipping;
  const cap = Number(domesticCap) || 0;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="settings-page">
      <datalist id="zone-countries-list">
        {ZONE_COUNTRY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
      </datalist>

      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Configure your store preferences</p>
        </div>
        <button className="btn btn-primary" onClick={saveSettings} disabled={isSaveDisabled} type="button">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-layout">
        <div className="card settings-tabs" role="tablist" aria-label="Settings sections" style={{ padding: 8 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="settings-panel"
              className={`nav-item settings-tab-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.Icon size={16} strokeWidth={1.8} aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>

        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}
             style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* ── Store ───────────────────────────────────────────────────── */}
          {tab === 'store' && (
            <>
              <div className="card">
                <div className="card-title set-card-title">Store Information</div>
                <div className="set-grid set-grid--wide">
                  <FormField label="Store Name"    value={form.store.name}     onChange={v => updateStore('name', v)}     placeholder="Your store name"    required />
                  <FormField label="Store Email"   value={form.store.email}    onChange={v => updateStore('email', v)}    type="email" placeholder="admin@yourstore.ng" required />
                  <FormField label="Support Phone" value={form.store.phone}    onChange={v => updateStore('phone', v)}    placeholder="+234 800 000 0000" type="tel" />
                  <FormField label="Store Address" value={form.store.address}  onChange={v => updateStore('address', v)}  placeholder="City, Country" />
                  <FormField label="Currency"      value={form.store.currency} onChange={v => updateStore('currency', v)} placeholder="NGN" />
                </div>
              </div>

              <div className="card">
                <div className="card-title set-card-title">NAFDAC & Compliance</div>
                <div className="set-grid set-grid--wide">
                  <FormField label="NAFDAC Number"       value={form.store.nafdac} onChange={v => updateStore('nafdac', v)} placeholder="NAFDAC/FD-001" />
                  <FormField label="CAC Business Number" value={form.store.cac}    onChange={v => updateStore('cac', v)}    placeholder="RC-1234567" />
                </div>
              </div>
            </>
          )}

          {/* ── Payments (read-only) ─────────────────────────────────────── */}
          {tab === 'payments' && (
            <div className="card">
              <div className="card-title set-card-title">Nomba Payment Gateway</div>

              <div className="set-note set-note--info">
                🔒 Nomba API keys are managed securely via environment variables on the server
                (<code>NOMBA_PUBLIC_KEY</code>, <code>NOMBA_WEBHOOK_SECRET</code>) and cannot be
                edited from this dashboard. Update them in your hosting provider&apos;s environment
                settings and redeploy.
              </div>

              <div className="set-section-label">Webhook URL (copy this to your Nomba dashboard)</div>
              <div className="set-code">{SERVER_ORIGIN}/webhooks/nomba</div>
              {SERVER_ORIGIN === window.location.origin && (
                <div className="set-hint" style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
                  ⚠️ Showing browser origin (local dev fallback). Set{' '}
                  <code>VITE_API_BASE_URL</code> in <code>.env.production</code> to display the
                  real API host.
                </div>
              )}
            </div>
          )}

          {/* ── Email ───────────────────────────────────────────────────── */}
          {tab === 'email' && (
            <div className="card">
              <div className="card-title set-card-title">Email (SMTP / Nodemailer)</div>
              <div className="set-grid set-grid--wide">
                <FormField label="SMTP Host" value={form.email.smtpHost} onChange={v => updateEmail('smtpHost', v)} placeholder="smtp.gmail.com" />
                <NumberFormField label="SMTP Port" value={form.email.smtpPort} onChange={v => updateEmail('smtpPort', v)} placeholder="587" />
                <FormField label="SMTP User" value={form.email.smtpUser} onChange={v => updateEmail('smtpUser', v)} placeholder="you@gmail.com" />
                <FormField
                  label="SMTP Password"
                  value={form.email.smtpPass}
                  onChange={v => updateEmail('smtpPass', v)}
                  type="password"
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={sendTestEmail} type="button">
                  Send Test Email
                </button>
              </div>
            </div>
          )}

          {/* ── Notifications ───────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <div className="card">
              <div className="card-title set-card-title">Notification Preferences</div>
              {NOTIFICATIONS.map(({ id, label }) => (
                <div key={id} className="set-row">
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle label={label} checked={form.notifications[id] || false} onChange={checked => updateNotification(id, checked)} />
                </div>
              ))}
              <div style={{ marginTop: 16, maxWidth: 240 }}>
                <NumberFormField
                  label="Low Stock Threshold"
                  value={form.notifications.lowStockThreshold}
                  onChange={v => updateNotification('lowStockThreshold', v)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* ── Security ────────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div className="card">
              <div className="card-title set-card-title">Security Settings</div>

              <div className="set-note set-note--warn">
                🚧 <strong>These controls are not yet active.</strong>{' '}
                <code>models/Settings.js</code> has no <code>security</code> section, so values will
                not persist until server support is added. Toggles are shown read-only to prevent
                false confidence.
              </div>

              {SECURITY_SETTINGS.map(({ id, label }) => (
                <div key={id} className="set-row" style={{ opacity: 0.55 }}>
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle label={label} checked={form.security[id] || false} onChange={() => {}} disabled />
                </div>
              ))}

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Change Admin Password</div>
                <div className="form-grid-1" style={{ maxWidth: 400 }}>
                  <FormField
                    label="Current Password" required type="password" autoComplete="current-password"
                    value={form.currentPassword} onChange={v => updatePasswordField('currentPassword', v)}
                    placeholder="Enter current password"
                  />
                  <FormField
                    label="New Password" required type="password" autoComplete="new-password"
                    value={form.newPassword} onChange={v => updatePasswordField('newPassword', v)}
                    placeholder="Min 8 characters"
                    hint="Must be at least 8 characters with letters and numbers"
                  />
                  <FormField
                    label="Confirm Password" required type="password" autoComplete="new-password"
                    value={form.confirmPassword} onChange={v => updatePasswordField('confirmPassword', v)}
                    placeholder="Repeat new password"
                  />
                  <button
                    className="btn btn-primary"
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
              <div className="set-note set-note--info">
                Domestic fields apply to Nigeria. <strong>Domestic Fee Cap: 0 = no cap</strong>{' '}
                (any positive number is the ceiling for Nigerian zones). International shipping
                must be enabled AND have at least one non-Nigeria zone, otherwise non-Nigeria
                addresses are blocked at checkout. For a zone, a free threshold of 0 or empty
                means never free; to make a zone always ship free, set its price to 0.
              </div>

              {/* Domestic */}
              <div className="set-section-label">Domestic (Nigeria)</div>
              <div className="set-grid set-block">
                <NumberFormField
                  label="Shipping Fee (₦)"
                  value={form.shipping.fee}
                  onChange={v => updateShippingField('fee', v)}
                  placeholder="5000"
                  hint={cap > 0 && Number(fee) > cap ? `Higher than the fee cap (${naira(cap)}).` : undefined}
                  warn
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

              {/* International */}
              <div className="set-row set-row--boxed" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="set-row-title" id="intl-label">Enable international shipping</div>
                  <div className="set-row-desc">
                    When off, customers outside Nigeria cannot complete checkout.
                    Requires at least one non-Nigeria zone below.
                  </div>
                </div>
                <Toggle
                  labelledBy="intl-label"
                  checked={!!form.shipping.internationalEnabled}
                  onChange={checked => updateShippingToggle('internationalEnabled', checked)}
                />
              </div>

              {/* Add zone (a real form: Enter submits) */}
              <div className="set-section-label">Add Zone</div>
              <form
                className="set-add"
                onSubmit={e => { e.preventDefault(); addShippingZone(); }}
              >
                <div className="set-grid">
                  <TextField label="Country *" list="zone-countries-list" placeholder="e.g. Nigeria"
                    value={newZoneCountry} onChange={setNewZoneCountry} />
                  <TextField label="State (optional)" placeholder="e.g. Lagos"
                    value={newZoneState} onChange={setNewZoneState} />
                  <TextField label="City (optional)" placeholder="e.g. Ikeja"
                    value={newZoneCity} onChange={setNewZoneCity} />
                </div>
                <div className="set-grid set-grid--end">
                  <TextField label="Price (₦) *" type="number" min={0} placeholder="2500" inputMode="decimal"
                    value={newZonePrice} onChange={setNewZonePrice} hint="0 = always free" />
                  <TextField label="Free threshold (₦, empty = never free)" type="number" min={0} placeholder="never free" inputMode="decimal"
                    value={newZoneFreeThreshold} onChange={setNewZoneFreeThreshold} />
                  <div className="form-field">
                    <button className="btn btn-primary btn-full" type="submit">Add Zone</button>
                  </div>
                </div>
              </form>

              {/* Zone list */}
              <div className="set-section-label">Zones ({form.shipping.zones.length})</div>

              {form.shipping.zones.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                  No shipping zones configured yet.
                </div>
              ) : (
                form.shipping.zones.map(zone => (
                  <ZoneRow
                    key={zone.uid}
                    zone={zone}
                    cap={cap}
                    onChange={updateZoneField}
                    onRemove={removeShippingZone}
                  />
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── COMPONENTS ──────────────────────────────────────────────────────────────

// One editable zone. Memoised and keyed by `uid`, so typing in one row
// neither remounts it (the old focus-loss bug) nor re-renders its siblings.
const ZoneRow = memo(function ZoneRow({ zone, cap, onChange, onRemove }) {
  const id = useId();
  const overCap = cap > 0 && isNigeria(zone.country) && Number(zone.price) > cap;

  return (
    <div className="set-zone">
      <div className="set-grid">
        <TextField label="Country" list="zone-countries-list" placeholder="e.g. Nigeria"
          value={zone.country} onChange={v => onChange(zone.uid, 'country', v)} id={`${id}-country`} />
        <TextField label="State" placeholder="(country-wide if empty)"
          value={zone.state || ''} onChange={v => onChange(zone.uid, 'state', v)} id={`${id}-state`} />
        <TextField label="City" placeholder="(state-wide if empty)"
          value={zone.city || ''} onChange={v => onChange(zone.uid, 'city', v)} id={`${id}-city`} />
      </div>
      <div className="set-grid set-grid--end">
        <NumberFormField
          label="Price (₦)"
          value={zone.price}
          onChange={v => onChange(zone.uid, 'price', Math.max(0, Number(v) || 0))}
          placeholder="2500"
          hint={overCap ? `Above the domestic fee cap (${naira(cap)}).` : (Number(zone.price) === 0 ? 'Always free' : undefined)}
          warn={overCap}
        />
        <NumberFormField
          label="Free threshold (₦, empty = never free)"
          value={zone.freeThreshold ?? ''}
          onChange={v => onChange(zone.uid, 'freeThreshold', v === '' || v == null ? null : Math.max(0, Number(v) || 0))}
          allowEmpty
          placeholder="never free"
        />
        <div className="set-zone-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(zone.uid)}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
});

function TextField({ label, value, onChange, hint, id: idProp, ...inputProps }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} onChange={e => onChange(e.target.value)} {...inputProps} />
      {hint && <div className="set-hint">{hint}</div>}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder, required = false, hint, autoComplete }) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: '#e74c3c', marginInlineStart: 4 }} aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value ?? ''}
        autoComplete={autoComplete}
        required={required}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <div className="set-hint">{hint}</div>}
    </div>
  );
}

/**
 * NumberInput: keeps a local string so mid-edit states ("", "5.", "0.0")
 * aren't clamped on each keystroke, but now reports every valid change to
 * the parent immediately (so Save / Enter always see the latest value) and
 * only normalises the display on blur.
 *
 *   value       controlled number (or null/'' for "unset")
 *   onChange    called with a number, or '' when allowEmpty and cleared
 *   allowEmpty  clearing reports '' instead of waiting for blur to set 0
 */
const sameNumber = (text, v) => {
  const textEmpty = text === '';
  const vEmpty = v === null || v === undefined || v === '';
  if (textEmpty || vEmpty) return textEmpty && vEmpty;
  return Number(text) === Number(v);
};
const toDisplay = (v) => (v === null || v === undefined || v === '') ? '' : String(v);

function NumberInput({ value, onChange, placeholder = '0', allowEmpty = false, id, 'aria-describedby': describedBy }) {
  const [local, setLocal] = useState(() => toDisplay(value));

  // Re-sync when the parent changes `value` (e.g. after save), but never
  // overwrite what the user is mid-typing if it already means the same number.
  useEffect(() => {
    setLocal(prev => (sameNumber(prev, value) ? prev : toDisplay(value)));
  }, [value]);

  function handleChange(raw) {
    setLocal(raw);
    if (raw === '') {
      if (allowEmpty) onChange('');       // otherwise wait for blur to settle on 0
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  }

  function handleBlur(raw) {
    if (raw === '' && allowEmpty) { setLocal(''); onChange(''); return; }
    const n = Number(raw);
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    setLocal(String(safe));
    onChange(safe);
  }

  return (
    <input
      id={id}
      aria-describedby={describedBy}
      type="number"
      inputMode="decimal"
      step="any"
      className="input"
      placeholder={placeholder}
      value={local}
      min={0}
      onChange={e => handleChange(e.target.value)}
      onBlur={e => handleBlur(e.target.value)}
    />
  );
}

function NumberFormField({ label, value, onChange, placeholder, required = false, allowEmpty = false, hint, warn = false }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: '#e74c3c', marginInlineStart: 4 }} aria-hidden="true">*</span>}
      </label>
      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && <div id={hintId} className={`set-hint ${warn ? 'set-hint--warn' : ''}`}>{hint}</div>}
    </div>
  );
}

// A real <button role="switch">: focusable, Space/Enter toggle it, and it
// has an accessible name. (The old <div onClick> was mouse-only.)
function Toggle({ checked, onChange, label, labelledBy, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      className="set-switch"
      onClick={() => onChange?.(!checked)}
    />
  );
}