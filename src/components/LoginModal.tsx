import { useEffect, useRef, useState, type FormEvent } from "react";
import googleIcon from "../assets/google 1.png";
import { useLogin, useRegister } from "../shared/auth/hooks";
import { toApiError } from "../shared/api/errors";
import { useFocusTrap } from "../shared/ui/useFocusTrap";

export type AuthUser = {
  email: string;
  name: string;
};

export type AuthMode = "login" | "register";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialMode?: AuthMode;
  /** Aviso exibido no topo (ex.: sessão expirada). */
  notice?: string | null;
  /** "page" renderiza a tela cheia de Login/Cadastro (sem sobreposição, sem botão fechar). */
  variant?: "modal" | "page";
  /** Chamado ao alternar entre Entrar e Criar conta (a tela cheia usa para trocar de rota). */
  onModeChange?: (mode: AuthMode) => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER_REGEX = /[A-Za-zÀ-ÿ]/;
const HAS_NUMBER_REGEX = /\d/;
const HAS_SPECIAL_CHAR_REGEX = /[^A-Za-z0-9À-ÿ\s]/;

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 6,
    hasLetter: HAS_LETTER_REGEX.test(password),
    hasNumber: HAS_NUMBER_REGEX.test(password),
    hasSpecial: HAS_SPECIAL_CHAR_REGEX.test(password),
  };
}

function validateLogin(email: string, password: string): string | null {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    return "Informe um endereço de e-mail válido.";
  }

  if (!password || password.length < 6) {
    return "A senha deve ter no mínimo 6 caracteres.";
  }

  return null;
}

