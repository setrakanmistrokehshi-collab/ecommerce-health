// API categories are free text. Translate the six we ship; show anything
// else exactly as the API returned it.
const KNOWN = ['immunity', 'energy', 'vitamins', 'weight', 'beauty', 'general'];

export function categoryName(t, id) {
  return KNOWN.includes(id) ? t(`categories.${id}.name`) : id;
}

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

// Order statuses are API values; translate the ones we know, show others raw.
export function statusName(t, status) {
  return STATUSES.includes(status) ? t(`status.${status}`) : status;
}

// Locale-aware date/time using the browser's Intl (no extra dependency).
// Returns '' for missing/invalid dates instead of throwing.
export function formatDateTime(lang, value, withTime = true) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(lang, withTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(d);
  } catch {
    return '';
  }
}
