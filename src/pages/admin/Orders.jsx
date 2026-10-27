// src/pages/admin/Orders.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOrders, updateOrderStatus } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, Truck, XCircle, Search, AlertTriangle, ChevronUp, ChevronDown, Download } from 'lucide-react';

const STATUSES = ['All', 'pending', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [status,  setStatus]  = useState('All');
  const [search,  setSearch]  = useState(searchParams.get('search') ?? '');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const LIMIT = 10;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: LIMIT, page, sort: '-createdAt' };
      if (status !== 'All') params.status = status;
      if (search)           params.search  = search;
      const res = await getOrders(params);
      setOrders(res.orders ?? res.data ?? []);
      setTotal(res.total ?? res.count ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, page]);

  async function handleStatusChange(id, newStatus) {
    try {
      await updateOrderStatus(id, newStatus);
      toast.success(`Order updated to ${newStatus}`, {
        icon: <CheckCircle2 size={18} strokeWidth={2} color="var(--accent)" />,
      });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const pages = Math.ceil(total / LIMIT) || 1;

  return (
    <>
      <div className="page-header">
        <div><h1>Order Management</h1><p>All customer orders</p></div>
        <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} strokeWidth={2.2} /> Export CSV
        </button>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { Icon: CheckCircle2, label:'Delivered', bg:'rgba(0,200,150,.12)', val:'8,241', delta:'+9.2%', up:true  },
          { Icon: Clock3,       label:'Pending',   bg:'rgba(245,158,11,.12)',val:'509',   delta:'+2.1%', up:true  },
          { Icon: Truck,        label:'Shipped',   bg:'rgba(124,92,252,.12)',val:'1,924', delta:'+5.7%', up:true  },
          { Icon: XCircle,      label:'Cancelled', bg:'rgba(255,77,109,.12)',val:'94',    delta:'-1.6%', up:false },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><div className="kpi-icon" style={{ background: k.bg }}><k.Icon size={16} strokeWidth={1.8} aria-hidden="true" /></div>{k.label}</div>
            <div className="kpi-value">{k.val}</div>
            <div className={`kpi-delta ${k.up?'up':'down'}`}>
              {k.up ? <ChevronUp size={12} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: -1 }} /> : <ChevronDown size={12} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: -1 }} />} {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} strokeWidth={2} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search orders…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 12, padding: '7px 10px 7px 28px', outline: 'none', width: 200 }}
              />
            </div>
            {/* Status filter */}
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--muted)', fontSize: 12, padding: '7px 10px', outline: 'none' }}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{total.toLocaleString()} orders</span>
        </div>

        {error   && <div className="error-state" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} strokeWidth={2} /> {error}</div>}
        {loading && <div className="spinner"/>}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th><th>Customer</th><th>Product</th>
                  <th>Date</th><th>Status</th><th>Amount</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>No orders found</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o._id}>
                    <td><span className="order-id">#{o._id?.slice(-6)}</span></td>
                    <td>{o.user?.name ?? '—'}</td>
                    <td style={{ color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.items?.[0]?.product?.name ?? '—'}
                      {o.items?.length > 1 && ` +${o.items.length - 1}`}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      <select
                        value={o.status}
                        onChange={e => handleStatusChange(o._id, e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)' }}
                        className={`status-badge s-${o.status}`}
                      >
                        {STATUSES.filter(s => s !== 'All').map(s => <option key={s} value={s}>{cap(s)}</option>)}
                      </select>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', color: o.status === 'cancelled' ? 'var(--muted)' : 'var(--accent)' }}>
                      ₦{(o.totalPrice ?? 0).toLocaleString()}
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => navigate(`/admin/orders/${o._id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Page {page} of {pages} · {total.toLocaleString()} total
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="filter-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(n => (
              <button key={n} className={`filter-btn ${n === page ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="filter-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
