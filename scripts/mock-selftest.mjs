// Verificação da camada de mocks fora do navegador: REST (axios) + Socket.IO (socket.io-client) sobre MSW.
// Uso: npm run mocks:selftest
import assert from "node:assert/strict";
import axios from "axios";
import { setupServer } from "msw/node";

// Em Node não há `location`: o MSW precisa dele para resolver os caminhos relativos (/api/...).
globalThis.location = new URL("http://localhost:5173/");

const { handlers } = await import("../src/mocks/handlers.ts");
const { socketHandlers } = await import("../src/mocks/socket.ts");
const { initDb, resetDb } = await import("../src/mocks/db.ts");
const { control } = await import("../src/mocks/control.ts");
const { setScenario, setPayment, resetConfig } = await import("../src/mocks/scenarios.ts");

const ORIGIN = "http://localhost:5173";
const http = axios.create({ baseURL: `${ORIGIN}/api`, validateStatus: () => true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

await initDb();
const server = setupServer(...handlers, ...socketHandlers);
server.listen({ onUnhandledRequest: "bypass" });
// O engine.io-client captura `globalThis.WebSocket` ao ser importado: precisa vir DEPOIS do MSW interceptar (igual ao navegador).
const { io } = await import("socket.io-client");
const { WebSocket: BrowserWebSocket } = await import("engine.io-client");

const login = async (email, password) => {
  const r = await http.post("/auth/login", { email, password });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`);
  return { token: r.data.token, auth: { Authorization: `Bearer ${r.data.token}` } };
};
const connect = (token) =>
  new Promise((resolve, reject) => {
    const events = [];
    const s = io("wss://realtime.kurio.mock", { query: { token }, reconnection: false,
      // Em Node o socket.io-client usaria o pacote `ws` (não interceptável pelo MSW): força o transporte baseado
      // no WebSocket global, que é o mesmo caminho usado no navegador.
      transports: [BrowserWebSocket] });
    s.on("nft.updated", (e) => events.push(e));
    s.on("order.updated", (e) => events.push(e));
    s.on("connect", () => resolve({ s, events }));
    s.on("connect_error", reject);
  });

const connectWallet = (auth, network = "ethereum") => http.post("/wallets/connection", { walletId: "primary", network }, { headers: auth });
const quoteBody = (q, extra = {}) => ({
  quoteToken: q.token, couponCode: null, walletType: "metamask", network: "ethereum", collectorName: "Ana", collectorEmail: "ana@kurio.test", ...extra,
});

console.log("REST");
await test("catálogo filtra, ordena e pagina", async () => {
  const r = await http.get("/nfts", { params: { tab: "all", sort: "price-asc", page: 1, network: "polygon" } });
  assert.equal(r.status, 200);
  assert.ok(r.data.items.every((n) => n.network === "polygon"));
  const prices = r.data.items.map((n) => Number(n.priceEth));
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal((await http.get("/nfts/nao-existe")).status, 404);
});

await test("cadastro: validação, conflito e sucesso", async () => {
  assert.equal((await http.post("/auth/register", { username: "", email: "x", password: "1" })).status, 422);
  const conflict = await http.post("/auth/register", { username: "ana", email: "ana@kurio.test", password: "Senha@123" });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.code, "email_conflict");
  const ok = await http.post("/auth/register", { username: "Carla", email: "carla@kurio.test", password: "Senha@789" });
  assert.equal(ok.status, 201);
  assert.equal((await http.get("/auth/session", { headers: { Authorization: `Bearer ${ok.data.token}` } })).status, 200);
});

await test("login inválido e sessão sem token", async () => {
  assert.equal((await http.post("/auth/login", { email: "ana@kurio.test", password: "Errada@1" })).data.code, "invalid_credentials");
  assert.equal((await http.get("/favorites")).status, 401);
});

await test("carrinho de visitante é mantido e mesclado ao autenticar", async () => {
  const guest = { "X-Guest-Id": "g1" };
  const add = await http.post("/cart/items", { nftId: "emerald-ape-042", edition: "1/50", quantity: 2 }, { headers: guest });
  assert.equal(add.status, 201);
  assert.equal((await http.get("/cart", { headers: guest })).data.count, 2);
  const { auth } = await login("bruno@kurio.test", "Senha@456");
  const merged = await http.post("/cart/merge", { guestId: "g1" }, { headers: auth });
  assert.equal(merged.data.count, 2);
  assert.equal((await http.get("/cart", { headers: guest })).data.count, 0);
  assert.equal((await http.get("/cart", { headers: auth })).data.count, 2);
});

await test("limites de quantidade/estoque", async () => {
  const { auth } = await login("ana@kurio.test", "Senha@123");
  const over = await http.post("/cart/items", { nftId: "emerald-ape-042", edition: "1/1", quantity: 3 }, { headers: auth });
  assert.equal(over.status, 409);
  const soldOut = await http.post("/cart/items", { nftId: "violet-nomad-314", edition: "1/1", quantity: 1 }, { headers: auth });
  assert.equal(soldOut.status, 409);
});

await test("cupom: válido, inválido e expirado", async () => {
  const { auth } = await login("ana@kurio.test", "Senha@123");
  await http.post("/cart/items", { nftId: "golden-beat-207", edition: "1/50", quantity: 1 }, { headers: auth });
  const ok = await http.post("/quote", { couponCode: "kurio10" }, { headers: auth });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.discountEth, "0.099");
  assert.equal((await http.post("/quote", { couponCode: "NOPE" }, { headers: auth })).data.code, "coupon_invalid");
  assert.equal((await http.post("/quote", { couponCode: "EXPIRADO" }, { headers: auth })).data.code, "coupon_expired");
  await http.delete("/cart/items/golden-beat-207", { params: { edition: "1/50" }, headers: auth });
});

console.log("Pedidos + Socket.IO");
await resetDb();
resetConfig();
await test("compra completa com idempotência, eventos e isolamento por usuário", async () => {
  const ana = await login("ana@kurio.test", "Senha@123");
  const bruno = await login("bruno@kurio.test", "Senha@456");
  const sAna = await connect(ana.token);
  const sBruno = await connect(bruno.token);

  await http.post("/cart/items", { nftId: "emerald-ape-042", edition: "1/50", quantity: 2 }, { headers: ana.auth });
  await http.post("/cart/items", { nftId: "golden-beat-207", edition: "ABERTA", quantity: 1 }, { headers: ana.auth });
  const q = (await http.post("/quote", {}, { headers: ana.auth })).data;
  assert.equal(q.subtotalEth, "3.37");
  assert.equal(q.totalEth, "3.386");

  const noWallet = await http.post("/orders", quoteBody(q), { headers: { ...ana.auth, "Idempotency-Key": "k-0" } });
  assert.equal(noWallet.data.code, "wallet_not_connected", "pedido exige carteira conectada");
  assert.equal((await connectWallet(ana.auth)).status, 200);
  const key = { ...ana.auth, "Idempotency-Key": "k-1" };
  const first = await http.post("/orders", quoteBody(q), { headers: key });
  assert.equal(first.status, 201);
  assert.equal(first.data.status, "pending");
  const again = await http.post("/orders", quoteBody(q), { headers: key });
  assert.equal(again.status, 200);
  assert.equal(again.data.id, first.data.id, "mesma chave recupera o mesmo pedido");
  const reuse = await http.post("/orders", quoteBody(q, { collectorName: "Outro" }), { headers: key });
  assert.equal(reuse.status, 409);
  assert.equal(reuse.data.code, "idempotency_conflict");
  const other = await http.post("/orders", quoteBody(q), { headers: { ...ana.auth, "Idempotency-Key": "k-2" } });
  assert.equal(other.status, 409, "outro pedido enquanto há um pendente é recusado");

  await sleep(1900);
  const done = await http.get(`/orders/${first.data.id}`, { headers: ana.auth });
  assert.equal(done.data.status, "confirmed");
  assert.match(done.data.txHash, /^0x[0-9A-F]{4}\.\.\.[0-9A-F]{4}$/i);
  assert.equal(done.data.totalEth, "3.386");
  assert.equal((await http.get("/cart", { headers: ana.auth })).data.count, 0, "itens comprados saem do carrinho");
  assert.equal((await http.get(`/orders/${first.data.id}`, { headers: bruno.auth })).status, 403);

  const types = sAna.events.map((e) => e.type);
  assert.ok(types.includes("order.updated") && types.includes("nft.updated"), `eventos: ${types}`);
  const orderEvents = sAna.events.filter((e) => e.type === "order.updated");
  assert.deepEqual(orderEvents.map((e) => e.version), [1, 2]);
  assert.equal(new Set(sAna.events.map((e) => e.id)).size, sAna.events.length, "ids estáveis e únicos");
  assert.ok(!sBruno.events.some((e) => e.type === "order.updated"), "Bruno não recebe eventos do pedido da Ana");
  assert.ok(sBruno.events.some((e) => e.type === "nft.updated"), "nft.updated é público");
  sAna.s.close();
  sBruno.s.close();
});

await test("preço muda durante o checkout: evento + 409 quote_changed", async () => {
  await resetDb();
  const ana = await login("ana@kurio.test", "Senha@123");
  const { s, events } = await connect(ana.token);
  await http.post("/cart/items", { nftId: "ivory-baron-088", edition: "ABERTA", quantity: 1 }, { headers: ana.auth });
  const q = (await http.post("/quote", {}, { headers: ana.auth })).data;
  control.patchNft("ivory-baron-088", { priceEth: "2.00" });
  await sleep(150);
  const ev = events.find((e) => e.type === "nft.updated" && e.resourceId === "ivory-baron-088");
  assert.equal(ev.payload.priceEth, "2");
  assert.equal(ev.version, 2);
  await connectWallet(ana.auth);
  const stale = await http.post("/orders", quoteBody(q), { headers: { ...ana.auth, "Idempotency-Key": "k-3" } });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, "quote_changed");
  assert.equal(stale.data.details.quote.totalEth, "2.016");
  s.close();
});

await test("pagamento recusado e cenário sold-out", async () => {
  await resetDb();
  setPayment("decline");
  const ana = await login("ana@kurio.test", "Senha@123");
  await http.post("/cart/items", { nftId: "golden-beat-207", edition: "ABERTA", quantity: 2 }, { headers: ana.auth });
  const q = (await http.post("/quote", {}, { headers: ana.auth })).data;
  await connectWallet(ana.auth);
  const o = await http.post("/orders", quoteBody(q), { headers: { ...ana.auth, "Idempotency-Key": "k-4" } });
  await sleep(1900);
  const done = (await http.get(`/orders/${o.data.id}`, { headers: ana.auth })).data;
  assert.equal(done.status, "declined");
  assert.equal((await http.get("/cart", { headers: ana.auth })).data.count, 2, "falha preserva os itens");
  setPayment("confirm");
  setScenario("sold-out");
  const q2 = (await http.post("/quote", {}, { headers: ana.auth })).data;
  await connectWallet(ana.auth);
  const so = await http.post("/orders", quoteBody(q2), { headers: { ...ana.auth, "Idempotency-Key": "k-5" } });
  assert.equal(so.status, 409);
  assert.equal(so.data.code, "availability_conflict");
  resetConfig();
});

await test("sessão expirada: 401 session_expired", async () => {
  await resetDb();
  const ana = await login("ana@kurio.test", "Senha@123");
  control.expireSessions();
  const r = await http.get("/favorites", { headers: ana.auth });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, "session_expired");
});

await test("desconexão do socket e retomada do pedido pendente via REST", async () => {
  await resetDb();
  const ana = await login("ana@kurio.test", "Senha@123");
  const { s } = await connect(ana.token);
  await http.post("/cart/items", { nftId: "cosmic-bloom-118", edition: "ABERTA", quantity: 1 }, { headers: ana.auth });
  const q = (await http.post("/quote", {}, { headers: ana.auth })).data;
  await connectWallet(ana.auth);
  const o = await http.post("/orders", quoteBody(q), { headers: { ...ana.auth, "Idempotency-Key": "k-6" } });
  const closed = new Promise((r) => s.on("disconnect", r));
  control.disconnectSockets(true);
  await closed;
  const pending = (await http.get("/orders/pending", { headers: ana.auth })).data.order;
  assert.equal(pending.id, o.data.id);
  await sleep(1900);
  assert.equal((await http.get(`/orders/${o.data.id}`, { headers: ana.auth })).data.status, "confirmed");
  assert.equal((await http.get("/orders/pending", { headers: ana.auth })).data.order, null);
  control.allowSockets();
});

console.log("Cenários de rede");
await test("offline, 5xx, 4xx, vazio", async () => {
  setScenario("http-5xx");
  assert.equal((await http.get("/nfts")).status, 503);
  setScenario("http-4xx");
  assert.equal((await http.get("/nfts")).status, 400);
  setScenario("empty");
  assert.equal((await http.get("/nfts")).data.total, 0);
  setScenario("offline");
  await assert.rejects(http.get("/nfts"));
  setScenario("wallet-refused");
  const refused = await connectWallet((await login("ana@kurio.test", "Senha@123")).auth);
  assert.equal(refused.status, 403);
  assert.equal(refused.data.code, "wallet_refused");
  setScenario("signup-conflict");
  assert.equal((await http.post("/auth/register", { username: "Zed", email: "zed@kurio.test", password: "Senha@789" })).status, 409);
  resetConfig();
});

server.close();
console.log(`\n${passed} verificações passaram.`);
process.exit(0);
