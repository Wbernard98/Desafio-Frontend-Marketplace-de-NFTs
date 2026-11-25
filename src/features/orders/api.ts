import { http } from "../../shared/api/http";
import type { ConnectWalletBody, CreateOrderBody, Order, WalletConnection } from "../../shared/api/types";

export const createOrder = (body: CreateOrderBody, idempotencyKey: string) =>
  http.post<Order>("/orders", body, { headers: { "Idempotency-Key": idempotencyKey } }).then((r) => r.data);
export const fetchOrder = (id: string, signal?: AbortSignal) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.data);
export const fetchPendingOrder = (signal?: AbortSignal) => http.get<{ order: Order | null }>("/orders/pending", { signal }).then((r) => r.data.order);

export const fetchConnection = (signal?: AbortSignal) =>
  http.get<{ connection: WalletConnection | null }>("/wallets/connection", { signal }).then((r) => r.data.connection);
export const connectWallet = (body: ConnectWalletBody) => http.post<{ connection: WalletConnection }>("/wallets/connection", body).then((r) => r.data.connection);
export const disconnectWallet = () => http.delete("/wallets/connection").then(() => null);
