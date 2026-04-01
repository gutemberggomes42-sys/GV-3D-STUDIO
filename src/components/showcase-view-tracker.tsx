"use client";

import { useEffect } from "react";

type ShowcaseViewTrackerProps = {
  itemId: string;
};

export function ShowcaseViewTracker({ itemId }: ShowcaseViewTrackerProps) {
  useEffect(() => {
    const key = `printflow-viewed-${itemId}`;

    if (window.sessionStorage.getItem(key)) {
      return;
    }

    window.sessionStorage.setItem(key, "true");
    void fetch(`/api/showcase/items/${itemId}/view`, {
      method: "POST",
      cache: "no-store",
    }).catch(() => undefined);
  }, [itemId]);

  return null;
}
