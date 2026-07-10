import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 360);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-gradient-primary transition-all duration-300 ${
          loading ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full w-2/3 animate-route-progress bg-accent shadow-glow" />
      </div>
      {children}
    </>
  );
}
