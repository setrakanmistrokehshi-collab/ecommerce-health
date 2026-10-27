// Single source of truth for supported languages.
// `name` is the language's own name (shown in the switcher, never translated).
// To add a language: add an entry here, add src/i18n/locales/<code>.json,
// run `npm run i18n:check`.
export const DEFAULT_LANGUAGE = 'en';
export const STORAGE_KEY = 'wh_lang';

export const LANGUAGES = [
  { code: 'en', name: 'English',    dir: 'ltr' },
  { code: 'fr', name: 'Français',   dir: 'ltr' },
  { code: 'ar', name: 'العربية',     dir: 'rtl' },
  { code: 'pt', name: 'Português',  dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili',  dir: 'ltr' },
  { code: 'ha', name: 'Hausa',      dir: 'ltr' },
  { code: 'yo', name: 'Yorùbá',     dir: 'ltr' },
  { code: 'ig', name: 'Igbo',       dir: 'ltr' },
  { code: 'am', name: 'አማርኛ',       dir: 'ltr' },
  { code: 'es', name: 'Español',    dir: 'ltr' },
  { code: 'zh', name: '中文',        dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी',       dir: 'ltr' },
];

export const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

export const getLanguage = (code) =>
  LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

const normalise = (tag) => (typeof tag === 'string' ? tag.toLowerCase().split(/[-_]/)[0] : '');

// Saved choice first, then the browser's preference list, else English.
export function detectLanguage() {
  try {
    const saved = normalise(localStorage.getItem(STORAGE_KEY));
    if (SUPPORTED_CODES.includes(saved)) return saved;
  } catch (_) { /* storage can be blocked; fall through */ }

  const prefs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const tag of prefs) {
    const code = normalise(tag);
    if (SUPPORTED_CODES.includes(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
