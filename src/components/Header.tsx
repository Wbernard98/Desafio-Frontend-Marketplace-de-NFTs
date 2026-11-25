import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import logoutIcon from "../assets/Logout.png";
import { LoginModal } from "./LoginModal";
import { useCartCount } from "../features/cart/hooks";
import { useLogout, useSession } from "../shared/auth/hooks";
import { authStore, safeRedirect } from "../shared/auth/authStore";
import { loginModal, useLoginModal } from "../shared/auth/loginModalStore";

const defaultHomeSearch = {
  tab: "all" as const,
  sort: "recent" as const,
  page: 1,
};

export function Header({ hideBarOnMobile = false }: { hideBarOnMobile?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  const cartCount = useCartCount();
  const { user, expired } = useSession();
  const logout = useLogout();
  const modal = useLoginModal();

  // Abre o modal quando uma rota protegida redireciona com ?login=1&redirect=...
  useEffect(() => {
    const params = new URLSearchParams(location.searchStr ?? "");
    if (params.get("login") === "1" && !user) {
      loginModal.open({ redirect: safeRedirect(params.get("redirect")), mode: params.get("mode") === "register" ? "register" : "login" });
    }
  }, [location.searchStr, user]);

  // Sessão expirada em qualquer tela: o modal abre sobre a página atual, preservando o contexto.
  useEffect(() => {
    if (expired) loginModal.open({ redirect: `${location.pathname}${location.searchStr ?? ""}` });
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseLogin = () => {
    const params = new URLSearchParams(location.searchStr ?? "");
    loginModal.close();
    authStore.dismissExpired();
    if (params.get("login") === "1") {
      navigate({
        to: location.pathname,
        search: (prev: Record<string, unknown>) => {
          return Object.fromEntries(Object.entries(prev).filter(([k]) => !["login", "redirect", "mode"].includes(k)));
        },
        replace: true,
      });
    }
  };

  const handleAuthSuccess = () => {
    const target = safeRedirect(modal.redirect);
    loginModal.close();
    if (target) navigate({ to: target, replace: true });
    else if (new URLSearchParams(location.searchStr ?? "").get("login") === "1") navigate({ to: "/", search: defaultHomeSearch, replace: true });
  };

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate({ to: "/", search: defaultHomeSearch }) });
  };

  const handleSearch = () => {
    navigate({ to: "/", search: defaultHomeSearch, hash: "catalogo" });
    requestAnimationFrame(() => document.getElementById("catalog-search")?.focus());
  };

  return (
    <>
      <header className={`mx-auto flex h-16 max-w-300 items-center justify-between px-6 ${hideBarOnMobile ? "max-md:hidden" : ""}`}>
        <a href="#conteudo" className="sr-only focus:not-sr-only">
          Ir para o conteúdo
        </a>

        <Link
          to="/"
          search={defaultHomeSearch}
          className="font-bold tracking-[0.2em]"
        >
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden gap-9 md:flex">
          <Link
            to="/"
            search={defaultHomeSearch}
            activeProps={{
              className: "border-b-2 border-accent py-1 text-accent",
            }}
            inactiveProps={{
              className: "py-1 text-fg/70 transition hover:text-accent",
            }}
            activeOptions={{ exact: true }}
          >
            Início
          </Link>

          <Link
            to="/"
            search={defaultHomeSearch}
            hash="catalogo"
            className="py-1 text-fg/70 transition hover:text-accent"
          >
            Mercado
          </Link>

          <Link
            to="/criadores"
            activeProps={{ className: "border-b-2 border-accent py-1 text-accent" }}
            inactiveProps={{ className: "py-1 text-fg/70 transition hover:text-accent" }}
          >
            Criadores
          </Link>

          <Link
            to="/aprenda"
            activeProps={{ className: "border-b-2 border-accent py-1 text-accent" }}
            inactiveProps={{ className: "py-1 text-fg/70 transition hover:text-accent" }}
          >
            Aprenda
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSearch}
            aria-label="Buscar"
            className="grid size-11 place-items-center hover:text-accent"
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
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
          </button>

          <Link
            to="/carrinho"
            aria-label={
              cartCount > 0
                ? `Carrinho (${cartCount} ${cartCount === 1 ? "item" : "itens"})`
                : "Carrinho"
            }
            className="relative grid size-11 place-items-center transition hover:text-accent"
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
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-bg">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                to="/perfil"
                search={{ section: "profile" }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-bg transition hover:bg-accent-hover"
              >
                <span className="max-w-28 truncate">{user.name}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:text-accent"
              >
                <img
                  src={logoutIcon}
                  alt=""
                  aria-hidden="true"
                  className="size-3.5 object-contain"
                />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/login", search: location.pathname === "/" ? {} : { redirect: location.href } })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold uppercase text-bg transition hover:bg-accent-hover"
            >
              <img
                src={logoutIcon}
                alt=""
                aria-hidden="true"
                className="size-4 object-contain"
              />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </header>

      <LoginModal
        isOpen={modal.open}
        initialMode={modal.mode}
        notice={expired ? "Sua sessão expirou. Entre novamente para continuar de onde parou." : null}
        onClose={handleCloseLogin}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}