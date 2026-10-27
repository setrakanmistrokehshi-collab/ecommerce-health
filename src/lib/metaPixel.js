import { getConsent } from '@/components/CookieConsentBanner';

// src/lib/metaPixel.js
//
// Browser-side Meta Pixel. Paired with the server-side Conversions
// API in utils/metaCapi.js on the backend — every event fired from
// here should also be sent server-side with the SAME event_id so
// Meta's 48-hour dedup window merges them into one counted
// conversion instead of two.
//
// Nothing here fires until the person has explicitly accepted
// cookies (NDPR requires a legal basis — consent — before sending
// browsing behavior to a third party like Meta). If consent is
// declined or not yet given, every exported function becomes a no-op.

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;

let loaded = false;

function isConsented() {
  return getConsent() === 'accepted';
}

function isConfigured() {
  return Boolean(PIXEL_ID);
}

/**
 * Injects Meta's base pixel script. Safe to call multiple times —
 * only actually loads once. Call this after consent is granted (see
 * initIfConsented below), not unconditionally on app start.
 */
function loadPixelScript() {
  if (loaded || !isConfigured() || typeof window === 'undefined') return;
  loaded = true;

  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', PIXEL_ID);
}

/** Call once, high in the app (e.g. App.jsx), and again whenever
 *  consent changes — loads the pixel only if the person has said yes. */
export function initIfConsented() {
  if (isConsented()) loadPixelScript();
}

/**
 * Generates a shared event_id for a client+server event pair. Pass
 * the SAME string to the matching backend CAPI call for that logical
 * event (e.g. one order's Purchase) so Meta dedupes correctly.
 */
export function generateEventId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/**
 * Deterministic event_id for events tied to a persistent record
 * (currently: Purchase, keyed by order id) rather than a one-off
 * interaction. Using a random ID here would mean reloading the order
 * success page fires a *different* Purchase event_id each time,
 * which the browser Pixel would dutifully send again — this keeps
 * repeat visits to the same success page deduped against the first
 * Purchase event, both against themselves and against the one
 * server-side CAPI call in routes/payments.js (which must build this
 * exact same string: `purchase_${order._id}`).
 */
export function purchaseEventId(orderId) {
  return `purchase_${orderId}`;
}

/**
 * Fires a standard Pixel event, browser-side only. No-ops silently
 * if the pixel isn't loaded (not consented, or not configured) —
 * callers never need to check consent themselves.
 */
export function trackEvent(eventName, eventId, params = {}) {
  if (!isConsented() || !window.fbq) return;
  if (!loaded) loadPixelScript();
  window.fbq('trackSingle', PIXEL_ID, eventName, params, { eventID: eventId });
}

// ── Convenience wrappers for this store's funnel ──────────────────

export function trackViewContent(product, eventId) {
  const params = {
    content_ids: [product.id ?? product._id],
    content_type: 'product',
    content_name: product.name,
  };
  if (!product.pwywEnabled) {
    params.currency = 'NGN';
    params.value = product.price;
  }
  trackEvent('ViewContent', eventId, params);
}

export function trackAddToCart(product, quantity, eventId) {
  const params = {
    content_ids: [product.id ?? product._id],
    content_type: 'product',
    content_name: product.name,
  };
  if (!product.pwywEnabled) {
    params.currency = 'NGN';
    params.value = (product.price ?? 0) * quantity;
  }
  trackEvent('AddToCart', eventId, params);
}

export function trackInitiateCheckout(items, totalValue, eventId) {
  trackEvent('InitiateCheckout', eventId, {
    content_ids: items.map((i) => i.productId ?? i._id ?? i.id),
    content_type: 'product',
    currency: 'NGN',
    value: totalValue,
    num_items: items.reduce((sum, i) => sum + (i.quantity ?? 1), 0),
  });
}

export function trackPurchase(order, eventId) {
  trackEvent('Purchase', eventId, {
    content_ids: (order.items ?? []).map((i) => i.product ?? i.productId),
    content_type: 'product',
    currency: 'NGN',
    // order.total is stored in kobo on the backend Order model —
    // convert to Naira here since Pixel/CAPI value should be the
    // real transaction amount in the given currency's major unit.
    value: (order.total ?? 0) / 100,
  });
}
