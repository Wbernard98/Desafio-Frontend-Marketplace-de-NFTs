import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { useNfts } from "../features/catalog/hooks";
import {
  NftCard,
  NftCardSkeleton,
} from "../features/catalog/components/NftCard";
import { CatalogSidebar } from "../features/catalog/components/CatalogSidebar";
import { Pagination } from "../features/catalog/components/Pagination";
import { Editorial, Hero } from "../components/HomeEditorial";
import { useCartCount } from "../features/cart/hooks";
import type { HomeSearch } from "../app/router";

const tabs = [
  ["all", "Todos os NFTs"],
  ["new", "Novos lançamentos"],
  ["hot", "Em alta"],
] as const;

const sorts = [
  ["recent", "Listados recentemente"],
  ["price-asc", "Menor preço"],
  ["price-desc", "Maior preço"],
] as const;

const defaultSearch: HomeSearch = {
  tab: "all",
  sort: "recent",
  page: 1,
};

type CatalogNftItem = {
  id: string | number;
  title?: string;
  name?: string;
  price?: number | string;
  priceEth?: number | string;
  image?: string;
  imageUrl?: string;
  badge?: string;
};

type ResolvedNftMedia = {
  primary: string;
  secondary?: string;
};

const assetImages = import.meta.glob<string>(
  "../assets/**/*.{png,jpg,jpeg,webp,gif,avif}",
  { eager: true, import: "default" }
);

function normalizeAssetPath(raw: string): string {
  const clean = raw.trim();
  if (
    clean.startsWith("http") ||
    clean.startsWith("/") ||
    clean.startsWith("data:") ||
    clean.startsWith("blob:")
  ) {
    return clean;
  }

  const normalized = clean.replace(/^\.?\//, "");
  const matchedKey = Object.keys(assetImages).find(
    (k) => k.endsWith(normalized) || k.endsWith(`/${normalized}`)
  );
  if (matchedKey) {
    return assetImages[matchedKey];
  }

  return `/${normalized}`;
}

function resolveNftMedia(
  nft: CatalogNftItem & Record<string, unknown>,
  index: number
): ResolvedNftMedia {
  const candidates = [
    nft.image,
    nft.imageUrl,
    nft.img,
    nft.thumbnail,
    nft.cover,
    nft.media,
    nft.artwork,
    nft.src,
  ];

  const foundUrls: string[] = [];

  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim()) {
      const resolved = normalizeAssetPath(raw);
      if (!foundUrls.includes(resolved)) {
        foundUrls.push(resolved);
      }
    }
  }

  const slug = String(nft.id ?? nft.title ?? nft.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  if (slug) {
    const bySlug = Object.entries(assetImages).find(([key]) =>
      key.toLowerCase().includes(slug)
    );
    if (bySlug && !foundUrls.includes(bySlug[1])) {
      foundUrls.push(bySlug[1]);
    }
  }

  const galleryAssets = Object.values(assetImages).filter(
    (url) =>
      typeof url === "string" &&
      !url.toLowerCase().includes("logout") &&
      !url.toLowerCase().includes("google")
  );

  for (const assetUrl of galleryAssets) {
    if (foundUrls.length >= 2) break;
    if (!foundUrls.includes(assetUrl)) {
      foundUrls.push(assetUrl);
    }
  }

  const fallbackSecondary =
    galleryAssets.length > 0
      ? galleryAssets[(index + 1) % galleryAssets.length]
      : undefined;

  return {
    primary: foundUrls[0] ?? galleryAssets[0] ?? "",
    secondary: foundUrls[1] ?? fallbackSecondary,
  };
}

