// src/pages/admin/EditUserRole.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { admin as adminApi } from '@/api/client';
import { ROLES } from '@/constants/roles';
import toast from 'react-hot-toast';

export default function EditUserRole() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.getUser(id);
      setUser(data.user);
      setSelectedRole(data.user.role);
    } catch (error) {
      toast.error('Failed to load user');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminApi.updateUserRole(id, { role: selectedRole });
      toast.success('User role updated successfully');
      navigate('/admin/users');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update role');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-muted)' }}>
        User not found
      </div>
    );
  }

  const roleOptions = [
    { value: 'customer', label: 'Customer' },
    { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
    { value: ROLES.PRODUCT_MANAGER, label: 'Product Manager' },
    { value: ROLES.ORDER_MANAGER, label: 'Order Manager' },
    { value: ROLES.SUPPORT, label: 'Support Agent' },
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <button
          onClick={() => navigate('/admin/users')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--admin-muted)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back to Users
          
                          {/* 👇  EDIT ROLE BUTTON */}
    <button
      onClick={() => navigate(`/admin/users/${id}/role`, { state: { user: u } })}
      style={{
        padding: '3px 8px',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        background: 'rgba(74,133,200,0.1)',
        color: '#4a85c8',
      }}
    >
      Edit Role
    </button>
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--admin-text)', marginTop: 'var(--space-4)' }}>
          Edit User Role
        </h1>
      </div>

      <div className="admin-card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--sage)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--forest-deep)' }}>{user.name}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>{user.email}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500, color: 'var(--admin-text)' }}>
            Current Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="admin-input"
            style={{ width: '100%' }}
            disabled={saving}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}