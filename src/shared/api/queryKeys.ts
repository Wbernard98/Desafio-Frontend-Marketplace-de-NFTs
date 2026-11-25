/** Chaves de cache. Dados privados sempre incluem o dono (id do usuário ou "guest"): isolamento por usuário. */
export const keys = {
  session: (owner: string) => ["session", owner] as const,
  cart: (owner: string) => ["cart", owner] as const,
  quote: (owner: string, coupon: string | null) => ["quote", owner, coupon ?? ""] as const,
  favorites: (owner: string) => ["favorites", owner] as const,
  profile: (owner: string) => ["profile", owner] as const,
  wallets: (owner: string) => ["wallets", owner] as const,
  connection: (owner: string) => ["connection", owner] as const,
  order: (owner: string, id: string) => ["order", owner, id] as const,
  pendingOrder: (owner: string) => ["orders", "pending", owner] as const,
  nft: (id: string) => ["nft", id] as const,
};

/** Raízes de cache que pertencem a um usuário e são descartadas no logout/troca de usuário. */
export const PRIVATE_ROOTS = ["session", "cart", "quote", "favorites", "profile", "wallets", "connection", "order", "orders"] as const;
