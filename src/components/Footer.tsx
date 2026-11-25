import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";

const defaultHomeSearch = {
  tab: "all" as const,
  sort: "recent" as const,
  page: 1,
};

const features = [
  {
    badge: "W",
    title: "Segurança da carteira",
    description:
      "Proteja sua carteira e colecione arte digital verificada com confiança.",
  },
  {
    badge: "C",
    title: "Criadores em destaque",
    description:
      "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
  },
  {
    badge: "D",
    title: "Alertas de lançamentos",
    description:
      "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
  },
] as const;

const profileLinks = [
  "Meu perfil",
  "Minha coleção",
  "Atividade",
  "Estúdio do criador",
  "Lista de interesse",
] as const;

const helpLinks = [
  "Central de ajuda",
  "Como comprar NFTs",
  "Carteira e segurança",
  "Política do mercado",
  "Denunciar item",
] as const;

const collectionLinks = [
  "Arte digital",
  "Fotografia",
  "Música",
  "Arte 3D",
  "Utilidade",
] as const;

const wallets = ["METAMASK", "WALLETCONNECT", "COINBASE"] as const;

export function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="mx-auto mt-10 max-w-300 px-6 pb-8">
      <div className="overflow-hidden border border-line bg-[#1d0f09]">
        {/* Faixa superior: 3 medalhões + Antecipe-se ao próximo lançamento */}
        <div className="grid grid-cols-1 border-b border-line md:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <div
              key={item.badge}
              className="flex flex-col items-start gap-3 border-b border-line/60 px-6 py-8 lg:border-b-0 lg:border-r lg:border-line/60"
            >
              <span className="grid size-12 place-items-center rounded-full bg-accent text-sm font-bold text-bg">
                {item.badge}
              </span>
              <h2 className="text-xs font-bold text-fg">{item.title}</h2>
              <p className="text-[11px] leading-relaxed text-muted">
                {item.description}
              </p>
            </div>
          ))}

          <div className="px-6 py-8">
            <h2 className="text-xs font-bold leading-snug text-fg">
              Antecipe-se ao próximo lançamento
            </h2>
            <form onSubmit={handleSubmit} className="mt-3 flex items-stretch">
              <label htmlFor="newsletter-email" className="sr-only">
                Seu e-mail
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (subscribed) setSubscribed(false);
                }}
                placeholder="digite seu e-mail..."
                className="min-w-0 flex-1 border border-line bg-[#2a150d] px-3 py-2 text-[11px] text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="bg-accent px-4 py-2 text-[11px] font-bold text-bg transition hover:bg-accent-hover"
              >
                Enviar
              </button>
            </form>
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
              {subscribed
                ? "E-mail registado para os próximos lançamentos!"
                : "Receba lançamentos selecionados, histórias de criadores e novidades do mercado."}
            </p>
          </div>
        </div>

        {/* Faixa da marca e contato (4 colunas alinhadas) */}
        <div className="grid grid-cols-1 gap-4 border-b border-line bg-[#331a0f] px-6 py-4 text-[11px] md:grid-cols-2 md:items-center lg:grid-cols-4">
          <div>
            <Link
              to="/"
              search={defaultHomeSearch}
              className="font-bold tracking-[0.2em] text-fg"
            >
              KURIO
            </Link>
          </div>

          <div className="text-muted">
            Feito para colecionadores, criadores e cultura
          </div>

          <div className="text-muted">contato@email.com</div>

          <div className="text-muted">+55 11 4002 8922</div>
        </div>

        {/* Colunas de navegação, redes sociais e carteiras */}
        <div className="grid grid-cols-1 gap-8 px-6 py-8 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-3 font-bold text-fg">Meu perfil</h3>
            <ul className="space-y-2 text-muted">
              {profileLinks.map((label) => (
                <li key={label}>
                  <Link
                    to="/"
                    search={defaultHomeSearch}
                    className="transition hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-bold text-fg">Central de ajuda</h3>
            <ul className="space-y-2 text-muted">
              {helpLinks.map((label) => (
                <li key={label}>
                  <Link
                    to="/"
                    search={defaultHomeSearch}
                    className="transition hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-bold text-fg">Coleções</h3>
            <ul className="space-y-2 text-muted">
              {collectionLinks.map((label) => (
                <li key={label}>
                  <Link
                    to="/"
                    search={defaultHomeSearch}
                    className="transition hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="mb-3 font-bold text-fg">Redes sociais</h3>
              <div className="flex items-center gap-2">
                {[
                  { name: "Facebook", symbol: "f" },
                  { name: "Instagram", symbol: "◎" },
                  { name: "Twitter", symbol: "𝕏" },
                  { name: "LinkedIn", symbol: "in" },
                  { name: "YouTube", symbol: "▶" },
                ].map((social) => (
                  <a
                    key={social.name}
                    href="#conteudo"
                    aria-label={social.name}
                    className="grid size-7 place-items-center rounded border border-line bg-[#26130b] text-[10px] font-bold text-fg transition hover:border-accent hover:text-accent"
                  >
                    {social.symbol}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-bold text-fg">Carteiras compatíveis</h3>
              <div className="flex flex-wrap items-center gap-2">
                {wallets.map((wallet) => (
                  <span
                    key={wallet}
                    className="rounded border border-line bg-[#26130b] px-2 py-1 text-[9px] font-bold tracking-wider text-muted"
                  >
                    {wallet}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé inferior de copyright */}
        <div className="border-t border-line/60 px-6 py-4 text-center text-[10px] text-muted">
          © 2026 Kurio. Propriedade digital para todos.
        </div>
      </div>
    </footer>
  );
}