// src/pages/AdminLoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/context/authStore';
import { ROLES } from '@/constants/roles';
import { Leaf } from 'lucide-react';


export default function AdminLoginPage() {
  const navigate    = useNavigate();
  const adminLogin  = useAuthStore((s) => s.adminLogin);
  const isLoading   = useAuthStore((s) => s.isLoading);
  const error       = useAuthStore((s) => s.error);
  const clearError  = useAuthStore((s) => s.clearError);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
 

async function handleSubmit(e) {
  e.preventDefault();
  clearError();

  const result = await adminLogin({ email, password });

  if (!result.success) return;

  const role = result.user?.role;

  if (role === ROLES.ADMIN) {
    navigate('/admin/dashboard');
  } else if (role === ROLES.PRODUCT_MANAGER) {
    navigate('/admin/products');
  } else if (role === ROLES.ORDER_MANAGER) {
    navigate('/admin/orders');
  } else {
    navigate('/admin/dashboard');
  }
}

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}><Leaf size={16} strokeWidth={1.8} color="#fff" aria-hidden="true" /></div>
          <div style={styles.logoText}>Winners<span style={{ color: '#00c896' }}>health</span></div>
        </div>

        <h1 style={styles.title}>Admin Sign In</h1>
        <p style={styles.subtitle}>Staff access only — this is not the customer login page.</p>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@winnerstore.ng"
            style={styles.input}
            autoComplete="username"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={styles.input}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={isLoading} style={styles.button}>
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>

        <div style={styles.footer}>
          Not staff? <a href="/login" style={styles.link}>Go to customer login</a>
        </div>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1117',
    fontFamily: "'DM Sans', sans-serif",
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#181b23',
    border: '1px solid #262b3d',
    borderRadius: 16,
    padding: 32,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoMark: {
    width: 32, height: 32,
    background: 'linear-gradient(135deg, #00c896, #7c5cfc)',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16,
  },
  logoText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    color: '#e8eaf0',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e8eaf0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#7b829a',
    marginBottom: 24,
  },
  error: {
    background: 'rgba(255,77,109,.08)',
    border: '1px solid rgba(255,77,109,.2)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#ff4d6d',
    fontSize: 13,
    marginBottom: 16,
  },
  field: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#7b829a',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#1e2130',
    border: '1px solid #262b3d',
    borderRadius: 8,
    color: '#e8eaf0',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    background: '#00c896',
    color: '#0a1a15',
    border: 'none',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#7b829a',
    marginTop: 20,
  },
  link: {
    color: '#00c896',
    textDecoration: 'none',
  },
};
