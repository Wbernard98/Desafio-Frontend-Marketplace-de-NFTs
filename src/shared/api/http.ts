import axios, { isAxiosError } from "axios";
import { authStore, getGuestId, getToken } from "../auth/authStore";

/**
 * Todas as chamadas REST passam por aqui. Nenhuma resposta fictícia mora neste arquivo:
 * em desenvolvimento/demonstração quem responde é o MSW (src/mocks), na camada de rede.
 */
export const HTTP_TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 8000);
export const http = axios.create({ baseURL: "/api", timeout: HTTP_TIMEOUT_MS });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  config.headers.set("X-Guest-Id", getGuestId());
  return config;
});

http.interceptors.response.use(undefined, (error: unknown) => {
  if (isAxiosError(error) && error.response?.status === 401) {
    const code = (error.response.data as { code?: string } | undefined)?.code;
    if (code === "session_expired" || code === "session_invalid") authStore.markExpired();
  }
  return Promise.reject(error);
});
