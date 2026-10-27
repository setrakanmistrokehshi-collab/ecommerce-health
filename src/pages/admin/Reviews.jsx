// src/pages/admin/Reviews.jsx
import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { getReviews, approveReview, rejectReview } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { Star, Clock3, CheckCircle2, Ban, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

const FALLBACK = [
  { _id:'r1', user:{name:'Chidi Okonkwo'}, product:{name:'Greens Plus Daily Formula'}, rating:5, comment:"This product is absolutely amazing! Energy levels through the roof after 3 months.", status:'pending',   createdAt:'2026-06-10' },
  { _id:'r2', user:{name:'Amaka Eze'},     product:{name:'Marine Collagen Blend'},      rating:5, comment:"My skin has never looked better. After 8 weeks the difference is clear. Colleagues keep asking what I use!", status:'pending', createdAt:'2026-06-10' },
  { _id:'r3', user:{name:'Emeka Nwosu'},   product:{name:'Immunity Shield Pro'},        rating:4, comment:"Great product, fewer colds this rainy season. Shipping was fast too.",       status:'pending',   createdAt:'2026-06-09' },
  { _id:'r4', user:{name:'Fatima Bello'},  product:{name:'Vitamin C + Zinc'},           rating:5, comment:"Very effective. Not been sick once since I started. Good value for money.",  status:'approved',  createdAt:'2026-06-08' },
  { _id:'r5', user:{name:'Tunde Adeyemi'},product:{name:'Energy Pro Complex'},          rating:3, comment:"Decent but I expected more. Noticeable effect but not as dramatic as advertised.", status:'approved', createdAt:'2026-06-07' },
];

export default function Reviews() {
  const [filter, setFilter] = useState('All');

  const { data, loading, error, refetch } = useFetch(() => getReviews());

  const all     = data?.reviews ?? FALLBACK;
  const reviews = filter === 'All' ? all : all.filter(r => r.status === filter.toLowerCase());

  async function handle(id, action) {
    try {
      if (action === 'approve') await approveReview(id);
      else                      await rejectReview(id);
      toast.success(`Review ${action}d`, {
        icon: <CheckCircle2 size={18} strokeWidth={2} color="var(--accent)" />,
      });
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const stats = {
    avg:      (all.reduce((s,r) => s + (r.rating??0), 0) / (all.length||1)).toFixed(1),
    pending:  all.filter(r => r.status === 'pending').length,
    approved: all.filter(r => r.status === 'approved').length,
    rejected: all.filter(r => r.status === 'rejected').length,
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Product Reviews</h1><p>Moderate and respond to customer reviews</p></div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { Icon: Star,        label:'Avg Rating',       bg:'rgba(0,200,150,.12)',  val: stats.avg,      delta:'+0.2 this month', up:true  },
          { Icon: Clock3,      label:'Pending Approval', bg:'rgba(245,158,11,.12)', val: stats.pending,  delta:'Needs action',    up:false },
          { Icon: CheckCircle2,label:'Published',        bg:'rgba(124,92,252,.12)', val: stats.approved, delta:'+84 this week',   up:true  },
          { Icon: Ban,         label:'Rejected',         bg:'rgba(255,77,109,.12)', val: stats.rejected, delta:'Spam/abuse',      up:false },
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
          <div className="card-title">All Reviews</div>
          <div className="date-filter">
            {['All','Pending','Approved','Rejected'].map(f => (
              <button key={f} className={`filter-btn ${filter===f?'active':''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {error   && <div className="error-state" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} strokeWidth={2} /> {error}</div>}
        {loading && <div className="spinner"/>}

        {!loading && reviews.map(r => (
          <div key={r._id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                  {(r.user?.name ?? 'U')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{r.user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent2)', marginBottom: 4 }}>{r.product?.name}</div>
                  <div style={{ color: '#f59e0b', fontSize: 14, marginBottom: 6 }}>
                    {'★'.repeat(r.rating ?? 0)}{'☆'.repeat(5-(r.rating??0))}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 560 }}>{r.comment}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <span className={`status-badge s-${r.status}`}>{r.status}</span>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary"  style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handle(r._id,'approve')}>Approve</button>
                    <button className="btn btn-ghost"    style={{ fontSize: 11, padding: '4px 10px', color:'var(--danger)' }} onClick={() => handle(r._id,'reject')}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && reviews.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Star size={32} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3>No reviews found</h3>
          </div>
        )}
      </div>
    </>
  );
}
