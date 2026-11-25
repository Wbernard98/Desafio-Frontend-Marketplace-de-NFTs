import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "../api/http";
import { keys } from "../api/queryKeys";
import type { AuthResponse, LoginBody, RegisterBody, SessionResponse } from "../api/types";
import { clearPrivateData } from "../../app/queryClient";
import { authStore, getGuestId, ownerOf, useAuthState } from "./authStore";
import { mergeGuestCart } from "../../features/cart/api";
import { setCoupon } from "../../features/cart/hooks";
import { clearCheckoutLocalState } from "../../features/orders/localState";

export const fetchSession = (signal?: AbortSignal) => http.get<SessionResponse>("/auth/session", { signal }).then((r) => r.data);
const postLogin = (b: LoginBody) => http.post<AuthResponse>("/auth/login", b).then((r) => r.data);
const postRegister = (b: RegisterBody) => http.post<AuthResponse>("/auth/register", b).then((r) => r.data);

/** Sessão recuperável após refresh: o token fica salvo e a API valida a cada carga. */
export function useSession() {
  const auth = useAuthState();
  const query = useQuery({
    queryKey: keys.session(ownerOf(auth)),
    queryFn: ({ signal }) => fetchSession(signal),
    enabled: !!auth.token,
    retry: false,
    staleTime: 60_000,
  });
  return {
    user: auth.token ? (query.data?.user ?? null) : null,
    isAuthenticated: !!auth.token,
    isLoading: !!auth.token && query.isPending,
    expired: auth.expired,
  };
}

function useEstablishSession() {
  const qc = useQueryClient();
  return async (data: AuthResponse) => {
    const previous = authStore.get().userId;
    if (previous && previous !== data.user.id) await clearPrivateData(); // troca de usuário
    authStore.setSession(data.token, data.user.id);
    qc.setQueryData(keys.session(data.user.id), { user: data.user, expiresAt: data.expiresAt });
    try {
      await mergeGuestCart(getGuestId()); // preserva os itens do visitante ao autenticar
    } catch {
      /* o carrinho do visitante continua disponível no servidor */
    }
    await qc.invalidateQueries({ queryKey: ["cart"] });
    await qc.invalidateQueries({ queryKey: ["quote"] });
  };
}

export function useLogin() {
  const establish = useEstablishSession();
  return useMutation({ mutationFn: postLogin, onSuccess: establish });
}
export function useRegister() {
  const establish = useEstablishSession();
  return useMutation({ mutationFn: postRegister, onSuccess: establish });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await http.post("/auth/logout");
      } catch {
        /* mesmo se a API falhar, o logout local acontece */
      }
    },
    onSettled: async () => {
      authStore.clear();
      await clearPrivateData();
      setCoupon(null);
      clearCheckoutLocalState();
    },
  });
}
