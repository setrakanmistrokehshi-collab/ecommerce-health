import { CreditCard } from 'lucide-react';

const GATEWAYS = [
  { code: 'monnify', label: 'Pay with Monnify', blurb: 'Card, bank transfer, USSD' },
  { code: 'bachs',  label: 'Pay with Bachs Multi-Currency', blurb: 'Secure payment' },
  { code: 'paystack', label: 'Paystack', blurb: 'Card, bank transfer, USSD' },
  { code: 'nomba',  label: 'Nomba', blurb: 'Card, bank transfer' },
];

export default function GatewayPicker({ value, onChange, currencyCode, disabled = false }) {
  const availableGateways = GATEWAYS.filter(
    (g) => g.code !== 'bachs' || ['USD', 'NGN'].includes(currencyCode ?? '')
  );

  return (
    <fieldset
      disabled={disabled}
      style={{
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <legend className="sr-only">Payment method</legend>

      {availableGateways.map((g) => {
        const active = value === g.code;
        const id = `gateway-${g.code}`;

        return (
          <label
            key={g.code}
            htmlFor={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: `1.5px solid ${active ? 'var(--sage)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: active ? 'var(--parchment)' : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <input
              id={id}
              type="radio"
              name="gateway"
              value={g.code}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(g.code)}
              style={{ accentColor: 'var(--sage)', width: 16, height: 16 }}
            />
            <CreditCard
              size={18}
              strokeWidth={1.8}
              color={active ? 'var(--sage)' : 'var(--muted)'}
              aria-hidden="true"
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--forest)' }}>
                {g.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {g.blurb}
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}