export const WORKPLACE_CHANGED_EVENT = "workplace:changed" as const;

export function emitWorkplaceChanged(): void {
  window.dispatchEvent(new Event(WORKPLACE_CHANGED_EVENT));
}

export function onWorkplaceChanged(handler: () => void): () => void {
  window.addEventListener(WORKPLACE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(WORKPLACE_CHANGED_EVENT, handler);
}

