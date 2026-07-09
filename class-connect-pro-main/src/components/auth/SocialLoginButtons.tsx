import { useEffect, useState } from "react";
import { Apple, Facebook } from "lucide-react";

import type { OAuthProvider } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";

interface SocialLoginButtonsProps {
  onProviderSelect?: (provider: OAuthProvider, label: string) => void;
  disabled?: boolean;
}

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.44Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.9A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.82 1.49l2.87-2.87C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.93 5.51l3.34 2.59C7.2 7.74 9.4 5.98 12 5.98Z" />
  </svg>
);

const MicrosoftMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#F25022" d="M3 3h8.5v8.5H3V3Z" />
    <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5V3Z" />
    <path fill="#00A4EF" d="M3 12.5h8.5V21H3v-8.5Z" />
    <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5v-8.5Z" />
  </svg>
);

const providers: Array<{
  id: OAuthProvider;
  name: string;
  icon: JSX.Element;
}> = [
  { id: "google", name: "Google", icon: <GoogleMark /> },
  { id: "facebook", name: "Facebook", icon: <Facebook className="h-4 w-4 text-[#1877F2]" /> },
  { id: "apple", name: "Apple", icon: <Apple className="h-4 w-4 text-slate-950 dark:text-slate-50" /> },
  { id: "microsoft", name: "Microsoft", icon: <MicrosoftMark /> },
];

export function SocialLoginButtons({ onProviderSelect, disabled = false }: SocialLoginButtonsProps) {
  const [configuredProviders, setConfiguredProviders] = useState<Record<OAuthProvider, boolean> | null>(null);

  useEffect(() => {
    let active = true;

    fetch(buildApiUrl("/auth/oauth/status"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.providers) setConfiguredProviders(data.providers);
      })
      .catch(() => {
        if (active) setConfiguredProviders(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {providers.map((provider) => {
        const configured = configuredProviders?.[provider.id] ?? true;
        const isDisabled = disabled || !configured;

        return (
          <button
            key={provider.id}
            type="button"
            data-auth-provider={provider.id}
            aria-label={`Continue with ${provider.name}`}
            title={configured ? `Continue with ${provider.name}` : `${provider.name} OAuth is not configured in Railway yet`}
            disabled={isDisabled}
            onClick={() => onProviderSelect?.(provider.id, provider.name)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-2 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-md transition-base hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            {provider.icon}
            <span className="min-w-0 truncate">{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
