import { Link } from "@tanstack/react-router";
import { fmtEth } from "../../../shared/lib/money";
import { Skeleton } from "../../../shared/ui/Skeleton";
import type { Nft } from "../types";
import gogglesMonkey from "../../../assets/macaco-oculos.jpg";
import bucketMonkey from "../../../assets/nft-artwork-18.png";
import blazerMonkey from "../../../assets/macaco-blazer.jpg";
import headphonesMonkey from "../../../assets/frame-220.png";

type ExtraNftCardData = {
  id: string;
  name?: string;
  priceEth?: string;
  originalPriceEth?: string;
  imageUrl?: string;
  imageAlt?: string;
  placeholderColor?: string;
};

const catalogArtworkByIndex = [
  gogglesMonkey,
  bucketMonkey,
  blazerMonkey,
  bucketMonkey,
  bucketMonkey,
  blazerMonkey,
  headphonesMonkey,
] as const;

const localHeadphonesNfts: readonly ExtraNftCardData[] = [
  {
    id: "golden-beat-207",
    name: "Golden Beat #207",
    priceEth: "0.99",
    imageUrl: headphonesMonkey,
    imageAlt: "Golden Beat #207 com fone de ouvido verde e jaqueta clara",
    placeholderColor: "#26140c",
  },
  {
    id: "golden-edition-220",
    imageUrl: headphonesMonkey,
    imageAlt: "Macaco com fone de ouvido verde e jaqueta clara",
    placeholderColor: "#26140c",
  },
  {
    id: "golden-signal-160",
    name: "Golden Signal #160",
    priceEth: "0.39",
    imageUrl: headphonesMonkey,
    imageAlt: "Golden Signal #160 com fone de ouvido verde e jaqueta clara",
    placeholderColor: "#26140c",
  },
];

function resolveCatalogImage(nft: Nft): string | undefined {
  if (nft.imageUrl) {
    return nft.imageUrl;
  }

  const normalized = `${nft.id} ${nft.name}`.toLowerCase();

  if (normalized.includes("emerald") || normalized.includes("042") || normalized.includes("842")) {
    return gogglesMonkey;
  }
  if (normalized.includes("sage") || normalized.includes("cosmic") || normalized.includes("violet") || normalized.includes("nomad")) {
    return bucketMonkey;
  }
  if (normalized.includes("neon") || normalized.includes("ivory") || normalized.includes("baron")) {
    return blazerMonkey;
  }
  if (normalized.includes("golden") || normalized.includes("beat") || normalized.includes("signal")) {
    return headphonesMonkey;
  }

  const hash = nft.id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return catalogArtworkByIndex[hash % catalogArtworkByIndex.length];
}

export function NftCard({ nft }: { nft: Nft }) {
  const imageSrc = resolveCatalogImage(nft);

  return (
    <Link to="/nft/$id" params={{ id: nft.id }} className="flex flex-col gap-2.5 bg-surface p-3.5 hover:bg-[#32190f]">
      <div className="aspect-square overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={nft.imageAlt}
            loading="lazy"
            width={320}
            height={320}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div role="img" aria-label={nft.imageAlt} className="h-full w-full" style={{ background: nft.placeholderColor }} />
        )}
      </div>
      <span>{nft.name}</span>
      <span>
        <b className="text-accent">{fmtEth(nft.priceEth)}</b>
        {nft.originalPriceEth && (
          <s className="ml-2 text-muted"><span className="sr-only">preço anterior </span>{fmtEth(nft.originalPriceEth)}</s>
        )}
      </span>
    </Link>
  );
}

export function ExtraNftCard({ nft }: { nft: ExtraNftCardData }) {
  return (
    <Link to="/nft/$id" params={{ id: nft.id }} className="flex flex-col gap-2.5 bg-surface p-3.5 hover:bg-[#32190f]">
      <div className="aspect-square overflow-hidden">
        {nft.imageUrl ? (
          <img
            src={nft.imageUrl}
            alt={nft.imageAlt ?? nft.name ?? "NFT"}
            loading="lazy"
            width={320}
            height={320}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div role="img" aria-label={nft.imageAlt ?? nft.name ?? "NFT"} className="h-full w-full" style={{ background: nft.placeholderColor }} />
        )}
      </div>
      {nft.name ? <span>{nft.name}</span> : null}
      {nft.priceEth ? (
        <span>
          <b className="text-accent">{fmtEth(nft.priceEth)}</b>
          {nft.originalPriceEth && (
            <s className="ml-2 text-muted"><span className="sr-only">preço anterior </span>{fmtEth(nft.originalPriceEth)}</s>
          )}
        </span>
      ) : null}
    </Link>
  );
}

export function HeadphonesExtraCards() {
  return (
    <>
      {localHeadphonesNfts.map((item) => (
        <ExtraNftCard key={item.id} nft={item} />
      ))}
    </>
  );
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 bg-surface p-3.5">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-3.5 w-2/5" />
    </div>
  );
}