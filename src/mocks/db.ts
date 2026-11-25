import Decimal from "decimal.js";
import { nftFixtures } from "./fixtures";
import { config } from "./scenarios";
import type { Nft } from "../features/catalog/types";
import type {
  ApiErrorBody,
  CartLine,
  CartLineView,
  CreateOrderBody,
  WalletConnection,
  Order,
  OrderStatus,
  Quote,
  QuoteIssue,
  RealtimeEvent,
  User,
  WalletsResponse,
} from "../shared/api/types";

/** Erro de domínio traduzido em resposta HTTP pelos handlers. */
export class DomainError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}
export const fail = (status: number, code: ApiErrorBody["code"], message: string, fields?: Record<string, string>, details?: unknown) =>
  new DomainError(status, { code, message, fields, details });

export interface UserRecord extends User {
  username: string;
  salt: string;
  passwordHash: string;
  avatarUrl: string | null;
  favorites: string[];
  wallets: WalletsResponse;
  /** Conexão de carteira simulada (por usuário). */
  connection: WalletConnection | null;
}
export interface SessionRecord { token: string; userId: string; expiresAt: number }
export interface OrderRecord extends Order {
  userId: string;
  idempotencyKey: string;
  bodyHash: string;
  settleAt: number;
  willDecline: boolean;
}
interface DbState {
  v: 1;
  nfts: Nft[];
  users: UserRecord[];
  sessions: SessionRecord[];
  carts: Record<string, CartLine[]>;
  orders: OrderRecord[];
  eventSeq: number;
  orderSeq: number;
}

/* ------------------------------ persistência ------------------------------ */

// v2: fixtures passaram a ter imagens; mudar a versão força o reseed do banco salvo no navegador
const DB_KEY = "kurio:mock-db:v2";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SETTLE_DELAY_MS = 1500;

let memory: string | null = null;
const store = {
  get: () => {
    try {
      return globalThis.localStorage ? globalThis.localStorage.getItem(DB_KEY) : memory;
    } catch {
      return memory;
    }
  },
  set: (value: string) => {
    memory = value;
    try {
      globalThis.localStorage?.setItem(DB_KEY, value);
    } catch {
      /* cota excedida: o estado em memória continua válido */
    }
  },
  clear: () => {
    memory = null;
    try {
      globalThis.localStorage?.removeItem(DB_KEY);
    } catch {
      /* ignora */
    }
  },
};

let state: DbState | null = null;
export const db = (): DbState => {
  if (!state) throw new Error("MSW db não inicializado: chame initDb() antes.");
  return state;
};
export const commit = () => {
  if (state) store.set(JSON.stringify(state));
};

/* --------------------------------- util ---------------------------------- */

export function fnv(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const newToken = () => `tok_${globalThis.crypto.randomUUID()}`;
const emptyWallet = (id: "primary" | "secondary") => ({
  id, nickname: "", network: "" as const, address: "", type: "" as const, ensName: "", ensSuffix: ".eth" as const, referralCode: "",
});
export const emptyWallets = (): WalletsResponse => ({ primary: emptyWallet("primary"), secondary: null });

/** Credenciais fictícias (documentadas no README). */
export const SEED_USERS = [
  { id: "u-ana", email: "ana@kurio.test", name: "Ana Colecionadora", username: "ana_c", password: "Senha@123" },
  { id: "u-bruno", email: "bruno@kurio.test", name: "Bruno Mendes", username: "bruno_m", password: "Senha@456" },
] as const;

async function seed(): Promise<DbState> {
  const users: UserRecord[] = [];
  for (const u of SEED_USERS) {
    const salt = `salt-${u.id}`;
    users.push({
      id: u.id, email: u.email, name: u.name, username: u.username, salt,
      passwordHash: await hashPassword(u.password, salt), avatarUrl: null, favorites: [], connection: null,
      wallets:
        u.id === "u-ana"
          ? {
              primary: { id: "primary", nickname: "Carteira Principal", network: "ethereum", address: "0x7A42c0ffee00000000000000000000000019E8aa", type: "metamask", ensName: "ana_c", ensSuffix: ".eth", referralCode: "KURIO-ANA" },
              secondary: null,
            }
          : emptyWallets(),
    });
  }
  return {
    v: 1,
    nfts: structuredClone(nftFixtures),
    users,
    sessions: [],
    carts: {},
    orders: [],
    eventSeq: 0,
    orderSeq: 0,
  };
}

export async function initDb(): Promise<void> {
  if (state) return;
  const raw = store.get();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.v === 1) {
        state = parsed;
      }
    } catch {
      /* cai no seed */
    }
  }
  if (!state) {
    state = await seed();
    commit();
  }
  for (const order of state.orders) if (order.status === "pending") scheduleSettle(order.id);
}

