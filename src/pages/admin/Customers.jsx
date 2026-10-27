// src/pages/admin/Customers.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/api/client'; // or '../../api/client'
import {
  Download, Users, UserPlus, Repeat, Gem, Search, AlertTriangle,
  ChevronUp, ChevronDown,
} from 'lucide-react';

const LIMIT = 10;
const STATE_COLORS = ['#00c896', '#7c5cfc', '#f59e0b', '#ff4d6d', '#00b4d8', '#7b829a'];

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res ?? null;
}

function formatNaira(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatCount(n) {
  return Number(n || 0).toLocaleString();
}

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: LIMIT,
      role: 'user', // customers only, if backend supports it
    };
    if (search.trim()) params.search = search.trim();

    Promise.all([
      admin.allUsers(params),
      // optional aggregate endpoint — ignore if missing
      typeof admin.customerStats === 'function'
        ? admin.customerStats().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([usersRes, statsRes]) => {
        if (cancelled) return;

        const body = unwrap(usersRes);
        const list = Array.isArray(body)
          ? body
          : Array.isArray(body?.users)
            ? body.users
            : Array.isArray(body?.data)
              ? body.data
              : [];

        const totalCount =
          body?.total ??
          body?.pagination?.total ??
          body?.count ??
          list.length;

        setCustomers(list);
        setTotal(Number(totalCount) || 0);

        const statsBody = unwrap(statsRes);
        setSummary(statsBody && typeof statsBody === 'object' ? statsBody : null);
      })
      .catch((err) => {
        console.error('Customers load failed:', err);
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load customers');
          setCustomers([]);
          setTotal(0);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [search, page]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  // Derive state breakdown from current list (or full summary if API provides it)
  const topStates = useMemo(() => {
    if (Array.isArray(summary?.topStates) && summary.topStates.length) {
      return summary.topStates.map((s) => ({
        state: s.state || s.name,
        count: Number(s.count || s.total || 0),
        pct: s.pct != null ? Number(s.pct) : null,
      }));
    }

    const counts = {};
    customers.forEach((c) => {
      const state = c.state || c.address?.state || 'Unknown';
      counts[state] = (counts[state] || 0) + 1;
    });
    const entries = Object.entries(counts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    const sum = entries.reduce((s, e) => s + e.count, 0) || 1;
    return entries.slice(0, 6).map((e) => ({
      ...e,
      pct: Math.round((e.count / sum) * 100),
    }));
  }, [customers, summary]);

  // KPIs: prefer summary from API; otherwise compute from loaded customers only
  const totalCustomers = summary?.totalCustomers ?? summary?.total ?? total;
  const newThisMonth = summary?.newThisMonth ?? summary?.newCustomers ?? null;
  const retentionRate = summary?.retentionRate ?? summary?.retention ?? null;
  const avgLtv =
    summary?.avgLifetimeValue ??
    summary?.avgLtv ??
    (customers.length
      ? customers.reduce((s, c) => s + Number(c.lifetimeValue ?? c.ltv ?? 0), 0) / customers.length
      : null);

  const kpis = [
    {
      Icon: Users,
      label: 'Total Customers',
      bg: 'rgba(0,200,150,.12)',
      val: totalCustomers != null ? formatCount(totalCustomers) : '—',
      delta: summary?.totalDelta ?? null,
      up: summary?.totalUp !== false,
    },
    {
      Icon: UserPlus,
      label: 'New This Month',
      bg: 'rgba(124,92,252,.12)',
      val: newThisMonth != null ? formatCount(newThisMonth) : '—',
      delta: summary?.newDelta ?? null,
      up: true,
    },
    {
      Icon: Repeat,
      label: 'Retention Rate',
      bg: 'rgba(245,158,11,.12)',
      val: retentionRate != null
        ? (String(retentionRate).includes('%') ? retentionRate : `${retentionRate}%`)
        : '—',
      delta: summary?.retentionDelta ?? null,
      up: true,
    },
    {
      Icon: Gem,
      label: 'Avg Lifetime Value',
      bg: 'rgba(255,77,109,.12)',
      val: avgLtv != null ? formatNaira(Math.round(avgLtv)) : '—',
      delta: summary?.ltvDelta ?? null,
      up: true,
    },
  ];

  const activity = [
    {
      label: 'Active today',
      value: summary?.activeToday ?? summary?.active?.today ?? null,
      color: 'var(--admin-accent)',
    },
    {
      label: 'Active this week',
      value: summary?.activeThisWeek ?? summary?.active?.week ?? null,
      color: 'var(--admin-accent)',
    },
    {
      label: 'Inactive 30d+',
      value: summary?.inactive30d ?? summary?.active?.inactive ?? null,
      color: 'var(--admin-muted)',
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Manage your customer base</p>
        </div>
        <button type="button" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} strokeWidth={2.2} /> Export CSV
        </button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">
              <div className="kpi-icon" style={{ background: k.bg }}>
                <k.Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              </div>
              {k.label}
            </div>
            <div className="kpi-value">{k.val}</div>
            {k.delta != null && (
              <div className={`kpi-delta ${k.up ? 'up' : 'down'}`}>
                {k.up
                  ? <ChevronUp size={12} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: -1 }} />
                  : <ChevronDown size={12} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: -1 }} />}
                {' '}{k.delta}
              </div>
            )}
          </div>
        ))}
      </div>

     <div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: 16,
    alignItems: 'start',
  }}
>
        <div className="card">
          <div className="card-header">
            <div className="card-title">All Customers ({formatCount(total)})</div>
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                strokeWidth={2}
                style={{
                  position: 'absolute', left: 9, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--muted)',
                }}
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search customers…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  padding: '7px 10px 7px 28px',
                  outline: 'none',
                  width: 200,
                }}
              />
            </div>
          </div>

          {error && (
            <div className="error-state" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 16 }}>
              <AlertTriangle size={14} strokeWidth={2} /> {error}
            </div>
          )}

          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-muted)' }}>
              Loading customers…
            </div>
          )}

          {!loading && !error && customers.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-muted)' }}>
              No customers found
            </div>
          )}

          {!loading && customers.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>State</th>
                    <th>Orders</th>
                    <th>LTV</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {(c.name ?? 'U')[0]}
                          </div>
                          {c.name ?? '—'}
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.email ?? '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        {c.state ?? c.address?.state ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {c.orderCount ?? c.ordersCount ?? c.orders ?? 0}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                        {formatNaira(c.lifetimeValue ?? c.ltv ?? 0)}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString('en-GB', {
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => navigate(`/admin/customers/${c._id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && pages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 6,
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="filter-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--admin-muted)', alignSelf: 'center' }}>
                {page} / {pages}
              </span>
              <button
                type="button"
                className="filter-btn"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top States</div>
            </div>
            {topStates.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--admin-muted)' }}>
                No location data yet
              </div>
            ) : (
              topStates.map((s, i) => {
                const color = STATE_COLORS[i % STATE_COLORS.length];
                const pct = s.pct != null ? s.pct : 0;
                return (
                  <div
                    key={s.state}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13 }}>{s.state}</div>
                    <div style={{
                      width: 70, height: 5, background: 'var(--surface2)',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: 'var(--muted)', width: 40, textAlign: 'right',
                    }}>
                      {pct}%
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Activity</div>
            </div>
            {activity.every((a) => a.value == null) ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--admin-muted)' }}>
                No activity stats from API yet
              </div>
            ) : (
              activity.map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color, fontWeight: 600 }}>
                    {value != null ? formatCount(value) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}