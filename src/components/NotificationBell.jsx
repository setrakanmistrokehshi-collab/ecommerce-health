import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '@/api/client';
import useAuthStore from '@/context/authStore';

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isAppPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

export default function NotificationBell() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return null;
  return <AuthenticatedNotificationBell />;
}

function AuthenticatedNotificationBell() {
  const navigate = useNavigate();
  const bellRef = useRef(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;

    async function fetchNotifications() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await api.get('/notifications');
        const payload = response?.data?.data ?? response?.data ?? {};
        if (!mounted) return;
        setItems(Array.isArray(payload.items) ? payload.items.slice(0, 20) : []);
        setUnread(Math.max(0, Number(payload.unread) || 0));
        setAvailable(true);
      } catch {
        if (!mounted) return;
        setAvailable(false);
        setOpen(false);
        setItems([]);
        setUnread(0);
      } finally {
        inFlight = false;
      }
    }

    void fetchNotifications();
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchNotifications();
    }, 45_000);
    const onVisibilityChange = () => {
      if (!document.hidden) void fetchNotifications();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!available) return null;

  async function markAllRead() {
    try {
      await api.patch('/notifications/read', { all: true });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch {
      // Keep notification endpoint failures silent.
    }
  }

  async function openNotification(item) {
    if (!item.read) {
      try {
        await api.patch('/notifications/read', { ids: [item._id] });
        setItems((current) => current.map((entry) => (
          entry._id === item._id ? { ...entry, read: true } : entry
        )));
        setUnread((current) => Math.max(0, current - 1));
      } catch {
        // Navigation remains available when marking the item read fails.
      }
    }

    setOpen(false);
    if (isAppPath(item.url)) navigate(item.url);
  }

  return (
    <div className='notification-bell' ref={bellRef}>
      <button
        type='button'
        className='notification-bell__trigger'
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup='true'
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} strokeWidth={1.8} aria-hidden='true' />
        {unread > 0 && (
          <span className='notification-bell__badge'>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <section className='notification-bell__panel' aria-label='Notifications'>
          <header className='notification-bell__header'>
            <span>Notifications</span>
            {unread > 0 && (
              <button type='button' onClick={markAllRead}>
                <CheckCheck size={14} aria-hidden='true' /> Mark all read
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <p className='notification-bell__empty'>No notifications yet</p>
          ) : (
            <ul className='notification-bell__list'>
              {items.map((item) => (
                <li key={item._id}>
                  <button
                    type='button'
                    className={`notification-bell__item${item.read ? '' : ' is-unread'}`}
                    onClick={() => openNotification(item)}
                  >
                    <span className='notification-bell__item-title'>{item.title}</span>
                    <span className='notification-bell__item-body'>{item.body}</span>
                    {item.createdAt && (
                      <time className='notification-bell__item-time' dateTime={item.createdAt}>
                        {formatCreatedAt(item.createdAt)}
                      </time>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
