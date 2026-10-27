import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import { LANGUAGES } from '@/i18n/languages';
import { setLanguage } from '@/i18n';

// Native <select>: fully keyboard/screen-reader accessible, and works on
// every phone. Each option carries its own lang attribute so assistive
// tech pronounces the names correctly.
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const current = i18n.resolvedLanguage || i18n.language;

  const onChange = async (e) => {
    setBusy(true);
    try {
      await setLanguage(e.target.value);
    } catch (err) {
      console.error('Language change failed:', err);
      toast.error(t('lang.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`lang-switch ${className}`}>
      <label htmlFor={id} className="sr-only">{t('lang.label')}</label>
      <Languages size={16} aria-hidden="true" />
      <select id={id} value={current} onChange={onChange} disabled={busy}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
