import { Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { fetchNft } from "../features/catalog/api";
import { keys } from "../shared/api/queryKeys";
import { useFavorites, useToggleFavorite } from "../features/favorites/hooks";
import { toApiError } from "../shared/api/errors";
import { fmtEth } from "../shared/lib/money";
import { Skeleton } from "../shared/ui/Skeleton";

/** Lista de interesse = favoritos do usuário autenticado (persistidos na API). */
export function WishlistTab() {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const ids = favorites.data?.nftIds ?? [];
  const nfts = useQueries({ queries: ids.map((id) => ({ queryKey: keys.nft(id), queryFn: () => fetchNft(id) })) });

  return (
    <section aria-labelledby="wishlist-title">
      <h1 id="wishlist-title" className="text-sm font-bold text-fg">
        Lista de interesse
      </h1>

      {favorites.isPending ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Carregando favoritos">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full" />
          ))}
        </div>
      ) : favorites.isError ? (
        <p role="alert" className="mt-5 text-xs text-red-300">
          {toApiError(favorites.error).message}{" "}
          <button type="button" onClick={() => void favorites.refetch()} className="underline">
            Tentar novamente
          </button>
        </p>
      ) : ids.length === 0 ? (
        <p className="mt-5 text-xs text-muted">
          Você ainda não favoritou nenhum NFT.{" "}
          <Link to="/" search={{ tab: "all", sort: "recent", page: 1 }} className="text-accent underline">
            Explorar NFTs
          </Link>
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {nfts.map((q, i) => {
            const nft = q.data;
            if (!nft) return <li key={ids[i]}><Skeleton className="aspect-[4/5] w-full" /></li>;
            return (
              <li key={nft.id} className="flex flex-col gap-2.5 bg-surface p-3">
                <Link to="/nft/$id" params={{ id: nft.id }} className="block aspect-square overflow-hidden rounded-xl bg-bg/40">
                  {nft.imageUrl ? (
                    <img src={nft.imageUrl} alt={nft.imageAlt} loading="lazy" className="size-full object-cover object-center" />
                  ) : (
                    <div role="img" aria-label={nft.imageAlt} className="size-full" style={{ background: nft.placeholderColor }} />
                  )}
                </Link>
                <Link to="/nft/$id" params={{ id: nft.id }} className="text-xs font-bold text-fg hover:text-accent">
                  {nft.name}
                </Link>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-accent">{fmtEth(nft.priceEth)}</span>
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ nftId: nft.id, favorite: false, name: nft.name })}
                    className="text-[11px] text-muted underline hover:text-accent"
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
