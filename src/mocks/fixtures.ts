import type { Facets, Nft } from "../features/catalog/types";
import gogglesMonkey from "../assets/macaco-oculos.jpg";
import bucketMonkey from "../assets/nft-artwork-18.png";
import blazerMonkey from "../assets/macaco-blazer.jpg";
import headphonesMonkey from "../assets/frame-220.png";

const artworks = [gogglesMonkey, bucketMonkey, blazerMonkey, headphonesMonkey];
const names = ["Emerald Ape", "Sage Nomad", "Neon Vessel", "Cosmic Bloom", "Violet Nomad", "Ivory Baron", "Golden Beat", "Golden Signal"];
const colors = ["#c9b27a", "#aab58f", "#8fb09f", "#b9c09a", "#b7a9c9", "#d6c7a3"];
export const collectionIds = ["arte-digital", "fotografia", "musica", "arte-3d", "colecionaveis", "generativa", "jogos", "assinaturas", "utilidade"];
const networks = ["ethereum", "polygon", "solana"] as const;

const label: Record<string, string> = {
  "arte-digital": "Arte digital", fotografia: "Fotografia", musica: "Música", "arte-3d": "Arte 3D",
  colecionaveis: "Colecionáveis", generativa: "Generativa", jogos: "Jogos", assinaturas: "Assinaturas", utilidade: "Utilidade",
  ethereum: "Ethereum", polygon: "Polygon", solana: "Solana",
};

const genericDetail = (name: string) => ({
  reviewsCount: 4,
  attributes: "Raro, Colecionável",
  summary: `${name} é um colecionável digital da coleção Kurio Editions, verificado na rede e com acesso para colecionadores.`,
  detailsParagraphs: [
    `${name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token.`,
    "A propriedade inclui a arte em alta resolução e um registro permanente de procedência.",
  ],
  networkInfo: "Cunhado com procedência imutável e metadados armazenados no IPFS.",
  contractInfo: "Direitos autorais do criador: 5% nas vendas secundárias.",
  royaltiesInfo: "0x7A42...19E8 • Contrato inteligente ERC-721 verificado.",
});

const sumStock = (stock: Record<string, number>) => Object.values(stock).reduce((a, b) => a + b, 0);

/** Itens em destaque: ids estáveis usados nas telas do Figma (detalhe, carrinho, "também viram"). */
const hero: Nft[] = [
  { id: "emerald-ape-042", name: "Emerald Ape #042", tokenId: "#0042", price: "1.19", image: gogglesMonkey,
    alt: "Emerald Ape #042 com óculos escuros e jaqueta verde", coll: "arte-digital", net: "ethereum" as const, stock: { "1/1": 1, "1/10": 4, "1/50": 12, ABERTA: 30 } },
  { id: "violet-nomad-314", name: "Violet Nomad #314", tokenId: "#0089", price: "1.39", image: bucketMonkey,
    alt: "Violet Nomad #314", coll: "generativa", net: "polygon" as const, stock: { "1/1": 0, "1/10": 6, "1/50": 10, ABERTA: 25 } },
  { id: "ivory-baron-088", name: "Ivory Baron #088", tokenId: "#0552", price: "1.79", image: blazerMonkey,
    alt: "Ivory Baron #088", coll: "colecionaveis", net: "ethereum" as const, stock: { "1/1": 1, "1/10": 3, "1/50": 15, ABERTA: 40 } },
  { id: "cosmic-bloom-118", name: "Cosmic Bloom #118", tokenId: "#0118", price: "1.29", image: bucketMonkey,
    alt: "Cosmic Bloom #118", coll: "arte-3d", net: "solana" as const, stock: { "1/1": 1, "1/10": 5, "1/50": 9, ABERTA: 20 } },
  { id: "golden-beat-207", name: "Golden Beat #207", tokenId: "#0207", price: "0.99", image: headphonesMonkey,
    alt: "Golden Beat #207", coll: "musica", net: "ethereum" as const, stock: { "1/1": 1, "1/10": 2, "1/50": 8, ABERTA: 50 } },
  { id: "golden-signal-160", name: "Golden Signal #160", tokenId: "#0160", price: "0.39", image: headphonesMonkey,
    alt: "Golden Signal #160", coll: "musica", net: "polygon" as const, stock: { "1/1": 1, "1/10": 1, "1/50": 6, ABERTA: 60 } },
].map((h, i) => ({
  id: h.id,
  name: h.name,
  tokenId: h.tokenId,
  collectionId: h.coll,
  collectionName: "Kurio Apes",
  priceEth: h.price,
  network: h.net,
  imageUrl: h.image,
  imageAlt: h.alt,
  placeholderColor: colors[i % colors.length],
  stock: h.stock,
  available: sumStock(h.stock),
  maxPerOrder: 10,
  version: 1,
  createdAt: new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString(),
  hot: i % 2 === 0,
  ...genericDetail(h.name),
  ...(h.id === "emerald-ape-042"
    ? {
        reviewsCount: 19,
        attributes: "Óculos, Esmeralda, Raro",
        summary: "Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.",
        detailsParagraphs: [
          "Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.",
          "A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.",
        ],
        networkInfo: "Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.",
        contractInfo: "Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.",
        royaltiesInfo: "0x7A42...19E8 • Contrato inteligente ERC-721 verificado.",
      }
    : {}),
}));

const generated: Nft[] = Array.from({ length: 36 }, (_, i) => {
  const price = (0.39 + ((i * 37) % 160) / 100).toFixed(2);
  const name = `${names[i % names.length]} #${String(((i * 53) % 900) + 1).padStart(3, "0")}`;
  const stock = { "1/1": 1, "1/10": (i % 4) + 1, "1/50": (i % 5) + 2, ABERTA: (i % 3) * 5 };
  return {
    id: `nft-${i + 1}`,
    name,
    tokenId: `#${String(1000 + i)}`,
    priceEth: price,
    originalPriceEth: i % 7 === 2 ? (Number(price) + 0.3).toFixed(2) : undefined,
    collectionId: collectionIds[i % collectionIds.length],
    collectionName: label[collectionIds[i % collectionIds.length]],
    network: networks[i % 3],
    imageUrl: artworks[i % artworks.length],
    imageAlt: `Arte do NFT ${name}`,
    placeholderColor: colors[i % colors.length],
    stock,
    available: sumStock(stock),
    maxPerOrder: 10,
    version: 1,
    createdAt: new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString(),
    hot: i % 3 === 0,
    ...genericDetail(name),
  };
});

/** Determinístico: mesmo resultado em dev, demo e testes. */
export const nftFixtures: Nft[] = [...hero, ...generated];

export const buildFacets = (items: Nft[]): Facets => ({
  collections: collectionIds.map((id) => ({ id, label: label[id], count: items.filter((n) => n.collectionId === id).length })),
  networks: networks.map((id) => ({ id, label: label[id], count: items.filter((n) => n.network === id).length })),
});
