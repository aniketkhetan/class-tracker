"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

// Light, dark, then back to following the system. A cycle rather than a menu
// because the header has room for one button and this is used on a phone.
const ORDER = ["light", "dark", "system"] as const;

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABELS = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Following system theme",
} as const;

// false while server rendering, true once hydrated. The server has no idea
// which theme is stored, so rendering the real icon any earlier would mismatch.
const subscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const Icon = ICONS[current] ?? Monitor;

  if (!mounted) {
    return <Button variant="ghost" size="icon-sm" disabled aria-hidden />;
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={LABELS[current]}
      title={LABELS[current]}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
    >
      <Icon />
    </Button>
  );
}
