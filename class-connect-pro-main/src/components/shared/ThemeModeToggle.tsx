import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const themeOptions: Array<{
  value: ThemeChoice;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

interface ThemeModeToggleProps {
  className?: string;
}

export function ThemeModeToggle({ className }: ThemeModeToggleProps) {
  const { theme = "system", setTheme } = useTheme();
  const activeTheme = theme as ThemeChoice;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-md",
        className
      )}
      aria-label="Theme mode"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = activeTheme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            title={`${option.label} mode`}
            aria-label={`${option.label} mode`}
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-base hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-primary text-primary-foreground shadow-soft hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
