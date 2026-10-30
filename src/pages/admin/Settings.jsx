// src/pages/admin/Settings.jsx
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Store, CreditCard, Truck, Mail, Bell, Lock } from 'lucide-react';
import './Settings.css';

// ── Constants ───────────────────────────────────────────────────────────────

const SERVER_ORIGIN =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : window.location.origin;

const MASKED = '***';
const isMasked = (v) => !v || String(v).trim() === MASKED;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
const isNigeria = (c) => String(c ?? '').toLowerCase().trim() === 'nigeria';

const TABS = [
  { id: 'store', Icon: Store, label: 'Store' },
  { id: 'payments', Icon: CreditCard, label: 'Payments' },
  { id: 'shipping', Icon: Truck, label: 'Shipping' },
  { id: 'email', Icon: Mail, label: 'Email' },
  { id: 'notifications', Icon: Bell, label: 'Notifications' },
  { id: 'security', Icon: Lock, label: 'Security' },
];

const NOTIFICATIONS = [
  { id: 'lowStock', label: 'Low stock alerts' },
  { id: 'newOrder', label: 'New order placed' },
  { id: 'orderStatus', label: 'Order status update' },
  { id: 'newCustomer', label: 'New customer signup' },
  { id: 'payment', label: 'Payment received' },
  { id: 'review', label: 'Review submitted' },
];

const SECURITY_SETTINGS = [
  { id: '2fa', label: 'Two-factor authentication' },
  { id: 'login_alert', label: 'Login email alerts' },
  { id: 'force_https', label: 'Force HTTPS' },
];

const ZONE_COUNTRY_SUGGESTIONS = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States',
  'United Kingdom', 'Canada', 'Cameroon', 'Senegal', 'Ivory Coast',
  'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Egypt',
  'Germany', 'France', 'Netherlands', 'Australia', 'India',
];

