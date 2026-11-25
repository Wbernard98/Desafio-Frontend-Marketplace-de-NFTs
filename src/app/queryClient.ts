import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { PRIVATE_ROOTS } from "../shared/api/queryKeys";

/**
 * Política de cache, retries e sincronização (documentada no README):
 * - staleTime 30s: o catálogo tolera dados levemente velhos; eventos Socket.IO (nft.updated) corrigem antes disso.
 * - gcTime 5min; refetchOnWindowFocus desligado (o tempo real e a reconexão fazem a sincronização).
 * - retries só para falhas transitórias (rede/timeout/5xx), no máximo 2x com backoff exponencial; 4xx nunca é repetido.
 * - mutations nunca repetem sozinhas: a recuperação é manual e idempotente (Idempotency-Key nos pedidos).
 * - dados privados têm o usuário na chave e são removidos no logout/troca de usuário (clearPrivateData).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        if (isAxiosError(error) && error.response && error.response.status < 500) return false;
        return count < 2;
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
});

/** Cancela requisições em voo e remove do cache tudo que é privado (usado no logout, expiração e troca de usuário). */
export async function clearPrivateData() {
  const isPrivate = (key: readonly unknown[]) => (PRIVATE_ROOTS as readonly unknown[]).includes(key[0]);
  await queryClient.cancelQueries({ predicate: (q) => isPrivate(q.queryKey) });
  queryClient.removeQueries({ predicate: (q) => isPrivate(q.queryKey) });
}
