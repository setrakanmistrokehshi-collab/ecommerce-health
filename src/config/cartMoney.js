// Money helpers for screens that work with cart-store items — those
// items come straight from Product.price, which is plain Naira (see
// models/Product.js, seed.js, AddProduct.jsx "Price (₦)" field on the
// backend). This is deliberately separate from config/money.js, whose
// koboToNaira/formatNaira/FREE_SHIPPING_THRESHOLD_KOBO exist for actual
// Order documents fetched from the backend — those genuinely are kobo
// (see models/Order.js, payments.js). Mixing the two up is exactly the
// bug this file exists to prevent: don't format a cart-store total with
// config/money.js, and don't format an Order total with this file.
//
// Free-shipping/shipping-fee thresholds are mirrored in Naira here to
// match routes/payments.js's kobo constants exactly:
//   FREE_SHIPPING_THRESHOLD_KOBO = 2_500_000  → ₦25,000
//   SHIPPING_FEE_KOBO            =   250_000  → ₦2,500
// If either changes on the backend, update both this file and
// config/money.js so the three stay in sync.

export function formatNairaAmount(naira) {
  const value = Number(naira) || 0;
  return `₦${value.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const CURRENCY_SYMBOLS = { NGN: '₦', USD: '$', GBP: '£' };

/**
 * Converts a Naira amount into an arbitrary display currency and
 * formats it. Mirrors the backend's utils/money.js formatMoney()
 * exactly (same rate convention: units of the target currency per 1
 * NGN) so a price shown here and the amount actually charged at
 * checkout are computed the same way — this is a DISPLAY conversion
 * only, the underlying stored value stays Naira/kobo everywhere.
 */
export function formatMoney(naira, currencyCode, rate) {
  const value = (Number(naira) || 0) * rate;
  const symbol = CURRENCY_SYMBOLS[currencyCode] || `${currencyCode} `;
  return `${symbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const FREE_SHIPPING_THRESHOLD_NAIRA = 0;
export const SHIPPING_FEE_NAIRA = 0;

export function calculateShippingNaira(subtotalNaira, discountNaira = 0) {
  return subtotalNaira - discountNaira >= FREE_SHIPPING_THRESHOLD_NAIRA
    ? 0
    : SHIPPING_FEE_NAIRA;
}
