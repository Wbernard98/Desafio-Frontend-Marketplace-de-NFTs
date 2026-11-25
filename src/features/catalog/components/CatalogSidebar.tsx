import { useState } from "react";
import { useFacets } from "../hooks";
import { Skeleton } from "../../../shared/ui/Skeleton";
import type { HomeSearch } from "../../../app/router";
import featuredNft from "../../../assets/nft-artwork-18.png";

interface Props {
  search: HomeSearch;
  onChange: (patch: Partial<HomeSearch>) => void;
}

const MAX_PRICE = 12.3;

export function CatalogSidebar({ search, onChange }: Props) {
  const { data, isPending, isError, refetch } = useFacets();
  const [min, setMin] = useState(search.min ?? "0.02");
  const [max, setMax] = useState(search.max ?? String(MAX_PRICE));

  const item = (
    id: string,
    label: string,
    count: number,
    active: boolean,
    onClick: () => void,
  ) => (
    <li key={id}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex w-full justify-between py-0.5 text-left hover:text-accent ${active ? "text-accent" : "text-muted"}`}
      >
        <span>{label}</span>
        <span>({count})</span>
      </button>
    </li>
  );

  return (
    <aside aria-label="Filtros" className="w-full shrink-0 bg-surface p-5 lg:w-60">
      <h2 className="mb-3.5 text-xs font-bold">Coleções</h2>
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <button
          type="button"
          onClick={() => refetch()}
          className="text-accent underline"
        >
          Falha ao carregar. Tentar de novo
        </button>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.collections.map((c) =>
            item(
              c.id,
              c.label,
              c.count,
              search.collection === c.id,
              () =>
                onChange({
                  collection: search.collection === c.id ? undefined : c.id,
                }),
            ),
          )}
        </ul>
      )}

      <h2 className="mb-3.5 mt-7 text-xs font-bold">Faixa de preço</h2>
      <div className="flex flex-col gap-2">
        <label className="text-muted">
          Mínimo (ETH)
          <input
            type="range"
            min={0}
            max={MAX_PRICE}
            step={0.01}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-full accent-accent"
          />
        </label>
        <label className="text-muted">
          Máximo (ETH)
          <input
            type="range"
            min={0}
            max={MAX_PRICE}
            step={0.01}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="w-full accent-accent"
          />
        </label>
        <p className="text-[10px] text-muted">
          Preço: {Number(min).toFixed(2)} - {Number(max).toFixed(2)} ETH
        </p>
        <button
          type="button"
          onClick={() => onChange({ min, max })}
          className="w-fit rounded-lg bg-accent px-3 py-1.5 font-bold uppercase text-bg hover:bg-accent-hover"
        >
          Aplicar
        </button>
      </div>

      <h2 className="mb-3.5 mt-7 text-xs font-bold">Rede</h2>
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? null : (
        <ul className="flex flex-col gap-2.5">
          {data.networks.map((n) =>
            item(
              n.id,
              n.label,
              n.count,
              search.network === n.id,
              () =>
                onChange({
                  network:
                    search.network === n.id
                      ? undefined
                      : (n.id as HomeSearch["network"]),
                }),
            ),
          )}
        </ul>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-[10px] font-bold uppercase text-accent">
          NFT em destaque
        </p>
        <h2 className="mb-3.5 text-sm font-bold uppercase text-fg">
          Oferta limitada
        </h2>
        <div className="aspect-square w-full overflow-hidden rounded-xl border-2 border-white bg-bg">
          <img
            src={featuredNft}
            alt="NFT em destaque de oferta limitada"
            className="size-full object-cover object-top"
          />
        </div>
      </div>
    </aside>
  );
}