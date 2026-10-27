// components/AutoLogoutCountdown.jsx
import React from 'react';
import useAuthStore from '@/context/authStore';
import { Clock, AlertTriangle } from 'lucide-react';

export function AutoLogoutCountdown() {
  const { isAutoLogoutActive, secondsUntilAutoLogout, cancelAutoLogout } = useAuthStore();

  if (!isAutoLogoutActive) return null;

  const minutes = Math.floor(secondsUntilAutoLogout / 60);
  const seconds = secondsUntilAutoLogout % 60;
  const isWarning = secondsUntilAutoLogout <= 60;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: isWarning ? '#ff4444' : '#333333',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: isWarning ? 'pulse 1s infinite' : 'none',
      }}
    >
      {isWarning
        ? <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
        : <Clock size={16} strokeWidth={2} aria-hidden="true" />}
      <span>
        {isWarning ? 'Will logout in: ' : 'Auto-logout in: '}
        <strong>{minutes}:{String(seconds).padStart(2, '0')}</strong>
      </span>
      <button
        onClick={cancelAutoLogout}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Stay
      </button>
    </div>
  );
}