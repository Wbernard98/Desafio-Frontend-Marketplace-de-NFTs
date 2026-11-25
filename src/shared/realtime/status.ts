import { useSyncExternalStore } from "react";

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
let status: RealtimeStatus = "connecting";
const listeners = new Set<() => void>();
export const setRealtimeStatus = (next: RealtimeStatus) => {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
};
export const useRealtimeStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
