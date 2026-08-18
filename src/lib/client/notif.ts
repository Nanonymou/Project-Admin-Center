/**
 * Client-side notification sync. The notification pages and the topbar bell all
 * read the same DB inbox; when one marks something read, it emits this event so
 * the others (notably the unread badge) refresh immediately.
 */
export const NOTIF_CHANGED_EVENT = "pac:notif-changed";

export function emitNotifChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIF_CHANGED_EVENT));
}

export function onNotifChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIF_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIF_CHANGED_EVENT, handler);
}

/**
 * The active account's Super-Admin-granted locationIds, kept in a module cache
 * set by the persona provider. Sent alongside the persona id so the server
 * honours the same per-account site scope the client sees.
 */
let grantedLocations: string[] = [];

/** Called by the persona provider whenever the resolved account scope changes. */
export function setGrantedLocations(locations: string[]): void {
  grantedLocations = locations;
}

/**
 * Header identifying the caller to persona-scoped APIs. Includes the account's
 * granted sites (`x-persona-locations`) when a Super Admin has scoped this
 * account, so server-side authorization matches the client's view.
 */
export function personaHeaders(personaId: string): Record<string, string> {
  const headers: Record<string, string> = { "x-persona-id": personaId };
  if (grantedLocations.length > 0) headers["x-persona-locations"] = grantedLocations.join(",");
  return headers;
}
