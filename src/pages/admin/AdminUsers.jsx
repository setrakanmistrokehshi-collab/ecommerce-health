import React, { useState, useEffect, useCallback } from 'react';
import { admin as adminApi } from '@/api/client';
import { Pagination, Modal } from '@/components/ui';
import { ROLES } from '../../constants/roles';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'user',            label: 'Customer' },
  { value: 'support_agent',   label: 'Support Agent' },
  { value: 'order_manager',   label: 'Order Manager' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'super_admin',     label: 'Super Admin' },
];

const ROLE_STYLES = {
  super_admin:     { background: 'rgba(200,133,74,0.15)',  color: '#c8854a' },
  product_manager: { background: 'rgba(74,133,200,0.15)',  color: '#4a85c8' },
  order_manager:   { background: 'rgba(74,200,133,0.15)',  color: '#4ac885' },
  support_agent:   { background: 'rgba(200,74,133,0.15)',  color: '#c84a85' },
  user:            { background: 'rgba(122,158,126,0.1)',  color: '#7a9e7e' },
};

const ROLE_LABELS = {
  super_admin:     'Super Admin',
  product_manager: 'Product Manager',
  order_manager:   'Order Manager',
  support_agent:   'Support Agent',
  user:            'Customer',
};

export default function AdminUsers() {
  const [items,    setItems]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // View modal
  const [selected, setSelected] = useState(null);

  // Role edit modal
  const [roleTarget,   setRoleTarget]   = useState(null);  // user being edited
  const [newRole,      setNewRole]      = useState('');
  const [roleLoading,  setRoleLoading]  = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    adminApi.allUsers({
      page,
      limit: 15,
      search:  search  || undefined,
      role:    roleFilter || undefined,
    })
      .then(({ data }) => {
        setItems(data.users || []);
        setTotal(data.pagination?.total || 0);
        setPages(data.pagination?.pages || 1);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Toggle active status ──────────────────────────────────────
  const toggleStatus = async (user) => {
    if (!confirm(`${user.isActive ? 'Deactivate' : 'Activate'} "${user.name}"?`)) return;
    try {
      await adminApi.toggleUserStatus(user._id);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      loadUsers();
      if (selected?._id === user._id) {
        setSelected(u => ({ ...u, isActive: !u.isActive }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    }
  };

  // ── Open role edit modal ──────────────────────────────────────
  const openRoleModal = (user) => {
    setRoleTarget(user);
    setNewRole(user.role);  // pre-select current role
  };

  // ── Submit role change ────────────────────────────────────────
  const submitRoleChange = async () => {
    if (!roleTarget || newRole === roleTarget.role) {
      toast('No change made');
      setRoleTarget(null);
      return;
    }

    setRoleLoading(true);
    try {
      await adminApi.updateUserRole(roleTarget._id, { role: newRole });
      toast.success(`${roleTarget.name} is now ${ROLE_LABELS[newRole]}`);
      setRoleTarget(null);
      loadUsers();
      // update view modal if it's open for the same user
      if (selected?._id === roleTarget._id) {
        setSelected(u => ({ ...u, role: newRole }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--admin-text)', marginBottom: 4 }}>
          Users
        </h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>{total} total accounts</p>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ display: 'flex', gap: 12, padding: 16, flexWrap: 'wrap' }}>
        <input
          className="admin-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: '1 1 220px' }}
        />
        <select
          className="admin-input"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          style={{ flex: '0 1 160px' }}
        >
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                    No users found
                  </td>
                </tr>
              ) : items.map(u => {
                const roleStyle = ROLE_STYLES[u.role] || ROLE_STYLES.user;
                const isStaff   = u.role !== 'user';

                return (
                  <tr key={u._id}>
                    {/* Name + email */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: isStaff ? 'rgba(200,133,74,0.25)' : 'rgba(122,158,126,0.2)',
                          color:      isStaff ? '#c8854a' : '#7a9e7e',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 14, flexShrink: 0,
                        }}>
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--admin-text)' }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>{u.phone || '—'}</td>

                    {/* Role badge */}
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 4, fontSize: 11, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        ...roleStyle,
                      }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>

                    {/* Email verified */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: u.isEmailVerified ? '#7a9e7e' : '#fbbf24',
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--admin-muted)' }}>
                          {u.isEmailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                    </td>

                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                      {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                      {u.lastLogin ? format(new Date(u.lastLogin), 'MMM d') : 'Never'}
                    </td>

                    {/* Active status */}
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        background: u.isActive ? 'rgba(122,158,126,0.15)' : 'rgba(248,113,113,0.15)',
                        color:      u.isActive ? '#7a9e7e' : '#f87171',
                      }}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setSelected(u)}
                          style={{ padding: '3px 8px', background: 'rgba(122,158,126,0.1)', color: '#7a9e7e', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => toggleStatus(u)}
                          style={{
                            padding: '3px 8px', border: 'none', borderRadius: 4,
                            cursor: 'pointer', fontSize: 12,
                            background: u.isActive ? 'rgba(248,113,113,0.1)' : 'rgba(122,158,126,0.1)',
                            color:      u.isActive ? '#f87171' : '#7a9e7e',
                          }}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => openRoleModal(u)}
                          style={{ padding: '3px 8px', background: 'rgba(74,133,200,0.1)', color: '#4a85c8', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Edit Role
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--admin-border)' }}>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {/* ── View user modal ───────────────────────────────────── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name} maxWidth={480}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--sage)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700,
              }}>
                {selected.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{selected.name}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{selected.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className={`badge ${selected.isActive ? 'badge-green' : 'badge-red'}`}>
                    {selected.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="badge badge-amber">
                    {ROLE_LABELS[selected.role] || selected.role}
                  </span>
                  {selected.isEmailVerified && <span className="badge badge-green">Verified</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { l: 'Phone',          v: selected.phone || '—' },
                { l: 'Newsletter',     v: selected.newsletterSubscribed ? 'Subscribed' : 'No' },
                { l: 'Joined',         v: selected.createdAt ? format(new Date(selected.createdAt), 'MMM d, yyyy') : '—' },
                { l: 'Last Login',     v: selected.lastLogin ? format(new Date(selected.lastLogin), 'MMM d, yyyy') : 'Never' },
                { l: 'Saved Addresses',v: selected.addresses?.length || 0 },
                { l: 'Wishlist Items', v: selected.wishlist?.length || 0 },
              ].map(r => (
                <div key={r.l} style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{r.l}</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-full"
                style={{
                  background: selected.isActive ? 'rgba(184,92,56,0.1)' : 'rgba(122,158,126,0.1)',
                  color:      selected.isActive ? 'var(--rust)' : 'var(--sage-dark)',
                  border: `1px solid ${selected.isActive ? 'rgba(184,92,56,0.3)' : 'rgba(122,158,126,0.3)'}`,
                }}
                onClick={() => toggleStatus(selected)}
              >
                {selected.isActive ? 'Deactivate User' : 'Activate User'}
              </button>
              <button
                className="btn btn-full"
                style={{ background: 'rgba(74,133,200,0.1)', color: '#4a85c8', border: '1px solid rgba(74,133,200,0.3)' }}
                onClick={() => { setSelected(null); openRoleModal(selected); }}
              >
                Edit Role
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit role modal ───────────────────────────────────── */}
      <Modal
        open={!!roleTarget}
        onClose={() => { if (!roleLoading) setRoleTarget(null); }}
        title="Change User Role"
        maxWidth={400}
      >
        {roleTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Who we're editing */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--admin-bg)', borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(122,158,126,0.2)', color: '#7a9e7e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16, flexShrink: 0,
              }}>
                {roleTarget.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--admin-text)' }}>{roleTarget.name}</div>
                <div style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{roleTarget.email}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ ...ROLE_STYLES[roleTarget.role], padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                  {ROLE_LABELS[roleTarget.role]}
                </span>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--admin-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New Role
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ROLE_OPTIONS.map(r => (
                  <label
                    key={r.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${newRole === r.value ? 'rgba(74,133,200,0.5)' : 'var(--admin-border)'}`,
                      background: newRole === r.value ? 'rgba(74,133,200,0.08)' : 'var(--admin-bg)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={newRole === r.value}
                      onChange={() => setNewRole(r.value)}
                      style={{ accentColor: '#4a85c8' }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--admin-text)', fontWeight: newRole === r.value ? 600 : 400 }}>
                      {r.label}
                    </span>
                    {r.value === roleTarget.role && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--admin-muted)' }}>current</span>
                    )}
                    {r.value === 'super_admin' && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#c8854a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} strokeWidth={2.2} aria-hidden="true" /> Full access
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Warning for super_admin */}
            {newRole === 'super_admin' && newRole !== roleTarget.role && (
              <div style={{
                background: 'rgba(200,133,74,0.1)', border: '1px solid rgba(200,133,74,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c8854a',
              }}>
                This grants full access to the entire admin panel including billing, settings, and user management.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-outline btn-full"
                onClick={() => setRoleTarget(null)}
                disabled={roleLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-full"
                onClick={submitRoleChange}
                disabled={roleLoading || newRole === roleTarget.role}
              >
                {roleLoading ? 'Saving…' : 'Confirm Role Change'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}