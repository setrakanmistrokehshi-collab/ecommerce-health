// src/pages/auth/RegisterPage.jsx  (or wherever your auth pages live)
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useAuthStore from '@/context/authStore';
import { Field } from '@/components/ui';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Leaf, Check, Eye, EyeOff, House } from 'lucide-react';

// ── Shared Auth Card Shell ─────────────────────────────────────────
function AuthShell({ title, subtitle, children }) {
  const { t } = useTranslation();
  return (
    <div
      className="auth-shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cream)',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, animation: 'fadeUp 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, textDecoration: 'none' }}>
            <Leaf size={25} strokeWidth={1.7} color="var(--sage)" aria-hidden="true" />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--forest)', fontWeight: 700 }}>
              Winners Health
            </span>
          </Link>
          <Link
            to="/"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, color: 'var(--forest)' }}
          >
            <House size={15} strokeWidth={2} aria-hidden="true" />
            {t('auth.home')}
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--forest)', marginBottom: 6, lineHeight: 1.25 }}>
            {t('auth.headline')}
          </h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, fontSize: 14, margin: 0 }}>
            {t('auth.lede')}
          </p>
        </div>

        <div
          className="auth-shell__card"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--white)',
            borderRadius: 20,
            boxShadow: '0 1px 2px rgba(20,22,31,0.04), 0 12px 32px -12px rgba(20,22,31,0.12)',
            padding: 'var(--space-6) var(--space-5)',
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--forest)', marginBottom: 6 }}>
            {title}
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-6)', fontSize: 14 }}>{subtitle}</p>
          {children}
        </div>

      </div>
    </div>
  );
}

// ── Register Page ─────────────────────────────────────────────────
export function RegisterPage() {
  const { t } = useTranslation();
  const { register: registerUser, loginWithGoogle, isLoading } = useAuthStore(); // adjust if your store method is named differently
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const password = watch('password');

  const onSubmit = async (data) => {
    // Remove confirmPassword before sending
    const { confirmPassword, ...payload } = data;

    const result = await registerUser(payload); // expects { name, email, password }

    if (result?.success) {
      toast.success(t('auth.createdToast'), {
        icon: <Check size={18} strokeWidth={2.5} color="var(--success)" />,
      });
      navigate('/');
    } else {
      toast.error(result?.error || t('auth.registerFailed'));
    }
  };

  const handleGoogleSuccess = (data) => {
    loginWithGoogle(data);
    toast.success(t('auth.welcomeToast'));
    navigate(params.get('redirect') || '/');
  };

  const handleGoogleError = (err) => {
    toast.error(err.message || t('auth.googleFailed'));
  };


  return (
    <AuthShell title={t('footer.createAccount')} subtitle={t('auth.createSubtitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Google */}
         <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
        />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('auth.orEmail')}</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <Field label={t('auth.fullName')} error={errors.name?.message}>
            <input
              className={`input ${errors.name ? 'error' : ''}`}
              type="text"
              placeholder="Chidi Okonkwo"
              {...register('name', {
                required: t('auth.nameRequired'),
                minLength: { value: 2, message: t('auth.nameShort') },
              })}
            />
          </Field>

          <Field label={t('auth.email')} error={errors.email?.message}>
            <input
              className={`input ${errors.email ? 'error' : ''}`}
              type="email"
              placeholder="you@example.com"
              {...register('email', {
                required: t('auth.emailRequired'),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t('auth.emailInvalid'),
                },
              })}
            />
          </Field>

          <Field label={t('auth.password')} error={errors.password?.message}>
            <div style={{ position: 'relative' }}>
              <input
                className={`input ${errors.password ? 'error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.createPassword')}
                style={{ paddingInlineEnd: 44 }}
                {...register('password', {
                  required: t('auth.passwordRequired'),
                  minLength: { value: 6, message: t('auth.min6') },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                style={{
                  position: 'absolute',
                  insetInlineEnd: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
              </button>
            </div>
          </Field>

          <Field label={t('auth.confirmPassword')} error={errors.confirmPassword?.message}>
            <div style={{ position: 'relative' }}>
              <input
                className={`input ${errors.confirmPassword ? 'error' : ''}`}
                type={showConfirm ? 'text' : 'password'}
                placeholder={t('auth.repeatPassword')}
                style={{ paddingInlineEnd: 44 }}
                {...register('confirmPassword', {
                  required: t('auth.confirmRequired'),
                  validate: (value) => value === password || t('auth.mismatch'),
                })}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                style={{
                  position: 'absolute',
                  insetInlineEnd: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  padding: 0,
                }}
              >
                {showConfirm ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
              </button>
            </div>
          </Field>

          <button
            className="btn btn-primary btn-full btn-lg"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18 }} /> {t('auth.creating')}
              </>
            ) : (
              t('footer.createAccount')
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
            {t('auth.haveAccount')}{' '}
            <Link to="/login" style={{ color: 'var(--sage-dark)', fontWeight: 600 }}>
              {t('auth.signIn')}
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
export default RegisterPage;