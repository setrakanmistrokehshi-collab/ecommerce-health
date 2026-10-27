import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { admin as adminApi } from '@/api/client';
import { Pill } from 'lucide-react';

const COLORS = ['#7a9e7e', '#c8854a', '#2d4a35', '#a8c5ac', '#e8a870', '#5a7a5e'];
const fmtNGN = (v) => `₦${Number(v || 0).toLocaleString()}`;

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res ?? [];
}

export default function AdminAnalytics() {
  const [revenue, setRevenue] = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [cats, setCats] = useState([]);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const revenueFn =
      adminApi.revenueAnalytics ||
      adminApi.getRevenueReport ||
      ((m) => adminApi.revenue?.(m));

    const topFn =
      adminApi.topProducts ||
      adminApi.getTopProducts ||
      (() => Promise.reject(new Error('topProducts API missing')));

    const catFn =
      adminApi.categoryAnalytics ||
      adminApi.getCategoryAnalytics ||
      (() => Promise.reject(new Error('categoryAnalytics API missing')));

    Promise.all([
      revenueFn(months),
      topFn(),
      catFn(),
    ])
      .then(([r, t, c]) => {
        if (cancelled) return;
        setRevenue(Array.isArray(unwrap(r)) ? unwrap(r) : []);
        setTopProds(Array.isArray(unwrap(t)) ? unwrap(t) : []);
        setCats(Array.isArray(unwrap(c)) ? unwrap(c) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Analytics load failed:', err);
        setError(err?.message || 'Failed to load analytics');
        setRevenue([]);
        setTopProds([]);
        setCats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [months]);

  if (loading) {
    return (
      <div style={{ color: 'var(--admin-muted)', padding: 40, textAlign: 'center' }}>
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)', padding: 40, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 28,
            color: 'var(--admin-text)', marginBottom: 4,
          }}>
            Analytics
          </h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>Detailed performance insights</p>
        </div>
        <select
          className="admin-input"
          style={{ width: 160 }}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      <div className="admin-card">
        <h3 style={{
          color: 'var(--admin-text)', fontFamily: 'var(--font-display)',
          fontSize: 18, marginBottom: 'var(--space-5)',
        }}>
          Revenue & Order Volume
        </h3>
        {revenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={revenue} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
              <XAxis dataKey="month" stroke="var(--admin-muted)" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                stroke="var(--admin-muted)"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--admin-muted)"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--admin-card)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 8,
                }}
                labelStyle={{ color: 'var(--admin-text)' }}
              />
              <Legend wrapperStyle={{ fontSize: 13, color: 'var(--admin-muted)' }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (₦)" fill="#7a9e7e" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#c8854a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 40 }}>
            No revenue data yet
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <div className="admin-card">
          <h3 style={{
            color: 'var(--admin-text)', fontFamily: 'var(--font-display)',
            fontSize: 18, marginBottom: 'var(--space-5)',
          }}>
            Top 10 Products by Units Sold
          </h3>
          {topProds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProds.slice(0, 10).map((p, i) => {
                const max = topProds[0]?.totalSold || 1;
                const sold = p.totalSold ?? p.units ?? 0;
                return (
                  <div key={p._id || p.name || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 20, fontSize: 12, color: 'var(--admin-muted)',
                      textAlign: 'right', fontFamily: 'var(--font-mono)',
                    }}>
                      {i + 1}
                    </span>
                    <Pill size={15} strokeWidth={1.8} color="var(--admin-muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--admin-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.name}
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2, marginTop: 4,
                        background: 'var(--admin-border)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: COLORS[i % COLORS.length],
                          width: `${(sold / max) * 100}%`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--admin-accent)',
                      minWidth: 40, textAlign: 'right',
                    }}>
                      {sold}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 40 }}>
              No sales data yet
            </div>
          )}
        </div>

        <div className="admin-card">
          <h3 style={{
            color: 'var(--admin-text)', fontFamily: 'var(--font-display)',
            fontSize: 18, marginBottom: 'var(--space-5)',
          }}>
            Revenue by Category
          </h3>
          {cats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--admin-muted)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    stroke="var(--admin-muted)"
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--admin-card)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 8,
                    }}
                    formatter={(v) => [fmtNGN(v), 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {cats.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cats.map((c, i) => (
                  <div key={c.category || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: COLORS[i % COLORS.length],
                      }} />
                      <span style={{ color: 'var(--admin-text)', textTransform: 'capitalize' }}>
                        {c.category}
                      </span>
                    </div>
                    <span style={{ color: 'var(--admin-muted)' }}>{fmtNGN(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 40 }}>
              No category data yet
            </div>
          )}
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{
          color: 'var(--admin-text)', fontFamily: 'var(--font-display)',
          fontSize: 18, marginBottom: 'var(--space-5)',
        }}>
          Revenue Trend
        </h3>
        {revenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
              <XAxis dataKey="month" stroke="var(--admin-muted)" tick={{ fontSize: 12 }} />
              <YAxis
                stroke="var(--admin-muted)"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--admin-card)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 8,
                }}
                labelStyle={{ color: 'var(--admin-text)' }}
                formatter={(v, n) => [
                  n === 'revenue' ? fmtNGN(v) : v,
                  n === 'revenue' ? 'Revenue' : 'Orders',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 13, color: 'var(--admin-muted)' }} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#7a9e7e"
                strokeWidth={2.5}
                dot={{ fill: '#7a9e7e', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#c8854a"
                strokeWidth={2}
                dot={{ fill: '#c8854a', r: 3 }}
                strokeDasharray="5 4"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--admin-muted)', padding: 40 }}>
            No trend data yet
          </div>
        )}
      </div>
    </div>
  );
}