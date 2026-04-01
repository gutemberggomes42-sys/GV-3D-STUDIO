"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getShowcaseCartCount,
  readShowcaseCart,
  showcaseCartUpdatedEvent,
} from "@/lib/showcase-cart";

type ShowcaseCartButtonProps = {
  className?: string;
  compact?: boolean;
};

export function ShowcaseCartButton({
  className,
  compact = false,
}: ShowcaseCartButtonProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const syncCart = () => {
      setCount(getShowcaseCartCount(readShowcaseCart()));
    };

    syncCart();
    window.addEventListener("storage", syncCart);
    window.addEventListener(showcaseCartUpdatedEvent, syncCart as EventListener);

    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener(showcaseCartUpdatedEvent, syncCart as EventListener);
    };
  }, []);

  return (
    <Link
      href="/carrinho"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/12"
      }
    >
      <span className="relative inline-flex items-center">
        <ShoppingCart className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1.5 text-[10px] font-bold text-slate-950">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      {!compact ? <span>{count > 0 ? `Carrinho (${count})` : "Carrinho"}</span> : null}
    </Link>
  );
}
