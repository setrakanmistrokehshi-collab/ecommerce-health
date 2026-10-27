// src/pages/admin/Settings.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Store, CreditCard, Truck, Mail, Bell, Lock } from 'lucide-react';

const TABS = [
  { id: 'store',         Icon: Store,      label: 'Store'         },
  { id: 'payments',      Icon: CreditCard, label: 'Payments'      },
  { id: 'shipping',      Icon: Truck,      label: 'Shipping'      },
  { id: 'email',         Icon: Mail,       label: 'Email'         },
  { id: 'notifications', Icon: Bell,       label: 'Notifications' },
  { id: 'security',      Icon: Lock,       label: 'Security'      },
];

// Labels only. `id` matches the actual notification key defined in
// models/Settings.js (notifications.lowStock, notifications.newOrder,
// etc.), not an arbitrary frontend-invented name.
const NOTIFICATIONS = [
  { id: 'lowStock',    label: 'Low stock alerts'    },
  { id: 'newOrder',    label: 'New order placed'    },
  { id: 'orderStatus', label: 'Order status update' },
  { id: 'newCustomer', label: 'New customer signup' },
  { id: 'payment',     label: 'Payment received'    },
  { id: 'review',      label: 'Review submitted'    },
];

// Security settings aren't in models/Settings.js yet — kept as
// labels-only UI state until a backend field exists to persist them.
// See the note rendered in the Security tab below.
const SECURITY_SETTINGS = [
  { id: '2fa',         label: 'Two-factor authentication' },
  { id: 'login_alert', label: 'Login email alerts'        },
  { id: 'force_https', label: 'Force HTTPS'               },
];

