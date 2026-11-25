import { http, HttpResponse, delay } from "msw";
import Decimal from "decimal.js";
import {
  DomainError, blockingIssues, bodyHashOf, buildQuote, cartKey, commit, countOf, createOrder, createSession, db, expireAllSessions,
  fail, findNft, fnv, getCart, hashPassword, identify, mergeCarts, patchNft, settleDue, toOrder, toUser, viewLine, emptyWallets,
  type Identity, type UserRecord,
} from "./db";
import { buildFacets } from "./fixtures";
import { config, consumeFailure } from "./scenarios";
import { dropSessionSockets } from "./socket";
import { EDITIONS, type Nft } from "../features/catalog/types";
import type {
  AddCartBody, AuthResponse, ChangePasswordBody, ConnectWalletBody, CreateOrderBody, LoginBody, Profile, QuoteBody, RegisterBody, UpdateCartBody,
  UpdateProfileBody, UpdateWalletsBody, Wallet,
} from "../shared/api/types";

const PAGE_SIZE = 6;
const API = "/api";
const HTTP_TIMEOUT = Number(import.meta.env?.VITE_HTTP_TIMEOUT_MS ?? 8000);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PW = (p: string) => p.length >= 6 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9À-ÿ\s]/.test(p);

/* ------------------------------- utilitários ------------------------------ */

const errorResponse = (e: DomainError) => HttpResponse.json(e.body, { status: e.status });

/** Condições de rede do cenário ativo: latência, offline e erros HTTP. */
async function gate(request: Request, opts: { kind?: "auth" | "data" | "catalog"; failKey?: string } = {}) {
  const { scenario } = config;
  if (scenario === "offline") return HttpResponse.error();
  if (scenario === "slow") await delay(2500);
  else if (scenario === "variable-latency") await delay([900, 120, 600, 40][parseInt(fnv(request.url), 16) % 4]);
  else await delay(80);
  if (opts.failKey && consumeFailure(opts.failKey)) return HttpResponse.json({ code: "unavailable", message: "Serviço indisponível. Tente novamente." }, { status: 503 });
  if (scenario === "http-5xx" && opts.kind !== "auth") return HttpResponse.json({ code: "internal_error", message: "Erro interno do servidor." }, { status: 503 });
  if (scenario === "http-4xx" && opts.kind === "catalog") return HttpResponse.json({ code: "validation_error", message: "Requisição inválida." }, { status: 400 });
  return null;
}

type UserIdentity = Extract<Identity, { kind: "user" }>;

function identifyRequest(request: Request): Identity {
  if (config.scenario === "session-expired" && !config.fired.sessionExpired && request.headers.get("Authorization")) {
    config.fired.sessionExpired = true;
    expireAllSessions();
  }
  return identify(request.headers.get("Authorization"));
}
function sessionError(id: Identity): DomainError | null {
  if (id.kind === "expired") return fail(401, "session_expired", "Sua sessão expirou. Entre novamente para continuar.");
  if (id.kind === "invalid") return fail(401, "session_invalid", "Sessão inválida. Entre novamente.");
  return null;
}
function requireUser(request: Request): UserIdentity {
  const id = identifyRequest(request);
  const err = sessionError(id);
  if (err) throw err;
  if (id.kind !== "user") throw fail(401, "session_invalid", "Faça login para continuar.");
  if (config.scenario === "unauthorized") throw fail(403, "forbidden", "Você não tem permissão para acessar este recurso.");
  return id;
}
function optionalIdentity(request: Request): Identity {
  const id = identifyRequest(request);
  const err = sessionError(id);
  if (err) throw err;
  return id;
}
const guestOf = (request: Request) => request.headers.get("X-Guest-Id");

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw fail(422, "validation_error", "Corpo da requisição inválido.");
  }
}

/** Executa um handler traduzindo DomainError em resposta HTTP. */
const guarded =
  (opts: { kind?: "auth" | "data" | "catalog"; failKey?: string }, fn: (ctx: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => Promise<Response> | Response) =>
  async (ctx: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const g = await gate(ctx.request, opts);
    if (g) return g;
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof DomainError) return errorResponse(e);
      throw e;
    }
  };

