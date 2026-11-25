import type { EthString } from "../lib/money";

/** Contratos tipados entre transporte (REST), estado (Query) e interface. */

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fields?: Record<string, string>;
  details?: unknown;
}

export type ApiErrorCode =
  | "validation_error"
  | "invalid_credentials"
  | "email_conflict"
  | "session_invalid"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "availability_conflict"
  | "quote_changed"
  | "idempotency_conflict"
  | "coupon_invalid"
  | "coupon_expired"
  | "payment_declined"
  | "wallet_refused"
  | "wallet_not_connected"
  | "internal_error"
  | "unavailable";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface SessionResponse {
  user: User;
  expiresAt: string;
}

export interface AuthResponse extends SessionResponse {
  token: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody extends LoginBody {
  username: string;
}

/** ---- Carrinho / cotação ---- */
export interface CartLine {
  nftId: string;
  edition: string;
  quantity: number;
  /** Preço no momento da inclusão (para detectar mudança). */
  addedPriceEth: EthString;
}

export interface CartLineView extends CartLine {
  name: string;
  tokenId: string;
  imageUrl: string | null;
  imageAlt: string;
  placeholderColor: string;
  unitPriceEth: EthString;
  lineTotalEth: EthString;
  available: number;
  nftVersion: number;
  priceChanged: boolean;
}

export interface CartResponse {
  lines: CartLineView[];
  count: number;
}

export interface AddCartBody {
  nftId: string;
  edition: string;
  quantity: number;
}

export interface UpdateCartBody {
  quantity: number;
}

export interface QuoteIssue {
  nftId: string;
  edition: string;
  kind: "price_changed" | "sold_out" | "insufficient_stock";
  message: string;
  available?: number;
}

export interface Quote {
  token: string;
  lines: CartLineView[];
  couponCode: string | null;
  subtotalEth: EthString;
  discountEth: EthString;
  networkFeeEth: EthString;
  totalEth: EthString;
  issues: QuoteIssue[];
  generatedAt: string;
}

export interface QuoteBody {
  couponCode?: string | null;
}

/** ---- Carteiras / perfil ---- */
export type WalletNetwork = "ethereum" | "polygon" | "solana";
export type WalletType = "metamask" | "coinbase" | "walletconnect";

export interface Wallet {
  id: "primary" | "secondary";
  nickname: string;
  network: WalletNetwork | "";
  address: string;
  type: WalletType | "";
  ensName: string;
  ensSuffix: ".eth" | ".sol";
  referralCode: string;
}

export interface WalletsResponse {
  primary: Wallet;
  secondary: Wallet | null;
}

export interface UpdateWalletsBody {
  primary: Omit<Wallet, "id">;
  secondary: Omit<Wallet, "id"> | null;
}

export interface WalletConnection {
  walletId: "primary" | "secondary";
  type: WalletType;
  network: WalletNetwork;
  address: string;
  connectedAt: string;
}

export interface ConnectWalletBody {
  walletId: "primary" | "secondary";
  network: WalletNetwork;
}

export interface Profile {
  displayName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

export type UpdateProfileBody = Profile;

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

/** ---- Pedidos ---- */
export type OrderStatus = "pending" | "confirmed" | "declined";

export interface OrderItemSnapshot {
  nftId: string;
  name: string;
  tokenId: string;
  edition: string;
  quantity: number;
  unitPriceEth: EthString;
  lineTotalEth: EthString;
  imageUrl: string | null;
  imageAlt: string;
  placeholderColor: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  /** Incrementa a cada transição; usado para ignorar eventos antigos. */
  version: number;
  txHash: string | null;
  createdAt: string;
  walletName: string;
  network: WalletNetwork;
  collectorName: string;
  items: OrderItemSnapshot[];
  couponCode: string | null;
  subtotalEth: EthString;
  discountEth: EthString;
  networkFeeEth: EthString;
  totalEth: EthString;
  declineReason?: string;
}

export interface CreateOrderBody {
  quoteToken: string;
  couponCode: string | null;
  walletType: WalletType;
  network: WalletNetwork;
  collectorName: string;
  collectorEmail: string;
  notes?: string;
}

/** ---- Tempo real ---- */
export interface RealtimeEnvelope<TType extends string, TPayload> {
  /** Identidade estável do evento (deduplicação). */
  id: string;
  type: TType;
  resource: "nft" | "order";
  resourceId: string;
  /** Versão do recurso após a mudança (descarta eventos antigos). */
  version: number;
  userId: string | null;
  ts: string;
  payload: TPayload;
}

export interface NftUpdatedPayload {
  priceEth: EthString;
  originalPriceEth?: EthString;
  /** Estoque por edição; `available` é a soma. */
  stock: Record<string, number>;
  available: number;
}

export type NftUpdatedEvent = RealtimeEnvelope<"nft.updated", NftUpdatedPayload>;
export type OrderUpdatedEvent = RealtimeEnvelope<"order.updated", { order: Order }>;
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent;