// Empty shape matching models/Settings.js exactly — no sample/demo
// values. Every field starts blank/zero and is populated only from
// what loadSettings() actually receives from the backend.
const EMPTY_FORM = {
  store: {
    name: '', email: '', phone: '', address: '', currency: '', nafdac: '', cac: '',
  },
  payments: {
    nombaPublicKey: '', webhookSecret: '',
  },
  shipping: {
    fee: 0,
    freeThreshold: 0,
    zones: [], // [{ name, price }, ...] — shape and content come entirely from the backend
  },
  notifications: {
    lowStockThreshold: 0,
    lowStock: false, newOrder: false, orderStatus: false,
    newCustomer: false, payment: false, review: false,
  },
  email: {
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '',
  },
  security: {},
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function Settings() {
  const [tab, setTab] = useState('store');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZonePrice, setNewZonePrice] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      // Controller wraps as { success, data: {...} }
      const settings = data?.data ?? data ?? {};

      const nextShipping = settings.shipping ?? {};
      setForm(prev => ({
        ...prev,
        store:         { ...prev.store,         ...settings.store },
        payments:      { ...prev.payments,      ...settings.payments },
        shipping: {
          ...prev.shipping,
          fee: Math.max(0, Number(nextShipping.fee ?? nextShipping.standardFee ?? 0) || 0),
          freeThreshold: Math.max(
            0,
            Number(nextShipping.freeThreshold ?? nextShipping.freeShippingThreshold ?? 0) || 0
          ),
          zones: Array.isArray(nextShipping.zones)
            ? nextShipping.zones.map((zone) => ({
                name: String(zone.name ?? '').trim(),
                price: Math.max(0, Number(zone.price) || 0),
              }))
            : [],
        },
        notifications: { ...prev.notifications, ...settings.notifications },
        email:         { ...prev.email,         ...settings.email },
        // security has no backend field yet — leave as-is
      }));
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  function updateStore(key, value) {
    setForm(prev => ({ ...prev, store: { ...prev.store, [key]: value } }));
  }

  function updatePayments(key, value) {
    setForm(prev => ({ ...prev, payments: { ...prev.payments, [key]: value } }));
  }

  function updateEmail(key, value) {
    setForm(prev => ({ ...prev, email: { ...prev.email, [key]: value } }));
  }

  function updateNotification(key, value) {
    setForm(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
  }

  function updateSecurity(key, value) {
    setForm(prev => ({ ...prev, security: { ...prev.security, [key]: value } }));
  }

  function updateShippingField(key, value) {
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        [key]: Number(value) || 0,
      },
    }));
  }

  function updateZonePrice(zoneName, price) {
    const safePrice = Number(price) || 0;
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: prev.shipping.zones.map(z =>
          z.name === zoneName ? { ...z, price: Math.max(0, safePrice) } : z
        ),
      },
    }));
  }

  function addShippingZone() {
    const name = newZoneName.trim();
    const priceValue = newZonePrice.trim();
    const parsedPrice = Number(priceValue);

    if (!name) {
      toast.error('Zone name is required');
      return;
    }

    if (!priceValue || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error('Zone price must be a valid non-negative number');
      return;
    }

    if (form.shipping.zones.some(zone => zone.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A shipping zone with that name already exists');
      return;
    }

    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: [...prev.shipping.zones, { name, price: Math.max(0, parsedPrice) }],
      },
    }));

    setNewZoneName('');
    setNewZonePrice('');
  }

  function validateShippingConfig() {
    const fee = Number(form.shipping.fee);
    const threshold = Number(form.shipping.freeThreshold);

    if (!Number.isFinite(fee) || fee < 0) {
      return 'Shipping fee must be a valid non-negative number.';
    }

    if (!Number.isFinite(threshold) || threshold < 0) {
      return 'Free shipping threshold must be a valid non-negative number.';
    }

    const seenNames = new Set();
    for (const zone of form.shipping.zones) {
      const zoneName = String(zone.name ?? '').trim();
      const zonePrice = Number(zone.price);

      if (!zoneName) {
        return 'Every shipping zone needs a name.';
      }

      if (seenNames.has(zoneName.toLowerCase())) {
        return `Duplicate shipping zone name: ${zoneName}`;
      }
      seenNames.add(zoneName.toLowerCase());

      if (!Number.isFinite(zonePrice) || zonePrice < 0) {
        return `Shipping zone "${zoneName}" must have a valid non-negative price.`;
      }
    }

    return '';
  }

  function removeShippingZone(zoneName) {
    setForm(prev => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        zones: prev.shipping.zones.filter(z => z.name !== zoneName),
      },
    }));
  }

  function updatePasswordField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    if (!form.store.name.trim()) {
      toast.error('Store name is required');
      return;
    }
    if (!form.store.email.trim() || !form.store.email.includes('@')) {
      toast.error('Valid store email is required');
      return;
    }

    const validationError = validateShippingConfig();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      // Send only the settings-document shape the backend validates
      // (store/payments/shipping/notifications/email) — never the
      // password-change fields, which live in the same form state
      // but belong to a different endpoint entirely.
      await api.post('/admin/settings', {
        store: form.store,
        payments: form.payments,
        shipping: {
          fee: Number(form.shipping.fee) || 0,
          freeThreshold: Number(form.shipping.freeThreshold) || 0,
          zones: form.shipping.zones,
        },
        notifications: form.notifications,
        email: {
          smtpHost: form.email.smtpHost,
          smtpPort: form.email.smtpPort,
          smtpUser: form.email.smtpUser,
          // smtpPass intentionally omitted — backend stores it in
          // env/secrets manager, never accepts it over this endpoint
        },
      });
      toast.success('Settings saved successfully!');
     
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword || currentPassword.length < 1) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      toast.error('Password must contain at least one letter and one number');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from your current password');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/admin/settings/password', { currentPassword, newPassword });

      toast.success('Password changed successfully! You will be logged out shortly.');

      setForm(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      setTimeout(() => {
        window.location.href = '/admin-login?passwordChanged=true';
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function sendTestEmail() {
    try {
      await api.post('/admin/settings/test-email', { email: form.store.email });
      toast.success('Test email sent successfully!');
    } catch (err) {
      toast.error('Failed to send test email');
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
      }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Configure your store preferences
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={saving}
          type="button"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-layout">
        <div className="card settings-tabs" style={{ padding: 8 }}>
          {TABS.map(t => (
            <div
              key={t.id}
              className={`nav-item settings-tab-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <t.Icon size={16} strokeWidth={1.8} aria-hidden="true" /> {t.label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Store Tab */}
          {tab === 'store' && (
            <>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>Store Information</div>
                <div className="form-grid-2">
                  <FormField
                    label="Store Name"
                    value={form.store.name}
                    onChange={v => updateStore('name', v)}
                    placeholder="Your store name"
                    required
                  />
                  <FormField
                    label="Store Email"
                    value={form.store.email}
                    onChange={v => updateStore('email', v)}
                    type="email"
                    placeholder="admin@yourstore.ng"
                    required
                  />
                  <FormField
                    label="Support Phone"
                    value={form.store.phone}
                    onChange={v => updateStore('phone', v)}
                    placeholder="+234 800 000 0000"
                  />
                  <FormField
                    label="Store Address"
                    value={form.store.address}
                    onChange={v => updateStore('address', v)}
                    placeholder="City, Country"
                  />
                  <FormField
                    label="Currency"
                    value={form.store.currency}
                    onChange={v => updateStore('currency', v)}
                    placeholder="NGN"
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>NAFDAC & Compliance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField
                    label="NAFDAC Number"
                    value={form.store.nafdac}
                    onChange={v => updateStore('nafdac', v)}
                    placeholder="NAFDAC/FD-001"
                  />
                  <FormField
                    label="CAC Business Number"
                    value={form.store.cac}
                    onChange={v => updateStore('cac', v)}
                    placeholder="RC-1234567"
                  />
                </div>
              </div>
            </>
          )}

          {/* Payments Tab */}
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
              }}>
                ℹ️ Your backend already handles Nomba webhook verification via HMAC-SHA512.
                Enter keys from your Nomba dashboard. Saved keys are masked as *** on reload —
                re-enter a value only if you're changing it.
              </div>

              <FormField
                label="Nomba Public Key"
                value={form.payments.nombaPublicKey}
                onChange={v => updatePayments('nombaPublicKey', v)}
                placeholder="pk_live_…"
                type="password"
              />

              <FormField
                label="Webhook Secret"
                value={form.payments.webhookSecret}
                onChange={v => updatePayments('webhookSecret', v)}
                placeholder="whsec_…"
                type="password"
              />

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
                }}>
                  {window.location.origin}/webhooks/nomba
                </div>
              </div>
            </div>
          )}

          {/* Email Tab */}
          {tab === 'email' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Email (SMTP / Nodemailer)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  label="SMTP Host"
                  value={form.email.smtpHost}
                  onChange={v => updateEmail('smtpHost', v)}
                  placeholder="smtp.gmail.com"
                />
                <FormField
                  label="SMTP Port"
                  value={form.email.smtpPort}
                  onChange={v => updateEmail('smtpPort', Number(v) || 0)}
                  type="number"
                />
                <FormField
                  label="SMTP User"
                  value={form.email.smtpUser}
                  onChange={v => updateEmail('smtpUser', v)}
                  placeholder="you@gmail.com"
                />
                <FormField
                  label="SMTP Pass"
                  value={form.email.smtpPass}
                  onChange={v => updateEmail('smtpPass', v)}
                  type="password"
                  placeholder="App password (set on server, not saved here)"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={sendTestEmail}
                  type="button"
                >
                  Send Test Email
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {tab === 'notifications' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Notification Preferences</div>

              {NOTIFICATIONS.map(({ id, label }) => (
                <div key={id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <Toggle
                    checked={form.notifications[id] || false}
                    onChange={(checked) => updateNotification(id, checked)}
                  />
                </div>
              ))}

              <div className="form-field" style={{ marginTop: 16 }}>
                <label>Low Stock Threshold</label>
                <input
                  type="number"
                  value={form.notifications.lowStockThreshold}
                  onChange={e => updateNotification('lowStockThreshold', Number(e.target.value) || 0)}
                  style={{ width: 100 }}
                />
              </div>
            </div>
          )}

          {/* Security Tab */}
          {tab === 'security' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Security Settings</div>

              <div style={{
                padding: '10px 14px',
                background: 'rgba(224,160,62,.08)',
                border: '1px solid rgba(224,160,62,.25)',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--muted)',
              }}>
                These toggles aren't wired to a backend field yet — models/Settings.js has no
                `security` section, so changes here won't persist until that's added.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SECURITY_SETTINGS.map(({ id, label }) => (
                  <div key={id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 13 }}>{label}</span>
                    <Toggle
                      checked={form.security[id] || false}
                      onChange={(checked) => updateSecurity(id, checked)}
                    />
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 24,
                borderTop: '1px solid var(--border)',
                paddingTop: 24,
              }}>
                <div className="card-title" style={{ marginBottom: 12 }}>
                  Change Admin Password
                </div>

                <div className="form-grid-1" style={{ maxWidth: 400 }}>
                  <div className="form-field">
                    <label>
                      Current Password <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <input
                      type="password"
                      value={form.currentPassword}
                      onChange={e => updatePasswordField('currentPassword', e.target.value)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="form-field">
                    <label>
                      New Password <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
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
                    <label>
                      Confirm Password <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => updatePasswordField('confirmPassword', e.target.value)}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={changePassword}
                    disabled={changingPassword}
                    style={{ alignSelf: 'flex-start', marginTop: 8 }}
                    type="button"
                  >
                    {changingPassword ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Tab */}
          {tab === 'shipping' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Shipping Configuration</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <FormField
                  label="Shipping Fee (₦)"
                  value={form.shipping.fee}
                  onChange={(v) => updateShippingField('fee', v)}
                  type="number"
                  placeholder="5000"
                />
                <FormField
                  label="Free Shipping Threshold (₦)"
                  value={form.shipping.freeThreshold}
                  onChange={(v) => updateShippingField('freeThreshold', v)}
                  type="number"
                  placeholder="60000"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr auto', gap: 10, marginBottom: 16 }}>
                <input
                  className='input'
                  placeholder='Zone name (e.g. Lagos Mainland)'
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                />
                <input
                  className='input'
                  type='number'
                  placeholder='Price'
                  value={newZonePrice}
                  onChange={(e) => setNewZonePrice(e.target.value)}
                />
                <button className='btn btn-primary btn-sm' type='button' onClick={addShippingZone}>
                  Add Zone
                </button>
              </div>

              {form.shipping.zones.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
                  No shipping zones configured yet.
                </div>
              ) : (
                form.shipping.zones.map((zone) => (
                  <div key={zone.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 13, flex: 1 }}>{zone.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>₦</span>
                      <input
                        type="number"
                        value={zone.price}
                        onChange={(e) => updateZonePrice(zone.name, parseInt(e.target.value, 10) || 0)}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text)',
                          fontFamily: 'var(--mono)',
                          fontSize: 13,
                          padding: '5px 8px',
                          outline: 'none',
                          width: 80,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                    <button
                      type='button'
                      className='btn btn-ghost btn-sm'
                      onClick={() => removeShippingZone(zone.name)}
                      style={{ color: 'var(--danger)', padding: '4px 8px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── COMPONENTS ─────────────────────────────────────────────────────

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

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange?.(!checked)}
      role="switch"
      aria-checked={checked}
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