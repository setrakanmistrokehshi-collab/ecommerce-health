import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { orders as ordersApi } from '@/api/client';
import { PageLoader, EmptyState, OrderStatusBadge, Modal, Pagination } from '@/components/ui';
import PaymentStatusBanner from '@/pages/Paymentstatusbanner';
import { formatNaira } from '@/config/money';
import { useTranslation } from 'react-i18next';
import { formatDateTime, statusName } from '@/i18n/helpers';
import toast from 'react-hot-toast';
import { Package, Truck, Box, Home } from 'lucide-react';
import PriceTag from '@/components/PriceTag';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const { id: routeOrderId } = useParams();
  const navigate = useNavigate();
  const [orderList, setOrderList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      setLoading(true);
      try {
        const { data } = await ordersApi.myOrders({ page, limit: PAGE_SIZE, sort: '-createdAt' });
        const payload = data?.data ?? data ?? {};
        const orders = payload.orders ?? payload.items ?? payload.results ?? [];
        const total = payload.pagination?.total ?? payload.total ?? orders.length;
        const pages = payload.pagination?.pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

        if (!mounted) return;

        setOrderList(Array.isArray(orders) ? orders : []);
        setTotalOrders(Number(total) || 0);
        setTotalPages(Number(pages) || 1);
      } catch (err) {
        if (!mounted) return;
        setOrderList([]);
        setTotalOrders(0);
        setTotalPages(1);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOrders();
    return () => { mounted = false; };
  }, [page]);

  useEffect(() => {
    if (!routeOrderId) return undefined;
    let mounted = true;

    ordersApi.get(routeOrderId)
      .then(({ data }) => {
        if (!mounted) return;
        const payload = data?.data ?? data ?? {};
        setSelected(payload.order ?? payload);
      })
      .catch(() => {
        if (mounted) toast.error(t('orders.loadFailed'));
      });

    return () => { mounted = false; };
  }, [routeOrderId]);

  const handleCancel = async (id) => {
    if (!confirm(t('orders.cancelConfirm'))) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(id);
      toast.success(t('orders.cancelled'), {
        icon: <Package size={18} strokeWidth={2} color="var(--rust)" />,
      });
      setOrderList((prev) =>
        prev.map((o) => o._id === id ? { ...o, status: 'cancelled' } : o)
      );
      setSelected((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('orders.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <div className='container'>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 'var(--space-8)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              margin: 0,
              color: 'var(--forest)',
            }}
          >
            {t('orders.title')}
          </h1>
          <Link
            to="/"
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Home size={16} strokeWidth={2} aria-hidden="true" />
            {t('auth.home')}
          </Link>
        </div>

        {orderList.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('orders.empty')}
            message={t('orders.emptyMsg')}
            action={<Link to='/products' className='btn btn-primary'>{t('cart.shopNow')}</Link>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {orderList.map((order) => (
              <div key={order._id} className='card' style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--forest)', fontSize: 15 }}>
                        {order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      {order.paymentStatus === 'completed' && (
                        <span className='badge badge-green' style={{ fontSize: 10 }}>{statusName(t, 'paid')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {formatDateTime(i18n.language, order.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'end' }}>
                    <div><PriceTag text={formatNaira(order.total)} size="lg" /></div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {t('orders.itemCount', { n: order.items?.length ?? 0 })}
                    </div>
                  </div>
                </div>

                <PaymentStatusBanner order={order} />

                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {order.items?.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--parchment)', borderRadius: 'var(--radius)',
                      padding: '4px 10px', fontSize: 13,
                    }}>
                      <Box size={13} strokeWidth={2} color="var(--sage)" aria-hidden="true" />
                      <span style={{ fontWeight: 500, color: 'var(--forest)' }}>{item.name}</span>
                      <span style={{ color: 'var(--muted)' }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className='btn btn-outline btn-sm' onClick={() => setSelected(order)}>
                    {t('orders.viewDetails')}
                  </button>
                  {['pending', 'paid'].includes(order.status) && (
                    <button
                      className='btn btn-ghost btn-sm'
                      style={{ color: 'var(--rust)' }}
                      onClick={() => handleCancel(order._id)}
                      disabled={cancelling}
                    >
                      {t('orders.cancel')}
                    </button>
                  )}
                  {order.trackingNumber && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                      <Truck size={14} strokeWidth={2} aria-hidden="true" /> {t('orders.track')} <code style={{ fontFamily: 'var(--font-mono)' }}>{order.trackingNumber}</code>
                    </span>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {t('orders.pageOf', { page, pages: totalPages, total: totalOrders })}
              </span>
            </div>

            <Pagination page={page} pages={totalPages} onPage={setPage} />
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          if (routeOrderId) navigate('/orders', { replace: true });
        }}
        title={t('orders.modalTitle', { number: selected?.orderNumber })}
        maxWidth={580}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 14 }}>{t('orders.history')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.statusHistory?.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{statusName(t, s.status)}</div>
                      {s.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.note}</div>}
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(i18n.language, s.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr className='divider' />

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 14 }}>{t('orders.items')}</h4>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14, gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Box size={14} strokeWidth={2} color="var(--sage)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--forest)' }}>{item.name} ×{item.quantity}</span>
                  </span>
                  <span style={{ flexShrink: 0 }}><PriceTag text={formatNaira(item.price * item.quantity)} size="sm" /></span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { l: t('cart.subtotal'), v: formatNaira(selected.subtotal) },
                { l: t('cart.shipping'), v: selected.shipping === 0 ? t('cart.free') : formatNaira(selected.shipping) },
                ...(selected.discount > 0 ? [{ l: t('orders.discount'), v: `-${formatNaira(selected.discount)}` }] : []),
              ].map((r) => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: 'var(--muted)' }}>
                  <span>{r.l}</span><PriceTag text={r.v} size="sm" muted />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 16, paddingTop: 8, borderTop: '1px solid var(--border-light)', color: 'var(--forest)' }}>
                <span>{t('cart.total')}</span><span>{formatNaira(selected.total)}</span>
              </div>
            </div>

            <div style={{ background: 'var(--parchment)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', fontSize: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--forest)' }}>{t('orders.address')}</div>
              <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                {selected.shippingAddress?.street}, {selected.shippingAddress?.city},{' '}
                {selected.shippingAddress?.state}
              </div>
            </div>

            {['pending', 'paid'].includes(selected.status) && (
              <button
                className='btn btn-full'
                style={{ background: 'rgba(184,92,56,0.1)', color: 'var(--rust)', border: '1px solid rgba(184,92,56,0.3)' }}
                onClick={() => handleCancel(selected._id)}
                disabled={cancelling}
              >
                {cancelling ? t('orders.cancelling') : t('orders.cancel')}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}