/**
 * Mock client-side session flag (frontend-first). The login screen writes the
 * signed-in persona id here and logout clears it. This is not real auth — the
 * backend session API is a later task — but it gives the shell a single key to
 * read for login/logout state.
 */
export const SESSION_KEY = "pac.session";

/** Whether a mock session is present (client-only). */
export function hasSession(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(SESSION_KEY));
}

/** Clear the mock session (logout). */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