/** Restaura integralmente o cenário conhecido (dados + configuração). */
export async function resetDb(): Promise<void> {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  store.clear();
  state = null;
  await initDb();
}

/* -------------------------------- eventos -------------------------------- */

type Listener = (event: RealtimeEvent) => void;
const listeners = new Set<Listener>();
export const subscribeEvents = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function publish(event: RealtimeEvent) {
  for (const l of listeners) l(event);
}
function nextEventId() {
  const s = db();
  s.eventSeq += 1;
  return `evt_${s.eventSeq}`;
}
export function emitNftUpdated(nft: Nft) {
  publish({
    id: nextEventId(), type: "nft.updated", resource: "nft", resourceId: nft.id, version: nft.version, userId: null,
    ts: new Date().toISOString(),
    payload: { priceEth: nft.priceEth, originalPriceEth: nft.originalPriceEth, stock: { ...nft.stock }, available: nft.available },
  });
}
export function emitOrderUpdated(order: OrderRecord) {
  publish({
    id: nextEventId(), type: "order.updated", resource: "order", resourceId: order.id, version: order.version, userId: order.userId,
    ts: new Date().toISOString(), payload: { order: toOrder(order) },
  });
}

/* ---------------------------------- NFTs --------------------------------- */

export const findNft = (id: string) => db().nfts.find((n) => n.id === id);

/** Altera preço/estoque do NFT, incrementa a versão e notifica via Socket.IO. */
export function patchNft(id: string, patch: { priceEth?: string; stock?: Record<string, number> }) {
  const nft = findNft(id);
  if (!nft) throw fail(404, "not_found", "NFT não encontrado.");
  if (patch.priceEth !== undefined) nft.priceEth = new Decimal(patch.priceEth).toFixed();
  if (patch.stock) nft.stock = { ...nft.stock, ...patch.stock };
  nft.available = Object.values(nft.stock).reduce((a, b) => a + b, 0);
  nft.version += 1;
  commit();
  emitNftUpdated(nft);
  return nft;
}

/* --------------------------- sessão / identidade -------------------------- */

export function createSession(userId: string): SessionRecord {
  const session = { token: newToken(), userId, expiresAt: Date.now() + SESSION_TTL_MS };
  db().sessions.push(session);
  commit();
  return session;
}
export function expireAllSessions() {
  for (const s of db().sessions) s.expiresAt = 0;
  commit();
}
export type Identity =
  | { kind: "user"; user: UserRecord; session: SessionRecord }
  | { kind: "guest" }
  | { kind: "expired" }
  | { kind: "invalid" };

export function identify(authorization: string | null): Identity {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { kind: "guest" };
  const session = db().sessions.find((s) => s.token === token);
  if (!session) return { kind: "invalid" };
  if (session.expiresAt <= Date.now()) {
    db().sessions = db().sessions.filter((s) => s !== session);
    commit();
    return { kind: "expired" };
  }
  const user = db().users.find((u) => u.id === session.userId);
  return user ? { kind: "user", user, session } : { kind: "invalid" };
}
export const toUser = (u: UserRecord): User => ({ id: u.id, email: u.email, name: u.name });

/* -------------------------------- carrinho -------------------------------- */

export const cartKey = (id: Identity, guestId: string | null) =>
  id.kind === "user" ? `user:${id.user.id}` : `guest:${guestId ?? "anon"}`;
export const getCart = (key: string): CartLine[] => (db().carts[key] ??= []);

