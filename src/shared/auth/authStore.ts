import { useSyncExternalStore } from "react";

/**
 * Estado de autenticação do cliente: apenas o token de sessão opaco e o id do usuário.
 * Senhas nunca são armazenadas (o servidor guarda só hash+salt).
 */
export interface AuthState {
  token: string | null;
  userId: string | null;
  /** true quando a API respondeu 401 (sessão expirada/inválida) com um token presente. */
  expired: boolean;
}

const AUTH_KEY = "kurio:auth";
const GUEST_KEY = "kurio:guest-id";

function load(): AuthState {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AuthState>;
      if (typeof p.token === "string" && typeof p.userId === "string") return { token: p.token, userId: p.userId, expired: false };
    }
  } catch {
    /* storage indisponível ou JSON inválido */
  }
  return { token: null, userId: null, expired: false };
}

let state: AuthState = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => {
  try {
    if (state.token && state.userId) window.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: state.token, userId: state.userId }));
    else window.localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignora */
  }
};

export const authStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSession(token: string, userId: string) {
    state = { token, userId, expired: false };
    persist();
    emit();
  },
  /** Logout explícito ou troca de usuário. */
  clear() {
    state = { token: null, userId: null, expired: false };
    persist();
    emit();
  },
  /** A API invalidou a sessão: remove credenciais e sinaliza para a UI retomar após novo login. */
  markExpired() {
    if (!state.token) return;
    state = { token: null, userId: null, expired: true };
    persist();
    emit();
  },
  dismissExpired() {
    if (!state.expired) return;
    state = { ...state, expired: false };
    emit();
  },
};

// sincroniza logout/login feito em outra aba
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === AUTH_KEY) {
      state = load();
      emit();
    }
  });
}

export const useAuthState = () => useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
export const getToken = () => state.token;
/** Dono das chaves de cache privadas: id do usuário ou "guest". */
export const ownerOf = (s: AuthState) => s.userId ?? "guest";

export function getGuestId(): string {
  try {
    let id = window.localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Só aceita caminhos internos (evita open redirect). */
export function safeRedirect(target: string | null | undefined): string | null {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return null;
  return target;
}
