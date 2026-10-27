import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { AlertTriangle, Search, Clock, HeartHandshake, ArrowRight } from 'lucide-react';
import { formatNaira } from '@/config/money';


// Text lives in the locale files (pay.*). `body` lists translation keys; the
// bodies contain <strong> tags, rendered with <Trans>. `{{total}}` is the
// order total formatted by formatNaira.
const STATUS_CONFIG = {
  pending: {
    tone: 'neutral',
    Icon: Clock,
    title: 'pay.pendingTitle',
    body: ['pay.pendingBody'],
  },
  rejected: {
    tone: 'warning',
    Icon: AlertTriangle,
    title: 'pay.rejectedTitle',
    body: ['pay.rejectedBody', 'pay.rejectedTotal?'], // '?' = only when order.total exists
    cta: { label: 'pay.retry', to: (order) => `/checkout?retry=${order._id}` },
  },
  flagged_underpaid: {
    tone: 'warning',
    Icon: AlertTriangle,
    title: 'pay.underTitle',
    body: ['pay.underBody'],
    // NOTE: /contact has no route in App.jsx yet, so this link currently 404s.
    cta: { label: 'pay.contact', to: () => '/contact' },
  },
  discrepancy: {
    tone: 'warning',
    Icon: Search,
    title: 'pay.discTitle',
    body: ['pay.discBody'],
    cta: { label: 'pay.contact', to: () => '/contact' },
  },
  expired: {
    tone: 'neutral',
    Icon: Clock,
    title: 'pay.expiredTitle',
    body: ['pay.expiredBody'],
    cta: { label: 'pay.retry', to: (order) => `/checkout?retry=${order._id}` },
  },
};

const TONE_STYLES = {
  warning: {
    background: '#FFFBEB',
    border: '#F0C36D',
    iconBg: '#F5E3B3',
    title: '#92400E',
    body: '#7A5B15',
  },
  neutral: {
    background: 'var(--parchment, #F4F1EA)',
    border: '#DED8C8',
    iconBg: '#E7E2D6',
    title: 'var(--forest-deep, #2F5D3A)',
    body: 'var(--muted, #6B6A63)',
  },
};

export default function PaymentStatusBanner({ order }) {
  const { t } = useTranslation();
  if (!order) return null;

  const paymentStatus = String(order.paymentStatus ?? '').toLowerCase();
  const orderStatus = String(order.status ?? '').toLowerCase();
  const gatewayStatus = String(order.gatewayStatus ?? order.paymentResult?.status ?? '').toLowerCase();
  const paymentIsSettled =
    ['completed', 'paid', 'success', 'successful'].includes(paymentStatus) ||
    ['completed', 'paid', 'processing', 'shipped', 'delivered'].includes(orderStatus) ||
    ['completed', 'paid', 'success', 'successful'].includes(gatewayStatus);

  if (paymentIsSettled && !order.overpaymentFlag) return null;

  if (order.overpaymentFlag) {
    return (
      <div style={bannerStyle(TONE_STYLES.neutral)}>
        <span style={iconStyle(TONE_STYLES.neutral)}>
          <HeartHandshake size={16} strokeWidth={1.8} color={TONE_STYLES.neutral.title} aria-hidden="true" />
        </span>
        <div>
          <p style={titleStyle(TONE_STYLES.neutral)}>{t('pay.extraTitle')}</p>
          <p style={bodyStyle(TONE_STYLES.neutral)}>
            {t('pay.extraBody', {
              amount: order.overpaidAmount ? formatNaira(order.overpaidAmount) : t('pay.smallAmount'),
            })}
          </p>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[order.paymentStatus];
  if (!config) return null; // No additional notice is needed for this payment status.

  const styles = TONE_STYLES[config.tone];

  return (
    <div style={bannerStyle(styles)}>
      <span style={iconStyle(styles)}>
        <config.Icon size={16} strokeWidth={1.8} color={styles.title} aria-hidden="true" />
      </span>
      <div style={{ flex: 1 }}>
        <p style={titleStyle(styles)}>{t(config.title)}</p>
        <p style={bodyStyle(styles)}>
          {config.body.map((key) => {
            const optional = key.endsWith('?');
            const k = optional ? key.slice(0, -1) : key;
            if (optional && !order.total) return null;
            return (
              <React.Fragment key={k}>
                <Trans
                  i18nKey={k}
                  values={{ total: formatNaira(order.total) }}
                  components={{ strong: <strong /> }}
                />{' '}
              </React.Fragment>
            );
          })}
        </p>
        {config.cta && (
          <Link
            to={config.cta.to(order)}
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 14,
              fontWeight: 600,
              color: styles.title,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            {t(config.cta.label)} <ArrowRight className="icon-dir" size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />
          </Link>
        )}
      </div>
    </div>
  );
}

function bannerStyle(styles) {
  return {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    background: styles.background,
    border: `1px solid ${styles.border}`,
    borderRadius: 12,
    padding: '16px 18px',
    margin: '0 0 var(--space-6, 24px)',
  };
}

function iconStyle(styles) {
  return {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: styles.iconBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  };
}

function titleStyle(styles) {
  return {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
    color: styles.title,
  };
}

function bodyStyle(styles) {
  return {
    margin: '4px 0 0',
    fontSize: 14,
    lineHeight: 1.6,
    color: styles.body,
  };
}
