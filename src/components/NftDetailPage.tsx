import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { fmtEth } from "../shared/lib/money";
import { useNft, useNfts } from "../features/catalog/hooks";
import { useAddToCart, useCart } from "../features/cart/hooks";
import { useFavorites, useToggleFavorite } from "../features/favorites/hooks";
import { useSession } from "../shared/auth/hooks";
import { loginModal } from "../shared/auth/loginModalStore";
import { toApiError } from "../shared/api/errors";
import { EDITIONS } from "../features/catalog/types";
import { Skeleton } from "../shared/ui/Skeleton";
import { announce } from "../shared/ui/announcer";
import { MobileTopBar } from "./MobileTopBar";

const editions = EDITIONS;

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-300 px-6 pb-16 pt-4" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col-reverse gap-4 sm:flex-row lg:col-span-6">
          <div className="flex gap-3 sm:flex-col">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="size-16 sm:size-20" />
            ))}
          </div>
          <Skeleton className="aspect-square flex-1" />
        </div>
        <div className="space-y-4 lg:col-span-6">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export function NftDetailPage() {
  const { id } = useParams({ from: "/nft/$id" });
  const { data: nft, isPending, isError, error, refetch } = useNft(id);
  const cart = useCart();
  const addToCart = useAddToCart();
  const { isAuthenticated } = useSession();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const related = useNfts({ tab: "all", sort: "recent", page: 1, collection: nft?.collectionId });

  const [selectedThumb, setSelectedThumb] = useState(0);
  const [selectedEdition, setSelectedEdition] = useState<string>("1/50");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");
  const [cartToast, setCartToast] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (isPending) return <DetailSkeleton />;

  if (isError || !nft) {
    const apiError = toApiError(error);
    const notFound = apiError.code === "not_found";
    return (
      <div className="mx-auto max-w-300 px-6 py-24 text-center">
        <h1 className="mb-3 text-2xl font-bold">{notFound ? "NFT não encontrado" : "Não foi possível carregar o NFT"}</h1>
        <p className="mb-6 text-xs text-muted">{notFound ? "O NFT que você procura não existe ou foi removido." : apiError.message}</p>
        {!notFound && (
          <button type="button" onClick={() => void refetch()} className="mr-4 rounded-lg bg-accent px-5 py-2 text-xs font-bold text-bg hover:bg-accent-hover">
            Tentar novamente
          </button>
        )}
        <Link to="/" search={{ tab: "all", sort: "recent", page: 1 }} className="text-accent underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const thumbnails = [nft.imageUrl, nft.imageUrl, nft.imageUrl, nft.imageUrl];
  const firstAvailable = editions.find((ed) => (nft.stock[ed] ?? 0) > 0);
  const edition = (nft.stock[selectedEdition] ?? 0) > 0 ? selectedEdition : (firstAvailable ?? selectedEdition);
  const editionStock = nft.stock[edition] ?? 0;
  const inCart = cart.data?.lines.find((l) => l.nftId === nft.id && l.edition === edition)?.quantity ?? 0;
  const cap = Math.min(editionStock, nft.maxPerOrder);
  const maxQty = Math.max(0, cap - inCart);
  const qty = Math.min(quantity, Math.max(1, maxQty));
  const cartCount = cart.data?.count ?? 0;
  const favorited = favorites.data?.nftIds.includes(nft.id) ?? false;
  const soldOut = nft.available === 0 || !firstAvailable;

  const handleBuy = () => {
    addToCart.mutate(
      { nftId: nft.id, edition, quantity: qty },
      {
        onSuccess: (data) => {
          const text = `Adicionado ${qty}x ${nft.name} (Edição ${edition}) ao carrinho — Total: ${data.count}`;
          setCartToast({ type: "ok", text });
          announce(text);
        },
        onError: (err) => {
          const text = toApiError(err).message;
          setCartToast({ type: "error", text });
          announce(text, "assertive");
        },
      },
    );
  };

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      loginModal.open({ redirect: `/nft/${nft.id}` });
      return;
    }
    toggleFavorite.mutate({ nftId: nft.id, favorite: !favorited, name: nft.name });
  };

  return (
    <div className="mx-auto max-w-300 px-6 pb-32 pt-4 md:pb-16">
      <MobileTopBar
        right={
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-pressed={favorited}
            aria-label={favorited ? "Favoritado" : "Favoritar"}
            className={`grid size-9 place-items-center rounded-full bg-surface text-base ${favorited ? "text-accent" : "text-fg"}`}
          >
            <span aria-hidden="true">{favorited ? "♥" : "♡"}</span>
          </button>
        }
      />
      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link
          to="/"
          search={{ tab: "all", sort: "recent", page: 1 }}
          className="hover:text-accent"
        >
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-fg">{nft.name}</span>
      </nav>

      {/* Seção principal: Galeria à esquerda + Compra à direita */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Galeria de miniaturas + imagem principal */}
        <div className="flex flex-col-reverse gap-4 sm:flex-row lg:col-span-6">
          <div className="flex gap-3 sm:flex-col">
            {thumbnails.map((src, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedThumb(index)}
                aria-label={`Visualizar miniatura ${index + 1}`}
                className={`size-16 overflow-hidden rounded-lg border-2 bg-surface transition sm:size-20 ${
                  selectedThumb === index
                    ? "border-accent"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
              >
                {src ? (
                  <img src={src} alt="" className="size-full object-cover object-center" />
                ) : (
                  <span className="block size-full" style={{ background: nft.placeholderColor }} />
                )}
              </button>
            ))}
          </div>

          <div className="relative flex-1 overflow-hidden rounded-2xl bg-surface p-5">
            <div className="relative aspect-square overflow-hidden rounded-xl">
              {thumbnails[selectedThumb] ? (
                <img src={thumbnails[selectedThumb] ?? undefined} alt={nft.imageAlt} className="size-full object-cover object-center" />
              ) : (
                <div role="img" aria-label={nft.imageAlt} className="size-full" style={{ background: nft.placeholderColor }} />
              )}
              <span
                aria-hidden="true"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-bg/80 text-fg"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Informações de venda */}
        <div className="flex flex-col justify-between lg:col-span-6">
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-fg sm:text-3xl">
              {nft.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <span className="text-lg font-bold text-accent">
                {fmtEth(nft.priceEth)}
              </span>

              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="tracking-tight text-accent" aria-label="5 de 5 estrelas">
                  ★★★★★
                </span>
                <span>{nft.reviewsCount} avaliações de colecionadores</span>
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-xs font-bold text-fg">Sobre este NFT:</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {nft.summary}
              </p>
            </div>

            {/* Edição */}
            <div className="mt-5">
              <span className="block text-xs font-bold text-fg">Edição:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {editions.map((ed) => {
                  const active = edition === ed;
                  const edSoldOut = (nft.stock[ed] ?? 0) === 0;
                  return (
                    <button
                      key={ed}
                      type="button"
                      onClick={() => {
                        setSelectedEdition(ed);
                        setQuantity(1);
                      }}
                      disabled={edSoldOut}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                        active
                          ? "border-accent text-accent"
                          : "border-line text-muted hover:border-accent/60 hover:text-fg"
                      } disabled:cursor-not-allowed disabled:line-through disabled:opacity-40`}
                    >
                      {ed}
                      {edSoldOut && <span className="sr-only"> (esgotada)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantidade + Botões Comprar / Favoritar */}
            <div className="mt-6 flex flex-wrap items-center gap-4 max-md:hidden">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() => setQuantity(Math.max(1, qty - 1))}
                  className="grid h-10 w-6 place-items-center rounded-full bg-accent font-bold text-bg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  -
                </button>
                <span className="w-5 text-center text-xs font-bold text-fg">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  disabled={qty >= maxQty}
                  onClick={() => setQuantity(qty + 1)}
                  className="grid h-10 w-6 place-items-center rounded-full bg-accent font-bold text-bg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleBuy}
                disabled={soldOut || maxQty === 0 || addToCart.isPending}
                className="rounded-lg bg-accent px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-bg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {soldOut ? "Esgotado" : maxQty === 0 ? "Limite atingido" : addToCart.isPending ? "Adicionando…" : cartCount > 0 ? `Comprar (${cartCount} no carrinho)` : "Comprar"}
              </button>

              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-pressed={favorited}
                className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-xs font-bold transition ${
                  favorited
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-accent/70 text-fg hover:border-accent hover:text-accent"
                }`}
              >
                <span aria-hidden="true">{favorited ? "♥" : "♡"}</span>
                <span>{favorited ? "Favoritado" : "Favoritar"}</span>
              </button>
            </div>

            {/* Avisos visuais de carrinho e favorito */}
            {(cartToast || cartCount > 0 || favorited) && (
              <div className="mt-4 space-y-2 text-xs">
                {cartToast && (
                  <div
                    role={cartToast.type === "error" ? "alert" : "status"}
                    className={`rounded-lg border px-3.5 py-2 font-medium ${cartToast.type === "error" ? "border-red-400/60 bg-red-900/20 text-red-200" : "border-accent/60 bg-accent/15 text-accent"}`}
                  >
                    {cartToast.text}{" "}
                    {cartToast.type === "ok" && (
                      <Link to="/carrinho" className="underline">
                        Ver carrinho
                      </Link>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
                  <span>
                    Carrinho: <strong className="text-accent">{cartCount}</strong>{" "}
                    {cartCount === 1 ? "item" : "itens"}
                  </span>
                  <span>•</span>
                  <span>
                    Status:{" "}
                    <strong className={favorited ? "text-accent" : "text-fg"}>
                      {favorited ? "Nos favoritos" : "Não favoritado"}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Metadados técnicos e compartilhamento */}
          <dl className="mt-6 space-y-2 border-t border-line pt-4 text-xs text-muted">
            <div className="flex gap-1.5">
              <dt>ID do token:</dt>
              <dd className="text-fg">{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Coleção:</dt>
              <dd className="text-fg">{nft.collectionName}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Atributos:</dt>
              <dd className="text-fg">{nft.attributes}</dd>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <dt className="font-bold text-fg">Compartilhar este NFT:</dt>
              <dd className="flex items-center gap-3 text-fg">
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Compartilhar no LinkedIn"
                  className="hover:text-accent"
                >
                  in
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(window.location.href)}`}
                  aria-label="Compartilhar por e-mail"
                  className="hover:text-accent"
                >
                  ✉
                </a>
                <a
                  href={`https://x.com/intent/tweet?text=${encodeURIComponent(nft.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Compartilhar no X"
                  className="hover:text-accent"
                >
                  𝕏
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Abas: Detalhes do NFT e Avaliações */}
      <section className="mt-14">
        <div role="tablist" aria-label="Informações detalhadas" className="flex gap-8 border-b border-line">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            onClick={() => setActiveTab("details")}
            className={`pb-3 text-xs font-bold transition ${
              activeTab === "details"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-fg"
            }`}
          >
            Detalhes do NFT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reviews"}
            onClick={() => setActiveTab("reviews")}
            className={`pb-3 text-xs font-bold transition ${
              activeTab === "reviews"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-fg"
            }`}
          >
            Avaliações de colecionadores ({nft.reviewsCount})
          </button>
        </div>

        {activeTab === "details" ? (
          <div className="mt-6 space-y-5 text-xs leading-relaxed text-muted">
            {nft.detailsParagraphs.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}

            <div>
              <h3 className="font-bold text-fg">Rede:</h3>
              <p className="mt-1">{nft.networkInfo}</p>
            </div>

            <div>
              <h3 className="font-bold text-fg">Contrato:</h3>
              <p className="mt-1">{nft.contractInfo}</p>
            </div>

            <div>
              <h3 className="font-bold text-fg">Direitos autorais:</h3>
              <p className="mt-1">{nft.royaltiesInfo}</p>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-xs text-muted">As avaliações dos colecionadores não estão disponíveis nesta demonstração.</p>
        )}
      </section>

      {/* Mais desta coleção */}
      <section className="mt-14">
        <div className="mb-5 border-b border-line pb-3">
          <h2 className="text-xs font-bold text-accent">Mais desta coleção</h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {related.isPending
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/5] w-full" />)
            : (related.data?.items ?? [])
                .filter((item) => item.id !== nft.id)
                .slice(0, 5)
                .map((item) => (
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
                    <span className="text-[11px] font-bold text-accent">{fmtEth(item.priceEth)}</span>
                  </Link>
                ))}
        </div>

        {/* Indicadores de paginação do carrossel */}
        <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
          <span className="size-2 rounded-full border border-accent/60" />
          <span className="size-2 rounded-full bg-accent" />
          <span className="size-2 rounded-full border border-accent/60" />
        </div>
      </section>

      {/* Barra de compra fixa (frame mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-[#180c07]/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Qtd.</span>
          <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(1, qty - 1))} className="grid size-6 place-items-center rounded-full bg-accent font-bold text-bg">-</button>
          <span className="w-4 text-center font-bold" aria-live="polite">{qty}</span>
          <button type="button" aria-label="Aumentar quantidade" disabled={qty >= maxQty} onClick={() => setQuantity(qty + 1)} className="grid size-6 place-items-center rounded-full bg-accent font-bold text-bg disabled:opacity-40">+</button>
        </div>
        <span className="text-xs font-bold text-accent">{fmtEth(nft.priceEth)}</span>
        <button
          type="button"
          onClick={handleBuy}
          disabled={soldOut || maxQty === 0 || addToCart.isPending}
          className="ml-auto rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {soldOut ? "Esgotado" : maxQty === 0 ? "Limite atingido" : "Comprar NFT"}
        </button>
        <Link to="/carrinho" aria-label={`Carrinho, ${cartCount} itens`} className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-fg">
          <span aria-hidden="true">🛒</span>
        </Link>
      </div>
    </div>
  );
}