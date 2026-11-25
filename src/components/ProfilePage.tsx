import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import logoutIcon from "../assets/Logout.png";
import { WalletsTab } from "./WalletsTab";
import { WishlistTab } from "./WishlistTab";
import { OutOfScopeNotice } from "./OutOfScope";
import { useChangePassword, useProfile, useUpdateProfile } from "../features/account/hooks";
import { useLogout } from "../shared/auth/hooks";
import { toApiError } from "../shared/api/errors";
import { Skeleton } from "../shared/ui/Skeleton";
import { announce } from "../shared/ui/announcer";
import type { Profile } from "../shared/api/types";

type ProfileSectionKey = "profile" | "wallets" | "activity" | "wishlist" | "offers" | "downloads" | "support";

const sidebarItems: { key: ProfileSectionKey; label: string; icon: string }[] = [
  { key: "profile", label: "Dados do perfil", icon: "👤" },
  { key: "wallets", label: "Carteiras", icon: "◎" },
  { key: "activity", label: "Atividade", icon: "↻" },
  { key: "wishlist", label: "Lista de interesse", icon: "♡" },
  { key: "offers", label: "Ofertas", icon: "◈" },
  { key: "downloads", label: "Arquivos baixados", icon: "⇩" },
  { key: "support", label: "Suporte", icon: "△" },
];

const outOfScopeTitle: Partial<Record<ProfileSectionKey, string>> = {
  activity: "Atividade",
  offers: "Ofertas",
  downloads: "Arquivos baixados",
  support: "Suporte",
};

const INPUT = "mt-1.5 w-full border border-line bg-[#1d0f09] px-3 py-2 text-xs text-fg focus:border-accent focus:outline-none";
const MAX_AVATAR_BYTES = 300 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const STRONG_PW = (p: string) => p.length >= 6 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9À-ÿ\s]/.test(p);

