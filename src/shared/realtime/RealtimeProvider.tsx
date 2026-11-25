import { useEffect, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuthState } from "../auth/authStore";
import { announce } from "../ui/announcer";
import { fmtEth } from "../lib/money";
import { keys } from "../api/queryKeys";
import { catalogKeys } from "../../features/catalog/api";
import type { Nft, Paginated } from "../../features/catalog/types";
import type { CartResponse, NftUpdatedEvent, Order, OrderUpdatedEvent } from "../api/types";
import { setRealtimeStatus } from "./status";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "wss://realtime.kurio.mock";
const MAX_SEEN = 500;

/** Aplica nft.updated: corrige catálogo e detalhe no cache e re-sincroniza carrinho/cotação com a API. */
function applyNftUpdated(qc: QueryClient, e: NftUpdatedEvent, owner: string) {
  const patch = (n: Nft): Nft =>
    n.id === e.resourceId && n.version < e.version
      ? { ...n, priceEth: e.payload.priceEth, originalPriceEth: e.payload.originalPriceEth, stock: e.payload.stock, available: e.payload.available, version: e.version }
      : n;

  qc.setQueryData<Nft>(keys.nft(e.resourceId), (old) => (old ? patch(old) : old));
  qc.setQueriesData<Paginated<Nft>>({ queryKey: [...catalogKeys.all, "list"] }, (old) => (old ? { ...old, items: old.items.map(patch) } : old));
  // listas ordenadas por preço podem mudar de ordem: revalida as ativas
  void qc.invalidateQueries({ queryKey: [...catalogKeys.all, "list"] });

  const cart = qc.getQueryData<CartResponse>(keys.cart(owner));
  const inCart = cart?.lines.find((l) => l.nftId === e.resourceId);
  if (inCart) {
    void qc.invalidateQueries({ queryKey: keys.cart(owner) });
    void qc.invalidateQueries({ queryKey: ["quote", owner] });
    announce(`${inCart.name} foi atualizado: ${fmtEth(e.payload.priceEth)}, ${e.payload.available} disponíveis. O resumo foi recalculado.`, "assertive");
  } else if (qc.getQueryData(keys.nft(e.resourceId))) {
    announce(`Preço ou disponibilidade atualizados: ${fmtEth(e.payload.priceEth)}.`);
  }
}

function applyOrderUpdated(qc: QueryClient, e: OrderUpdatedEvent, owner: string) {
  const incoming = e.payload.order;
  const current = qc.getQueryData<Order>(keys.order(owner, incoming.id));
  // pedidos terminais nunca regridem; versões antigas são descartadas
  if (current && (current.version >= incoming.version || current.status !== "pending")) return;
  qc.setQueryData(keys.order(owner, incoming.id), incoming);
  void qc.invalidateQueries({ queryKey: keys.pendingOrder(owner) });
  if (incoming.status !== "pending") {
    void qc.invalidateQueries({ queryKey: keys.cart(owner) });
    void qc.invalidateQueries({ queryKey: ["quote", owner] });
    announce(incoming.status === "confirmed" ? "Pedido confirmado." : `Pedido recusado. ${incoming.declineReason ?? ""}`, "assertive");
  }
}

/**
 * Mantém UMA conexão Socket.IO por sessão (token). Ao trocar/encerrar a sessão, a conexão e todos os
 * listeners são liberados e uma nova nasce com a identidade atual: eventos de um usuário nunca atualizam outro.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { token, userId } = useAuthState();

  useEffect(() => {
    const owner = userId ?? "guest";
    const seen = new Set<string>(); // deduplicação por id do evento
    const applied = new Map<string, number>(); // maior versão já aplicada por recurso
    let everConnected = false;

    setRealtimeStatus("connecting");
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket"],
      query: token ? { token } : {},
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
    });

    const accept = (e: { id: string; resource: string; resourceId: string; version: number; userId: string | null }) => {
      if (e.userId && e.userId !== userId) return false; // evento de outra sessão
      if (seen.has(e.id)) return false; // duplicata
      seen.add(e.id);
      if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string);
      const k = `${e.resource}:${e.resourceId}`;
      if ((applied.get(k) ?? 0) >= e.version) return false; // evento antigo
      applied.set(k, e.version);
      return true;
    };

    socket.on("nft.updated", (e: NftUpdatedEvent) => accept(e) && applyNftUpdated(qc, e, owner));
    socket.on("order.updated", (e: OrderUpdatedEvent) => accept(e) && applyOrderUpdated(qc, e, owner));

    socket.on("connect", () => {
      setRealtimeStatus("connected");
      if (everConnected) {
        // reconexão: reconcilia os recursos ativos com a API REST
        applied.clear();
        for (const root of [catalogKeys.all, ["nft"], ["cart"], ["quote"], ["orders"], ["order"]]) void qc.invalidateQueries({ queryKey: root });
        announce("Conexão em tempo real restabelecida.");
      }
      everConnected = true;
    });
    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect") return;
      setRealtimeStatus("reconnecting");
      announce("Conexão em tempo real perdida. Tentando reconectar…");
    });
    socket.on("connect_error", () => setRealtimeStatus("reconnecting"));

    return () => {
      socket.off();
      socket.disconnect();
      setRealtimeStatus("disconnected");
    };
  }, [token, userId, qc]);

  return <>{children}</>;
}

