import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCartCount } from "../features/cart/hooks";
import type { HomeSearch } from "../app/router";

export type MobileNftItem = {
  id: string;
  title: string;
  priceEth: string;
  image: string;
  badge?: string;
  tab?: "all" | "new" | "hot";
  network?: "ethereum" | "polygon" | "solana";
  collection?: string;
};

type MobileHomeNftsProps = {
  items: MobileNftItem[];
  search: HomeSearch;
  onUpdateSearch: (patch: Partial<HomeSearch>) => void;
  onOpenFilters?: () => void;
};

const defaultSearch: HomeSearch = {
  tab: "all",
  sort: "recent",
  page: 1,
};

export function MobileHomeNfts({
  items,
  search,
  onUpdateSearch,
  onOpenFilters,
}: MobileHomeNftsProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const cartCount = useCartCount();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
    setQuery(search.q ?? "");
  }, [search.q]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    onUpdateSearch({ q: query.trim() || undefined, page: 1 });
  };

  const activeTab = search.tab ?? "all";

  const filteredItems = items.filter((item) => {
    if (activeTab === "new" && item.tab && item.tab !== "new") return false;
    if (activeTab === "hot" && item.tab && item.tab !== "hot") return false;
    if (search.network && item.network && item.network !== search.network) {
      return false;
    }
    if (
      search.collection &&
      item.collection &&
      item.collection.toLowerCase() !== search.collection.toLowerCase()
    ) {
      return false;
    }
    if (search.q && search.q.trim()) {
      const qLower = search.q.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(qLower) ||
        (item.collection?.toLowerCase().includes(qLower) ?? false)
      );
    }
    return true;
  });

  const tabs: { key: "all" | "new" | "hot"; label: string }[] = [
    { key: "all", label: "Todos os NFTs" },
    { key: "new", label: "Novos lançamentos" },
    { key: "hot", label: "Em alta" },
  ];

  return (
    <div className="block pb-20 md:hidden">
      {/* Busca + botão de filtro */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-2 px-4 pt-3"
      >
        <div className="relative flex flex-1 items-center">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const nextVal = e.target.value;
              setQuery(nextVal);
              onUpdateSearch({ q: nextVal.trim() || undefined, page: 1 });
            }}
            placeholder="Explorar coleções"
            aria-label="Explorar coleções"
            className="w-full rounded-md border border-line bg-[#26130b] py-2 pl-9 pr-3 text-xs text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenFilters) {
              onOpenFilters();
            } else {
              navigate({
                to: "/",
                search: { ...defaultSearch, ...search },
              });
            }
          }}
          aria-label="Filtrar coleções e redes"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-[#26130b] text-fg transition hover:border-accent hover:text-accent"
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

      {/* Banner Hero Mobile */}
      <div className="mx-4 mt-3 overflow-hidden rounded-lg border border-line bg-gradient-to-r from-[#2b140b] via-[#3a190c] to-[#562410] p-4">
        <p className="text-[10px] font-medium text-accent">
          Bem-vindo à Kurio
        </p>
        <h2 className="mt-1 text-base font-extrabold leading-tight tracking-wide text-fg uppercase">
          SEJA DONO DA
          <br />
          CULTURA DIGITAL
        </h2>
        <p className="mt-1.5 max-w-56 text-[10px] leading-relaxed text-fg/80">
          Descubra NFTs selecionados de criadores de todo o mundo.
        </p>
        <button
          type="button"
          onClick={() => onUpdateSearch({ tab: "all", page: 1 })}
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

      {/* Abas de navegação da vitrine */}
      <div
        role="tablist"
        aria-label="Categorias de NFTs"
        className="mt-4 flex items-center gap-5 border-b border-line/70 px-4 text-xs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onUpdateSearch({ tab: tab.key, page: 1 })}
              className={`pb-2.5 transition ${
                isActive
                  ? "border-b-2 border-accent font-bold text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grade de 2 colunas de NFTs */}
      {filteredItems.length === 0 ? (
        <div className="mx-4 mt-6 rounded-lg border border-line bg-[#1d0f09] p-6 text-center text-xs text-muted">
          <p>Nenhum NFT encontrado com os filtros atuais.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onUpdateSearch({
                q: undefined,
                collection: undefined,
                network: undefined,
                tab: "all",
                page: 1,
              });
            }}
            className="mt-3 rounded bg-accent px-3.5 py-1.5 text-[11px] font-bold text-bg"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-5 px-4">
          {filteredItems.map((nft) => (
            <Link
              key={nft.id}
              to="/nft/$id"
              params={{ id: nft.id }}
              className="group flex flex-col"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line/80 bg-[#26130b]">
                {nft.badge && (
                  <span className="absolute left-2 top-2 z-10 rounded bg-[#180c07]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg">
                    {nft.badge}
                  </span>
                )}
                <img
                  src={nft.image}
                  alt={nft.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>

              <h3 className="mt-2 truncate text-xs font-semibold text-fg group-hover:text-accent">
                {nft.title}
              </h3>
              <p className="mt-0.5 text-[11px] font-bold text-accent">
                {nft.priceEth} ETH
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Barra inferior fixa estilo Mobile / Início */}
      <nav
        aria-label="Navegação inferior mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-line bg-[#180c07]/95 px-2 backdrop-blur-sm md:hidden"
      >
        <Link
          to="/"
          search={defaultSearch}
          aria-label="Início"
          className="grid size-10 place-items-center text-accent"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z" />
          </svg>
        </Link>

        <Link
          to="/mercado"
          search={defaultSearch}
          aria-label="Mercado"
          className="grid size-10 place-items-center text-muted hover:text-fg"
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
          className="relative grid size-10 place-items-center text-muted hover:text-fg"
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
          className="grid size-10 place-items-center text-muted hover:text-fg"
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
  );
}