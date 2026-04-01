"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const storageKey = "printflow-showcase-wishlist";

function readWishlist() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : []);
  } catch {
    return new Set<string>();
  }
}

function writeWishlist(nextValue: Set<string>) {
  window.localStorage.setItem(storageKey, JSON.stringify([...nextValue]));
  window.dispatchEvent(new CustomEvent("printflow-wishlist-updated"));
}

type ShowcaseWishlistButtonProps = {
  itemId: string;
  className?: string;
};

export function ShowcaseWishlistButton({
  itemId,
  className,
}: ShowcaseWishlistButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const syncWishlist = () => {
      setIsFavorite(readWishlist().has(itemId));
    };

    syncWishlist();
    window.addEventListener("storage", syncWishlist);
    window.addEventListener("printflow-wishlist-updated", syncWishlist as EventListener);

    return () => {
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("printflow-wishlist-updated", syncWishlist as EventListener);
    };
  }, [itemId]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextWishlist = readWishlist();

        if (nextWishlist.has(itemId)) {
          nextWishlist.delete(itemId);
        } else {
          nextWishlist.add(itemId);
        }

        writeWishlist(nextWishlist);
        setIsFavorite(nextWishlist.has(itemId));
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm transition",
        isFavorite
          ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
          : "border-white/10 bg-black/35 text-white/75 hover:bg-white/10 hover:text-white",
        className,
      )}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={isFavorite}
    >
      <Heart className={cn("h-4 w-4", isFavorite ? "fill-current" : "")} />
    </button>
  );
}
