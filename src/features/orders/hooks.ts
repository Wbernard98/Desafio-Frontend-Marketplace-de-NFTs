import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerOf, useAuthState } from "../../shared/auth/authStore";
import { keys } from "../../shared/api/queryKeys";
import { useRealtimeStatus } from "../../shared/realtime/status";
import type { Order } from "../../shared/api/types";
import { connectWallet, createOrder, disconnectWallet, fetchConnection, fetchOrder, fetchPendingOrder } from "./api";

/** Pedido por id. Enquanto pendente e sem socket, faz polling leve: recupera o estado após queda de conexão. */
export function useOrder(id: string) {
  const auth = useAuthState();
  const status = useRealtimeStatus();
  return useQuery({
    queryKey: keys.order(ownerOf(auth), id),
    queryFn: ({ signal }) => fetchOrder(id, signal),
    enabled: !!auth.token,
    refetchInterval: (q) => (q.state.data?.status === "pending" && status !== "connected" ? 2000 : false),
  });
}

export function usePendingOrder() {
  const auth = useAuthState();
  return useQuery({ queryKey: keys.pendingOrder(ownerOf(auth)), queryFn: ({ signal }) => fetchPendingOrder(signal), enabled: !!auth.token, staleTime: 0 });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({
    mutationFn: ({ body, key }: { body: Parameters<typeof createOrder>[0]; key: string }) => createOrder(body, key),
    onSuccess: (order: Order) => {
      qc.setQueryData(keys.order(owner, order.id), order);
      void qc.invalidateQueries({ queryKey: keys.pendingOrder(owner) });
    },
  });
}

export function useWalletConnection() {
  const auth = useAuthState();
  return useQuery({ queryKey: keys.connection(ownerOf(auth)), queryFn: ({ signal }) => fetchConnection(signal), enabled: !!auth.token });
}
export function useConnectWallet() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({ mutationFn: connectWallet, onSuccess: (c) => qc.setQueryData(keys.connection(owner), c) });
}
export function useDisconnectWallet() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({ mutationFn: disconnectWallet, onSuccess: () => qc.setQueryData(keys.connection(owner), null) });
}
