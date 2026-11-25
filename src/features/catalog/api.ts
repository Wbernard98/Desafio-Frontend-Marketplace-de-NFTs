import { http } from "../../shared/api/http";
import type { Facets, Nft, NftListParams, Paginated } from "./types";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (p: NftListParams) => ["catalog", "list", p] as const,
  facets: ["catalog", "facets"] as const,
};

// `signal` cancela requisições obsoletas quando os filtros mudam.
export const fetchNfts = (params: NftListParams, signal?: AbortSignal) =>
  http.get<Paginated<Nft>>("/nfts", { params, signal }).then((r) => r.data);

export const fetchFacets = (signal?: AbortSignal) =>
  http.get<Facets>("/facets", { signal }).then((r) => r.data);

export const fetchNft = (id: string, signal?: AbortSignal) =>
  http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal }).then((r) => r.data);
