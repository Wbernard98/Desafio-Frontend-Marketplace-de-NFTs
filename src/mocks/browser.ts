import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { socketHandlers } from "./socket";
import { control } from "./control";
import { initDb } from "./db";
import { loadConfigFromEnvironment } from "./scenarios";

export const worker = setupWorker(...handlers, ...socketHandlers);

/** Ativa a camada de mocks (REST + Socket.IO). Chamado antes de renderizar o app. */
export async function startMocks() {
  loadConfigFromEnvironment();
  await initDb();
  window.__kurioMock = control;
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}