export function viewLine(line: CartLine): CartLineView {
  const nft = findNft(line.nftId);
  const unit = nft?.priceEth ?? line.addedPriceEth;
  return {
    ...line,
    name: nft?.name ?? line.nftId,
    tokenId: nft?.tokenId ?? "",
    imageUrl: nft?.imageUrl ?? null,
    imageAlt: nft?.imageAlt ?? "",
    placeholderColor: nft?.placeholderColor ?? "#c9b27a",
    unitPriceEth: unit,
    lineTotalEth: new Decimal(unit).times(line.quantity).toFixed(),
    available: nft?.stock[line.edition] ?? 0,
    nftVersion: nft?.version ?? 0,
    priceChanged: !new Decimal(unit).eq(line.addedPriceEth),
  };
}
export const countOf = (lines: CartLine[]) => lines.reduce((a, l) => a + l.quantity, 0);

/** Mescla o carrinho do visitante no carrinho do usuário ao autenticar. */
export function mergeCarts(fromKey: string, toKey: string) {
  const from = getCart(fromKey);
  const to = getCart(toKey);
  for (const line of from) {
    const nft = findNft(line.nftId);
    const cap = Math.min(nft?.stock[line.edition] ?? 0, nft?.maxPerOrder ?? 10);
    const existing = to.find((l) => l.nftId === line.nftId && l.edition === line.edition);
    if (existing) existing.quantity = Math.min(cap || existing.quantity, existing.quantity + line.quantity);
    else to.push({ ...line, quantity: Math.min(line.quantity, cap || line.quantity) });
  }
  db().carts[fromKey] = [];
  commit();
}

/* --------------------------------- cotação -------------------------------- */

const COUPONS: Record<string, string> = { KURIO10: "0.10", WELCOME5: "0.05" };
const EXPIRED_COUPONS = new Set(["EXPIRADO", "BLACKFRIDAY25"]);
export const NETWORK_FEE = "0.016";

export function buildQuote(lines: CartLine[], couponCodeRaw: string | null | undefined): Quote {
  const couponCode = couponCodeRaw?.trim().toUpperCase() || null;
  let rate = "0";
  if (couponCode) {
    if (EXPIRED_COUPONS.has(couponCode)) throw fail(422, "coupon_expired", "Este cupom expirou.");
    if (!(couponCode in COUPONS)) throw fail(422, "coupon_invalid", "Código promocional inválido.");
    rate = COUPONS[couponCode];
  }
  const views = lines.map(viewLine);
  const issues: QuoteIssue[] = [];
  for (const l of views) {
    const nft = findNft(l.nftId);
    if (l.available === 0) issues.push({ nftId: l.nftId, edition: l.edition, kind: "sold_out", message: `${l.name} (${l.edition}) esgotou.`, available: 0 });
    else if (l.quantity > l.available || l.quantity > (nft?.maxPerOrder ?? 10))
      issues.push({ nftId: l.nftId, edition: l.edition, kind: "insufficient_stock", message: `Só há ${l.available} unidade(s) de ${l.name} (${l.edition}).`, available: l.available });
    else if (l.priceChanged)
      issues.push({ nftId: l.nftId, edition: l.edition, kind: "price_changed", message: `O preço de ${l.name} mudou para ${new Decimal(l.unitPriceEth).toFixed(2)} ETH.` });
  }
  const subtotal = views.reduce((a, l) => a.plus(l.lineTotalEth), new Decimal(0));
  const discount = subtotal.times(rate).toDecimalPlaces(6, Decimal.ROUND_DOWN);
  const fee = new Decimal(views.length > 0 ? NETWORK_FEE : "0");
  const total = Decimal.max(0, subtotal.minus(discount).plus(fee));
  const token = `q_${fnv(JSON.stringify([views.map((l) => [l.nftId, l.edition, l.quantity, l.unitPriceEth, l.nftVersion]), couponCode, total.toFixed()]))}`;
  return {
    token, lines: views, couponCode,
    subtotalEth: subtotal.toFixed(), discountEth: discount.toFixed(), networkFeeEth: fee.toFixed(), totalEth: total.toFixed(),
    issues, generatedAt: new Date().toISOString(),
  };
}
export const blockingIssues = (q: Quote) => q.issues.filter((i) => i.kind !== "price_changed");

/* --------------------------------- pedidos -------------------------------- */

