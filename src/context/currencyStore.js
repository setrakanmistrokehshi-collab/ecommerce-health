// src/context/currencyStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { currencies as currenciesApi } from '@/api/client';

const NGN_FALLBACK = { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: 1, isActive: true };

const useCurrencyStore = create(
  persist(
    (set, get) => ({
      available: [NGN_FALLBACK], // populated from GET /currencies on app load
      selected: 'NGN',           // persisted — the customer's chosen display currency
      isLoading: false,
      lastFetchedAt: null,

      fetchCurrencies: async () => {
        set({ isLoading: true });
        try {
          const { data } = await currenciesApi.list();
          const list = data.currencies?.length ? data.currencies : [NGN_FALLBACK];
          set({ available: list, isLoading: false, lastFetchedAt: Date.now() });

          // If the previously-selected currency is no longer active
          // (an admin disabled it) or doesn't exist, fall back to NGN
          // rather than silently keep computing prices with a stale
          // rate that's no longer being maintained.
          const stillValid = list.some((c) => c.code === get().selected && c.isActive);
          if (!stillValid) set({ selected: 'NGN' });
        } catch {
          // Fail open to NGN-only — checkout still works, it just
          // won't offer USD/GBP until the next successful fetch.
          set({ isLoading: false });
        }
      },

      setSelected: (code) => set({ selected: code }),

      // The current currency's full record (rate, symbol, staleness),
      // not just its code — this is what price-formatting components
      // actually need, so they don't each have to re-derive it from
      // `available` + `selected` themselves.
      getCurrent: () => {
        const { available, selected } = get();
        return available.find((c) => c.code === selected) || NGN_FALLBACK;
      },
    }),
    {
      name: 'vc-currency',
      partialize: (state) => ({ selected: state.selected }), // only persist the CHOICE, not fetched rates (those should always come fresh from the server)
    }
  )
);

export default useCurrencyStore;
