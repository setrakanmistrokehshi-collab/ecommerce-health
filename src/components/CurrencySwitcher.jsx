import { useState, useRef, useEffect } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import useCurrencyStore from '@/context/currencyStore';

export default function CurrencySwitcher() {
  const available = useCurrencyStore((s) => s.available);
  const selected = useCurrencyStore((s) => s.selected);
  const setSelected = useCurrencyStore((s) => s.setSelected);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Only worth showing at all once there's more than NGN to choose
  // from — an empty/single-currency dropdown is just visual noise.
  if (available.length <= 1) return null;

  const current = available.find((c) => c.code === selected) || available[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
          padding: '6px 10px', fontSize: 13, fontWeight: 600, color: 'var(--forest)',
          cursor: 'pointer',
        }}
      >
        {current.code}
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: '110%', insetInlineEnd: 0, zIndex: 50,
            background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: 180, overflow: 'hidden',
          }}
        >
          {available.map((c) => (
            <button
              key={c.code}
              role="option"
              aria-selected={c.code === selected}
              onClick={() => { setSelected(c.code); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                width: '100%', padding: '10px 14px', background: c.code === selected ? 'var(--parchment)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--forest)',
              }}
            >
              <span>{c.symbol} {c.code} — {c.name}</span>
              {c.isStale && (
                <span title="Exchange rate hasn't been updated recently">
                  <AlertTriangle size={13} strokeWidth={2} color="var(--warning)" aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
