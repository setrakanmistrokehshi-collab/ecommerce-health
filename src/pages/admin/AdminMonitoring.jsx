// src/pages/admin/AdminMonitoring.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/client';
import { Activity, CheckCircle2, AlertTriangle } from 'lucide-react';

const WINDOW_OPTIONS = [
  { label: '1 Hour', minutes: 60 },
  { label: '6 Hours', minutes: 360 },
  { label: '24 Hours', minutes: 1440 },
];

const GATEWAY_LABELS = {
  monnify: 'Monnify',
  paystack: 'Paystack',
  nomba: 'Nomba',
  brevo: 'Brevo (Email)',
};

const STATUS_COLORS = {
  processed: 'var(--success, #34c77b)',
  duplicate: 'var(--admin-muted)',
  already_processing: 'var(--admin-muted)',
  signature_failed: 'var(--error)',
  missing_reference: 'var(--warning)',
  order_not_found: 'var(--error)',
  discrepancy: 'var(--warning)',
  error: 'var(--error)',
};

export default function AdminMonitoring() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/admin/monitoring', { params: { windowMinutes } });
   
      if (!res?.success) {
        throw new Error(res?.message || res?.error || 'Failed to load monitoring data');
      }

      setData(res?.data ?? null);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load monitoring data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    load();
    // Light auto-refresh — staleness matters more here than on most admin pages.
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div style={{ color: 'var(--admin-muted)', padding: 40, textAlign: 'center' }}>
        Loading monitoring data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)', padding: 40, textAlign: 'center' }}>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={load} type="button">Retry</button>
        </div>
      </div>
    );
  }

  const gateways = Object.keys(data?.webhooks?.byGateway ?? {});
  const chartData = (data?.apiCalls?.volumeChart ?? []).map((p) => ({
    ...p,
    label: new Date(p.minute).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Monitoring</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>
            Webhook delivery status and API call volume — auto-refreshes every 30s.
          </p>
        </div>
        <div className="date-filter">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              className={`filter-btn ${windowMinutes === opt.minutes ? 'active' : ''}`}
              onClick={() => setWindowMinutes(opt.minutes)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Webhook status tiles */}
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {gateways.length === 0 ? (
          <div className="admin-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--admin-muted)', padding: 24 }}>
            No webhook activity in this window.
          </div>
        ) : (
          gateways.map((gw) => {
            const statuses = data.webhooks.byGateway[gw];
            const total = Object.values(statuses).reduce((s, n) => s + n, 0);
            const errorCount = (statuses.error ?? 0) + (statuses.signature_failed ?? 0) + (statuses.order_not_found ?? 0);
            const isHealthy = errorCount === 0;
            return (
              <div key={gw} className="kpi-card">
                <div className="kpi-label">
                  <div className="kpi-icon" style={{ background: isHealthy ? 'rgba(52,199,123,.12)' : 'rgba(229,83,75,.12)' }}>
                    {isHealthy
                      ? <CheckCircle2 size={16} strokeWidth={1.8} color="var(--success, #34c77b)" aria-hidden="true" />
                      : <AlertTriangle size={16} strokeWidth={1.8} color="var(--error)" aria-hidden="true" />}
                  </div>
                  {GATEWAY_LABELS[gw] ?? gw}
                </div>
                <div className="kpi-value">{total}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {Object.entries(statuses).map(([status, count]) => (
                    <span
                      key={status}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontWeight: 600,
                        color: STATUS_COLORS[status] ?? 'var(--admin-muted)',
                        background: 'var(--admin-bg)',
                        border: `1px solid ${STATUS_COLORS[status] ?? 'var(--admin-border)'}`,
                      }}
                    >
                      {status.replace(/_/g, ' ')}: {count}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* API call volume chart */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div>
            <div className="card-title">API Call Volume</div>
            <div className="card-sub">
              {data?.apiCalls?.totalInWindow ?? 0} requests in the last {windowMinutes >= 1440 ? '24 hours' : `${windowMinutes} min`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-muted)' }}>
            <Activity size={13} strokeWidth={2} aria-hidden="true" />
            Live
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="apiVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--admin-accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--admin-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--admin-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--admin-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--admin-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--admin-text)' }}
                formatter={(value, name) => {
                  if (name === 'count') return [value, 'Requests'];
                  if (name === 'avgDurationMs') return [`${value}ms`, 'Avg duration'];
                  if (name === 'errorRate') return [`${value}%`, 'Error rate'];
                  return [value, name];
                }}
              />
              <Area type="monotone" dataKey="count" stroke="var(--admin-accent)" strokeWidth={2} fill="url(#apiVolume)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 40 }}>
            No API call data for this window yet — this fills in as traffic comes through
            (buckets flush every ~15s).
          </div>
        )}
      </div>

      {/* Recent webhook events feed */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Webhook Events</div>
            <div className="card-sub">Last 25 in this window</div>
          </div>
        </div>
        <div className="table-wrap">
          {(data?.webhooks?.recent ?? []).length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Gateway</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.webhooks.recent.map((w) => (
                  <tr key={w._id}>
                    <td>{GATEWAY_LABELS[w.gateway] ?? w.gateway}</td>
                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>{w.eventType ?? '—'}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontWeight: 600,
                          color: STATUS_COLORS[w.status] ?? 'var(--admin-muted)',
                          background: 'var(--admin-bg)',
                          border: `1px solid ${STATUS_COLORS[w.status] ?? 'var(--admin-border)'}`,
                        }}
                        title={w.errorMessage || undefined}
                      >
                        {w.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{w.orderNumber ?? '—'}</td>
                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                      {w.durationMs != null ? `${Math.round(w.durationMs)}ms` : '—'}
                    </td>
                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                      {new Date(w.receivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 32, fontSize: 13 }}>
              No webhook events in this window.
            </div>
          )}
        </div>
      </div>
    </>
  );
}