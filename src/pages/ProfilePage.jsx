import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { users as usersApi } from '@/api/client';
import useAuthStore from '@/context/authStore';
import { Field, Modal, PageLoader } from '@/components/ui';
import toast from 'react-hot-toast';
import { User, MapPin, Lock, Mail, Send, Inbox } from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addrModal, setAddrModal] = useState(false);

  useEffect(() => {
    usersApi
      .getProfile()
      .then(({ data }) => setProfile(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const TABS = [
    { id: 'profile', Icon: User, label: 'Profile' },
    { id: 'addresses', Icon: MapPin, label: 'Addresses' },
    { id: 'password', Icon: Lock, label: 'Password' },
    { id: 'newsletter', Icon: Mail, label: 'Newsletter' },
  ];

  return (
    <div className="profile-page">
      <style>{`
        .profile-page {
          padding: var(--space-8) 0 var(--space-16);
        }
        .profile-title {
          font-family: var(--font-display);
          font-size: 32px;
          margin-bottom: var(--space-8);
          color: var(--forest-deep);
        }
        .profile-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: var(--space-8);
          align-items: start;
        }
        .profile-sidebar {
          padding: var(--space-4);
          position: sticky;
          top: 80px;
        }
        .profile-avatar-wrap {
          text-align: center;
          padding: var(--space-4) 0 var(--space-5);
          border-bottom: 1px solid var(--border-light);
          margin-bottom: var(--space-3);
        }
        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--sage);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 700;
          margin: 0 auto 10px;
        }
        .profile-tab-btn {
          display: block;
          width: 100%;
          text-align: left;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius);
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          margin-bottom: 2px;
          background: transparent;
          color: var(--muted);
          border-left: 3px solid transparent;
        }
        .profile-tab-btn.active {
          background: var(--cream);
          color: var(--forest);
          border-left-color: var(--sage);
        }
        .profile-card {
          padding: var(--space-6);
        }
        .profile-card h2 {
          font-family: var(--font-display);
          font-size: 22px;
          margin-bottom: var(--space-6);
          color: var(--forest-deep);
        }
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          max-width: 440px;
          width: 100%;
        }
        .profile-form .input,
        .profile-page .input {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .profile-meta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: var(--space-2);
        }
        .profile-meta-pill {
          background: var(--cream);
          border-radius: var(--radius);
          padding: 10px 16px;
          font-size: 13px;
        }
        .profile-address-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--space-4);
        }
        .profile-address-card {
          border: 1.5px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          position: relative;
        }
        .profile-addr-form-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        .profile-newsletter-row {
          display: flex;
          align-items: flex-start;
          gap: var(--space-5);
        }

        /* Mobile tabs as horizontal scroll (sidebar becomes top tabs) */
        .profile-mobile-tabs {
          display: none;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin-bottom: var(--space-5);
          -webkit-overflow-scrolling: touch;
        }
        .profile-mobile-tab {
          flex-shrink: 0;
          padding: 10px 14px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--border);
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          white-space: nowrap;
        }
        .profile-mobile-tab.active {
          background: var(--sage-dark);
          color: #ffffff;
          border-color: var(--sage-dark);
        }

        @media (max-width: 768px) {
          .profile-page {
            padding: var(--space-5) 0 var(--space-12);
          }
          .profile-title {
            font-size: 24px;
            margin-bottom: var(--space-5);
          }
          .profile-layout {
            grid-template-columns: 1fr;
            gap: var(--space-4);
          }
          .profile-sidebar {
            display: none;
          }
          .profile-mobile-tabs {
            display: flex;
          }
          .profile-card {
            padding: var(--space-4);
          }
          .profile-card h2 {
            font-size: 18px;
            margin-bottom: var(--space-4);
          }
          .profile-form {
            max-width: 100%;
          }
          .profile-addr-form-2col {
            grid-template-columns: 1fr;
          }
          .profile-address-grid {
            grid-template-columns: 1fr;
          }
          .profile-newsletter-row {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: var(--space-4);
          }
          .profile-newsletter-row .btn {
            width: 100%;
          }
        }
      `}</style>

      <div className="container">
        <h1 className="profile-title">My Account</h1>

        {/* Mobile horizontal tabs */}
        <div className="profile-mobile-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`profile-mobile-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <t.Icon size={15} strokeWidth={1.8} aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>

        <div className="profile-layout">
          {/* Desktop sidebar */}
          <div className="card profile-sidebar">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {profile?.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ fontWeight: 600, color: 'var(--forest-deep)' }}>
                {profile?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {profile?.email}
              </div>
              {!profile?.isEmailVerified && (
                <span className="badge badge-amber" style={{ marginTop: 6 }}>
                  Email not verified
                </span>
              )}
            </div>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`profile-tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            {tab === 'profile' && (
              <ProfileTab
                profile={profile}
                setProfile={setProfile}
                setUser={setUser}
              />
            )}
            {tab === 'addresses' && (
              <AddressesTab
                profile={profile}
                setProfile={setProfile}
                addrModal={addrModal}
                setAddrModal={setAddrModal}
              />
            )}
            {tab === 'password' && <PasswordTab />}
            {tab === 'newsletter' && (
              <NewsletterTab profile={profile} setProfile={setProfile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ profile, setProfile, setUser }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: profile?.name, phone: profile?.phone },
  });

  const onSubmit = async (data) => {
    try {
      const res = await usersApi.updateProfile(data);
      setProfile(res.data.user);
      setUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="card profile-card">
      <h2>Profile Details</h2>
      <form className="profile-form" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Full Name" error={errors.name?.message}>
          <input
            className="input"
            {...register('name', {
              required: 'Required',
              maxLength: { value: 60, message: 'Too long' },
            })}
          />
        </Field>
        <Field label="Phone Number" error={errors.phone?.message}>
          <input
            className="input"
            placeholder="08012345678"
            {...register('phone')}
          />
        </Field>
        <div>
          <label className="label">Email Address</label>
          <input
            className="input"
            value={profile?.email || ''}
            disabled
            style={{ background: 'var(--cream)', cursor: 'not-allowed' }}
          />
          <span
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginTop: 4,
              display: 'block',
            }}
          >
            Email cannot be changed
          </span>
        </div>
        <div className="profile-meta-row">
          <div className="profile-meta-pill">
            <span style={{ color: 'var(--muted)' }}>Member since </span>
            <span style={{ fontWeight: 600, color: 'var(--forest)' }}>
              {profile?.createdAt
                ? new Date(profile.createdAt).getFullYear()
                : '—'}
            </span>
          </div>
          <div className="profile-meta-pill">
            <span style={{ color: 'var(--muted)' }}>Role </span>
            <span
              style={{
                fontWeight: 600,
                color: 'var(--forest)',
                textTransform: 'capitalize',
              }}
            >
              {profile?.role}
            </span>
          </div>
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={isSubmitting}
          style={{ alignSelf: 'flex-start' }}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

function AddressesTab({ profile, setProfile, addrModal, setAddrModal }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const onAdd = async (data) => {
    try {
      const res = await usersApi.addAddress(data);
      setProfile(res.data.user);
      toast.success('Address added');
      reset();
      setAddrModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add address');
    }
  };

  const onRemove = async (id) => {
    try {
      const res = await usersApi.removeAddress(id);
      setProfile(res.data.user);
      toast.success('Address removed');
    } catch {
      toast.error('Failed to remove address');
    }
  };

  return (
    <div className="card profile-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ marginBottom: 0 }}>Saved Addresses</h2>
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={() => setAddrModal(true)}
        >
          + Add Address
        </button>
      </div>

      {!profile?.addresses?.length ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-10)',
            color: 'var(--muted)',
          }}
        >
          No saved addresses yet
        </div>
      ) : (
        <div className="profile-address-grid">
          {profile.addresses.map((addr) => (
            <div key={addr._id} className="profile-address-card">
              {addr.isDefault && (
                <span
                  className="badge badge-green"
                  style={{ position: 'absolute', top: 10, right: 10 }}
                >
                  Default
                </span>
              )}
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--forest-deep)',
                  marginBottom: 4,
                }}
              >
                {addr.label}
              </div>
              <div
                style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}
              >
                {addr.street}
                <br />
                {addr.city}, {addr.state}
                <br />
                {addr.country}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                style={{ color: 'var(--rust)', marginTop: 8 }}
                onClick={() => onRemove(addr._id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addrModal}
        onClose={() => setAddrModal(false)}
        title="Add New Address"
      >
        <form
          onSubmit={handleSubmit(onAdd)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <Field label="Label (e.g. Home, Office)">
            <input className="input" placeholder="Home" {...register('label')} />
          </Field>
          <Field label="Street Address *" error={errors.street?.message}>
            <input
              className="input"
              {...register('street', { required: 'Required' })}
            />
          </Field>
          <div className="profile-addr-form-2col">
            <Field label="City *" error={errors.city?.message}>
              <input
                className="input"
                {...register('city', { required: 'Required' })}
              />
            </Field>
            <Field label="State *" error={errors.state?.message}>
              <input
                className="input"
                {...register('state', { required: 'Required' })}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="default" {...register('isDefault')} />
            <label htmlFor="default" style={{ fontSize: 14, cursor: 'pointer' }}>
              Set as default address
            </label>
          </div>
          <button
            className="btn btn-primary btn-full"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Address'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function PasswordTab() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      await usersApi.changePassword({
        currentPassword: data.current,
        newPassword: data.password,
      });
      toast.success('Password changed successfully!');
      reset();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="card profile-card">
      <h2>Change Password</h2>
      <form className="profile-form" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Current Password" error={errors.current?.message}>
          <input
            className="input"
            type="password"
            {...register('current', { required: 'Required' })}
          />
        </Field>
        <Field label="New Password" error={errors.password?.message}>
          <input
            className="input"
            type="password"
            {...register('password', {
              required: 'Required',
              minLength: { value: 8, message: 'Min 8 characters' },
            })}
          />
        </Field>
        <Field label="Confirm New Password" error={errors.confirm?.message}>
          <input
            className="input"
            type="password"
            {...register('confirm', {
              required: 'Required',
              validate: (v) =>
                v === watch('password') || 'Passwords do not match',
            })}
          />
        </Field>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={isSubmitting}
          style={{ alignSelf: 'flex-start' }}
        >
          {isSubmitting ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

function NewsletterTab({ profile, setProfile }) {
  const [loading, setLoading] = useState(false);
  const subscribed = profile?.newsletterSubscribed;

  const toggle = async () => {
    setLoading(true);
    try {
      await usersApi.newsletter({ subscribe: !subscribed });
      setProfile((p) => ({ ...p, newsletterSubscribed: !subscribed }));
      toast.success(
        subscribed ? 'Unsubscribed from newsletter' : 'Subscribed to newsletter!'
      );
    } catch {
      toast.error('Failed to update preference');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card profile-card">
      <h2>Newsletter</h2>
      <div className="profile-newsletter-row">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {subscribed
            ? <Send size={40} strokeWidth={1.5} color="var(--sage-dark)" aria-hidden="true" />
            : <Inbox size={40} strokeWidth={1.5} color="var(--muted)" aria-hidden="true" />}
        </div>
        <div>
          <h3
            style={{
              fontWeight: 600,
              color: 'var(--forest-deep)',
              marginBottom: 6,
            }}
          >
            {subscribed
              ? "You're subscribed!"
              : 'Stay in touch with our newsletter'}
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: 14,
              lineHeight: 1.7,
              maxWidth: 400,
              marginBottom: 16,
            }}
          >
            {subscribed
              ? 'You receive weekly wellness tips, exclusive offers, and new product alerts.'
              : 'Get weekly wellness tips, exclusive member offers, and be first to know about new products.'}
          </p>
          <button
            type="button"
            className={`btn ${subscribed ? 'btn-outline' : 'btn-primary'}`}
            onClick={toggle}
            disabled={loading}
          >
            {loading ? '...' : subscribed ? 'Unsubscribe' : 'Subscribe Now'}
          </button>
        </div>
      </div>
    </div>
  );
}