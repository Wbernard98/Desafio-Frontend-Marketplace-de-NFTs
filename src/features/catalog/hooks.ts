import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { catalogKeys, fetchFacets, fetchNft, fetchNfts } from "./api";
import { keys } from "../../shared/api/queryKeys";
import type { NftListParams } from "./types";

export const useNfts = (params: NftListParams) =>
  useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: ({ signal }) => fetchNfts(params, signal),
    placeholderData: keepPreviousData, // mantém a grade enquanto a próxima página carrega
  });

export const useFacets = () =>
  useQuery({ queryKey: catalogKeys.facets, queryFn: ({ signal }) => fetchFacets(signal), staleTime: 5 * 60_000 });

export const useNft = (id: string) =>
  useQuery({ queryKey: keys.nft(id), queryFn: ({ signal }) => fetchNft(id, signal) });
