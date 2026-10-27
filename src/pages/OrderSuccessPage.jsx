import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { orders as ordersApi } from '@/api/client';
import useCartStore from '@/context/cartStore';
import { PageLoader } from '@/components/ui';
import { formatNaira } from '@/config/money';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import PaymentStatusBanner from '@/pages/Paymentstatusbanner';
import { trackPurchase, purchaseEventId } from '@/lib/metaPixel';

const POLL_MS = 2500;
const MAX_ATTEMPTS = 24; // ~60s, then we stop polling and tell the customer what to expect

// ADAPT: the key(s) where your checkout page keeps the guest token it sends to /payments/checkout.
const GUEST_TOKEN_KEYS = ['guestToken', 'guest_token'];

function getGuestToken() {
  try {
    for (const k of GUEST_TOKEN_KEYS) {
      const v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (v) return v;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

// Logged-in customers use the normal status call. Guests have no login token, so
// that call returns 401: fall back to the guest endpoint (order id + guest token).
async function fetchStatus(ref, checkoutId) {
  try {
    return await ordersApi.verifyStatus(ref, { checkoutId, live: true });
  } catch (err) {
    const code = err?.response?.status;
    const token = getGuestToken();
    if ((code === 401 || code === 403) && token && /^[a-f\d]{24}$/i.test(ref)) {
      return await ordersApi.guestStatus(ref, token);
    }
    throw err;
  }
}

// Returns: 'success' | 'failed' | 'review' | 'pending'
function isConfirmed(data) {
  const payment = String(
    data?.paymentStatus ?? data?.order?.paymentStatus ?? ''
  ).toLowerCase();
  const orderStatus = String(
    data?.order?.status ?? data?.status ?? ''
  ).toLowerCase();

  if (['cancelled', 'refunded', 'failed'].includes(orderStatus)) return 'failed';
  if (['failed', 'cancelled', 'abandoned', 'expired', 'rejected'].includes(payment)) {
    return 'failed';
  }
  // Money arrived but the amount needs a human check: do NOT tell the customer to pay again.
  if (['flagged_underpaid', 'discrepancy'].includes(payment)) return 'review';

  if (['completed', 'paid', 'success', 'successful'].includes(payment)) {
    return 'success';
  }
  if (['paid', 'processing', 'shipped', 'delivered'].includes(orderStatus)) {
    return 'success';
  }
  return 'pending';
}

export default function OrderSuccessPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const ref =
    params.get('reference') ||
    params.get('ref') ||
    params.get('orderId');
  const checkoutId = params.get('checkout_id') || params.get('checkoutId');

  // loading | pending | success | failed | review | delayed
  const [status, setStatus] = useState(() => (ref ? 'loading' : 'pending'));
  const [order, setOrder] = useState(null);
  const clearCart = useCartStore((state) => state.clear);

  useEffect(() => {
    if (!ref) return undefined;

    let cancelled = false;
    let attempts = 0;
    let delay = POLL_MS;
    let timer = null;

    const clear = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const retryLater = () => {
      attempts += 1;
      if (attempts < MAX_ATTEMPTS && !cancelled) {
        timer = setTimeout(check, delay);
      } else if (!cancelled) {
        
        setStatus('delayed');
      }
    };

    const check = async () => {
      try {
        const res = await fetchStatus(ref, checkoutId || undefined);
        const data = res?.data?.data ?? res?.data ?? res;
        if (cancelled) return;

        const ord = data.order ?? data;
        setOrder(ord);

        const result = isConfirmed(data);

        // The gateway only sends the customer to this page after the hosted checkout
        // finished (cancel goes to a different URL) and the order exists. So the cart must
        // not stay full just because confirmation is slow. Purchase tracking below still
        // waits for a confirmed payment.
        if (result !== 'failed') clearCart();

        if (result === 'success') {
          setStatus('success');
          if (ord?._id) {
            // Fire the pixel once per order, even if the customer refreshes this page.
            const key = `purchase_tracked_${ord._id}`;
            let already = false;
            try { already = !!sessionStorage.getItem(key); } catch { /* ignore */ }
            if (!already) {
              trackPurchase(ord, purchaseEventId(ord._id));
              try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
            }
          }
          return;
        }

        if (result === 'failed') {
          setStatus('failed');
          return;
        }

        if (result === 'review') {
          setStatus('review');
          return;
        }

        setStatus('pending');
        retryLater();
      } catch (err) {
        if (cancelled) return;

        const code = err?.response?.status;

        // Cannot verify from this browser (not found / not allowed): stop and explain.
        if (code === 400 || code === 401 || code === 403 || code === 404) {
          
          if (code === 401 || code === 403) clearCart();
          setStatus('delayed');
          return;
        }

        // Rate limited: back off instead of retrying at the same pace.
        if (code === 429) delay = Math.min(delay * 2, 15000);

        setStatus('pending');
        retryLater();
      }
    };

    check();

    return () => {
      cancelled = true;
      clear();
    };
  }, [ref, checkoutId, clearCart]);

  if (status === 'loading') return <PageLoader />;

  // success | failed | review | delayed | (anything else = still confirming)
  const known = ['success', 'failed', 'review', 'delayed'];
  const title = t(`success.${status === 'success' ? 'confirmed' : known.includes(status) ? status : 'confirming'}`);
  const message = t(`success.${{
    success: 'msgConfirmed', failed: 'msgFailed', review: 'msgReview', delayed: 'msgDelayed',
  }[status] || 'msgConfirming'}`);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: 520,
          animation: 'fadeUp 0.4s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 'var(--space-6)',
          }}
        >
          {status === 'success' ? (
            <CheckCircle2
              size={72}
              strokeWidth={1.5}
              color="var(--success)"
              aria-hidden="true"
            />
          ) : status === 'failed' ? (
            <XCircle
              size={72}
              strokeWidth={1.5}
              color="var(--rust)"
              aria-hidden="true"
            />
          ) : (
            <Clock3
              size={72}
              strokeWidth={1.5}
              color="var(--amber)"
              aria-hidden="true"
            />
          )}
        </div>

        {/* aria-live so screen readers announce the change from "Confirming" to "Confirmed" */}
        <div role="status" aria-live="polite">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 36,
              color: 'var(--forest-deep)',
              marginBottom: 12,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              marginBottom: 'var(--space-8)',
              fontSize: 16,
            }}
          >
            {message}
          </p>
        </div>

        {order && (
          <div style={{ textAlign: 'start' }}>
            <PaymentStatusBanner order={order} />
          </div>
        )}

        {order && (
          <div
            style={{
              background: 'var(--cream)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-6)',
              textAlign: 'start',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {t('success.orderNumber')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--forest)',
                }}
              >
                {order.orderNumber}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {status === 'success' ? t('success.totalPaid') : t('success.orderTotal')}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--forest)' }}>
                {formatNaira(order.total)}
              </span>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/orders" className="btn btn-primary btn-lg">
            {t('success.viewOrders')}
          </Link>
          <Link to="/products" className="btn btn-outline btn-lg">
            {t('cart.continue')}
          </Link>
        </div>
      </div>
    </div>
  );
}