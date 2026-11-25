import { useSyncExternalStore } from "react";

/** Região viva global: feedback acessível para mutations e alterações em tempo real. */
export interface Announcement { id: number; message: string; politeness: "polite" | "assertive" }
let current: Announcement = { id: 0, message: "", politeness: "polite" };
const listeners = new Set<() => void>();

export function announce(message: string, politeness: "polite" | "assertive" = "polite") {
  current = { id: current.id + 1, message, politeness };
  listeners.forEach((l) => l());
}
export const useAnnouncement = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