function validateRegister(
  username: string,
  email: string,
  password: string,
  confirmPassword: string
): string | null {
  if (!username.trim()) {
    return "Informe seu nome de usuário.";
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    return "Informe um endereço de e-mail válido.";
  }

  const checks = getPasswordChecks(password);
  if (
    !checks.minLength ||
    !checks.hasLetter ||
    !checks.hasNumber ||
    !checks.hasSpecial
  ) {
    return "A senha deve ter no mínimo 6 caracteres e incluir letra, número e caractere especial.";
  }

  if (password !== confirmPassword) {
    return "A confirmação de senha não confere.";
  }

  return null;
}

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "login",
  notice = null,
  variant = "modal",
  onModeChange,
}: LoginModalProps) {
  const isPage = variant === "page";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useFocusTrap(dialogRef, isOpen && !isPage);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
      setMode(initialMode);
      setError(null);
      setFieldErrors({});
      setInfoMessage(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || isPage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPage, onClose]);

  if (!isOpen && !isPage) return null;

  const checks = getPasswordChecks(password);

  const passwordRequirements = [
    { key: "minLength", label: "Mínimo de 6 caracteres", met: checks.minLength },
    { key: "hasLetter", label: "Pelo menos 1 letra", met: checks.hasLetter },
    { key: "hasNumber", label: "Pelo menos 1 número", met: checks.hasNumber },
    {
      key: "hasSpecial",
      label: "Pelo menos 1 caractere especial (ex.: @, #, !, $)",
      met: checks.hasSpecial,
    },
  ] as const;

  const clearErrors = () => {
    clearErrors();
    if (Object.keys(fieldErrors).length) setFieldErrors({});
  };

  const switchMode = (nextMode: AuthMode) => {
    onModeChange?.(nextMode);
    setMode(nextMode);
    setError(null);
    setFieldErrors({});
    setInfoMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setFieldErrors({});
    setInfoMessage(null);

    const localError =
      mode === "login"
        ? validateLogin(email, password)
        : validateRegister(username, email, password, confirmPassword);
    if (localError) {
      setError(localError);
      return;
    }

    try {
      const trimmedEmail = email.trim();
      const result =
        mode === "login"
          ? await login.mutateAsync({ email: trimmedEmail, password })
          : await register.mutateAsync({ username: username.trim(), email: trimmedEmail, password });
      onSuccess({ email: result.user.email, name: result.user.name });
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors(apiError.fields);
      const detail = Object.values(apiError.fields).join(" ");
      setError(detail && apiError.code !== "email_conflict" ? `${apiError.message} ${detail}` : apiError.message);
    }
  };

  const handleForgotPassword = () => {
    setError(null);
    setInfoMessage("A recuperação de senha não está disponível nesta demonstração.");
  };

  const card = (
      <div className={isPage ? "relative w-full max-w-md px-1 py-7 text-fg sm:border sm:border-line sm:bg-[#1d0f09] sm:px-8" : "relative w-full max-w-md border border-line bg-[#1d0f09] px-6 py-7 text-fg shadow-2xl sm:px-8"}>
        {/* Botão fechar */}
        {!isPage && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de acesso"
            className="absolute right-4 top-4 grid size-7 place-items-center text-sm text-muted transition hover:text-fg"
          >
            ×
          </button>
        )}

        {/* Abas Entrar / Criar conta */}
        <div
          role="tablist"
          aria-label="Acesso à conta"
          className="flex items-center justify-center gap-4 text-sm font-bold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => switchMode("login")}
            className={`pb-1 transition ${
              mode === "login"
                ? "text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            Entrar
          </button>

          <span className="text-muted/50" aria-hidden="true">
            |
          </span>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            onClick={() => switchMode("register")}
            className={`pb-1 transition ${
              mode === "register"
                ? "text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            Criar conta
          </button>
        </div>

        <p
          id="auth-modal-title"
          className="mt-2 text-center text-[11px] leading-relaxed text-muted"
        >
          {mode === "login"
            ? "Entre para gerenciar sua carteira, coleção e perfil de criador"
            : "Crie seu perfil de colecionador e conecte uma carteira quando quiser."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "register" && (
            <div>
              <label htmlFor="register-username" className="sr-only">
                Nome de usuário
              </label>
              <input
                id="register-username"
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={error ? "auth-error" : undefined}
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearErrors();
                }}
                placeholder="Nome de usuário"
                className="w-full border border-line bg-[#26130b] px-3.5 py-2.5 text-xs text-fg placeholder:text-muted/65 focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="sr-only">
              E-mail
            </label>
            <input
              id="auth-email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={error ? "auth-error" : undefined}
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErrors();
              }}
              placeholder={
                mode === "login" ? "contato@email.com" : "Digite seu e-mail"
              }
              className="w-full border border-line bg-[#26130b] px-3.5 py-2.5 text-xs text-fg placeholder:text-muted/65 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="sr-only">
              Senha
            </label>
            <div className="relative flex items-center">
              <input
                id="auth-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={error ? "auth-error" : undefined}
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearErrors();
                }}
                placeholder={mode === "login" ? "••••••••••••" : "Senha"}
                className="w-full border border-line bg-[#26130b] px-3.5 py-2.5 pr-10 text-xs text-fg placeholder:text-muted/65 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 text-xs text-muted transition hover:text-fg"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            {mode === "login" ? (
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-accent underline hover:text-accent-hover"
                >
                  Esqueceu a senha?
                </button>
              </div>
            ) : (
              <ul
                aria-label="Requisitos da senha"
                className="mt-2 space-y-1 rounded border border-line/60 bg-[#22110a] px-3 py-2 text-[10px]"
              >
                {passwordRequirements.map((req) => (
                  <li
                    key={req.key}
                    className={`flex items-center gap-1.5 transition ${
                      req.met ? "font-semibold text-accent" : "text-muted"
                    }`}
                  >
                    <span aria-hidden="true">{req.met ? "✓" : "○"}</span>
                    <span>{req.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="register-confirm-password" className="sr-only">
                Confirmar senha
              </label>
              <div className="relative flex items-center">
                <input
                  id="register-confirm-password"
                aria-invalid={Boolean(fieldErrors.confirm)}
                aria-describedby={error ? "auth-error" : undefined}
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearErrors();
                  }}
                  placeholder="Confirmar senha"
                  className="w-full border border-line bg-[#26130b] px-3.5 py-2.5 pr-10 text-xs text-fg placeholder:text-muted/65 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação de senha"
                      : "Mostrar confirmação de senha"
                  }
                  className="absolute right-3 text-xs text-muted transition hover:text-fg"
                >
                  {showConfirmPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>
          )}

          {notice && (
            <p role="status" className="text-[11px] font-bold text-accent">
              {notice}
            </p>
          )}

          {error && (
            <p
              id="auth-error"
              role="alert"
              className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-200"
            >
              {error}
            </p>
          )}

          {infoMessage && (
            <p
              role="status"
              className="rounded border border-accent/50 bg-accent/10 px-3 py-2 text-[11px] text-accent"
            >
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="mt-2 w-full rounded bg-accent py-2.5 text-xs font-bold text-bg transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        {/* Continuar com redes */}
        <div className="mt-5">
          <p className="text-center text-[10px] text-muted">Ou continue com (indisponível nesta demonstração)</p>

          <div className="mt-3 space-y-2.5">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Indisponível nesta demonstração"
              className="flex w-full items-center justify-center gap-2.5 border border-line bg-[#26130b] py-2.5 text-xs text-fg transition hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <img
                src={googleIcon}
                alt=""
                aria-hidden="true"
                className="size-4 object-contain"
              />
              <span>Continuar com Google</span>
            </button>

            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Indisponível nesta demonstração"
              className="flex w-full items-center justify-center gap-2.5 border border-line bg-[#26130b] py-2.5 text-xs text-fg transition hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-bold text-[#4c8dff]" aria-hidden="true">
                f
              </span>
              <span>Continuar com Facebook</span>
            </button>
          </div>
        </div>
      </div>
  );

  if (isPage) {
    return (
      <div ref={dialogRef} className="flex justify-center px-4 py-10 sm:py-16">
        {card}
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
    >
      {card}
    </div>
  );
}
