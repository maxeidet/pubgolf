"use client";

import { useEffect, useRef, useState } from "react";

// Bottom sheet that slides up and can be swiped down to close.
// Drag works from the header, or from the content when it is scrolled to the top.
export function Sheet({
  open,
  onClose,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  // Only keep the sheet in the DOM while open (or animating out). A hidden fixed
  // overlay makes iOS Safari tint its toolbar dark.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(t);
  }, [open]);
  const panel = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Touch dragging (native listeners so we can preventDefault while dragging).
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let canDrag = false;
    let dragging = false;

    const begin = (y: number, t: number, target: EventTarget | null) => {
      startY = lastY = y;
      lastT = t;
      velocity = 0;
      dragging = false;
      canDrag =
        !!headerRef.current?.contains(target as Node) || (scroller.current?.scrollTop ?? 0) <= 0;
    };
    // Returns true while the gesture is a sheet drag.
    const move = (y: number, t: number) => {
      if (!canDrag) return false;
      const dy = y - startY;
      if (!dragging) {
        if (dy > 6) dragging = true;
        else if (dy < -6) canDrag = false;
        if (!dragging) return false;
      }
      velocity = (y - lastY) / Math.max(1, t - lastT);
      lastY = y;
      lastT = t;
      setDrag(Math.max(0, dy));
      return true;
    };
    const end = () => {
      if (dragging && (lastY - startY > 110 || velocity > 0.5)) onCloseRef.current();
      dragging = false;
      setDrag(0);
    };

    const ts = (e: TouchEvent) => begin(e.touches[0].clientY, e.timeStamp, e.target);
    const tm = (e: TouchEvent) => {
      if (move(e.touches[0].clientY, e.timeStamp) && e.cancelable) e.preventDefault();
    };
    // Mouse drag on the header, for desktop.
    const md = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) return;
      begin(e.clientY, e.timeStamp, e.target);
      const mm = (ev: MouseEvent) => move(ev.clientY, ev.timeStamp);
      const mu = () => {
        end();
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    };

    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", md);
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchmove", tm);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("mousedown", md);
    };
  }, [mounted]);

  // Escape to close + lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dragging = drag > 0;
  if (!mounted) return null;

  return (
    <div className={`fixed inset-0 z-50 ${shown ? "" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className="absolute inset-x-0 -bottom-40 -top-40 bg-linje/50 backdrop-blur-[2px]"
        style={{
          opacity: shown ? Math.max(0, 1 - drag / 400) : 0,
          transition: dragging ? "none" : "opacity 300ms ease",
        }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Topplista"
        inert={!shown}
        className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] mx-auto flex max-h-[85dvh] max-w-[27rem] flex-col overflow-hidden rounded-[32px] bg-kort shadow-[0_12px_50px_rgba(0,0,0,0.35)]"
        style={{
          transform: shown ? `translateY(${drag}px)` : "translateY(calc(100% + 2rem))",
          transition: dragging ? "none" : "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div ref={headerRef} className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5">
          <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-linje/25" />
          {header}
        </div>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
