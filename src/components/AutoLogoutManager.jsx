// src/components/AutoLogoutManager.jsx
import { useEffect, useRef } from 'react';
import useAuthStore from '@/context/authStore';
import { AUTO_LOGOUT_CONFIG } from '@/config/autoLogout'; 

export function AutoLogoutManager() {
  const { 
    isAuthenticated, 
    startAutoLogoutTimer, 
    cancelAutoLogout,
    isAutoLogoutActive,
    secondsUntilAutoLogout,
    
  } = useAuthStore();

  const hasShownWarning = useRef(false);
  const warningThreshold = AUTO_LOGOUT_CONFIG.warningThreshold; // 👈 USE CONFIG

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated) {
      cancelAutoLogout();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🔄 Tab hidden - auto-logout timer starting');
        startAutoLogoutTimer();
        hasShownWarning.current = false;
      } else {
        console.log('🔄 Tab visible - auto-logout cancelled');
        cancelAutoLogout();
        hasShownWarning.current = false;
      }
    };

    const handleAutoLogoutWarning = () => {
      if (isAutoLogoutActive && 
          secondsUntilAutoLogout <= warningThreshold && 
          !hasShownWarning.current) {
        hasShownWarning.current = true;
        
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('Auto-Logout Warning', {
            body: `You will be logged out in ${Math.floor(secondsUntilAutoLogout / 60)} minute(s) due to tab inactivity.`,
            icon: '/favicon.ico',
          });
        }
      }
    };

    const warningInterval = setInterval(handleAutoLogoutWarning, AUTO_LOGOUT_CONFIG.checkInterval);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(warningInterval);
      cancelAutoLogout();
    };
  }, [isAuthenticated, startAutoLogoutTimer, cancelAutoLogout, isAutoLogoutActive, secondsUntilAutoLogout]);

  return null;
}