export function HomePage() {
  const location = useLocation();
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const { data, isPending, isError, error, isFetching, refetch } = useNfts(search);

  const [mobileQuery, setMobileQuery] = useState(search.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const cartCount = useCartCount();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
    setMobileQuery(search.q ?? "");
  }, [search.q]);

  const update = (patch: Partial<HomeSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
    });

  const handleMobileSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: mobileQuery.trim() || undefined });
  };

  const items = (data?.items ?? []) as CatalogNftItem[];
  const isHomeActive = location.pathname === "/";
  const isMarketActive = location.pathname === "/mercado";

  return (
    <>
      {/* ==================== VERSÃO DESKTOP / TABLET ==================== */}
      <div className="hidden md:block">
        <Hero />
        <section
          id="catalogo"
          className="mx-auto flex max-w-300 flex-col gap-6 px-6 lg:flex-row lg:items-start"
        >
          <CatalogSidebar search={search} onChange={update} />
          <div className="min-w-0 flex-1" aria-busy={isFetching}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div
                role="tablist"
                aria-label="Seções do catálogo"
                className="flex gap-5"
              >
                {tabs.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={search.tab === id}
                    onClick={() => update({ tab: id })}
                    className={
                      search.tab === id
                        ? "text-accent underline"
                        : "hover:text-accent"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                Ordenar por:{" "}
                <select
                  value={search.sort}
                  onChange={(e) =>
                    update({ sort: e.target.value as HomeSearch["sort"] })
                  }
                  className="border border-line bg-bg p-1"
                >
                  {sorts.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="sr-only" aria-live="polite">
              {data ? `${data.total} NFTs encontrados` : ""}
            </p>

            {isError ? (
              <div role="alert" className="bg-surface p-8 text-center">
                <p className="mb-3">
                  {isAxiosError(error) && error.response
                    ? `Erro ${error.response.status} ao carregar o catálogo.`
                    : "Sem conexão com o servidor."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="bg-accent px-4 py-2 font-bold uppercase text-bg"
                >
                  Tentar novamente
                </button>
              </div>
            ) : isPending ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </div>
            ) : data.items.length === 0 ? (
              <div className="bg-surface p-8 text-center">
                <p className="mb-3">Nenhum NFT encontrado com esses filtros.</p>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      search: { tab: "all", sort: "recent", page: 1 },
                    })
                  }
                  className="text-accent underline"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${
                    isFetching ? "opacity-70" : ""
                  }`}
                >
                  {data.items.map((n) => (
                    <NftCard key={n.id} nft={n} />
                  ))}
                </div>
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(p) => update({ page: p })}
                />
              </>
            )}
          </div>
        </section>
        <Editorial />
      </div>

      {/* ==================== VERSÃO MOBILE (FIGMA: MOBILE / INÍCIO) ==================== */}
      <div className="block w-full overflow-x-hidden pb-24 md:hidden">
        {/* Busca + botão de filtros */}
        <form
          onSubmit={handleMobileSearchSubmit}
          className="flex items-center gap-2 px-3.5 pt-3"
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 shrink-0 text-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              id="catalog-search"
              type="search"
              value={mobileQuery}
              onChange={(e) => {
                const val = e.target.value;
                setMobileQuery(val);
                update({ q: val.trim() || undefined });
              }}
              placeholder="Explorar coleções"
              aria-label="Explorar coleções"
              className="w-full min-w-0 rounded-md border border-line bg-[#26130b] py-2 pl-9 pr-3 text-xs text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
            aria-label="Abrir filtros"
            className={`grid size-9 shrink-0 place-items-center rounded-md border transition ${
              mobileFiltersOpen
                ? "border-accent bg-accent text-bg"
                : "border-line bg-[#26130b] text-fg hover:border-accent hover:text-accent"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>
        </form>

        {/* Gaveta de filtros no mobile */}
        {mobileFiltersOpen && (
          <div className="mx-3.5 mt-3 rounded-lg border border-line bg-[#1d0f09] p-3">
            <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-2 text-xs">
              <span className="font-bold text-fg">Filtros</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="text-[11px] text-accent"
              >
                Fechar
              </button>
            </div>
            <CatalogSidebar search={search} onChange={update} />
          </div>
        )}

        {/* Banner Hero Mobile */}
        <div className="mx-3.5 mt-3 overflow-hidden rounded-lg border border-line bg-gradient-to-r from-[#2b140b] via-[#3a190c] to-[#562410] p-4">
          <p className="text-[10px] font-medium text-accent">
            Bem-vindo à Kurio
          </p>
          <h1 className="mt-1 text-base font-extrabold leading-tight tracking-wide text-fg uppercase">
            SEJA DONO DA
            <br />
            CULTURA DIGITAL
          </h1>
          <p className="mt-1.5 max-w-60 text-[10px] leading-relaxed text-fg/80">
            Descubra NFTs selecionados de criadores de todo o mundo.
          </p>
          <button
            type="button"
            onClick={() => update({ tab: "all" })}
            className="mt-3 inline-flex items-center rounded bg-accent px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-bg transition hover:bg-accent-hover"
          >
            EXPLORAR
          </button>

          <div
            aria-hidden="true"
            className="mt-3 flex items-center justify-center gap-1.5"
          >
            <span className="h-1 w-4 rounded-full bg-accent" />
            <span className="size-1 rounded-full bg-fg/30" />
            <span className="size-1 rounded-full bg-fg/30" />
          </div>
        </div>

        {/* Abas + ordenação compacta */}
        <div className="mt-4 flex items-center justify-between gap-2 border-b border-line/70 px-3.5 text-[11px]">
          <div
            role="tablist"
            aria-label="Seções do catálogo mobile"
            className="flex min-w-0 items-center gap-4 overflow-x-auto no-scrollbar"
          >
            {tabs.map(([id, label]) => {
              const isActive = search.tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => update({ tab: id })}
                  className={`shrink-0 pb-2.5 transition ${
                    isActive
                      ? "border-b-2 border-accent font-bold text-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ordenação mobile */}
        <div className="flex items-center justify-between px-3.5 pt-3 text-[11px] text-muted">
          <span>{data ? `${data.total} itens` : "Carregando..."}</span>
          <select
            aria-label="Ordenar NFTs"
            value={search.sort}
            onChange={(e) =>
              update({ sort: e.target.value as HomeSearch["sort"] })
            }
            className="rounded border border-line bg-[#1d0f09] px-2 py-1 text-[11px] text-fg focus:border-accent focus:outline-none"
          >
            {sorts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Grade de 2 colunas de NFTs */}
        <div className="px-3.5 pt-3" aria-busy={isFetching}>
          {isError ? (
            <div
              role="alert"
              className="rounded-lg border border-line bg-[#1d0f09] p-6 text-center text-xs"
            >
              <p className="mb-3">
                {isAxiosError(error) && error.response
                  ? `Erro ${error.response.status} ao carregar o catálogo.`
                  : "Sem conexão com o servidor."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded bg-accent px-4 py-2 font-bold uppercase text-bg"
              >
                Tentar novamente
              </button>
            </div>
          ) : isPending ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-line bg-[#1d0f09] p-6 text-center text-xs">
              <p className="mb-3 text-muted">
                Nenhum NFT encontrado com esses filtros.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMobileQuery("");
                  navigate({ search: defaultSearch });
                }}
                className="rounded bg-accent px-3.5 py-1.5 text-[11px] font-bold text-bg"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div
                className={`grid grid-cols-2 gap-x-3 gap-y-4 ${
                  isFetching ? "opacity-70" : ""
                }`}
              >
                {items.map((nft, index) => {
                  const nftRecord = nft as CatalogNftItem &
                    Record<string, unknown>;
                  const title = nft.title ?? nft.name ?? "NFT Kurio";
                  const media = resolveNftMedia(nftRecord, index);
                  const priceValue = nft.priceEth ?? nft.price ?? "1.00";

                  return (
                    <Link
                      key={String(nft.id)}
                      to="/nft/$id"
                      params={{ id: String(nft.id) }}
                      className="group flex min-w-0 flex-col"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line/80 bg-[#26130b]">
                        {nft.badge && (
                          <span className="absolute left-2 top-2 z-20 rounded bg-[#180c07]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg">
                            {nft.badge}
                          </span>
                        )}

                        {media.primary ? (
                          <div className="relative h-full w-full">
                            <img
                              src={media.primary}
                              alt={title}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            {media.secondary &&
                              media.secondary !== media.primary && (
                                <img
                                  src={media.secondary}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                  className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-25 mix-blend-overlay transition duration-500 group-hover:scale-125"
                                />
                              )}
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#180c07]/60 via-transparent to-transparent"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-wider text-accent/80">
                            KURIO NFT
                          </div>
                        )}
                      </div>

                      <h2 className="mt-2 truncate text-xs font-semibold text-fg group-hover:text-accent">
                        {title}
                      </h2>
                      <p className="mt-0.5 text-[11px] font-bold text-accent">
                        {String(priceValue).replace(/\s*ETH$/i, "")} ETH
                      </p>
                    </Link>
                  );
                })}
              </div>

              {data && data.totalPages > 1 && (
                <div className="mt-5">
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onChange={(p) => update({ page: p })}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Barra inferior fixa mobile */}
        <nav
          aria-label="Navegação inferior mobile"
          className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-line bg-[#180c07]/95 px-2 backdrop-blur-sm md:hidden"
        >
          <Link
            to="/"
            search={defaultSearch}
            aria-label="Início"
            className={`grid size-10 place-items-center transition ${
              isHomeActive ? "text-accent" : "text-muted hover:text-fg"
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isHomeActive ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z" />
            </svg>
          </Link>

          <Link
            to="/mercado"
            search={defaultSearch}
            aria-label="Mercado"
            className={`grid size-10 place-items-center transition ${
              isMarketActive ? "text-accent" : "text-muted hover:text-fg"
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Link>

          <Link
            to="/carrinho"
            aria-label="Carrinho"
            className="relative grid size-10 place-items-center text-muted transition hover:text-fg"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 4h3l2 12h10l2-8H7" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="17" cy="20" r="1" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            to="/perfil"
                search={{ section: "profile" }}
            aria-label="Meu perfil"
            className="grid size-10 place-items-center text-muted transition hover:text-fg"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </nav>
      </div>
    </>
  );
}