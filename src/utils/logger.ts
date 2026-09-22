export type RecentError = {
  scope: string;
  error: unknown;
  timestamp: number;
};

const MAX_RECENT_ERRORS = 20;
const recentErrors: RecentError[] = [];

export function logError(scope: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${scope}]`, error);
    return;
  }

  recentErrors.push({ scope, error, timestamp: Date.now() });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
}

export function getRecentErrors(): RecentError[] {
  return [...recentErrors];
}
