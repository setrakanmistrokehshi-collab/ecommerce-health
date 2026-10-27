// All prices/totals from the backend (Order, Product) are stored and
// transmitted in KOBO (integer) — this matches the backend's own
// convention (see Order.js). Every place in the UI that shows money
// needs to go through this file rather than dividing/formatting inline;
// that's what let the same missing-/100 bug happen independently in
// CheckoutPage.jsx and OrdersPage.jsx.

export function koboToNaira(kobo) {
  return (kobo ?? 0) / 100;
}

export function formatNaira(kobo) {
  return `₦${koboToNaira(kobo).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Mirrors the backend's shipping rule exactly (routes/payments.js).
// Kept in ONE place so the checkout preview and the actual charge can
// never drift apart the way they did before — if this rule ever changes,
// change it here AND in payments.js, not just one of the two.
export const FREE_SHIPPING_THRESHOLD_KOBO = 2_500_000; // ₦25,000
export const SHIPPING_FEE_KOBO = 250_000; // ₦2,500

export function calculateShipping(subtotalKobo, discountKobo = 0) {
  return subtotalKobo - discountKobo >= FREE_SHIPPING_THRESHOLD_KOBO ? 0 : SHIPPING_FEE_KOBO;
}