import { useEffect, useState, useCallback } from 'react';
import { products as productsApi } from '@/api/client';
import useCartStore from '@/context/cartStore';
import toast from 'react-hot-toast';

/**
 * Cart items are persisted with the price snapshotted at "Add to
 * Cart" time (see cartStore.js) and never refreshed after that. If a
 * product's price changes while it's sitting in someone's cart —an
 * ordinary, expected event (a sale, a correction) — the Cart/
 * Checkout display keeps showing the stale number indefinitely,
 * while the actual /payments/checkout endpoint always re-fetches the
 * live price and charges THAT. That's a real bug: the customer sees
 * one total and is charged a different one, with no warning either
 * direction.
 *
 * This hook is the fix: call it once when Cart or Checkout mounts.
 * It fetches current prices/stock for everything in the cart,
 * silently corrects the store to match reality, and returns a
 * summary of what changed so the page can show a "prices updated"
 * notice rather than let the discrepancy pass unremarked.
 */
export default function useRevalidateCart() {
  const items = useCartStore((s) => s.items);
  const updateItemFields = useCartStore((s) => s.updateItemFields);
  const removeItem = useCartStore((s) => s.removeItem);
  const [checking, setChecking] = useState(false);
  const [changes, setChanges] = useState(null); // null = not checked yet this mount

  const revalidate = useCallback(async () => {
    const regularItems = items.filter((item) => !item.pwywEnabled);
    if (regularItems.length === 0) {
      setChanges(null);
      return;
    }
    setChecking(true);
    try {
      const ids = [...new Set(regularItems.map((item) => item._id))];
      const { data } = await productsApi.revalidateCart(ids);
      const byId = new Map(data.products.map((p) => [p.productId, p]));

      const priceChanges = [];
      const removed = [];

      for (const item of regularItems) {
        const fresh = byId.get(item._id);
        if (!fresh || !fresh.available) {
          removed.push(item.name);
          removeItem(item.cartKey || item._id);
          continue;
        }
        if (fresh.price !== item.price) {
          priceChanges.push({ name: item.name, from: item.price, to: fresh.price });
          updateItemFields(item.cartKey || item._id, { price: fresh.price, stock: fresh.stock });
        } else if (fresh.stock !== item.stock) {
          // Stock alone changed (no price impact) — still worth
          // syncing so a qty stepper doesn't let someone request more
          // than what's actually available.
          updateItemFields(item.cartKey || item._id, { stock: fresh.stock });
        }
      }

      if (priceChanges.length > 0 || removed.length > 0) {
        setChanges({ priceChanges, removed });
        if (removed.length > 0) {
          toast.error(
            removed.length === 1
              ? `${removed[0]} is no longer available and was removed from your cart`
              : `${removed.length} items are no longer available and were removed from your cart`
          );
        }
        if (priceChanges.length > 0) {
          toast(
            priceChanges.length === 1
              ? `${priceChanges[0].name}'s price has changed to reflect the current price`
              : `${priceChanges.length} item prices have changed to reflect current pricing`,
            { icon: '⚠️' }
          );
        }
      } else {
        setChanges({ priceChanges: [], removed: [] });
      }
    } catch {
      // Fail open: if the revalidation call itself fails (network
      // blip, backend hiccup), don't block the customer from viewing
      // Cart/Checkout — the real checkout endpoint still re-validates
      // and charges the correct live price regardless, this is only
      // a DISPLAY reconciliation. Just leave `changes` as null so the
      // page doesn't falsely claim "prices confirmed current."
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    revalidate();
    // Intentionally only on mount — re-running on every cart mutation
    // would mean a network call per quantity-stepper click; the
    // checkout submission itself is still the final source of truth
    // regardless of what this hook shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checking, changes, revalidate };
}
