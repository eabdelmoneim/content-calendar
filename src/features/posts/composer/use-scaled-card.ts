"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Peacock's feed-preview scaling: the card keeps its real width (so text
 * wraps like the platform) and is scaled down to fit the preview pane.
 */
export function useScaledCard(cardWidth: number, measureKey: unknown) {
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const feed = feedRef.current;
    const card = cardRef.current;
    if (!feed || !card) return;
    const measure = () => {
      const style = getComputedStyle(feed);
      const available = feed.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const scale = available > 0 ? Math.min(1, available / cardWidth) : 1;
      const height = card.offsetHeight * scale;
      setLayout((previous) =>
        previous.scale === scale && previous.height === height ? previous : { scale, height },
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(feed);
    observer?.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cardWidth, measureKey]);

  return { feedRef, cardRef, layout };
}