const profileOf = (u: UserRecord): Profile => ({ displayName: u.name, username: u.username, email: u.email, avatarUrl: u.avatarUrl });

function validateAddress(network: string, address: string) {
  if (network === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
function validateWallet(w: Omit<Wallet, "id">, prefix: string, errors: Record<string, string>) {
  if (!w.nickname?.trim()) errors[`${prefix}.nickname`] = "Informe o apelido da carteira.";
  if (!["ethereum", "polygon", "solana"].includes(w.network)) errors[`${prefix}.network`] = "Selecione uma rede.";
  if (!["metamask", "coinbase", "walletconnect"].includes(w.type)) errors[`${prefix}.type`] = "Selecione o tipo de carteira.";
  if (!w.address?.trim()) errors[`${prefix}.address`] = "Informe o endereço da carteira.";
  else if (!validateAddress(w.network, w.address.trim())) errors[`${prefix}.address`] = "Endereço de carteira inválido.";
}

/* -------------------------------- handlers -------------------------------- */

export const handlers = [
  /* ---------------------------- sessão e conta ---------------------------- */
  http.post(`${API}/auth/register`, guarded({ kind: "auth" }, async ({ request }) => {
    const body = await readJson<RegisterBody>(request);
    const fields: Record<string, string> = {};
    if (!body.username?.trim()) fields.username = "Informe seu nome de usuário.";
    if (!EMAIL_RE.test(body.email?.trim() ?? "")) fields.email = "Informe um endereço de e-mail válido.";
    if (!STRONG_PW(body.password ?? "")) fields.password = "A senha deve ter no mínimo 6 caracteres e incluir letra, número e caractere especial.";
    if (Object.keys(fields).length) throw fail(422, "validation_error", "Revise os campos informados.", fields);
    const email = body.email.trim().toLowerCase();
    if (config.scenario === "signup-conflict" || db().users.some((u) => u.email === email))
      throw fail(409, "email_conflict", "Já existe uma conta com este e-mail.", { email: "Este e-mail já está cadastrado." });
    const id = `u-${fnv(email)}`;
    const salt = `salt-${id}`;
    const user: UserRecord = {
      id, email, name: body.username.trim(), username: body.username.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"), salt,
      passwordHash: await hashPassword(body.password, salt), avatarUrl: null, favorites: [], connection: null, wallets: emptyWallets(),
    };
    db().users.push(user);
    const session = createSession(id);
    return HttpResponse.json<AuthResponse>({ token: session.token, user: toUser(user), expiresAt: new Date(session.expiresAt).toISOString() }, { status: 201 });
  })),

  http.post(`${API}/auth/login`, guarded({ kind: "auth" }, async ({ request }) => {
    const body = await readJson<LoginBody>(request);
    const fields: Record<string, string> = {};
    if (!EMAIL_RE.test(body.email?.trim() ?? "")) fields.email = "Informe um endereço de e-mail válido.";
    if (!body.password || body.password.length < 6) fields.password = "A senha deve ter no mínimo 6 caracteres.";
    if (Object.keys(fields).length) throw fail(422, "validation_error", "Revise os campos informados.", fields);
    const user = db().users.find((u) => u.email === body.email.trim().toLowerCase());
    if (!user || (await hashPassword(body.password, user.salt)) !== user.passwordHash) throw fail(401, "invalid_credentials", "E-mail ou senha incorretos.");
    const session = createSession(user.id);
    return HttpResponse.json<AuthResponse>({ token: session.token, user: toUser(user), expiresAt: new Date(session.expiresAt).toISOString() });
  })),

  http.get(`${API}/auth/session`, guarded({ kind: "auth" }, ({ request }) => {
    const id = requireUser(request);
    return HttpResponse.json({ user: toUser(id.user), expiresAt: new Date(id.session.expiresAt).toISOString() });
  })),

  http.post(`${API}/auth/logout`, guarded({ kind: "auth" }, ({ request }) => {
    const id = identify(request.headers.get("Authorization"));
    if (id.kind === "user") {
      db().sessions = db().sessions.filter((s) => s.token !== id.session.token);
      commit();
      dropSessionSockets(id.session.token);
    }
    return new HttpResponse(null, { status: 204 });
  })),

  /* --------------------------------- NFTs --------------------------------- */
  http.get(`${API}/nfts`, guarded({ kind: "catalog" }, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.toLowerCase();
    const collection = sp.get("collection");
    const network = sp.get("network");
    const min = sp.get("min");
    const max = sp.get("max");
    const tab = sp.get("tab") ?? "all";
    const sort = sp.get("sort") ?? "recent";
    const page = Math.max(1, Number(sp.get("page") ?? 1));

    let items: Nft[] = config.scenario === "empty" ? [] : [...db().nfts];
    if (q) items = items.filter((n) => n.name.toLowerCase().includes(q));
    if (collection) items = items.filter((n) => n.collectionId === collection);
    if (network) items = items.filter((n) => n.network === network);
    if (min) items = items.filter((n) => new Decimal(n.priceEth).gte(min));
    if (max) items = items.filter((n) => new Decimal(n.priceEth).lte(max));
    if (tab === "hot") items = items.filter((n) => n.hot);
    if (tab === "new") items = items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);

    if (sort === "price-asc") items.sort((a, b) => new Decimal(a.priceEth).cmp(b.priceEth));
    else if (sort === "price-desc") items.sort((a, b) => new Decimal(b.priceEth).cmp(a.priceEth));
    else items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return HttpResponse.json({ items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pageSize: PAGE_SIZE, total, totalPages });
  })),

  http.get(`${API}/nfts/:id`, guarded({ kind: "catalog" }, ({ params }) => {
    const nft = findNft(String(params.id));
    if (!nft || config.scenario === "empty") throw fail(404, "not_found", "NFT não encontrado.");
    return HttpResponse.json(nft);
  })),

  http.get(`${API}/facets`, guarded({ kind: "data" }, () => HttpResponse.json(buildFacets(config.scenario === "empty" ? [] : db().nfts)))),

  /* ------------------------------- favoritos ------------------------------ */
  http.get(`${API}/favorites`, guarded({ kind: "data" }, ({ request }) => HttpResponse.json({ nftIds: requireUser(request).user.favorites }))),

  http.put(`${API}/favorites/:nftId`, guarded({ kind: "data", failKey: "favorites" }, ({ request, params }) => {
    const { user } = requireUser(request);
    const id = String(params.nftId);
    if (!findNft(id)) throw fail(404, "not_found", "NFT não encontrado.");
    if (!user.favorites.includes(id)) user.favorites.push(id);
    commit();
    return HttpResponse.json({ nftIds: user.favorites });
  })),

  http.delete(`${API}/favorites/:nftId`, guarded({ kind: "data", failKey: "favorites" }, ({ request, params }) => {
    const { user } = requireUser(request);
    user.favorites = user.favorites.filter((f) => f !== String(params.nftId));
    commit();
    return HttpResponse.json({ nftIds: user.favorites });
  })),

  /* -------------------------------- carrinho ------------------------------- */
  http.get(`${API}/cart`, guarded({ kind: "data" }, ({ request }) => {
    const lines = getCart(cartKey(optionalIdentity(request), guestOf(request)));
    return HttpResponse.json({ lines: lines.map(viewLine), count: countOf(lines) });
  })),

  http.post(`${API}/cart/items`, guarded({ kind: "data", failKey: "cart" }, async ({ request }) => {
    const key = cartKey(optionalIdentity(request), guestOf(request));
    const body = await readJson<AddCartBody>(request);
    const nft = findNft(body.nftId);
    if (!nft) throw fail(404, "not_found", "NFT não encontrado.");
    if (!EDITIONS.includes(body.edition as (typeof EDITIONS)[number]) || !Number.isInteger(body.quantity) || body.quantity < 1)
      throw fail(422, "validation_error", "Quantidade ou edição inválida.", { quantity: "Informe uma quantidade inteira maior que zero." });
    const stock = nft.stock[body.edition] ?? 0;
    if (stock === 0) throw fail(409, "availability_conflict", "Esta edição está esgotada.", undefined, { available: 0 });
    const cart = getCart(key);
    const existing = cart.find((l) => l.nftId === nft.id && l.edition === body.edition);
    const cap = Math.min(stock, nft.maxPerOrder);
    if ((existing?.quantity ?? 0) + body.quantity > cap)
      throw fail(409, "availability_conflict", `Limite de ${cap} unidade(s) para esta edição.`, undefined, { available: cap });
    if (existing) existing.quantity += body.quantity;
    else cart.push({ nftId: nft.id, edition: body.edition, quantity: body.quantity, addedPriceEth: nft.priceEth });
    commit();
    return HttpResponse.json({ lines: cart.map(viewLine), count: countOf(cart) }, { status: 201 });
  })),

  http.patch(`${API}/cart/items/:nftId`, guarded({ kind: "data", failKey: "cart" }, async ({ request, params }) => {
    const key = cartKey(optionalIdentity(request), guestOf(request));
    const edition = new URL(request.url).searchParams.get("edition") ?? "";
    const { quantity } = await readJson<UpdateCartBody>(request);
    const cart = getCart(key);
    const line = cart.find((l) => l.nftId === String(params.nftId) && l.edition === edition);
    if (!line) throw fail(404, "not_found", "Item não encontrado no carrinho.");
    const nft = findNft(line.nftId);
    const cap = Math.min(nft?.stock[edition] ?? 0, nft?.maxPerOrder ?? 10);
    if (!Number.isInteger(quantity) || quantity < 1) throw fail(422, "validation_error", "Quantidade inválida.", { quantity: "Informe uma quantidade inteira maior que zero." });
    if (quantity > cap) throw fail(409, "availability_conflict", `Limite de ${cap} unidade(s) para esta edição.`, undefined, { available: cap });
    line.quantity = quantity;
    commit();
    return HttpResponse.json({ lines: cart.map(viewLine), count: countOf(cart) });
  })),

  http.delete(`${API}/cart/items/:nftId`, guarded({ kind: "data", failKey: "cart" }, ({ request, params }) => {
    const key = cartKey(optionalIdentity(request), guestOf(request));
    const edition = new URL(request.url).searchParams.get("edition") ?? "";
    db().carts[key] = getCart(key).filter((l) => !(l.nftId === String(params.nftId) && l.edition === edition));
    commit();
    const cart = getCart(key);
    return HttpResponse.json({ lines: cart.map(viewLine), count: countOf(cart) });
  })),

  http.post(`${API}/cart/merge`, guarded({ kind: "data" }, async ({ request }) => {
    const { user } = requireUser(request);
    const { guestId } = await readJson<{ guestId: string }>(request);
    mergeCarts(`guest:${guestId}`, `user:${user.id}`);
    const cart = getCart(`user:${user.id}`);
    return HttpResponse.json({ lines: cart.map(viewLine), count: countOf(cart) });
  })),

  http.post(`${API}/cart/acknowledge`, guarded({ kind: "data" }, ({ request }) => {
    const key = cartKey(optionalIdentity(request), guestOf(request));
    const cart = getCart(key);
    for (const l of cart) l.addedPriceEth = findNft(l.nftId)?.priceEth ?? l.addedPriceEth;
    commit();
    return HttpResponse.json({ lines: cart.map(viewLine), count: countOf(cart) });
  })),

  /* --------------------------------- cotação -------------------------------- */
  http.post(`${API}/quote`, guarded({ kind: "data" }, async ({ request }) => {
    const key = cartKey(optionalIdentity(request), guestOf(request));
    const body = await readJson<QuoteBody>(request);
    return HttpResponse.json(buildQuote(getCart(key), body.couponCode));
  })),

  /* --------------------------------- pedidos -------------------------------- */
  http.get(`${API}/orders/pending`, guarded({ kind: "data" }, ({ request }) => {
    const { user } = requireUser(request);
    settleDue();
    const pending = db().orders.filter((o) => o.userId === user.id && o.status === "pending").at(-1);
    return HttpResponse.json({ order: pending ? toOrder(pending) : null });
  })),

  http.get(`${API}/orders/:id`, guarded({ kind: "data" }, ({ request, params }) => {
    const { user } = requireUser(request);
    settleDue();
    const order = db().orders.find((o) => o.id === String(params.id));
    if (!order) throw fail(404, "not_found", "Pedido não encontrado.");
    if (order.userId !== user.id) throw fail(403, "forbidden", "Você não tem permissão para ver este pedido.");
    return HttpResponse.json(toOrder(order));
  })),

  http.post(`${API}/orders`, guarded({ kind: "data" }, async ({ request }) => {
    const { user } = requireUser(request);
    settleDue();
    const key = request.headers.get("Idempotency-Key");
    if (!key) throw fail(422, "validation_error", "Cabeçalho Idempotency-Key obrigatório.");
    const body = await readJson<CreateOrderBody>(request);

    // idempotência: mesma chave + mesmo conteúdo recupera o mesmo pedido
    const existing = db().orders.find((o) => o.userId === user.id && o.idempotencyKey === key);
    if (existing) {
      if (existing.bodyHash !== bodyHashOf(body)) throw fail(409, "idempotency_conflict", "Esta chave de idempotência já foi usada com outro conteúdo.");
      return HttpResponse.json(toOrder(existing), { status: 200 });
    }
    const pending = db().orders.find((o) => o.userId === user.id && o.status === "pending");
    if (pending) throw fail(409, "idempotency_conflict", "Já existe um pedido pendente para sua conta.", undefined, { order: toOrder(pending) });

    const fields: Record<string, string> = {};
    if (!body.collectorName?.trim()) fields.collectorName = "Informe o nome do colecionador.";
    if (!EMAIL_RE.test(body.collectorEmail ?? "")) fields.collectorEmail = "Informe um e-mail válido.";
    if (!["ethereum", "polygon", "solana"].includes(body.network)) fields.network = "Selecione uma rede.";
    const registered = [user.wallets.primary, user.wallets.secondary].filter((w): w is Wallet => !!w && !!w.address);
    if (!registered.some((w) => w.type === body.walletType)) fields.walletType = "Selecione uma carteira cadastrada.";
    if (Object.keys(fields).length) throw fail(422, "validation_error", "Revise os campos informados.", fields);
    if (!user.connection || user.connection.type !== body.walletType || user.connection.network !== body.network)
      throw fail(409, "wallet_not_connected", "Conecte a carteira selecionada antes de enviar o pedido.");

    const cart = getCart(`user:${user.id}`);
    if (cart.length === 0) throw fail(422, "validation_error", "Seu carrinho está vazio.");

    // cenários de mudança durante a compra (disparam uma única vez)
    if (config.scenario === "price-changed" && !config.fired.priceChanged) {
      config.fired.priceChanged = true;
      patchNft(cart[0].nftId, { priceEth: new Decimal(findNft(cart[0].nftId)!.priceEth).plus("0.10").toFixed() });
    }
    if (config.scenario === "sold-out" && !config.fired.soldOut) {
      config.fired.soldOut = true;
      patchNft(cart[0].nftId, { stock: { [cart[0].edition]: 0 } });
    }

    const quote = buildQuote(cart, body.couponCode);
    // esgotado/insuficiente tem prioridade: não adianta reconfirmar algo que não existe mais
    if (blockingIssues(quote).length) throw fail(409, "availability_conflict", blockingIssues(quote)[0].message, undefined, { quote });
    if (quote.token !== body.quoteToken) throw fail(409, "quote_changed", "Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.", undefined, { quote });

    const order = createOrder(user, key, body, quote);

    if (config.scenario === "order-timeout" && !config.fired.orderTimeout) {
      config.fired.orderTimeout = true;
      await delay(HTTP_TIMEOUT + 2000); // o cliente estoura o timeout, mas o pedido já existe
    }
    return HttpResponse.json(toOrder(order), { status: 201 });
  })),

  /* ---------------------------------- perfil --------------------------------- */
  http.get(`${API}/profile`, guarded({ kind: "data" }, ({ request }) => HttpResponse.json(profileOf(requireUser(request).user)))),

  http.put(`${API}/profile`, guarded({ kind: "data" }, async ({ request }) => {
    const { user } = requireUser(request);
    const body = await readJson<UpdateProfileBody>(request);
    const fields: Record<string, string> = {};
    if (!body.displayName?.trim()) fields.displayName = "Informe o nome de exibição.";
    if (!body.username?.trim()) fields.username = "Informe o nome de usuário.";
    if (!EMAIL_RE.test(body.email?.trim() ?? "")) fields.email = "Informe um e-mail válido.";
    if (body.avatarUrl && body.avatarUrl.length > 400_000) fields.avatarUrl = "A imagem é muito grande (máx. ~300 KB).";
    const email = body.email?.trim().toLowerCase();
    if (!fields.email && db().users.some((u) => u.id !== user.id && u.email === email)) fields.email = "Este e-mail já está em uso.";
    if (Object.keys(fields).length) throw fail(fields.email?.includes("em uso") ? 409 : 422, fields.email?.includes("em uso") ? "email_conflict" : "validation_error", "Revise os campos informados.", fields);
    user.name = body.displayName.trim();
    user.username = body.username.trim();
    user.email = email;
    user.avatarUrl = body.avatarUrl ?? null;
    commit();
    return HttpResponse.json(profileOf(user));
  })),

  http.put(`${API}/profile/password`, guarded({ kind: "data" }, async ({ request }) => {
    const { user } = requireUser(request);
    const body = await readJson<ChangePasswordBody>(request);
    const fields: Record<string, string> = {};
    if (!body.currentPassword) fields.currentPassword = "Informe a senha atual.";
    else if ((await hashPassword(body.currentPassword, user.salt)) !== user.passwordHash) fields.currentPassword = "Senha atual incorreta.";
    if (!STRONG_PW(body.newPassword ?? "")) fields.newPassword = "A nova senha deve ter no mínimo 6 caracteres, com letra, número e caractere especial.";
    if (Object.keys(fields).length) throw fail(422, "validation_error", "Revise os campos informados.", fields);
    user.passwordHash = await hashPassword(body.newPassword, user.salt);
    commit();
    return new HttpResponse(null, { status: 204 });
  })),

  /* --------------------------------- carteiras ------------------------------- */
  http.get(`${API}/wallets`, guarded({ kind: "data" }, ({ request }) => HttpResponse.json(requireUser(request).user.wallets))),

  http.get(`${API}/wallets/connection`, guarded({ kind: "data" }, ({ request }) => HttpResponse.json({ connection: requireUser(request).user.connection }))),

  http.post(`${API}/wallets/connection`, guarded({ kind: "data", failKey: "wallet-connect" }, async ({ request }) => {
    const { user } = requireUser(request);
    const body = await readJson<ConnectWalletBody>(request);
    const wallet = body.walletId === "secondary" ? user.wallets.secondary : user.wallets.primary;
    if (!wallet || !wallet.address) throw fail(404, "not_found", "Carteira não cadastrada.");
    if (!["ethereum", "polygon", "solana"].includes(body.network)) throw fail(422, "validation_error", "Selecione uma rede.", { network: "Selecione uma rede." });
    if (config.scenario === "wallet-refused") throw fail(403, "wallet_refused", "A carteira recusou a conexão.");
    user.connection = { walletId: body.walletId, type: wallet.type as "metamask" | "coinbase" | "walletconnect", network: body.network, address: wallet.address, connectedAt: new Date().toISOString() };
    commit();
    return HttpResponse.json({ connection: user.connection });
  })),

  http.delete(`${API}/wallets/connection`, guarded({ kind: "data" }, ({ request }) => {
    const user = requireUser(request).user;
    user.connection = null;
    commit();
    return new HttpResponse(null, { status: 204 });
  })),

  http.put(`${API}/wallets`, guarded({ kind: "data" }, async ({ request }) => {
    const { user } = requireUser(request);
    const body = await readJson<UpdateWalletsBody>(request);
    const fields: Record<string, string> = {};
    validateWallet(body.primary, "primary", fields);
    if (!body.primary.referralCode?.trim()) fields["primary.referralCode"] = "Informe o código de indicação.";
    if (body.secondary) validateWallet(body.secondary, "secondary", fields);
    if (Object.keys(fields).length) throw fail(422, "validation_error", "Revise os campos informados.", fields);
    user.wallets = { primary: { ...body.primary, id: "primary" }, secondary: body.secondary ? { ...body.secondary, id: "secondary" } : null };
    user.connection = null; // carteiras mudaram: é preciso reconectar
    commit();
    return HttpResponse.json(user.wallets);
  })),
];
