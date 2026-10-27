import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orders as ordersApi, admin as adminApi } from '@/api/client';
import { getAdminOrderById } from '@/api/adminApi';
import { OrderStatusBadge, Modal, Pagination } from '@/components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { formatNaira } from '@/config/money';
import { MapPin, Mail, Pill } from 'lucide-react';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const PAYMENT_STATUSES = ['pending', 'expired', 'completed', 'failed', 'refunded'];

export default function AdminOrders() {
  const { id: routeOrderId } = useParams();
  const navigate = useNavigate();
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [notifying, setNotifying] = useState(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    ordersApi.all({
      page,
      limit: 8,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      search: search || undefined,
    })
      .then((response) => {
        const body = response?.data?.data ?? response?.data ?? response ?? {};
        const nextItems = body.orders ?? body.items ?? body.results ?? [];
        const nextTotal = Number(body.pagination?.total ?? body.total ?? nextItems.length ?? 0);
        const nextPages = Number(body.pagination?.pages ?? Math.max(1, Math.ceil(nextTotal / 8)) ?? 1);

        setItems(Array.isArray(nextItems) ? nextItems : []);
        setTotal(nextTotal);
        setPages(nextPages);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setPages(1);
      })
      .finally(() => setLoading(false));
  }, [page, status, paymentStatus, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!routeOrderId) return undefined;
    let mounted = true;

    getAdminOrderById(routeOrderId)
      .then((response) => {
        if (!mounted) return;
        const payload = response?.data?.data ?? response?.data ?? response ?? {};
        const order = payload.order ?? payload;
        setSelected(order);
        setNewStatus(order.status ?? '');
        setStatusNote('');
      })
      .catch(() => {
        if (mounted) toast.error('Could not load this order.');
      });

    return () => { mounted = false; };
  }, [routeOrderId]);

  const handleStatusUpdate = async () => {
    if (!newStatus || !selected) return;
    setUpdatingStatus(true);
    try {
      const { data } = await ordersApi.updateStatus(selected._id, { status: newStatus, note: statusNote });
      toast.success(`Status updated to ${newStatus}`);
      setSelected(data.order);
      fetchOrders();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNotifyShipped = async (id) => {
    setNotifying(true);
    try {
      await adminApi.notifyShipped(id);
      toast.success('Shipping notification sent!');
    } catch (err) {
      toast.error('Failed to send notification');
    } finally {
      setNotifying(false);
    }
  };

  const paymentFollowUpMessage = selected
    ? String(selected.paymentStatus).toLowerCase() === 'flagged_underpaid'
      ? `Hello ${selected.customerName || ''},\n\nWe're following up about payment for order ${selected.orderNumber || ''}. Sometimes a checkout can be interrupted by an unexpected gateway or connection issue. If you completed the payment, please don't pay again; reply with your payment receipt or reference so we can verify it. If you weren't able to complete checkout, let us know and we'll be happy to help.`
      : `Hello ${selected.customerName || ''},\n\nWe noticed the payment for order ${selected.orderNumber || ''} is still ${selected.paymentStatus}. Did you encounter a problem during checkout? Please let us know if we can help.`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--admin-text)', marginBottom: 4 }}>Orders</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>{total} total orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className='admin-card' style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input
          className='admin-input'
          placeholder='Search by order #, customer...'
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: '1 1 200px' }}
        />
        <select
          className='admin-input'
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ flex: '0 1 160px' }}
        >
          <option value=''>All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          className='admin-input'
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          style={{ flex: '0 1 180px' }}
        >
          <option value=''>All Payment States</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'completed' ? 'Completed' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['', ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            style={{
              padding: '5px 14px', borderRadius: 'var(--radius-full)',
              fontSize: 12, fontWeight: 500,
              background: status === s ? 'var(--admin-accent)' : 'var(--admin-card)',
              color: status === s ? 'white' : 'var(--admin-muted)',
              border: `1px solid ${status === s ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className='admin-card' style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className='admin-table'>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>No orders found</td></tr>
              ) : items.map((o) => (
                <tr key={o._id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--admin-accent)' }}>
                      {o.orderNumber}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--admin-text)' }}>{o.customerName}</div>
                    <div style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{o.customerEmail}</div>
                  </td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                   {(o.items ?? [])
                    .map(i => `${i.name ? i.name.split(' ')[0] : 'Item'} ×${i.quantity}`)
                    .join(', ')
                    .slice(0, 30)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{formatNaira(o.total)}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                      background: o.paymentStatus === 'completed' ? 'rgba(122,158,126,0.15)' : 'rgba(200,133,74,0.15)',
                      color: o.paymentStatus === 'completed' ? '#7a9e7e' : '#c8854a',
                      textTransform: 'capitalize',
                    }}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                    {o.createdAt ? format(new Date(o.createdAt), 'MMM d, yy') : '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => { setSelected(o); setNewStatus(o.status); setStatusNote(''); }}
                      style={{ padding: '4px 10px', background: 'rgba(122,158,126,0.1)', color: '#7a9e7e', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--admin-border)' }}>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          if (routeOrderId) navigate('/admin/orders', { replace: true });
        }}
        title={`Order ${selected?.orderNumber}`}
        maxWidth={600}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { l: 'Total', v: formatNaira(selected.total) },
                { l: 'Payment', v: selected.paymentStatus },
                { l: 'Method', v: selected.paymentMethod || '—' },
              ].map((r) => (
                <div key={r.l} style={{ background: 'var(--cream)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{r.l}</div>
                  <div style={{ fontWeight: 600, color: 'var(--forest-deep)', textTransform: 'capitalize' }}>{r.v}</div>
                </div>
              ))}
            </div>

            {/* Customer */}
            <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', fontSize: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Customer</div>
              <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
                {selected.customerName} · {selected.customerEmail} · {selected.customerPhone}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <MapPin size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <span>{selected.shippingAddress?.street}, {selected.shippingAddress?.city}, {selected.shippingAddress?.state}</span>
              </div>
            </div>

            {['pending', 'expired', 'failed', 'flagged_underpaid'].includes(String(selected.paymentStatus).toLowerCase()) && (
              <div style={{ background: 'rgba(200,133,74,0.1)', border: '1px solid rgba(200,133,74,0.3)', borderRadius: 'var(--radius)', padding: 'var(--space-4)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Payment follow-up</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
                  {String(selected.paymentStatus).toLowerCase() === 'flagged_underpaid'
                    ? 'Check whether the customer was interrupted during checkout or has already paid. The message asks them not to pay again if they have.'
                    : `This payment is ${selected.paymentStatus}. Ask the customer whether they encountered a problem during checkout.`}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.customerPhone && (
                    <a
                      className='btn btn-outline btn-sm'
                      href={`https://wa.me/${String(selected.customerPhone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(paymentFollowUpMessage)}`}
                      target='_blank'
                      rel='noreferrer'
                    >
                      WhatsApp customer
                    </a>
                  )}
                  {selected.customerEmail && (
                    <a
                      className='btn btn-outline btn-sm'
                      href={`mailto:${selected.customerEmail}?subject=${encodeURIComponent(`Help with order ${selected.orderNumber || ''}`)}&body=${encodeURIComponent(paymentFollowUpMessage)}`}
                    >
                      Email customer
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Items</div>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14, gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Pill size={14} strokeWidth={2} color="var(--sage-dark)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name} ×{item.quantity}</span>
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--forest)', flexShrink: 0 }}>{formatNaira(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Status history */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Status History</div>
              {selected.statusHistory?.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13, color: 'var(--muted)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.timestamp ? format(new Date(s.timestamp), 'MMM d HH:mm') : ''}</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--charcoal)' }}>{s.status}</span>
                  {s.note && <span>— {s.note}</span>}
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

            {/* Update status */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Update Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <select className='input' value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <input
                  className='input'
                  placeholder='Status note (optional)'
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className='btn btn-primary'
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus || newStatus === selected.status}
                    style={{ flex: 1 }}
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status'}
                  </button>
                  {selected.status === 'shipped' && (
                    <button
                      className='btn btn-outline'
                      onClick={() => handleNotifyShipped(selected._id)}
                      disabled={notifying}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {notifying ? '...' : <><Mail size={14} strokeWidth={2} /> Notify</>}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nomba reference */}
            {selected.nombaReference && (
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                Ref: {selected.nombaReference}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
