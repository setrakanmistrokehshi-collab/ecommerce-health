import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import {
  DEFAULT_LANGUAGE, STORAGE_KEY, SUPPORTED_CODES, detectLanguage, getLanguage,
} from './languages';

// English ships in the main bundle (it is the fallback and must never be
// missing). Every other locale is its own lazy chunk, fetched only when
// that language is selected.
const lazyLocales = import.meta.glob(['./locales/*.json', '!./locales/en.json']);

async function loadLocale(code) {
  if (i18n.hasResourceBundle(code, 'translation')) return;
  const loader = lazyLocales[`./locales/${code}.json`];
  if (!loader) throw new Error(`No locale file for "${code}"`);
  const mod = await loader();
  i18n.addResourceBundle(code, 'translation', mod.default ?? mod, true, true);
}

// Keep <html lang> and <html dir> in sync: screen readers pick the right
// voice, and Arabic gets a right-to-left layout.
function applyDocumentLanguage(code) {
  const { dir } = getLanguage(code);
  document.documentElement.setAttribute('lang', code);
  document.documentElement.setAttribute('dir', dir);
}

// Resolves (never rejects) once the first render can safely happen.
// If a non-English locale fails to load, the app starts in English.
export async function initI18n() {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,   // any missing key falls back to English
    supportedLngs: SUPPORTED_CODES,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },         // never blank the UI while loading
  });

  const initial = detectLanguage();
  if (initial !== DEFAULT_LANGUAGE) {
    try {
      await loadLocale(initial);
      await i18n.changeLanguage(initial);
    } catch (err) {
      console.error('Could not load language, using English:', err);
    }
  }

  applyDocumentLanguage(i18n.language);
  i18n.on('languageChanged', applyDocumentLanguage);
  return i18n;
}

// Used by the language switcher. Loads first, switches second, so the UI
// never shows a half-translated state; throws (and changes nothing) on failure.
export async function setLanguage(code) {
  if (!SUPPORTED_CODES.includes(code)) throw new Error(`Unsupported language "${code}"`);
  await loadLocale(code);
  await i18n.changeLanguage(code);
  try { localStorage.setItem(STORAGE_KEY, code); } catch (_) { /* ignore */ }
}

export default i18n;
