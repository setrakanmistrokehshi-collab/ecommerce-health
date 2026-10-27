import { formatMoney, formatNairaAmount } from '@/config/cartMoney';

export default function TierSelector({ tiers, value, onChange, currency }) {
  const formatAmount = (amount) => currency?.code === 'NGN'
    ? formatNairaAmount(amount)
    : formatMoney(amount, currency?.code || 'NGN', currency?.rate || 1);

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-5) 0' }}>
      <legend style={{ fontSize: 14, fontWeight: 600, color: 'var(--forest)', marginBottom: 10 }}>
        Choose what works for you
      </legend>
      <div style={{ display: 'grid', gap: 8 }}>
        {tiers.map((tier) => (
          <label
            key={tier.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="pwyw-tier"
              value={tier.id}
              checked={String(value) === String(tier.id)}
              onChange={() => onChange(tier.id)}
            />
            <span style={{ flex: 1 }}>{tier.label}</span>
            <span style={{ fontWeight: 600 }}>{formatAmount(tier.amount)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}