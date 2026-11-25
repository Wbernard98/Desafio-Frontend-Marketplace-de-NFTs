import { useEffect, useState, type FormEvent } from "react";
import { useUpdateWallets, useWallets } from "../features/account/hooks";
import { toApiError } from "../shared/api/errors";
import { Skeleton } from "../shared/ui/Skeleton";
import { announce } from "../shared/ui/announcer";
import type { UpdateWalletsBody, Wallet } from "../shared/api/types";

type WalletForm = Omit<Wallet, "id">;

const EMPTY: WalletForm = { nickname: "", network: "ethereum", address: "", type: "metamask", ensName: "", ensSuffix: ".eth", referralCode: "" };
const INPUT = "mt-1.5 w-full border border-line bg-[#1d0f09] px-3 py-2 text-xs text-fg focus:border-accent focus:outline-none";
const strip = (w: Wallet): WalletForm => ({ nickname: w.nickname, network: w.network, address: w.address, type: w.type, ensName: w.ensName, ensSuffix: w.ensSuffix, referralCode: w.referralCode });

function WalletFields({ prefix, value, onChange, errors, showReferral }: { prefix: "primary" | "secondary"; value: WalletForm; onChange: (next: WalletForm) => void; errors: Record<string, string>; showReferral: boolean }) {
  const set = <K extends keyof WalletForm>(k: K, v: WalletForm[K]) => onChange({ ...value, [k]: v });
  const err = (k: string) => errors[`${prefix}.${k}`];
  const field = (k: string, label: string, required: boolean, control: (id: string, describedBy?: string) => React.ReactNode) => {
    const id = `${prefix}-${k}`;
    return (
      <div>
        <label htmlFor={id} className="block text-[11px] font-bold text-fg">
          {label}
          {required && <span className="text-accent">*</span>}
        </label>
        {control(id, err(k) ? `${id}-error` : undefined)}
        {err(k) && (
          <p id={`${id}-error`} role="alert" className="mt-1 text-[10px] text-red-300">
            {err(k)}
          </p>
        )}
      </div>
    );
  };
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {field("nickname", "Apelido da carteira", true, (id, d) => (
        <input id={id} type="text" value={value.nickname} onChange={(e) => set("nickname", e.target.value)} aria-required="true" aria-invalid={!!err("nickname")} aria-describedby={d} className={INPUT} />
      ))}
      {field("network", "Rede", true, (id, d) => (
        <select id={id} value={value.network} onChange={(e) => set("network", e.target.value as WalletForm["network"])} aria-required="true" aria-invalid={!!err("network")} aria-describedby={d} className={INPUT}>
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
          <option value="solana">Solana</option>
        </select>
      ))}
      {field("address", "Endereço da carteira", true, (id, d) => (
        <input id={id} type="text" value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="Endereço 0x da carteira" aria-required="true" aria-invalid={!!err("address")} aria-describedby={d} className={INPUT} />
      ))}
      {field("type", "Tipo de carteira", true, (id, d) => (
        <select id={id} value={value.type} onChange={(e) => set("type", e.target.value as WalletForm["type"])} aria-required="true" aria-invalid={!!err("type")} aria-describedby={d} className={INPUT}>
          <option value="metamask">MetaMask</option>
          <option value="coinbase">Coinbase Wallet</option>
          <option value="walletconnect">WalletConnect</option>
        </select>
      ))}
      {showReferral &&
        field("referralCode", "Código de indicação", true, (id, d) => (
          <input id={id} type="text" value={value.referralCode} onChange={(e) => set("referralCode", e.target.value)} aria-required="true" aria-invalid={!!err("referralCode")} aria-describedby={d} className={INPUT} />
        ))}
      {field("ensName", "Nome ENS", false, (id) => (
        <div className="mt-1.5 flex items-stretch gap-2">
          <select aria-label="Sufixo ENS" value={value.ensSuffix} onChange={(e) => set("ensSuffix", e.target.value as WalletForm["ensSuffix"])} className="w-20 border border-line bg-[#1d0f09] px-2.5 py-2 text-xs text-fg focus:border-accent focus:outline-none">
            <option value=".eth">.eth</option>
            <option value=".sol">.sol</option>
          </select>
          <input id={id} type="text" value={value.ensName} onChange={(e) => set("ensName", e.target.value)} className="min-w-0 flex-1 border border-line bg-[#1d0f09] px-3 py-2 text-xs text-fg focus:border-accent focus:outline-none" />
        </div>
      ))}
    </div>
  );
}

