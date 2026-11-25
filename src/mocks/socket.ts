import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { identify, subscribeEvents } from "./db";
import type { RealtimeEvent } from "../shared/api/types";

/**
 * Transporte Socket.IO simulado na camada de rede (MSW `ws.link` + @mswjs/socket.io-binding).
 * O app usa o `socket.io-client` real (transporte WebSocket); nenhum setter/cache é chamado diretamente.
 *
 * Limitações documentadas (ver README):
 *  - o servidor simulado vive em um host fictício (`wss://realtime.kurio.mock`): o MSW normaliza `/socket.io/`
 *    e o link por caminho colidiria com o WebSocket de HMR do Vite; o host dedicado evita isso;
 *  - só transporte `websocket` (sem long-polling) e só o namespace `/`;
 *  - sem rooms/broadcast nativos: o isolamento por usuário é feito aqui, filtrando por `userId`;
 *  - o binding não implementa o ping do Engine.IO: enviamos `2` periodicamente para o cliente não expirar;
 *  - a identidade vem do token na query da conexão (`?token=`), não do pacote CONNECT.
 */
export const MOCK_SOCKET_URL = "wss://realtime.kurio.mock";
const link = ws.link(MOCK_SOCKET_URL);
const PING_MS = 20_000;

type Connection = Parameters<Parameters<typeof link.addEventListener<"connection">>[1]>[0];
interface Entry { connection: Connection; io: ReturnType<typeof toSocketIo>; userId: string | null; token: string | null; ping: ReturnType<typeof setInterval> }

const entries = new Set<Entry>();
let blocked = false;
const recent: RealtimeEvent[] = [];

export const connectedSockets = () => entries.size;
/** Fecha todas as conexões (simula queda). Com `block`, recusa novas conexões até `blockSockets(false)`. */
export function disconnectSockets(block = false) {
  blocked = block;
  for (const e of [...entries]) e.connection.client.close();
}
export function blockSockets(value: boolean) {
  blocked = value;
}
export function dropSessionSockets(token: string) {
  for (const e of [...entries]) if (e.token === token) e.connection.client.close();
}
export const recentEvents = () => [...recent];

/** Envia um evento (inclusive duplicado/antigo) aos clientes autorizados a recebê-lo. */
export function dispatch(event: RealtimeEvent) {
  for (const e of entries) {
    if (event.userId && event.userId !== e.userId) continue;
    e.io.client.emit(event.type, event);
  }
}

subscribeEvents((event) => {
  recent.push(event);
  if (recent.length > 50) recent.shift();
  dispatch(event);
});

export const socketHandlers = [
  link.addEventListener("connection", (connection) => {
    if (blocked) {
      connection.client.close();
      return;
    }
    const io = toSocketIo(connection);
    const token = new URL(connection.client.url).searchParams.get("token");
    const identity = identify(token ? `Bearer ${token}` : null);
    const entry: Entry = {
      connection,
      io,
      token,
      userId: identity.kind === "user" ? identity.user.id : null,
      ping: setInterval(() => connection.client.send("2"), PING_MS),
    };
    entries.add(entry);
    connection.client.addEventListener("close", () => {
      clearInterval(entry.ping);
      entries.delete(entry);
    });
  }),
];
