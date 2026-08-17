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

/** Header identifying the caller to the persona-scoped notification API. */
export function personaHeaders(personaId: string): Record<string, string> {
  return { "x-persona-id": personaId };
}
