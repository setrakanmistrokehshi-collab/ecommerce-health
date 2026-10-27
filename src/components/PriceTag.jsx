import { memo } from 'react';
import { formatNairaAmount, formatMoney } from '@/config/cartMoney';
import useCurrencyStore from '@/context/currencyStore';


 
function PriceTag({ amount, text, size = 'md', muted = false, serif = false, strike = false, color }) {
  const currency = useCurrencyStore((s) => s.getCurrent());

  const sizes = {
    sm: { fontSize: 13, fontWeight: 600 },
    md: { fontSize: 16, fontWeight: 700 },
    lg: { fontSize: 22, fontWeight: 700 },
    xl: { fontSize: 30, fontWeight: 700 },
  };
  const s = sizes[size] || sizes.md;

  const display = text !== undefined
    ? text
    : currency.code === 'NGN'
      ? formatNairaAmount(amount)
      : formatMoney(amount, currency.code, currency.rate);

  return (
    <span
      style={{
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: color || (muted ? 'var(--muted)' : 'var(--forest)'),
        textDecoration: strike ? 'line-through' : 'none',
        textDecorationColor: color || (muted ? 'var(--muted)' : 'var(--sage)'),
        textDecorationThickness: '1.5px',
        fontFamily: serif ? 'var(--font-display)' : 'var(--font-body)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  );
}

export default memo(PriceTag);
