/* eslint-disable react-refresh/only-export-components -- módulo de rotas: exporta schema/defaults junto dos componentes de layout */
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { z } from "zod";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { HomePage } from "../routes/HomePage";
import { NftDetailPage } from "../components/NftDetailPage";
import { CartPage } from "../components/CartPage";
import { CheckoutPage } from "../components/CheckoutPage";
import { OrderPage } from "../components/OrderPage";
import { ProfilePage } from "../components/ProfilePage";
import { AuthPage } from "../components/AuthPage";
import { OutOfScopePage } from "../components/OutOfScope";
import { Announcer } from "../shared/ui/AnnouncerRegion";
import { getToken } from "../shared/auth/authStore";

export const homeSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  collection: z.string().optional().catch(undefined),
  network: z.enum(["ethereum", "polygon", "solana"]).optional().catch(undefined),
  min: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  max: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  tab: z.enum(["all", "new", "hot"]).catch("all"),
  sort: z.enum(["recent", "price-asc", "price-desc"]).catch("recent"),
  page: z.coerce.number().int().min(1).catch(1),
  login: z.coerce.number().optional().catch(undefined),
  mode: z.enum(["login", "register"]).optional().catch(undefined),
  /** Caminho interno para retomar o fluxo após o login. */
  redirect: z.string().optional().catch(undefined),
});
export type HomeSearch = z.infer<typeof homeSearchSchema>;

export const defaultHomeSearch: HomeSearch = {
  tab: "all",
  sort: "recent",
  page: 1,
};

const profileSearchSchema = z.object({
  section: z.enum(["profile", "wallets", "activity", "wishlist", "offers", "downloads", "support"]).catch("profile"),
});

/** Proteção dos fluxos privados: sem sessão, volta ao início pedindo login e retoma depois. */
function requireAuth({ location }: { location: { href: string } }) {
  if (!getToken()) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
}

function RootLayout() {
  const location = useLocation();
  const hideFooter = location.pathname === "/perfil";
  // carrinho, pagamento, pedido e detalhe têm barra própria nos frames mobile
  const ownMobileBar = /^\/(carrinho|pagamento|pedido\/|nft\/)/.test(location.pathname);

  return (
    <div className="min-h-screen bg-bg">
      <Header hideBarOnMobile={ownMobileBar} />
      <main id="conteudo">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
      <Announcer />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="mx-auto max-w-300 px-6 py-24 text-center">
      <h1 className="mb-4 text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" search={defaultHomeSearch} className="text-accent underline">
        Voltar ao início
      </Link>
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s) => homeSearchSchema.parse(s),
  component: HomePage,
});

const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: "/nft/$id", component: NftDetailPage });
const carrinhoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/carrinho", component: CartPage });
const pagamentoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pagamento", beforeLoad: requireAuth, component: CheckoutPage });
const pedidoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pedido/$id", beforeLoad: requireAuth, component: OrderPage });
const perfilRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/perfil",
  validateSearch: (s) => profileSearchSchema.parse(s),
  beforeLoad: requireAuth,
  component: ProfilePage,
});

/* Atalhos para telas previstas: redirecionam para o fluxo correspondente. */
const carteirasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/carteiras",
  beforeLoad: () => {
    throw redirect({ to: "/perfil", search: { section: "wallets" } });
  },
});
const authSearchSchema = z.object({ redirect: z.string().optional().catch(undefined) });
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (s) => authSearchSchema.parse(s),
  component: () => <AuthPage mode="login" />,
});
const cadastroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cadastro",
  validateSearch: (s) => authSearchSchema.parse(s),
  component: () => <AuthPage mode="register" />,
});
const criadoresRoute = createRoute({ getParentRoute: () => rootRoute, path: "/criadores", component: () => <OutOfScopePage title="Criadores" /> });
const aprendaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/aprenda", component: () => <OutOfScopePage title="Aprenda" /> });
const mercadoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mercado",
  beforeLoad: () => {
    throw redirect({ to: "/", search: defaultHomeSearch });
  },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  carrinhoRoute,
  pagamentoRoute,
  pedidoRoute,
  perfilRoute,
  carteirasRoute,
  loginRoute,
  cadastroRoute,
  criadoresRoute,
  aprendaRoute,
  mercadoRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
