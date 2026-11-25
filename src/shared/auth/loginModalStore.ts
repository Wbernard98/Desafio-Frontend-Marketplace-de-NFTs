import { useSyncExternalStore } from "react";

/** Estado do modal de acesso (aberto por qualquer tela que exija login). */
export interface LoginModalState {
  open: boolean;
  mode: "login" | "register";
  /** Caminho interno para retomar após autenticar. */
  redirect: string | null;
}
let state: LoginModalState = { open: false, mode: "login", redirect: null };
const listeners = new Set<() => void>();
const set = (next: LoginModalState) => {
  state = next;
  listeners.forEach((l) => l());
};
export const loginModal = {
  get: () => state,
  open: (opts: { mode?: "login" | "register"; redirect?: string | null } = {}) =>
    set({ open: true, mode: opts.mode ?? "login", redirect: opts.redirect ?? state.redirect }),
  close: () => set({ open: false, mode: "login", redirect: null }),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
export const useLoginModal = () => useSyncExternalStore(loginModal.subscribe, loginModal.get, loginModal.get);
