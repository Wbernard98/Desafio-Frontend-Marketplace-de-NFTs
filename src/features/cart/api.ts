import { http } from "../../shared/api/http";
import type { AddCartBody, CartResponse, Quote, QuoteBody } from "../../shared/api/types";

export const fetchCart = (signal?: AbortSignal) => http.get<CartResponse>("/cart", { signal }).then((r) => r.data);
export const addCartItem = (body: AddCartBody) => http.post<CartResponse>("/cart/items", body).then((r) => r.data);
export const updateCartItem = (nftId: string, edition: string, quantity: number) =>
  http.patch<CartResponse>(`/cart/items/${encodeURIComponent(nftId)}`, { quantity }, { params: { edition } }).then((r) => r.data);
export const removeCartItem = (nftId: string, edition: string) =>
  http.delete<CartResponse>(`/cart/items/${encodeURIComponent(nftId)}`, { params: { edition } }).then((r) => r.data);
export const mergeGuestCart = (guestId: string) => http.post<CartResponse>("/cart/merge", { guestId }).then((r) => r.data);
export const acknowledgePrices = () => http.post<CartResponse>("/cart/acknowledge").then((r) => r.data);
export const postQuote = (body: QuoteBody, signal?: AbortSignal) => http.post<Quote>("/quote", body, { signal }).then((r) => r.data);