const WALLET_LABEL = { metamask: "MetaMask", coinbase: "Coinbase Wallet", walletconnect: "WalletConnect" } as const;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const toOrder = (o: OrderRecord): Order => {
  const order: Record<string, unknown> = { ...o };
  for (const internal of ["userId", "idempotencyKey", "bodyHash", "settleAt", "willDecline"]) delete order[internal];
  return structuredClone(order) as unknown as Order;
};
export const bodyHashOf = (b: CreateOrderBody) => fnv(JSON.stringify([b.quoteToken, b.couponCode, b.walletType, b.network, b.collectorName, b.collectorEmail, b.notes ?? ""]));

export function createOrder(user: UserRecord, key: string, body: CreateOrderBody, quote: Quote): OrderRecord {
  const s = db();
  s.orderSeq += 1;
  const id = `ord_${String(s.orderSeq).padStart(4, "0")}`;
  const order: OrderRecord = {
    id, status: "pending", version: 1, txHash: null, createdAt: new Date().toISOString(),
    walletName: WALLET_LABEL[body.walletType], network: body.network, collectorName: body.collectorName,
    items: quote.lines.map((l) => ({
      nftId: l.nftId, name: l.name, tokenId: l.tokenId, edition: l.edition, quantity: l.quantity,
      unitPriceEth: l.unitPriceEth, lineTotalEth: l.lineTotalEth, imageUrl: l.imageUrl, imageAlt: l.imageAlt, placeholderColor: l.placeholderColor,
    })),
    couponCode: quote.couponCode, subtotalEth: quote.subtotalEth, discountEth: quote.discountEth,
    networkFeeEth: quote.networkFeeEth, totalEth: quote.totalEth,
    userId: user.id, idempotencyKey: key, bodyHash: bodyHashOf(body),
    settleAt: Date.now() + SETTLE_DELAY_MS, willDecline: config.payment === "decline",
  };
  s.orders.push(order);
  commit();
  emitOrderUpdated(order);
  scheduleSettle(id);
  return order;
}

function scheduleSettle(orderId: string) {
  if (timers.has(orderId)) return;
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) return;
  timers.set(orderId, setTimeout(() => settleOrder(orderId), Math.max(0, order.settleAt - Date.now())));
}

/** Transição terminal (pending -> confirmed | declined). Pedidos terminais não mudam mais. */
export function settleOrder(orderId: string) {
  const t = timers.get(orderId);
  if (t) clearTimeout(t);
  timers.delete(orderId);
  const order = db().orders.find((o) => o.id === orderId);
  if (!order || order.status !== "pending") return order;

  let status: OrderStatus = order.willDecline ? "declined" : "confirmed";
  let reason: string | undefined = order.willDecline ? "A carteira recusou a assinatura da transação." : undefined;

  if (status === "confirmed") {
    const short = order.items.find((i) => (findNft(i.nftId)?.stock[i.edition] ?? 0) < i.quantity);
    if (short) {
      status = "declined";
      reason = `${short.name} (${short.edition}) não tem mais estoque suficiente.`;
    }
  }

  order.status = status;
  order.version += 1;
  if (status === "declined") order.declineReason = reason;
  if (status === "confirmed") {
    order.txHash = `0x${fnv(order.id + "a").slice(0, 4)}...${fnv(order.id + "b").slice(-4)}`.toUpperCase().replace("0X", "0x");
    const cart = getCart(`user:${order.userId}`);
    for (const item of order.items) {
      const nft = findNft(item.nftId);
      if (nft) {
        nft.stock[item.edition] = Math.max(0, (nft.stock[item.edition] ?? 0) - item.quantity);
        nft.available = Object.values(nft.stock).reduce((a, b) => a + b, 0);
        nft.version += 1;
      }
      // remove do carrinho apenas o que foi comprado
      const line = cart.find((l) => l.nftId === item.nftId && l.edition === item.edition);
      if (line) line.quantity -= item.quantity;
    }
    db().carts[`user:${order.userId}`] = cart.filter((l) => l.quantity > 0);
  }
  commit();
  emitOrderUpdated(order);
  if (status === "confirmed") for (const item of order.items) { const n = findNft(item.nftId); if (n) emitNftUpdated(n); }
  return order;
}

/** Liquida pedidos cujo prazo já passou (ex.: a aba foi recarregada e o timer morreu). */
export function settleDue() {
  for (const o of db().orders) if (o.status === "pending" && o.settleAt <= Date.now()) settleOrder(o.id);
}
