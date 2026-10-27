// src/context/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth as authApi, TokenStore } from '@/api/client';
import { saveReturnPath } from '@/components/ReturnPath';
import { AUTO_LOGOUT_CONFIG } from '@/config/autoLogout';
import { loginPush, logoutPush } from '@/lib/onesignal';

const AUTO_LOGOUT_MINUTES = AUTO_LOGOUT_CONFIG.minutes;

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      error: null,
      
      // Auto-logout state
      autoLogoutTimer: null,
      isAutoLogoutActive: false,
      secondsUntilAutoLogout: 0,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

        loginWithGoogle: (data) => {
        const { accessToken, refreshToken, user } = data;
 
        TokenStore.set(accessToken);
        TokenStore.setRefresh(refreshToken);
 
        set({
          user,
          isAuthenticated: true,
          isHydrated: true,
          isLoading: false,
          error: null,
        });
        void loginPush(user?._id);
 
        return { success: true, user };
      },
 
      login: async (credentials) => {
        set({ isLoading: true, error: null });

        try {
          const { data } = await authApi.login(credentials);

          TokenStore.set(data.accessToken);
          TokenStore.setRefresh(data.refreshToken);

          set({
            user: data.user,
            isAuthenticated: true,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
          void loginPush(data.user?._id);

          return { success: true };
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            'Login failed. Check your credentials.';

          set({
            error: msg,
            isLoading: false,
          });

          return { success: false, error: msg };
        }
      },
      
      adminLogin: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.adminLogin(credentials);
          TokenStore.set(data.accessToken);
          TokenStore.setRefresh(data.refreshToken);
          set({ 
            user: data.user,
            isAuthenticated: true,
            isLoading: false 
          });
          void loginPush(data.user?._id);
          return {
            success: true, 
            user: data.user 
          };
        } catch (err) {
          const msg =
            err?.response?.data?.message || 'Login failed. Check your admin credentials.';
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const res = await authApi.register(data);

          set({
            isLoading: false,
          });

          return {
            success: true,
            data: res.data,
          };
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            'Registration failed.';

          set({
            error: msg,
            isLoading: false,
          });

          return {
            success: false,
            error: msg,
          };
        }
      },

      logout: async () => {
        void logoutPush();
        // Remember where the user was
        if (typeof window !== 'undefined') {
    saveReturnPath(window.location.pathname + window.location.search);
  }
        try {
          await authApi.logout();
        } catch (_) {
          // ignore
        }

        // Clear auto-logout timer
        get().clearAutoLogoutTimer();

        TokenStore.clear();

        set({
          user: null,
          isAuthenticated: false,
          isHydrated: true,
          isLoading: false,
          error: null,
          isAutoLogoutActive: false,
          secondsUntilAutoLogout: 0,
        });
      },

      // Start auto-logout timer
      startAutoLogoutTimer: () => {
        const { isAuthenticated, autoLogoutTimer, clearAutoLogoutTimer } = get();
        
        // Only start if user is authenticated and timer not already running
        if (!isAuthenticated || autoLogoutTimer) return;

        console.log(`🔄 Auto-logout timer started - will logout in ${AUTO_LOGOUT_MINUTES} minutes`);

        // Clear any existing timer first
        clearAutoLogoutTimer();

        // Set initial state
        set({
          isAutoLogoutActive: true,
          secondsUntilAutoLogout: AUTO_LOGOUT_MINUTES * 60,
        });

        // Start countdown updates
        const countdownInterval = setInterval(() => {
          const { secondsUntilAutoLogout, logout } = get();
          
          if (secondsUntilAutoLogout <= 1) {
            // Time's up - logout
            console.log('⏰ Auto-logout triggered - tab inactive too long');
            clearInterval(countdownInterval);
            logout();
            // Show notification to user
            if (typeof window !== 'undefined') {
              alert('You have been automatically logged out due to tab inactivity.');
            }
            return;
          }

          set({
            secondsUntilAutoLogout: secondsUntilAutoLogout - 1,
          });
        }, AUTO_LOGOUT_CONFIG.checkInterval);

        // Store the interval ID
        set({ autoLogoutTimer: countdownInterval });
      },

      // Cancel auto-logout timer
      cancelAutoLogout: () => {
        const { autoLogoutTimer } = get();
        
        if (autoLogoutTimer) {
          console.log('🔄 Auto-logout cancelled - user returned to tab');
          clearInterval(autoLogoutTimer);
          set({
            autoLogoutTimer: null,
            isAutoLogoutActive: false,
            secondsUntilAutoLogout: 0,
          });
        }
      },

      // Clear auto-logout timer (internal use)
      clearAutoLogoutTimer: () => {
        const { autoLogoutTimer } = get();
        if (autoLogoutTimer) {
          clearInterval(autoLogoutTimer);
          set({
            autoLogoutTimer: null,
            isAutoLogoutActive: false,
            secondsUntilAutoLogout: 0,
          });
        }
      },

      // Get formatted time remaining
      getAutoLogoutTimeRemaining: () => {
        const { secondsUntilAutoLogout } = get();
        const minutes = Math.floor(secondsUntilAutoLogout / 60);
        const seconds = secondsUntilAutoLogout % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
      },

      // Validate token and refresh user data
      fetchMe: async () => {
        set({
          isLoading: true,
        });

        try {
          const token = TokenStore.get();

          if (!token) {
            set({
              user: null,
              isAuthenticated: false,
              isHydrated: true,
              isLoading: false,
            });
            return;
          }

          const { data } = await authApi.me();

          set({
            user: data.user,
            isAuthenticated: true,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
          void loginPush(data.user?._id);
        } catch (_) {

          saveReturnPath();
          TokenStore.clear();

          set({
            user: null,
            isAuthenticated: false,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'winners-auth',

      // Persist only user information
      partialize: (state) => ({
        user: state.user,
        // Don't persist auto-logout state
      }),
    }
  )
);

export default useAuthStore;