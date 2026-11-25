import { useCallback, useSyncExternalStore } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerOf, useAuthState } from "../../shared/auth/authStore";
import { keys } from "../../shared/api/queryKeys";
import { toApiError } from "../../shared/api/errors";
import { announce } from "../../shared/ui/announcer";
import type { CartResponse } from "../../shared/api/types";
import { acknowledgePrices, addCartItem, fetchCart, postQuote, removeCartItem, updateCartItem } from "./api";

export const useOwner = () => ownerOf(useAuthState());

export function useCart() {
  const owner = useOwner();
  return useQuery({ queryKey: keys.cart(owner), queryFn: ({ signal }) => fetchCart(signal), staleTime: 15_000 });
}

export const useCartCount = () => useCart().data?.count ?? 0;

/** Atualização otimista com rollback: o carrinho responde ao clique antes da API. */
function useOptimisticCart<TVars>(mutationFn: (v: TVars) => Promise<CartResponse>, apply: (cart: CartResponse, v: TVars) => CartResponse) {
  const qc = useQueryClient();
  const owner = useOwner();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: keys.cart(owner) });
      const previous = qc.getQueryData<CartResponse>(keys.cart(owner));
      if (previous) qc.setQueryData(keys.cart(owner), apply(previous, vars));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.cart(owner), ctx.previous); // rollback
      announce(toApiError(error).message, "assertive");
    },
    onSuccess: (data) => qc.setQueryData(keys.cart(owner), data),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.cart(owner) });
      void qc.invalidateQueries({ queryKey: ["quote", owner] });
    },
  });
}

const recount = (lines: CartResponse["lines"]): CartResponse => ({ lines, count: lines.reduce((a, l) => a + l.quantity, 0) });

export const useUpdateCartItem = () =>
  useOptimisticCart(
    (v: { nftId: string; edition: string; quantity: number }) => updateCartItem(v.nftId, v.edition, v.quantity),
    (cart, v) => recount(cart.lines.map((l) => (l.nftId === v.nftId && l.edition === v.edition ? { ...l, quantity: v.quantity } : l))),
  );

export const useRemoveCartItem = () =>
  useOptimisticCart(
    (v: { nftId: string; edition: string }) => removeCartItem(v.nftId, v.edition),
    (cart, v) => recount(cart.lines.filter((l) => !(l.nftId === v.nftId && l.edition === v.edition))),
  );

export function useAddToCart() {
  const qc = useQueryClient();
  const owner = useOwner();
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: (data) => qc.setQueryData(keys.cart(owner), data),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["quote", owner] }),
  });
}

export function useAcknowledgePrices() {
  const qc = useQueryClient();
  const owner = useOwner();
  return useMutation({
    mutationFn: acknowledgePrices,
    onSuccess: (data) => {
      qc.setQueryData(keys.cart(owner), data);
      void qc.invalidateQueries({ queryKey: ["quote", owner] });
    },
  });
}

/* --------- cupom aplicado (preferência de UI do carrinho; a validação é da API) --------- */
const COUPON_KEY = "kurio:coupon";
const couponListeners = new Set<() => void>();
const readCoupon = () => {
  try {
    return window.sessionStorage.getItem(COUPON_KEY);
  } catch {
    return null;
  }
};
export const setCoupon = (code: string | null) => {
  try {
    if (code) window.sessionStorage.setItem(COUPON_KEY, code);
    else window.sessionStorage.removeItem(COUPON_KEY);
  } catch {
    /* ignora */
  }
  couponListeners.forEach((l) => l());
};
export const useCoupon = () =>
  useSyncExternalStore(
    (l) => {
      couponListeners.add(l);
      return () => couponListeners.delete(l);
    },
    readCoupon,
    () => null,
  );

/** Cotação (subtotal, desconto, taxa e total) — a API é a referência para finalizar o pedido. */
export function useQuote() {
  const owner = useOwner();
  const coupon = useCoupon();
  return useQuery({
    queryKey: keys.quote(owner, coupon),
    queryFn: ({ signal }) => postQuote({ couponCode: coupon }, signal),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  const owner = useOwner();
  return useMutation({
    mutationFn: async (code: string) => {
      const normalized = code.trim().toUpperCase();
      return qc.fetchQuery({ queryKey: keys.quote(owner, normalized), queryFn: ({ signal }) => postQuote({ couponCode: normalized }, signal), staleTime: 0 });
    },
    onSuccess: (quote) => setCoupon(quote.couponCode),
  });
}

export const useRemoveCoupon = () => useCallback(() => setCoupon(null), []);