function PasswordInput({ id, label, value, onChange, error, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-muted">
        {label}
      </label>
      <div className="relative mt-1 flex items-center">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full border border-line bg-[#1d0f09] px-3 py-2 pr-9 text-xs text-fg focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={() => setShow((p) => !p)} aria-label={`${show ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} className="absolute right-2.5 text-xs text-muted hover:text-fg">
          {show ? "🙈" : "👁"}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[10px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function ProfileForm() {
  const { data, isPending, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<Profile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
    if (data && !form) setForm(data);
  }, [data, form]);

  if (isPending || !form) {
    if (isError) {
      return (
        <div role="alert" className="mt-5 border border-line bg-[#1d0f09] p-6 text-xs">
          {toApiError(error).message}{" "}
          <button type="button" onClick={() => void refetch()} className="underline">
            Tentar novamente
          </button>
        </div>
      );
    }
    return (
      <div className="mt-5 max-w-2xl space-y-4" aria-busy="true" aria-label="Carregando perfil">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const setField = <K extends keyof Profile>(key: K, value: Profile[K]) => setForm((p) => (p ? { ...p, [key]: value } : p));

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setFieldErrors((p) => ({ ...p, avatarUrl: "Use uma imagem PNG, JPG ou WebP." }));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFieldErrors((p) => ({ ...p, avatarUrl: "A imagem deve ter no máximo 300 KB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setField("avatarUrl", reader.result);
        setFieldErrors((p) => ({ ...p, avatarUrl: "" }));
        setStatus(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const errors: Record<string, string> = {};
    if (!form.displayName.trim()) errors.displayName = "Informe o nome de exibição.";
    if (!form.username.trim()) errors.username = "Informe o nome de usuário.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Informe um e-mail válido.";
    const wantsPassword = !!(currentPassword || newPassword || confirmNewPassword);
    if (wantsPassword) {
      if (!currentPassword) errors.currentPassword = "Informe a senha atual.";
      if (!STRONG_PW(newPassword)) errors.newPassword = "A nova senha deve ter no mínimo 6 caracteres, com letra, número e caractere especial.";
      if (newPassword !== confirmNewPassword) errors.confirmNewPassword = "A confirmação da nova senha não confere.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setStatus({ type: "error", text: "Revise os campos destacados." });
      return;
    }
    try {
      await update.mutateAsync(form);
      if (wantsPassword) {
        await changePassword.mutateAsync({ currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
      setStatus({ type: "success", text: wantsPassword ? "Perfil e senha atualizados com sucesso." : "Perfil do colecionador guardado com sucesso." });
      announce("Perfil guardado com sucesso.");
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors(apiError.fields);
      setStatus({ type: "error", text: apiError.message });
    }
  };

  const saving = update.isPending || changePassword.isPending;

  return (
    <form onSubmit={handleSave} noValidate className="mt-5 max-w-2xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            ["profile-display-name", "displayName", "Nome de exibição", "text"],
            ["profile-username", "username", "Nome de usuário", "text"],
            ["profile-email", "email", "E-mail", "email"],
          ] as const
        ).map(([id, key, label, type]) => (
          <div key={id}>
            <label htmlFor={id} className="block text-[11px] font-bold text-fg">
              {label}
              <span className="text-accent">*</span>
            </label>
            <input
              id={id}
              type={type}
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              aria-required="true"
              aria-invalid={!!fieldErrors[key]}
              aria-describedby={fieldErrors[key] ? `${id}-error` : undefined}
              className={INPUT}
            />
            {fieldErrors[key] && (
              <p id={`${id}-error`} role="alert" className="mt-1 text-[10px] text-red-300">
                {fieldErrors[key]}
              </p>
            )}
          </div>
        ))}

        <div>
          <span className="block text-[11px] font-bold text-fg">Avatar</span>
          <div className="mt-1.5 flex items-center gap-2.5">
            {form.avatarUrl && <img src={form.avatarUrl} alt="Avatar do colecionador" className="size-8 rounded border border-line object-cover" />}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className="sr-only" aria-label="Escolher avatar" tabIndex={-1} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded bg-accent px-3 py-1.5 text-[11px] font-bold text-bg transition hover:bg-accent-hover">
              Alterar
            </button>
            <button
              type="button"
              onClick={() => {
                setField("avatarUrl", null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-[11px] text-muted transition hover:text-fg"
            >
              Remover
            </button>
          </div>
          {fieldErrors.avatarUrl && (
            <p role="alert" className="mt-1 text-[10px] text-red-300">
              {fieldErrors.avatarUrl}
            </p>
          )}
        </div>
      </div>

      {/* Alterar senha */}
      <div className="mt-7 max-w-sm">
        <h2 className="text-xs font-bold text-fg">Alterar senha</h2>
        <div className="mt-3 space-y-3">
          <PasswordInput id="current-password" label="Senha atual" value={currentPassword} onChange={setCurrentPassword} error={fieldErrors.currentPassword} autoComplete="current-password" />
          <PasswordInput id="new-password" label="Nova senha" value={newPassword} onChange={setNewPassword} error={fieldErrors.newPassword} autoComplete="new-password" />
          <PasswordInput id="confirm-new-password" label="Confirmar nova senha" value={confirmNewPassword} onChange={setConfirmNewPassword} error={fieldErrors.confirmNewPassword} autoComplete="new-password" />
        </div>
      </div>

      <div className="mt-7 flex items-center gap-4">
        <button type="submit" disabled={saving} aria-busy={saving} className="rounded bg-accent px-6 py-2.5 text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar alterações"}
        </button>
      </div>

      {status && (
        <p role={status.type === "error" ? "alert" : "status"} className={`mt-4 rounded border p-2.5 text-[11px] ${status.type === "success" ? "border-accent/60 bg-accent/15 text-accent" : "border-red-500/60 bg-red-950/40 text-red-200"}`}>
          {status.text}
        </p>
      )}
    </form>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { section } = useSearch({ from: "/perfil" });
  const logout = useLogout();

  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/", search: { tab: "all", sort: "recent", page: 1 } }) });

  return (
    <div className="mx-auto max-w-300 px-6 pb-16 pt-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <h2 className="text-xs font-bold text-fg">Meu perfil</h2>
          <nav aria-label="Menu do perfil" className="mt-4 space-y-2.5 text-xs">
            {sidebarItems.map((item) => {
              const isActive = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => navigate({ to: "/perfil", search: { section: item.key } })}
                  className={`flex w-full items-center gap-2.5 py-1 text-left transition ${isActive ? "font-semibold text-accent" : "text-muted hover:text-fg"}`}
                >
                  <span aria-hidden="true" className="w-4 text-center text-[11px]">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button type="button" onClick={handleLogout} className="mt-4 flex w-full items-center gap-2.5 pt-2 text-left text-muted transition hover:text-accent">
              <img src={logoutIcon} alt="" aria-hidden="true" className="size-3.5 object-contain" />
              <span>Sair</span>
            </button>
          </nav>
        </aside>

        <section className="lg:col-span-9">
          {section === "wallets" ? (
            <WalletsTab />
          ) : section === "wishlist" ? (
            <WishlistTab />
          ) : outOfScopeTitle[section] ? (
            <OutOfScopeNotice title={outOfScopeTitle[section]!} />
          ) : (
            <>
              <h1 className="text-sm font-bold text-fg">Perfil do colecionador</h1>
              <ProfileForm />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
