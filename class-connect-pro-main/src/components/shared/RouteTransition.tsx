import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Start each page at the top - otherwise navigating from a long page (a full
    // gradebook, say) drops you into the middle of the next one.
    window.scrollTo({ top: 0, behavior: "auto" });

    // Nothing was navigated to on the very first paint, so don't flash the bar.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 260);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <>
      {/* Mounted only while navigating: the sweep loops, so leaving it in the tree
          would keep an animation running on every page for no reason. */}
      {loading && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
        >
          <div className="h-full w-1/3 animate-route-progress bg-gradient-primary" />
        </div>
      )}
      {children}
    </>
  );
}
