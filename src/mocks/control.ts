import { commit, db, expireAllSessions, patchNft, publish, resetDb, settleOrder } from "./db";
import { failNext, resetConfig, setPayment, setScenario, type PaymentMode, type Scenario } from "./scenarios";
import { blockSockets, connectedSockets, disconnectSockets, dispatch, recentEvents } from "./socket";
import type { RealtimeEvent } from "../shared/api/types";

/**
 * Painel de controle dos mocks (window.__kurioMock). Serve ao desenvolvimento, à demonstração e ao Playwright.
 * Tudo aqui age sobre a camada de rede simulada: os eventos saem pelo servidor Socket.IO do MSW
 * e chegam à UI pelo `socket.io-client`, exatamente como em produção.
 */
export const control = {
  /** Restaura dados + configuração para o cenário conhecido. */
  async reset() {
    resetConfig();
    await resetDb();
    blockSockets(false);
  },
  setScenario: (s: Scenario) => setScenario(s),
  setPayment: (p: PaymentMode) => setPayment(p),
  failNext: (key: string, times = 1) => failNext(key, times),
  expireSessions: () => expireAllSessions(),
  /** Muda preço/estoque e emite `nft.updated` (versão incrementada). */
  patchNft: (id: string, patch: { priceEth?: string; stock?: Record<string, number> }) => {
    patchNft(id, patch);
  },
  settleOrder: (id: string) => settleOrder(id),
  /** Reemite eventos já enviados (duplicatas) ou fabrica um evento antigo. */
  replayLast: (n = 1) => recentEvents().slice(-n).forEach((e) => dispatch(e)),
  emitRaw: (event: RealtimeEvent) => dispatch(event),
  publishRaw: (event: RealtimeEvent) => publish(event),
  disconnectSockets: (block = false) => disconnectSockets(block),
  allowSockets: () => blockSockets(false),
  socketCount: () => connectedSockets(),
  orders: () => db().orders.map((o) => ({ id: o.id, status: o.status, version: o.version })),
  save: () => commit(),
};

export type MockControl = typeof control;
declare global {
  interface Window {
    __kurioMock?: MockControl;
  }
}
