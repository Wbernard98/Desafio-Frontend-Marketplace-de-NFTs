import type { EthString } from "../../shared/lib/money";

export type Network = "ethereum" | "polygon" | "solana";
export type SortKey = "recent" | "price-asc" | "price-desc";
export type Tab = "all" | "new" | "hot";

export const EDITIONS = ["1/1", "1/10", "1/50", "ABERTA"] as const;
export type Edition = (typeof EDITIONS)[number];

export interface Nft {
  id: string;
  name: string;
  tokenId: string;
  collectionId: string;
  collectionName: string;
  priceEth: EthString;
  originalPriceEth?: EthString;
  network: Network;
  imageUrl: string | null;
  imageAlt: string;
  placeholderColor: string;
  /** Soma do estoque de todas as edições. */
  available: number;
  /** Estoque por edição. 0 = edição esgotada. */
  stock: Record<string, number>;
  /** Limite de unidades por pedido (por edição). */
  maxPerOrder: number;
  /** Incrementa a cada alteração de preço/estoque (ordenação de eventos). */
  version: number;
  createdAt: string;
  hot: boolean;
  reviewsCount: number;
  attributes: string;
  summary: string;
  detailsParagraphs: string[];
  networkInfo: string;
  contractInfo: string;
  royaltiesInfo: string;
}

export interface Facet { id: string; label: string; count: number }
export interface Facets { collections: Facet[]; networks: Facet[] }

export interface NftListParams {
  q?: string;
  collection?: string;
  network?: Network;
  min?: string;
  max?: string;
  tab: Tab;
  sort: SortKey;
  page: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