const EMPTY_FORM = {
  store: { name: '', email: '', phone: '', address: '', currency: '', nafdac: '', cac: '' },
  shipping: {
    fee: 0,
    freeThreshold: 0,
    domesticCap: { default: 5000 },
    internationalEnabled: false,
    zones: [],
  },
  notifications: {
    lowStockThreshold: 0,
    lowStock: false,
    newOrder: false,
    orderStatus: false,
    newCustomer: false,
    payment: false,
    review: false,
  },
  email: { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' },
  security: {},
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

// ── Zone helpers ────────────────────────────────────────────────────────────

let zoneSeq = 0;
const nextZoneUid = () => `zone-${++zoneSeq}`;

/** empty or 0 → never free */
function cleanThreshold(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseZone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const structured = raw.country != null || raw.state != null || raw.city != null;
  return {
    uid: nextZoneUid(),
    country: String(raw.country ?? 'Nigeria').trim(),
    state: structured
      ? (raw.state ? String(raw.state).trim() : '')
      : String(raw.name ?? '').trim(),
    city: structured ? (raw.city ? String(raw.city).trim() : '') : '',
    price: Math.max(0, Number(raw.price) || 0),
    freeThreshold: cleanThreshold(raw.freeThreshold),
  };
}

function zoneKey(country, state, city) {
  return [country, state, city]
    .map((v) => String(v || '').toLowerCase().trim())
    .join('|');
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState('store');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [newZoneCountry, setNewZoneCountry] = useState('Nigeria');
  const [newZoneState, setNewZoneState] = useState('');
  const [newZoneCity, setNewZoneCity] = useState('');
  const [newZonePrice, setNewZonePrice] = useState('');
  const [newZoneFreeThreshold, setNewZoneFreeThreshold] = useState('');

  const redirectTimerRef = useRef(null);
  const abortRef = useRef(null);
  const isDirtyRef = useRef(false);
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  useEffect(() => {
    const onUnload = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load / save ───────────────────────────────────────────────────────────

  async function loadSettings({ silent = false } = {}) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }

    try {
      const { data } = await api.get('/admin/settings', { signal: controller.signal });
      if (controller.signal.aborted) return;

      const settings = data?.data ?? data ?? {};
      const s = settings.shipping ?? {};

      setForm((prev) => ({
        ...prev,
        store: { ...prev.store, ...settings.store },
        shipping: {
          fee: Math.max(0, Number(s.fee ?? s.standardFee ?? 0) || 0),
          freeThreshold: Math.max(
            0,
            Number(s.freeThreshold ?? s.freeShippingThreshold ?? 0) || 0
          ),
          domesticCap: Math.max(0, Number(s.domesticCap?.default ?? 5000) || 0),
          internationalEnabled: Boolean(s.internationalEnabled),
          zones: Array.isArray(s.zones)
            ? s.zones.map(parseZone).filter(Boolean)
            : [],
        },
        notifications: { ...prev.notifications, ...settings.notifications },
        email: { ...prev.email, ...settings.email, smtpPass: '' },
      }));
      isDirtyRef.current = false;
    } catch (err) {
      if (
        err.name === 'AbortError' ||
        err.name === 'CanceledError' ||
        err.code === 'ERR_CANCELED'
      ) {
        return;
      }
      console.error('Failed to load settings:', err);
      if (silent) {
        toast('Saved, but the page could not refresh. Please reload.', { icon: '⚠️' });
      } else {
        setLoadError(true);
        toast.error('Could not load settings. Saving is turned off until this works.');
      }
    } finally {
      if (!silent && !controller.signal.aborted) setLoading(false);
    }
  }

  function updateStore(key, value) {
    markDirty();
    setForm((prev) => ({ ...prev, store: { ...prev.store, [key]: value } }));
  }
  function updateEmail(key, value) {
    markDirty();
    setForm((prev) => ({ ...prev, email: { ...prev.email, [key]: value } }));
  }
  function updateNotification(key, value) {
    markDirty();
    setForm((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  }
  function updateShippingField(key, value) {
    markDirty();
    setForm((prev) => ({
      ...prev,
      shipping: { ...prev.shipping, [key]: value },
    }));
  }
  function updatePasswordField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const updateZoneField = useCallback(
    (uid, field, value) => {
      markDirty();
      setForm((prev) => ({
        ...prev,
        shipping: {
          ...prev.shipping,
          zones: prev.shipping.zones.map((z) =>
            z.uid === uid ? { ...z, [field]: value } : z
          ),
        },
      }));
    },
    [markDirty]
  );

  const removeShippingZone = useCallback(
    (uid) => {
      markDirty();
      setForm((prev) => ({
        ...prev,
        shipping: {
          ...prev.shipping,
          zones: prev.shipping.zones.filter((z) => z.uid !== uid),
        },
      }));
    },
    [markDirty]
  );

  function addShippingZone() {
    const country = newZoneCountry.trim();
    const stateVal = newZoneState.trim();
    const cityVal = newZoneCity.trim();

    if (!country) {
      toast.error('Please enter a country');
      return;
    }
    if (cityVal && !stateVal) {
      toast.error('Please add a state when you add a city');
      return;
    }

    const price = Number(newZonePrice.trim());
    if (!newZonePrice.trim() || !Number.isFinite(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    let freeThreshold = null;
    if (newZoneFreeThreshold.trim()) {
      const n = Number(newZoneFreeThreshold.trim());
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Please enter a valid free shipping amount');
        return;
      }
      freeThreshold = cleanThreshold(n);
    }

    const key = zoneKey(country, stateVal, cityVal);
    if (
      form.shipping.zones.some(
        (z) => zoneKey(z.country, z.state || '', z.city || '') === key
      )
    ) {
      toast.error('This zone already exists');
      return;
    }

    markDirty();
    setForm((prev) => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: [
          ...prev.shipping.zones,
          {
            uid: nextZoneUid(),
            country,
            state: stateVal,
            city: cityVal,
            price: Math.max(0, price),
            freeThreshold,
          },
        ],
      },
    }));

    setNewZoneState('');
    setNewZoneCity('');
    setNewZonePrice('');
    setNewZoneFreeThreshold('');
  }

  function validateShippingConfig() {
    const fee = Number(form.shipping.fee);
    const threshold = Number(form.shipping.freeThreshold);
    const cap = Number(form.shipping.domesticCap);

    if (!Number.isFinite(fee) || fee < 0) return 'Shipping fee must be 0 or more.';
    if (!Number.isFinite(threshold) || threshold < 0) {
      return 'Free shipping amount must be 0 or more.';
    }
    if (!Number.isFinite(cap) || cap < 0) return 'Max Nigeria fee must be 0 or more.';

    const seen = new Set();
    for (const zone of form.shipping.zones) {
      const country = String(zone.country ?? '').trim();
      const state = String(zone.state ?? '').trim();
      const city = String(zone.city ?? '').trim();
      const price = Number(zone.price);

      if (!country) return 'Each zone needs a country.';
      if (city && !state) return `Zone "${country}": please add a state when you set a city.`;
      if (!Number.isFinite(price) || price < 0) {
        return `Zone "${country}" needs a valid price.`;
      }

      const key = zoneKey(country, state, city);
      if (seen.has(key)) {
        return `This zone is listed twice: ${country}${state ? ` / ${state}` : ''}${city ? ` / ${city}` : ''}`;
      }
      seen.add(key);
    }

    if (
      form.shipping.internationalEnabled &&
      !form.shipping.zones.some((z) => !isNigeria(z.country))
    ) {
      return 'International shipping is on. Please add at least one zone outside Nigeria, or turn it off.';
    }

    return '';
  }

  async function saveSettings() {
    if (loadError) {
      toast.error('Settings did not load. Please refresh the page before saving.');
      return;
    }

    const storeName = form.store.name.trim();
    const storeEmail = form.store.email.trim();
    if (!storeName) {
      toast.error('Store name is required');
      return;
    }
    if (!storeEmail || !EMAIL_RE.test(storeEmail)) {
      toast.error('Please enter a valid store email');
      return;
    }

    const shippingError = validateShippingConfig();
    if (shippingError) {
      toast.error(shippingError);
      return;
    }

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
          fee: Number(form.shipping.fee) || 0,
          freeThreshold: Number(form.shipping.freeThreshold) || 0,
          domesticCap: Number(form.shipping.domesticCap) || 0,
          internationalEnabled: Boolean(form.shipping.internationalEnabled),
          zones: form.shipping.zones.map((z) => ({
            country: String(z.country).trim(),
            state: z.state ? String(z.state).trim() : null,
            city: z.city ? String(z.city).trim() : null,
            price: Number(z.price) || 0,
            freeThreshold: cleanThreshold(z.freeThreshold),
          })),
        },
        notifications: form.notifications,
        email: emailPayload,
      });

      toast.success('Settings saved');
      isDirtyRef.current = false;
      await loadSettings({ silent: true });
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password needs letters and numbers');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('Please choose a different password from the current one');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/admin/settings/password', { currentPassword, newPassword });
      toast.success('Password changed. You will be logged out shortly.');
      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      redirectTimerRef.current = setTimeout(() => {
        window.location.href = '/admin-login?passwordChanged=true';
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally {
      setChangingPassword(false);
    }
  }

  async function sendTestEmail() {
    const email = form.store.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      toast.error('Please enter a valid store email first');
      return;
    }
    try {
      await api.post('/admin/settings/test-email', { email });
      toast.success('Test email sent');
    } catch {
      toast.error('Could not send test email');
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        role="status"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}
      >
        Loading settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <div className="set-note set-note--danger" role="alert">
          Settings could not be loaded. Saving is turned off so nothing is overwritten by
          mistake.{' '}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => loadSettings()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isSaveDisabled = saving || changingPassword || loadError;
  const { fee, domesticCap } = form.shipping;
  const cap = Number(domesticCap) || 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="settings-page">
      <datalist id="zone-countries-list">
        {ZONE_COUNTRY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Configure your store preferences
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={saveSettings}
          disabled={isSaveDisabled}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-layout">
        <div
          className="card settings-tabs"
          role="tablist"
          aria-label="Settings sections"
          style={{ padding: 8 }}
        >
          {TABS.map((t) => (
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

        <div
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
        >
          {/* Store */}
          {tab === 'store' && (
            <>
              <div className="card">
                <div className="card-title set-card-title">Store Information</div>
                <div className="set-grid set-grid--wide">
                  <FormField
                    label="Store Name"
                    value={form.store.name}
                    onChange={(v) => updateStore('name', v)}
                    placeholder="Your store name"
                    required
                  />
                  <FormField
                    label="Store Email"
                    value={form.store.email}
                    onChange={(v) => updateStore('email', v)}
                    type="email"
                    placeholder="admin@yourstore.ng"
                    required
                  />
                  <FormField
                    label="Support Phone"
                    value={form.store.phone}
                    onChange={(v) => updateStore('phone', v)}
                    placeholder="+234 800 000 0000"
                    type="tel"
                  />
                  <FormField
                    label="Store Address"
                    value={form.store.address}
                    onChange={(v) => updateStore('address', v)}
                    placeholder="City, Country"
                  />
                  <FormField
                    label="Currency"
                    value={form.store.currency}
                    onChange={(v) => updateStore('currency', v)}
                    placeholder="NGN"
                    hint="For example: NGN"
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title set-card-title">NAFDAC & Compliance</div>
                <div className="set-grid set-grid--wide">
                  <FormField
                    label="NAFDAC Number"
                    value={form.store.nafdac}
                    onChange={(v) => updateStore('nafdac', v)}
                    placeholder="NAFDAC/FD-001"
                  />
                  <FormField
                    label="CAC Business Number"
                    value={form.store.cac}
                    onChange={(v) => updateStore('cac', v)}
                    placeholder="RC-1234567"
                  />
                </div>
              </div>
            </>
          )}

          {/* Payments */}
          {tab === 'payments' && (
            <div className="card">
              <div className="card-title set-card-title">Payment Gateway</div>
              <div className="set-note set-note--info">
                API keys are set on the server and cannot be changed here.
              </div>
              <div className="set-section-label">Nomba webhook URL</div>
              <div className="set-code">{SERVER_ORIGIN}/webhooks/nomba</div>
            </div>
          )}

          {/* Email */}
          {tab === 'email' && (
            <div className="card">
              <div className="card-title set-card-title">Email (SMTP)</div>
              <div className="set-grid set-grid--wide">
                <FormField
                  label="SMTP Host"
                  value={form.email.smtpHost}
                  onChange={(v) => updateEmail('smtpHost', v)}
                  placeholder="smtp.gmail.com"
                />
                <NumberFormField
                  label="SMTP Port"
                  value={form.email.smtpPort}
                  onChange={(v) => updateEmail('smtpPort', v)}
                  placeholder="587"
                />
                <FormField
                  label="SMTP User"
                  value={form.email.smtpUser}
                  onChange={(v) => updateEmail('smtpUser', v)}
                  placeholder="you@gmail.com"
                />
                <FormField
                  label="SMTP Password"
                  value={form.email.smtpPass}
                  onChange={(v) => updateEmail('smtpPass', v)}
                  type="password"
                  placeholder="Leave blank to keep the current password"
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={sendTestEmail}>
                  Send Test Email
                </button>
              </div>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="card">
              <div className="card-title set-card-title">Notification Preferences</div>
              {NOTIFICATIONS.map(({ id, label }) => (
                <div key={id} className="set-row">
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle
                    label={label}
                    checked={form.notifications[id] || false}
                    onChange={(checked) => updateNotification(id, checked)}
                  />
                </div>
              ))}
              <div style={{ marginTop: 16, maxWidth: 240 }}>
                <NumberFormField
                  label="Low stock threshold"
                  value={form.notifications.lowStockThreshold}
                  onChange={(v) => updateNotification('lowStockThreshold', v)}
                  placeholder="30"
                  hint="You will get an alert when stock goes below this number"
                />
              </div>
            </div>
          )}

          {/* Security */}
          {tab === 'security' && (
            <div className="card">
              <div className="card-title set-card-title">Security</div>
              <div className="set-note set-note--warn">
                These options are not active yet.
              </div>
              {SECURITY_SETTINGS.map(({ id, label }) => (
                <div key={id} className="set-row" style={{ opacity: 0.55 }}>
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle
                    label={label}
                    checked={form.security[id] || false}
                    onChange={() => {}}
                    disabled
                  />
                </div>
              ))}

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>
                  Change Admin Password
                </div>
                <div className="form-grid-1" style={{ maxWidth: 400 }}>
                  <FormField
                    label="Current password"
                    required
                    type="password"
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(v) => updatePasswordField('currentPassword', v)}
                  />
                  <FormField
                    label="New password"
                    required
                    type="password"
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={(v) => updatePasswordField('newPassword', v)}
                    hint="At least 8 characters, with letters and numbers"
                  />
                  <FormField
                    label="Confirm password"
                    required
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(v) => updatePasswordField('confirmPassword', v)}
                  />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={changePassword}
                    disabled={changingPassword}
                    style={{ alignSelf: 'flex-start', marginTop: 8 }}
                  >
                    {changingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shipping */}
          {tab === 'shipping' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>
                Shipping
              </div>
              <p className="set-hint" style={{ marginBottom: 16 }}>
                Amounts are in naira (₦). Zones set the price for each place. Nigeria defaults
                apply when there is no matching zone.
              </p>

              <div className="set-section-label">Nigeria defaults</div>
              <div className="set-grid set-block">
                <NumberFormField
                  label="Default shipping fee (₦)"
                  value={form.shipping.fee}
                  onChange={(v) => updateShippingField('fee', v)}
                  placeholder="5000"
                  hint={
                    cap > 0 && Number(fee) > cap
                      ? `This is higher than the Nigeria max fee (${naira(cap)}), so the max will be used at checkout`
                      : 'Used for Nigeria when no zone matches'
                  }
                  warn={cap > 0 && Number(fee) > cap}
                />
                <NumberFormField
                  label="Free shipping from (₦)"
                  value={form.shipping.freeThreshold}
                  onChange={(v) => updateShippingField('freeThreshold', v)}
                  placeholder="70000"
                  hint="Orders at or above this amount get free shipping in Nigeria. Use 0 to turn this off"
                />
                <NumberFormField
                  label="Max Nigeria fee (₦)"
                  value={form.shipping.domesticCap}
                  onChange={(v) => updateShippingField('domesticCap', v)}
                  placeholder="5000"
                  hint="Highest fee allowed for Nigeria. Use 0 for no limit"
                />
              </div>

              <div
                className="set-row set-row--boxed"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <div className="set-row-title" id="intl-label">
                    International shipping
                  </div>
                  <div className="set-row-desc">
                    When this is off, customers outside Nigeria cannot check out. When it is on,
                    add at least one zone that is not Nigeria.
                  </div>
                </div>
                <Toggle
                  labelledBy="intl-label"
                  checked={!!form.shipping.internationalEnabled}
                  onChange={(checked) => updateShippingField('internationalEnabled', checked)}
                />
              </div>

              <div className="set-section-label">Add zone</div>
              <form
                className="set-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  addShippingZone();
                }}
              >
                <div className="set-grid">
                  <TextField
                    label="Country *"
                    list="zone-countries-list"
                    placeholder="e.g. Ghana"
                    value={newZoneCountry}
                    onChange={setNewZoneCountry}
                    hint="Use the same country name as on the checkout page"
                  />
                  <TextField
                    label="State"
                    placeholder="Optional"
                    value={newZoneState}
                    onChange={setNewZoneState}
                    hint="Leave blank to cover the whole country"
                  />
                  <TextField
                    label="City"
                    placeholder="Optional"
                    value={newZoneCity}
                    onChange={setNewZoneCity}
                    hint="If you add a city, also add a state"
                  />
                </div>
                <div className="set-grid set-grid--end">
                  <TextField
                    label="Price (₦) *"
                    type="number"
                    min={0}
                    placeholder="20000"
                    inputMode="decimal"
                    value={newZonePrice}
                    onChange={setNewZonePrice}
                    hint="Shipping price in naira. Use 0 for free shipping"
                  />
                  <TextField
                    label="Free from order total (₦)"
                    type="number"
                    min={0}
                    placeholder="Optional"
                    inputMode="decimal"
                    value={newZoneFreeThreshold}
                    onChange={setNewZoneFreeThreshold}
                    hint="Optional. Leave blank if this zone should not become free by order size"
                  />
                  <div className="form-field">
                    <button className="btn btn-primary btn-full" type="submit">
                      Add zone
                    </button>
                  </div>
                </div>
              </form>

              <div className="set-section-label">
                Zones ({form.shipping.zones.length})
              </div>
              {form.shipping.zones.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                  No zones yet. Nigeria can still use the defaults above.
                </div>
              ) : (
                form.shipping.zones.map((zone) => (
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

// ── Small components ────────────────────────────────────────────────────────

const ZoneRow = memo(function ZoneRow({ zone, cap, onChange, onRemove }) {
  const id = useId();
  const overCap =
    cap > 0 && isNigeria(zone.country) && Number(zone.price) > cap;

  return (
    <div className="set-zone">
      <div className="set-grid">
        <TextField
          label="Country"
          list="zone-countries-list"
          value={zone.country}
          onChange={(v) => onChange(zone.uid, 'country', v)}
          id={`${id}-country`}
        />
        <TextField
          label="State"
          placeholder="Whole country if empty"
          value={zone.state || ''}
          onChange={(v) => onChange(zone.uid, 'state', v)}
          id={`${id}-state`}
        />
        <TextField
          label="City"
          placeholder="Whole state if empty"
          value={zone.city || ''}
          onChange={(v) => onChange(zone.uid, 'city', v)}
          id={`${id}-city`}
        />
      </div>
      <div className="set-grid set-grid--end">
        <NumberFormField
          label="Price (₦)"
          value={zone.price}
          onChange={(v) => onChange(zone.uid, 'price', Math.max(0, Number(v) || 0))}
          placeholder="20000"
          hint={
            overCap
              ? `Higher than the Nigeria max fee (${naira(cap)}), so the max will be used at checkout`
              : Number(zone.price) === 0
                ? 'Free shipping for this zone'
                : undefined
          }
          warn={overCap}
        />
        <NumberFormField
          label="Free from (₦)"
          value={zone.freeThreshold ?? ''}
          onChange={(v) =>
            onChange(
              zone.uid,
              'freeThreshold',
              v === '' || v == null ? null : Math.max(0, Number(v) || 0)
            )
          }
          allowEmpty
          placeholder="Never free"
          hint="Leave blank if this zone should not become free by order size"
        />
        <div className="set-zone-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onRemove(zone.uid)}
          >
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
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
      {hint && <div className="set-hint">{hint}</div>}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  hint,
  autoComplete,
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span style={{ color: '#e74c3c', marginInlineStart: 4 }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value ?? ''}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <div className="set-hint">{hint}</div>}
    </div>
  );
}

const sameNumber = (text, v) => {
  const textEmpty = text === '';
  const vEmpty = v === null || v === undefined || v === '';
  if (textEmpty || vEmpty) return textEmpty && vEmpty;
  return Number(text) === Number(v);
};

const toDisplay = (v) =>
  v === null || v === undefined || v === '' ? '' : String(v);

function NumberInput({
  value,
  onChange,
  placeholder = '0',
  allowEmpty = false,
  id,
  'aria-describedby': describedBy,
}) {
  const [local, setLocal] = useState(() => toDisplay(value));

  useEffect(() => {
    setLocal((prev) => (sameNumber(prev, value) ? prev : toDisplay(value)));
  }, [value]);

  function handleChange(raw) {
    setLocal(raw);
    if (raw === '') {
      if (allowEmpty) onChange('');
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  }

  function handleBlur(raw) {
    if (raw === '' && allowEmpty) {
      setLocal('');
      onChange('');
      return;
    }
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
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => handleBlur(e.target.value)}
    />
  );
}

function NumberFormField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  allowEmpty = false,
  hint,
  warn = false,
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span style={{ color: '#e74c3c', marginInlineStart: 4 }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && (
        <div id={hintId} className={`set-hint ${warn ? 'set-hint--warn' : ''}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

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