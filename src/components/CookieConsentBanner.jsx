import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

const STORAGE_KEY = 'cookie_consent';

/**
 * Reads the stored consent choice, if any.
 * Returns 'accepted' | 'declined' | null (no choice made yet).
 * Exported so metaPixel.js can check consent before firing anything,
 * without importing the whole banner component.
 */
export function getConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage unavailable (private browsing, etc.) — treat as no consent
  }
}

function setConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // If storage isn't available we can't persist the choice, but the
    // in-memory state for this page load still reflects it correctly.
  }
  window.dispatchEvent(new CustomEvent('cookieconsentchange', { detail: value }));
}

export default function CookieConsentBanner() {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(() => getConsent());

  useEffect(() => {
    const onChange = (e) => setChoice(e.detail);
    window.addEventListener('cookieconsentchange', onChange);
    return () => window.removeEventListener('cookieconsentchange', onChange);
  }, []);

  if (choice) return null; // already decided — nothing to show

  const accept = () => setConsent('accepted');
  const decline = () => setConsent('declined');

  return (
    <div
      role="dialog"
      aria-label={t('cookie.dialog')}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
        background: 'var(--charcoal, #1a1c25)',
        color: 'var(--cream, #f8f4ee)',
        padding: 'var(--space-4, 16px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
      }}>
        <Cookie size={22} strokeWidth={1.6} style={{ flexShrink: 0 }} aria-hidden="true" />

        <p style={{ flex: '1 1 320px', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          <Trans
            i18nKey="cookie.text"
            components={{
              privacy: <a href="/privacy-policy" style={{ color: 'inherit', textDecoration: 'underline' }} />,
            }}
          />
        </p>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={decline}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'inherit' }}
          >
            {t('cookie.decline')}
          </button>
          <button
            type="button"
            onClick={accept}
            className="btn btn-primary btn-sm"
          >
            {t('cookie.accept')}
          </button>
          <button
            type="button"
            onClick={decline}
            aria-label={t('cookie.dismiss')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.7,
            }}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
