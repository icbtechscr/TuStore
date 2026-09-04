"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { isPurchasableProduct } from "@/lib/stock";

type Props = {
  product: Omit<CartItem, "qty">;
  disabled?: boolean;
  className?: string;
};

export function AddToCartButton({ product, disabled, className = "" }: Props) {
  const { add } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const unavailable = !isPurchasableProduct(
    product.stockStatus,
    product.stockQty,
    product.unitPrice
  );
  const isDisabled = disabled || unavailable;

  function onClick() {
    if (isDisabled) return;
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className="group inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#ffd814] px-6 py-3 text-sm font-bold text-ink-900 shadow-sm transition-all hover:bg-[#f7ca00] active:scale-95 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none"
      >
        {added ? (
          <>
            <Check className="size-4" />
            Agregado
          </>
        ) : (
          <>
            <ShoppingCart className="size-4" />
            Agregar al carrito
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          if (isDisabled) return;
          add(product, 1);
          router.push("/carrito");
        }}
        disabled={isDisabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-ink-200 bg-[#ffa41c] px-6 py-3 text-sm font-bold text-ink-900 transition-colors hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Comprar ahora
      </button>
    </div>
  );
}