export function WalletsTab() {
  const { data, isPending, isError, error, refetch } = useWallets();
  const update = useUpdateWallets();

  const [primary, setPrimary] = useState<WalletForm>(EMPTY);
  const [secondary, setSecondary] = useState<WalletForm | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    if (data && !loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
      setPrimary(strip(data.primary));
      setSecondary(data.secondary ? strip(data.secondary) : null);
      setLoaded(true);
    }
  }, [data, loaded]);

  if (isError) {
    return (
      <div role="alert" className="border border-line bg-[#1d0f09] p-6 text-xs">
        {toApiError(error).message}{" "}
        <button type="button" onClick={() => void refetch()} className="underline">
          Tentar novamente
        </button>
      </div>
    );
  }
  if (isPending || !loaded) {
    return (
      <div className="max-w-3xl space-y-4" aria-busy="true" aria-label="Carregando carteiras">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const handleSameAsPrimary = (checked: boolean) => {
    setSecondary(checked ? { ...primary, nickname: primary.nickname || "Carteira Principal" } : { ...EMPTY, address: "" });
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const body: UpdateWalletsBody = { primary, secondary };
    update.mutate(body, {
      onSuccess: () => {
        setErrors({});
        setFeedback({ type: "success", message: "Carteiras salvas e disponíveis para pagamentos e recebimento de NFTs." });
        announce("Carteiras salvas com sucesso.");
      },
      onError: (err) => {
        const apiError = toApiError(err);
        setErrors(apiError.fields);
        setFeedback({ type: "error", message: Object.keys(apiError.fields).length ? "Revise os campos destacados." : apiError.message });
      },
    });
  };

  return (
    <form onSubmit={handleSave} noValidate className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-fg">Carteira principal</h1>
          <p className="mt-1 text-[11px] text-muted">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </div>
        {!secondary && (
          <button type="button" onClick={() => setSecondary({ ...EMPTY })} className="shrink-0 text-[11px] font-medium text-accent transition hover:text-accent-hover">
            + Adicionar
          </button>
        )}
      </div>

      <WalletFields prefix="primary" value={primary} onChange={setPrimary} errors={errors} showReferral />

      {secondary && (
        <section className="mt-8" aria-labelledby="secondary-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="secondary-title" className="text-sm font-bold text-fg">
              Carteira secundária
            </h2>
            <button type="button" onClick={() => setSecondary(null)} className="text-[11px] text-muted underline hover:text-accent">
              Remover carteira secundária
            </button>
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-fg">
            <input type="checkbox" onChange={(e) => handleSameAsPrimary(e.target.checked)} className="accent-accent" />
            <span>Igual à carteira principal</span>
          </label>
          <WalletFields prefix="secondary" value={secondary} onChange={setSecondary} errors={errors} showReferral={false} />
        </section>
      )}

      <div className="mt-7 flex items-center gap-4">
        <button type="submit" disabled={update.isPending} aria-busy={update.isPending} className="rounded bg-accent px-6 py-2.5 text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-60">
          {update.isPending ? "Salvando…" : "Salvar carteiras"}
        </button>
      </div>

      {feedback && (
        <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded border p-2.5 text-[11px] ${feedback.type === "success" ? "border-accent/60 bg-accent/15 text-accent" : "border-red-500/60 bg-red-950/40 text-red-200"}`}>
          {feedback.message}
        </p>
      )}
    </form>
  );
}
