import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ThemeToggle() {
  const { t } = useTranslation();
  // Single source of truth: read the attribute main.jsx's IIFE already
  // set on <html> before React mounted. No separate localStorage read
  // here — two independent copies of "what's the current theme" logic
  // is exactly what caused this bug in the first place.
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? t('theme.toLight') : t('theme.toDark')}
      onClick={toggle}
      style={{
        position: 'relative',
        width: 52,
        height: 28,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Track icons — static, dimmed on the inactive side, give the
          switch meaning even before the knob finishes animating. */}
      <Sun
        size={13}
        strokeWidth={2}
        aria-hidden="true"
        style={{
          position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          color: dark ? 'var(--text-muted)' : 'var(--warning)',
          transition: 'color 0.2s ease',
        }}
      />
      <Moon
        size={13}
        strokeWidth={2}
        aria-hidden="true"
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          color: dark ? 'var(--text)' : 'var(--text-muted)',
          transition: 'color 0.2s ease',
        }}
      />

      {/* Knob */}
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: dark ? 26 : 2,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 0.2s ease',
        }}
      >
        {dark
          ? <Moon size={12} strokeWidth={2} color="var(--text)" aria-hidden="true" />
          : <Sun size={12} strokeWidth={2} color="var(--warning)" aria-hidden="true" />}
      </span>
    </button>
  );
}