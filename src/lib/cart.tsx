"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clampOrderQty,
  isPurchasableProduct,
  normalizeStockStatus,
  type StockStatus,
} from "./stock";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  brand: string | null;
  unitPrice: number;
  stockStatus: StockStatus;
  stockQty: number | null;
  qty: number;
};

type CartState = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const CartCtx = createContext<CartState | null>(null);
const STORAGE_KEY = "tustore-cart-v1";

function normalizeCartItem(item: Partial<CartItem>): CartItem | null {
  if (
    typeof item.id !== "string" ||
    typeof item.slug !== "string" ||
    typeof item.name !== "string" ||
    typeof item.unitPrice !== "number"
  ) {
    return null;
  }
  const stockStatus = normalizeStockStatus(item.stockStatus, true);
  const stockQty =
    typeof item.stockQty === "number" && Number.isFinite(item.stockQty)
      ? item.stockQty
      : null;
  const qty = clampOrderQty(Number(item.qty) || 1, stockStatus, stockQty);
  if (!isPurchasableProduct(stockStatus, stockQty, item.unitPrice)) return null;
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    image: typeof item.image === "string" ? item.image : null,
    brand: typeof item.brand === "string" ? item.brand : null,
    unitPrice: item.unitPrice,
    stockStatus,
    stockQty,
    qty,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed
              .map((item) => normalizeCartItem(item))
              .filter((item): item is CartItem => !!item)
          );
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback<CartState["add"]>((item, qty = 1) => {
    setItems((prev) => {
      const stockStatus = normalizeStockStatus(item.stockStatus, true);
      if (!isPurchasableProduct(stockStatus, item.stockQty, item.unitPrice)) {
        return prev;
      }
      const ex = prev.find((p) => p.id === item.id);
      if (ex) {
        return prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                ...item,
                stockStatus,
                qty: clampOrderQty(p.qty + qty, stockStatus, item.stockQty),
              }
            : p
        );
      }
      return [
        ...prev,
        {
          ...item,
          stockStatus,
          qty: clampOrderQty(qty, stockStatus, item.stockQty),
        },
      ];
    });
  }, []);

  const remove = useCallback<CartState["remove"]>((id) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const setQty = useCallback<CartState["setQty"]>((id, qty) => {
    setItems((prev) =>
      prev
        .map((p) =>
          p.id === id
            ? { ...p, qty: clampOrderQty(qty, p.stockStatus, p.stockQty) }
            : p
        )
        .filter((p) => p.qty > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartState>(() => {
    const count = items.reduce((acc, i) => acc + i.qty, 0);
    const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
    return { items, count, subtotal, add, remove, setQty, clear };
  }, [items, add, remove, setQty, clear]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) {
    return {
      items: [],
      count: 0,
      subtotal: 0,
      add: () => {},
      remove: () => {},
      setQty: () => {},
      clear: () => {},
    };
  }
  return ctx;
}
