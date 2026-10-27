// src/pages/admin/Reports.jsx
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { admin } from '@/api/client';
import {
  Pill,
  Shield,
  Sparkles,
  Zap,
  Scale,
  Wallet,
  Package,
  ShoppingCart,
  TrendingUp,
  Download,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const CATEGORY_ICON = {
  Immunity: Shield,
  Beauty: Sparkles,
  Energy: Zap,
  Weight: Scale,
  Vitamins: Pill,
};

/** API returns naira (major units), not kobo. */
function toNumber(n) {
  if (n == null || n === '') return null;
  const v = typeof n === 'number' ? n : Number(String(n).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
}

function formatNaira(n) {
  const v = toNumber(n);
  if (v == null) return '—';
  return `₦${v.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact naira display. Thresholds are on the naira value itself.
 * e.g. 4_599_938 → ₦4.6M  |  45_000 → ₦45.0K  |  850 → ₦850
 */
function formatNairaShort(n) {
  const v = toNumber(n);
  if (v == null) return '—';

  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);

  if (abs >= 1_000_000_000) return `${sign}₦${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}₦${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₦${abs.toLocaleString('en-NG', {
    maximumFractionDigits: abs < 1 ? 2 : 0,
  })}`;
}

function formatPercent(n) {
  const v = toNumber(n);
  if (v == null) return '—';
  const pct = Math.abs(v) <= 1 ? v * 100 : v;
  return `${pct.toFixed(1)}%`;
}

function formatDelta(delta) {
  if (delta == null || delta === '') return null;
  if (typeof delta === 'string') return delta;
  const v = toNumber(delta);
  if (v == null) return null;
  const sign = v > 0 ? '+' : '';
  if (Math.abs(v) <= 1 && !Number.isInteger(v)) {
    return `${sign}${(v * 100).toFixed(1)}%`;
  }
  return `${sign}${v.toFixed(1)}%`;
}

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res ?? null;
}

function pickNumber(...candidates) {
  for (const c of candidates) {
    const v = toNumber(c);
    if (v != null) return v;
  }
  return null;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--admin-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--admin-muted)', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ color: p.color, display: 'flex', gap: 8, marginBottom: 3 }}
        >
          <span>{p.name}:</span>
          <strong>{formatNaira(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      admin.revenueAnalytics
        ? admin.revenueAnalytics(period === 'weekly' ? 3 : 6)
        : Promise.reject(new Error('admin.revenueAnalytics missing')),
      admin.topProducts
        ? admin.topProducts(9)
        : Promise.reject(new Error('admin.topProducts missing')),
      typeof admin.dashboard === 'function'
        ? admin.dashboard(period === 'weekly' ? '7d' : '30d')
        : Promise.resolve(null),
    ])
      .then(([revRes, topRes, statsRes]) => {
        if (cancelled) return;

        const rev = unwrap(revRes);
        const tops = unwrap(topRes);
        const stats = unwrap(statsRes);

        const series = Array.isArray(rev)
          ? rev
          : Array.isArray(rev?.months)
            ? rev.months
            : Array.isArray(rev?.series)
              ? rev.series
              : Array.isArray(rev?.data)
                ? rev.data
                : [];

        const products = Array.isArray(tops)
          ? tops
          : Array.isArray(tops?.products)
            ? tops.products
            : Array.isArray(tops?.data)
              ? tops.data
              : [];

        const embeddedSummary =
          rev && !Array.isArray(rev) && typeof rev === 'object'
            ? rev.summary ?? rev.stats ?? rev.totals ?? null
            : null;

        setChartData(series);
        setTopProds(products);
        setSummary(
          (stats && typeof stats === 'object' ? stats : null) ||
            (embeddedSummary && typeof embeddedSummary === 'object'
              ? embeddedSummary
              : null)
        );
      })
      .catch((err) => {
        console.error('Reports load failed:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load reports');
          setChartData([]);
          setTopProds([]);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  // ── KPI derivation (naira from API) ───────────────────────────────────────
  const lastPoint = chartData.length ? chartData[chartData.length - 1] : null;
  const seriesRevenueSum = chartData.reduce(
    (s, d) => s + (toNumber(d.revenue) || 0),
    0
  );

  const monthlyRevenue = pickNumber(
    summary?.totalRevenue,
    summary?.revenue,
    summary?.monthlyRevenue,
    summary?.periodRevenue,
    lastPoint?.revenue,
    seriesRevenueSum || null
  );

  const unitsFromProducts = topProds.reduce(
    (s, p) => s + (toNumber(p.units ?? p.totalSold) || 0),
    0
  );

  const unitsSold = pickNumber(
    summary?.unitsSold,
    summary?.totalUnits,
    summary?.units,
    unitsFromProducts || null
  );

  const orderCount = pickNumber(
    summary?.orderCount,
    summary?.orders,
    summary?.totalOrders,
    summary?.order_count
  );

  const avgOrderValue = pickNumber(
    summary?.avgOrderValue,
    summary?.aov,
    summary?.averageOrderValue,
    monthlyRevenue != null && orderCount > 0
      ? monthlyRevenue / orderCount
      : null
  );

  const seriesProfit = chartData.reduce(
    (s, d) => s + (toNumber(d.profit) || 0),
    0
  );
  const computedMarginFromLast =
    lastPoint &&
    toNumber(lastPoint.profit) != null &&
    toNumber(lastPoint.revenue) > 0
      ? (toNumber(lastPoint.profit) / toNumber(lastPoint.revenue)) * 100
      : null;
  const computedMarginFromSeries =
    seriesRevenueSum > 0 && seriesProfit !== 0
      ? (seriesProfit / seriesRevenueSum) * 100
      : null;

  const profitMargin = pickNumber(
    summary?.margin,
    summary?.profitMargin,
    summary?.profit_margin,
    computedMarginFromLast,
    computedMarginFromSeries
  );

  const revenueDelta =
    summary?.revenueDelta ??
    summary?.revenue?.delta ??
    summary?.deltas?.revenue ??
    null;
  const unitsDelta = summary?.unitsDelta ?? summary?.deltas?.units ?? null;
  const aovDelta = summary?.aovDelta ?? summary?.deltas?.aov ?? null;
  const marginDelta = summary?.marginDelta ?? summary?.deltas?.margin ?? null;

  const revenueUp =
    summary?.revenueUp !== false &&
    (toNumber(revenueDelta) == null || toNumber(revenueDelta) >= 0);

  if (loading) {
    return (
      <div style={{ color: 'var(--admin-muted)', padding: 40, textAlign: 'center' }}>
        Loading reports…
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

  const kpis = [
    {
      Icon: Wallet,
      label: 'Revenue',
      bg: 'rgba(0,200,150,.12)',
      val: monthlyRevenue != null ? formatNairaShort(monthlyRevenue) : '—',
      full: monthlyRevenue != null ? formatNaira(monthlyRevenue) : null,
      delta: formatDelta(revenueDelta),
      up: revenueUp,
    },
    {
      Icon: Package,
      label: 'Units Sold',
      bg: 'rgba(124,92,252,.12)',
      val: unitsSold != null ? Number(unitsSold).toLocaleString('en-NG') : '—',
      full: null,
      delta: formatDelta(unitsDelta),
      up: true,
    },
    {
      Icon: ShoppingCart,
      label: 'Avg Order Value',
      bg: 'rgba(245,158,11,.12)',
      val: avgOrderValue != null ? formatNairaShort(avgOrderValue) : '—',
      full: avgOrderValue != null ? formatNaira(avgOrderValue) : null,
      delta: formatDelta(aovDelta),
      up: true,
    },
    {
      Icon: TrendingUp,
      label: 'Profit Margin',
      bg: 'rgba(255,77,109,.12)',
      val: profitMargin != null ? formatPercent(profitMargin) : '—',
      full: null,
      delta: formatDelta(marginDelta),
      up: true,
    },
  ];

  return (
    <>
      <style>{`
        .reports-page .reports-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .reports-page .reports-header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .reports-page .reports-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .reports-page .reports-charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        .reports-page .reports-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          max-width: 100%;
        }
        .reports-page .reports-table-wrap table {
          min-width: 640px;
          width: 100%;
        }
        .reports-page .kpi-value {
          word-break: break-word;
        }
        @media (max-width: 900px) {
          .reports-page .reports-page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .reports-page .reports-header-actions {
            width: 100%;
          }
          .reports-page .reports-header-actions .btn {
            flex: 1 1 auto;
          }
          .reports-page .reports-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .reports-page .reports-charts {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .reports-page .reports-kpi-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="reports-page">
        <div className="page-header reports-page-header">
          <div>
            <h1>Reports</h1>
            <p>Detailed analytics and performance data</p>
          </div>
          <div className="reports-header-actions">
            <button
              type="button"
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} strokeWidth={2.2} /> Download PDF
            </button>
            <button type="button" className="btn btn-primary">
              Generate Report
            </button>
          </div>
        </div>

        <div className="reports-kpi-grid">
          {kpis.map((k) => (
            <div key={k.label} className="kpi-card" title={k.full || undefined}>
              <div className="kpi-label">
                <div className="kpi-icon" style={{ background: k.bg }}>
                  <k.Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </div>
                {k.label}
              </div>
              <div className="kpi-value">{k.val}</div>
              {k.delta != null && (
                <div className={`kpi-delta ${k.up ? 'up' : 'down'}`}>
                  {k.up ? (
                    <ChevronUp
                      size={12}
                      strokeWidth={2.5}
                      style={{ display: 'inline', verticalAlign: -1 }}
                    />
                  ) : (
                    <ChevronDown
                      size={12}
                      strokeWidth={2.5}
                      style={{ display: 'inline', verticalAlign: -1 }}
                    />
                  )}{' '}
                  {k.delta}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="reports-charts">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Revenue</div>
                <div className="card-sub">Total revenue per period</div>
              </div>
              <div className="date-filter">
                {['monthly', 'weekly'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`filter-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--admin-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--admin-muted)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--admin-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNairaShort}
                    width={56}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#00c896"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--admin-muted)',
                  padding: 40,
                }}
              >
                No revenue data yet
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Profit vs Expenses</div>
                <div className="card-sub">Period breakdown</div>
              </div>
            </div>
            {chartData.some((d) => d.profit != null || d.expenses != null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--admin-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--admin-muted)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--admin-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNairaShort}
                    width={56}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      color: 'var(--admin-muted)',
                      paddingTop: 8,
                    }}
                  />
                  <Bar
                    dataKey="profit"
                    name="Profit"
                    fill="#00c896"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="#ff4d6d"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--admin-muted)',
                  padding: 40,
                }}
              >
                No profit/expense fields in API response
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                Revenue by Product — Top {topProds.length || 9}
              </div>
            </div>
          </div>
          <div className="table-wrap reports-table-wrap">
            {topProds.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Units</th>
                    <th>Revenue</th>
                    <th>Margin</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {topProds.map((p, i) => {
                    const CatIcon = CATEGORY_ICON[p.category] || Pill;
                    const units = toNumber(p.units ?? p.totalSold) ?? 0;
                    const revenue = toNumber(p.revenue) ?? 0;
                    const margin = p.margin;
                    const trend = p.trend;
                    return (
                      <tr key={p._id || p.name || i}>
                        <td
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--admin-muted)',
                          }}
                        >
                          {p.rank ?? i + 1}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <CatIcon
                              size={16}
                              strokeWidth={1.8}
                              color="var(--admin-muted)"
                              aria-hidden="true"
                            />
                            {p.name}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              background: 'rgba(124,92,252,.12)',
                              color: 'var(--admin-accent)',
                              padding: '2px 8px',
                              borderRadius: 20,
                            }}
                          >
                            {p.category ?? '—'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {units.toLocaleString('en-NG')}
                        </td>
                        <td
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--admin-accent)',
                          }}
                        >
                          {formatNaira(revenue)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {margin != null ? formatPercent(margin) : '—'}
                        </td>
                        <td
                          style={{
                            fontSize: 18,
                            color:
                              trend === '↑' || trend === 'up'
                                ? 'var(--admin-accent)'
                                : trend === '↓' || trend === 'down'
                                  ? 'var(--error)'
                                  : 'var(--admin-muted)',
                          }}
                        >
                          {trend ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--admin-muted)',
                  padding: 40,
                }}
              >
                No product sales data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}