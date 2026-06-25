export type AppTheme = "dark" | "light" | "pretty" | "cute";

type ThemeOption = {
  value: AppTheme;
  label: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const THEME_STORAGE_KEY = "webband-studio-theme";

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "pretty", label: "Pretty" },
  { value: "cute", label: "Cute" }
];

export function normalizeTheme(value: unknown): AppTheme {
  return THEME_OPTIONS.some((theme) => theme.value === value) ? (value as AppTheme) : "dark";
}

function safeStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function readStoredTheme(storage?: StorageLike): AppTheme {
  try {
    return normalizeTheme(safeStorage(storage)?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function writeStoredTheme(theme: AppTheme, storage?: StorageLike) {
  try {
    safeStorage(storage)?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private contexts; the in-memory theme still works.
  }
}
