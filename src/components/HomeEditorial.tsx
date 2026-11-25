import heroMonkey from "../assets/macaco-oculos.jpg";
import editorialRightMonkey from "../assets/macaco-blazer.jpg";
import bucketHatMonkey from "../assets/nft-artwork-18.png";
import headphonesMonkey from "../assets/frame-220.png";

const posts = [
  {
    meta: "12 de setembro | Leitura de 6 min",
    title: "Como funciona a propriedade de NFTs",
    excerpt: "Aprenda a colecionar, negociar e verificar ativos digitais.",
    href: "#catalogo",
    image: editorialRightMonkey,
    alt: "Macaco usando blazer claro, blusa verde e brinco de argola",
  },
  {
    meta: "13 de setembro | Leitura de 2 min",
    title: "10 artistas digitais para acompanhar",
    excerpt: "Conheça criadores que moldam a cultura digital.",
    href: "#catalogo",
    image: heroMonkey,
    alt: "Macaco usando óculos escuros e jaqueta verde",
  },
  {
    meta: "15 de setembro | Leitura de 3 min",
    title: "Raridade, atributos e procedência",
    excerpt: "Entenda raridade, procedência, direitos autorais e utilidade.",
    href: "#catalogo",
    image: bucketHatMonkey,
    alt: "Macaco usando chapéu bucket e moletom roxo",
  },
  {
    meta: "15 de setembro | Leitura de 2 min",
    title: "Como proteger sua carteira",
    excerpt: "Proteja sua carteira, seus ativos e sua identidade.",
    href: "#catalogo",
    image: headphonesMonkey,
    alt: "Macaco usando fone de ouvido verde e jaqueta clara",
  },
] as const;

const editorialBanners = [
  {
    title: "Lançamentos gênesis de edição limitada",
    description:
      "Colecione edições escassas diretamente dos criadores antes da revelação pública.",
    href: "#catalogo",
    image: heroMonkey,
    alt: "Macaco usando óculos escuros e jaqueta verde",
  },
  {
    title: "Arte digital selecionada e muito mais",
    description:
      "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.",
    href: "#catalogo",
    image: editorialRightMonkey,
    alt: "Macaco usando blazer claro, blusa verde e brinco de argola",
  },
] as const;

export function Hero() {
  return (
    <section className="mx-auto flex max-w-300 flex-col items-center justify-between gap-12 px-6 pb-14 pt-8 md:flex-row">
      <div className="max-w-130">
        <p className="mb-5 text-[10px] text-muted">Bem-vindo à Kurio</p>
        <h1 className="mb-5 text-4xl font-bold uppercase leading-tight md:text-[44px]">
          Seja dono do futuro da arte digital
        </h1>
        <p className="mb-7 max-w-105 text-muted">
          Descubra NFTs selecionados de criadores emergentes e consagrados, apoie artistas e tenha uma parte da cultura da internet.
        </p>
        <a
          href="#catalogo"
          className="inline-block rounded-lg bg-accent px-4 py-2.5 font-bold uppercase text-bg hover:bg-accent-hover"
        >
          Explorar
        </a>
      </div>
      <div className="flex aspect-square w-full max-w-105 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface">
        <img
          src={heroMonkey}
          alt="Macaco usando óculos escuros e jaqueta verde"
          className="h-full w-full object-cover object-center"
        />
      </div>
    </section>
  );
}

export function Editorial() {
  return (
    <>
      <section className="mx-auto grid max-w-300 gap-5 px-6 py-12 md:grid-cols-2">
        {editorialBanners.map((banner) => (
          <div key={banner.title} className="flex items-stretch overflow-hidden bg-surface">
            <div className="flex w-44 shrink-0 items-center justify-center overflow-hidden bg-bg/40 sm:w-48">
              <img
                src={banner.image}
                alt={banner.alt}
                className="h-full w-full rounded-xl object-cover object-center"
              />
            </div>
            <div className="flex flex-1 flex-col items-end justify-center p-5 text-right">
              <h2 className="mb-2 font-bold">{banner.title}</h2>
              <p className="mb-3.5 text-[10px] text-muted">{banner.description}</p>
              <a
                href={banner.href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-bold uppercase text-bg transition hover:bg-accent-hover"
              >
                <span>Explorar</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-300 px-6 pb-12 text-center">
        <h2 className="text-lg font-bold">Diário da Cunhagem</h2>
        <p className="mb-8 mt-2 text-[10px] text-muted">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
        <div className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => (
            <article key={post.title} className="flex flex-col bg-surface">
              <div className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-t-xl bg-bg/40">
                <img
                  src={post.image}
                  alt={post.alt}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <div>
                  <p className="mb-2 text-[9px] text-muted">{post.meta}</p>
                  <h3 className="mb-2 font-bold leading-snug">{post.title}</h3>
                  <p className="mb-3 text-[10px] leading-relaxed text-muted">
                    {post.excerpt}
                  </p>
                </div>
                <a
                  href={post.href}
                  className="inline-flex w-fit items-center gap-1 text-[10px] font-medium text-accent transition hover:underline"
                >
                  <span>Ler mais</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-300 px-6">
        <div className="grid gap-6 bg-surface p-7 md:grid-cols-4">
          {[
            [
              "W",
              "Segurança da carteira",
              "Proteja sua carteira e colecione arte digital verificada com confiança.",
            ],
            [
              "C",
              "Criadores em destaque",
              "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
            ],
            [
              "D",
              "Alertas de lançamentos",
              "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
            ],
          ].map(([l, t, d]) => (
            <div key={t}>
              <div
                className="mb-3 grid size-11 place-items-center rounded-full bg-accent font-bold text-bg"
                aria-hidden="true"
              >
                {l}
              </div>
              <h3 className="font-bold">{t}</h3>
              <p className="mt-1 text-[10px] text-muted">{d}</p>
            </div>
          ))}
          <form onSubmit={(e) => e.preventDefault()}>
            <h3 className="font-bold">Antecipe-se ao próximo lançamento</h3>
            <div className="mt-3 flex">
              <label htmlFor="news" className="sr-only">
                E-mail
              </label>
              <input
                id="news"
                type="email"
                disabled
                placeholder="digite seu e-mail..."
                className="min-w-0 flex-1 border border-line bg-bg p-2"
              />
              <button
                type="submit"
                disabled
                className="rounded-r-lg bg-accent px-3 font-bold uppercase text-bg opacity-70"
              >
                Enviar
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted">Newsletter indisponível nesta versão.</p>
          </form>
        </div>
      </section>
    </>
  );
}