import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, chosenTierId) => {
        const { items } = get();
        const tier = product.pwywEnabled
          ? product.pwywTiers?.find((entry) => String(entry.id) === String(chosenTierId))
          : null;
        if (product.pwywEnabled && !tier) return;

        const cartKey = product.pwywEnabled
          ? `${product._id}:${tier.id}`
          : String(product._id);
        const existing = items.find((item) => (item.cartKey || String(item._id)) === cartKey);
        const cartItem = {
          ...product,
          ...(tier ? {
            chosenTierId: tier.id,
            chosenTierLabel: tier.label,
            price: tier.amount,
          } : {}),
          cartKey,
          quantity,
          stale: false,
        };

        if (existing) {
          set({
            items: items.map((i) =>
              (i.cartKey || String(i._id)) === cartKey
                ? {
                    ...i,
                    quantity: i.quantity + quantity,
                    ...(i.pwywEnabled ? { lineTotal: undefined } : {}),
                  }
                : i
            ),
          });
        } else {
          set({ items: [...items, cartItem] });
        }
      },

      replaceStaleItem: (cartKey, product, quantity, chosenTierId) => {
        const tier = product.pwywTiers?.find((entry) => String(entry.id) === String(chosenTierId));
        if (!tier) return;
        const items = get().items;
        const staleIndex = items.findIndex((item) => (item.cartKey || String(item._id)) === cartKey);
        if (staleIndex < 0) return;

        const nextKey = `${product._id}:${tier.id}`;
        const existingIndex = items.findIndex((item, index) =>
          index !== staleIndex && (item.cartKey || String(item._id)) === nextKey
        );
        const nextItems = items.filter((_, index) => index !== staleIndex);
        if (existingIndex >= 0) {
          const nextExistingIndex = existingIndex > staleIndex ? existingIndex - 1 : existingIndex;
          nextItems[nextExistingIndex] = {
            ...nextItems[nextExistingIndex],
            quantity: nextItems[nextExistingIndex].quantity + items[staleIndex].quantity,
          };
        } else {
          nextItems.push({
            ...items[staleIndex],
            ...product,
            chosenTierId: tier.id,
            chosenTierLabel: tier.label,
            price: tier.amount,
            quantity: items[staleIndex].quantity ?? quantity,
            lineTotal: undefined,
            cartKey: nextKey,
            stale: false,
          });
        }
        set({ items: nextItems });
      },

      markStale: (cartKeys) => {
        const staleKeys = new Set(cartKeys);
        set({
          items: get().items.map((item) => staleKeys.has(item.cartKey || String(item._id))
            ? { ...item, stale: true }
            : item
          ),
        });
      },

      replaceItems: (items) => set({ items }),

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i._id !== id && (i.cartKey || String(i._id)) !== id) });
      },

      updateQty: (id, qty) => {
        if (qty < 1) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((i) =>
            (i.cartKey || String(i._id)) === id || i._id === id
              ? { ...i, quantity: qty, ...(i.pwywEnabled ? { lineTotal: undefined } : {}) }
              : i
          ),
        });
      },

      // Patches arbitrary fields on a cart item (currently: price,
      // stock) without touching quantity — used by
      // useRevalidateCart.js to reconcile a stale add-to-cart-time
      // price snapshot against the live catalog. Distinct from
      // updateQty, which is quantity-only and user-driven.
      updateItemFields: (id, fields) => {
        set({
          items: get().items.map((i) =>
            (i.cartKey || String(i._id)) === id || i._id === id ? { ...i, ...fields } : i
          ),
        });
      },

      clear: () => set({ items: [] }),
    }),
    {
      name: 'winners-cart',
    }
  )
);

export default useCartStore;

// ── Helper selectors (use these in components) ───────────────────
export const selectCartCount = (state) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartTotal = (state) =>
  state.items.reduce((sum, item) => sum + (item.pwywEnabled
    ? Number(item.lineTotal ?? item.price * item.quantity) || 0
    : item.price * item.quantity), 0);