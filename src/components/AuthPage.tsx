import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { LoginModal } from "./LoginModal";
import { useSession } from "../shared/auth/hooks";
import { safeRedirect } from "../shared/auth/authStore";

/** Telas Login e Cadastro (desktop e mobile): página cheia, mesma lógica do modal. */
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const { isAuthenticated } = useSession();
  const target = safeRedirect(redirect) ?? "/";

  // quem já está autenticado não precisa ver o formulário
  useEffect(() => {
    if (isAuthenticated) void navigate({ to: target, replace: true });
  }, [isAuthenticated, navigate, target]);

  return (
    <LoginModal
      variant="page"
      isOpen
      initialMode={mode}
      onClose={() => undefined}
      onModeChange={(next) => void navigate({ to: next === "login" ? "/login" : "/cadastro", search: redirect ? { redirect } : {}, replace: true })}
      onSuccess={() => void navigate({ to: target, replace: true })}
    />
  );
}
