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

      /**
       * Google / OAuth callback payload.
       * Refresh token is set as an httpOnly cookie by the API — do not store it in JS.
       */
      loginWithGoogle: (data) => {
        const { accessToken, user } = data;

        if (accessToken) TokenStore.set(accessToken);

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

          // Access only — refresh is httpOnly cookie from Set-Cookie
          TokenStore.set(data.accessToken);

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

          set({
            user: data.user,
            isAuthenticated: true,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
          void loginPush(data.user?._id);
          return {
            success: true,
            user: data.user,
          };
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            'Login failed. Check your admin credentials.';
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
            err?.response?.data?.message || 'Registration failed.';

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

        if (typeof window !== 'undefined') {
          saveReturnPath(
            window.location.pathname + window.location.search
          );
        }

        try {
          // Server clears httpOnly refresh cookie
          await authApi.logout();
        } catch (_) {
          // ignore network errors — still clear local session
        }

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

      startAutoLogoutTimer: () => {
        const { isAuthenticated, autoLogoutTimer, clearAutoLogoutTimer } =
          get();

        if (!isAuthenticated || autoLogoutTimer) return;
         
        clearAutoLogoutTimer();

        set({
          isAutoLogoutActive: true,
          secondsUntilAutoLogout: AUTO_LOGOUT_MINUTES * 60,
        });

        const countdownInterval = setInterval(() => {
          const { secondsUntilAutoLogout, logout } = get();

          if (secondsUntilAutoLogout <= 1) {
            clearInterval(countdownInterval);
            logout();
            if (typeof window !== 'undefined') {
              alert(
                'You have been automatically logged out due to tab inactivity.'
              );
            }
            return;
          }

          set({
            secondsUntilAutoLogout: secondsUntilAutoLogout - 1,
          });
        }, AUTO_LOGOUT_CONFIG.checkInterval);

        set({ autoLogoutTimer: countdownInterval });
      },

      cancelAutoLogout: () => {
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

      getAutoLogoutTimeRemaining: () => {
        const { secondsUntilAutoLogout } = get();
        const minutes = Math.floor(secondsUntilAutoLogout / 60);
        const seconds = secondsUntilAutoLogout % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
      },

      /**
       * Validate access token and load user.
       * If access is missing/expired, axios interceptor refreshes via cookie.
       */
      fetchMe: async () => {
        set({ isLoading: true });

        try {
          const token = TokenStore.get();

          // No access token: still try /me only if you rely on refresh-first flows.
          // Default: treat as logged out until user logs in again.
          // Optional: await authApi.refreshToken() then me() if you want silent restore.
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

      // Persist user profile only — never tokens
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

export default useAuthStore;