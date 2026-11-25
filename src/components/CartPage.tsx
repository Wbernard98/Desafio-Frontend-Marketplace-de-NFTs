import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useCart, useQuote, useApplyCoupon, useCoupon, useRemoveCoupon, useRemoveCartItem, useUpdateCartItem, useAcknowledgePrices } from "../features/cart/hooks";
import { useNfts } from "../features/catalog/hooks";
import { useSession } from "../shared/auth/hooks";
import { loginModal } from "../shared/auth/loginModalStore";
import { toApiError } from "../shared/api/errors";
import { fmtEthDp } from "../shared/lib/money";
import { Skeleton } from "../shared/ui/Skeleton";
import { MobileTopBar } from "./MobileTopBar";
import { announce } from "../shared/ui/announcer";

const defaultHomeSearch = {
  tab: "all" as const,
  sort: "recent" as const,
  page: 1,
};

export function CartPage() {
  const cart = useCart();
  const quote = useQuote();
  const coupon = useCoupon();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const applyCoupon = useApplyCoupon();
  const clearCoupon = useRemoveCoupon();
  const acknowledge = useAcknowledgePrices();
  const { isAuthenticated } = useSession();
  const suggestions = useNfts({ tab: "hot", sort: "recent", page: 1 });

  const [promoCode, setPromoCode] = useState("");
  const [promoFeedback, setPromoFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const lines = cart.data?.lines ?? [];
  const priceChanged = lines.some((l) => l.priceChanged);
  const blocking = quote.data?.issues.filter((i) => i.kind !== "price_changed") ?? [];
  const canCheckout = lines.length > 0 && blocking.length === 0 && !quote.isError;

  const handleQuantityChange = (nftId: string, edition: string, current: number, delta: number) => {
    const next = current + delta;
    if (next <= 0) remove.mutate({ nftId, edition });
    else update.mutate({ nftId, edition, quantity: next });
  };

  const handleApplyPromo = (e: FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim();
    if (!code) {
      setPromoFeedback({ type: "error", text: "Digite um código promocional." });
      return;
    }
    applyCoupon.mutate(code, {
      onSuccess: (q) => {
        setPromoFeedback({ type: "ok", text: `Código ${q.couponCode} aplicado.` });
        setPromoCode("");
      },
      onError: (err) => setPromoFeedback({ type: "error", text: toApiError(err).message }),
    });
  };

  const handleRemovePromo = () => {
    clearCoupon();
    setPromoFeedback(null);
    announce("Cupom removido.");
  };

  const summaryLoading = quote.isPending && lines.length > 0;

  return (
    <div className="mx-auto max-w-300 px-6 pb-16 pt-4">
      <MobileTopBar title="Carrinho de NFTs" />
      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-6 hidden items-center gap-2 text-xs text-muted md:flex">
        <Link to="/" search={defaultHomeSearch} className="hover:text-accent">
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <h1 className="text-xs font-normal text-fg">Carrinho</h1>
      </nav>

      {priceChanged && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-accent/60 bg-[#2a150d] px-4 py-3 text-xs text-fg">
          <span>
            O preço de um ou mais itens mudou enquanto você navegava. O resumo abaixo já reflete os valores atuais.
          </span>
          <button
            type="button"
            onClick={() => acknowledge.mutate()}
            className="rounded bg-accent px-3 py-1.5 text-[11px] font-bold text-bg hover:bg-accent-hover"
          >
            Entendi
          </button>
        </div>
      )}

      {blocking.length > 0 && (
        <ul role="alert" className="mb-5 space-y-1 border border-red-400/60 bg-[#2a150d] px-4 py-3 text-xs text-red-200">
          {blocking.map((i) => (
            <li key={`${i.nftId}-${i.edition}`}>{i.message} Ajuste a quantidade ou remova o item para continuar.</li>
          ))}
        </ul>
      )}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Lista / Tabela de NFTs */}
        <div className="lg:col-span-8">
          <div className="hidden grid-cols-12 border-b border-line pb-3 text-[11px] font-bold text-fg md:grid">
            <span className="col-span-5">NFTs</span>
            <span className="col-span-2 text-center">Preço</span>
            <span className="col-span-2 text-center">Edições</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-1" aria-hidden="true" />
          </div>

          {cart.isPending ? (
            <div className="mt-4 space-y-3" aria-busy="true" aria-label="Carregando carrinho">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[68px] w-full" />
              ))}
            </div>
          ) : cart.isError ? (
            <div role="alert" className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
              <p className="text-xs text-fg">{toApiError(cart.error).message}</p>
              <button type="button" onClick={() => void cart.refetch()} className="mt-4 rounded-lg bg-accent px-5 py-2 text-xs font-bold text-bg hover:bg-accent-hover">
                Tentar novamente
              </button>
            </div>
          ) : lines.length === 0 ? (
            <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
              <p className="text-xs text-muted">O seu carrinho está vazio no momento.</p>
              <Link
                to="/"
                search={defaultHomeSearch}
                className="mt-4 inline-block rounded-lg bg-accent px-5 py-2 text-xs font-bold text-bg hover:bg-accent-hover"
              >
                Explorar NFTs
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {lines.map((item) => {
                const cap = Math.min(item.available, 10);
                return (
                  <li
                    key={`${item.nftId}-${item.edition}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-[#1d0f09] px-3 py-3 text-xs md:grid md:grid-cols-12 md:gap-2 md:rounded-none md:px-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:col-span-5">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.imageAlt} className="size-11 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div role="img" aria-label={item.imageAlt} className="size-11 shrink-0 rounded-md" style={{ background: item.placeholderColor }} />
                      )}
                      <div className="min-w-0">
                        <Link to="/nft/$id" params={{ id: item.nftId }} className="block truncate font-bold text-fg hover:text-accent">
                          {item.name}
                        </Link>
                        <p className="text-[11px] text-muted">
                          <span className="hidden md:inline">ID do token: {item.tokenId} · </span>Edição {item.edition}
                        </p>
                        <p className="text-[11px] font-bold text-accent md:hidden">{fmtEthDp(item.unitPriceEth, 2)}</p>
                        {item.priceChanged && <p className="text-[10px] text-accent">Preço atualizado</p>}
                      </div>
                    </div>

                    <div className="hidden text-center font-bold text-accent md:col-span-2 md:block">{fmtEthDp(item.unitPriceEth, 2)}</div>

                    <div className="flex items-center justify-center gap-2 md:col-span-2">
                      <button
                        type="button"
                        aria-label={`Diminuir quantidade de ${item.name}`}
                        onClick={() => handleQuantityChange(item.nftId, item.edition, item.quantity, -1)}
                        className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-bg hover:bg-accent-hover"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-bold text-fg" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Aumentar quantidade de ${item.name}`}
                        disabled={item.quantity >= cap}
                        onClick={() => handleQuantityChange(item.nftId, item.edition, item.quantity, 1)}
                        className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-bg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <div className="hidden text-right font-bold text-accent md:col-span-2 md:block">{fmtEthDp(item.lineTotalEth, 2)}</div>

                    <div className="flex justify-end md:col-span-1">
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => remove.mutate({ nftId: item.nftId, edition: item.edition })}
                        className="text-muted transition hover:text-accent"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6l1 14h10l1-14" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Coluna direita: Resumo da carteira */}
        <aside className="lg:col-span-4" aria-label="Resumo da carteira">
          <div className="border border-line/70 bg-[#1d0f09] p-5">
            <h2 className="text-xs font-bold text-fg">Resumo da carteira</h2>

            <form onSubmit={handleApplyPromo} className="mt-4">
              <label htmlFor="promo-code" className="block text-[11px] font-bold text-fg">
                Código promocional
              </label>
              <div className="mt-2 flex items-stretch gap-2">
                <input
                  id="promo-code"
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Digite o código promocional..."
                  aria-describedby="promo-feedback"
                  aria-invalid={promoFeedback?.type === "error"}
                  className="min-w-0 flex-1 border border-line bg-[#2a150d] px-3 py-2 text-[11px] text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={applyCoupon.isPending}
                  className="bg-accent px-4 py-2 text-[11px] font-bold text-bg transition hover:bg-accent-hover disabled:opacity-60"
                >
                  {applyCoupon.isPending ? "…" : "Aplicar"}
                </button>
              </div>
              <p id="promo-feedback" role={promoFeedback?.type === "error" ? "alert" : "status"} className={`mt-1.5 text-[10px] ${promoFeedback?.type === "error" ? "text-red-300" : "text-accent"}`}>
                {promoFeedback?.text}
              </p>
              {coupon && (
                <p className="mt-1 text-[10px] text-muted">
                  Cupom ativo: <strong className="text-fg">{coupon}</strong>{" "}
                  <button type="button" onClick={handleRemovePromo} className="underline hover:text-accent">
                    Remover
                  </button>
                </p>
              )}
            </form>

            {summaryLoading ? (
              <div className="mt-5 space-y-3 border-t border-line/70 pt-4" aria-busy="true" aria-label="Calculando resumo">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <dl className="mt-5 space-y-2.5 border-t border-line/70 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="font-bold text-fg">{fmtEthDp(quote.data?.subtotalEth ?? "0", 2)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Desconto do lançamento</dt>
                  <dd className="text-muted">(-) {fmtEthDp(quote.data?.discountEth ?? "0", 2)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Taxa de rede</dt>
                  <dd className="font-bold text-fg">{fmtEthDp(quote.data?.networkFeeEth ?? "0", 3)}</dd>
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] text-muted">Taxa estimada</span>
                </div>
                <div className="flex items-center justify-between border-t border-line/70 pt-3 text-sm font-bold">
                  <dt className="text-fg">Total</dt>
                  <dd className="text-accent">{fmtEthDp(quote.data?.totalEth ?? "0", 3)}</dd>
                </div>
              </dl>
            )}

            {quote.isError && (
              <p role="alert" className="mt-3 text-[11px] text-red-300">
                Não foi possível calcular o resumo. {toApiError(quote.error).message}{" "}
                <button type="button" onClick={() => void quote.refetch()} className="underline">
                  Tentar novamente
                </button>
              </p>
            )}

            {isAuthenticated ? (
              canCheckout ? (
                <Link
                  to="/pagamento"
                  className="mt-5 block w-full rounded bg-accent py-2.5 text-center text-xs font-bold text-bg transition hover:bg-accent-hover"
                >
                  Conectar e finalizar
                </Link>
              ) : (
                <button type="button" disabled className="mt-5 block w-full cursor-not-allowed rounded bg-accent py-2.5 text-center text-xs font-bold text-bg opacity-50">
                  Conectar e finalizar
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canCheckout}
                onClick={() => loginModal.open({ redirect: "/pagamento" })}
                className="mt-5 block w-full rounded bg-accent py-2.5 text-center text-xs font-bold text-bg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Entrar para finalizar
              </button>
            )}

            <div className="mt-3 text-center">
              <Link to="/" search={defaultHomeSearch} className="text-[11px] text-muted underline hover:text-accent">
                Continuar explorando
              </Link>
            </div>
          </div>
        </aside>
      </section>

      {/* Secção inferior: Colecionadores também viram */}
      <section className="mt-14" aria-labelledby="also-viewed">
        <div className="mb-5 border-b border-line pb-3">
          <h2 id="also-viewed" className="text-xs font-bold text-accent">
            Colecionadores também viram
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {suggestions.isPending
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/5] w-full" />)
            : (suggestions.data?.items ?? []).slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  to="/nft/$id"
                  params={{ id: item.id }}
                  className="flex flex-col gap-2.5 bg-surface p-3 transition hover:ring-1 hover:ring-accent"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-bg/40">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.imageAlt} loading="lazy" className="size-full object-cover object-center" />
                    ) : (
                      <div role="img" aria-label={item.imageAlt} className="size-full" style={{ background: item.placeholderColor }} />
                    )}
                  </div>
                  <span className="text-xs font-bold text-fg">{item.name}</span>
                  <span className="text-[11px] font-bold text-accent">{fmtEthDp(item.priceEth, 2)}</span>
                </Link>
              ))}
        </div>
      </section>
    </div>
  );
}
