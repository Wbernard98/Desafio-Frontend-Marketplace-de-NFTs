import { http } from "../../shared/api/http";

export interface FavoritesResponse { nftIds: string[] }
export const fetchFavorites = (signal?: AbortSignal) => http.get<FavoritesResponse>("/favorites", { signal }).then((r) => r.data);
export const addFavorite = (id: string) => http.put<FavoritesResponse>(`/favorites/${encodeURIComponent(id)}`).then((r) => r.data);
export const removeFavorite = (id: string) => http.delete<FavoritesResponse>(`/favorites/${encodeURIComponent(id)}`).then((r) => r.data);
