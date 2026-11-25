import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useApplyCoupon, useCart, useCoupon, useOwner, useQuote } from "../features/cart/hooks";
import { useProfile, useWallets } from "../features/account/hooks";
import { useConnectWallet, useCreateOrder, useDisconnectWallet, usePendingOrder, useWalletConnection } from "../features/orders/hooks";
import { idempotencyKeyFor, loadDraft, releaseIdempotencyKey, saveDraft } from "../features/orders/localState";
import { useSession } from "../shared/auth/hooks";
import { authStore } from "../shared/auth/authStore";
import { loginModal } from "../shared/auth/loginModalStore";
import { toApiError } from "../shared/api/errors";
import { keys } from "../shared/api/queryKeys";
import { fmtEthDp } from "../shared/lib/money";
import { useRealtimeStatus } from "../shared/realtime/status";
import { Skeleton } from "../shared/ui/Skeleton";
import { useFocusTrap } from "../shared/ui/useFocusTrap";
import { MobileTopBar } from "./MobileTopBar";
import type { CreateOrderBody, Quote, Wallet, WalletNetwork } from "../shared/api/types";

const defaultHomeSearch = {
  tab: "all" as const,
  sort: "recent" as const,
  page: 1,
};

const INPUT = "mt-1.5 w-full border border-line bg-[#1d0f09] px-3 py-2 text-xs text-fg focus:border-accent focus:outline-none read-only:cursor-not-allowed read-only:opacity-70";
const LABEL = "block text-[11px] font-bold text-fg";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WALLET_LABEL: Record<string, string> = { metamask: "MetaMask", coinbase: "Coinbase Wallet", walletconnect: "WalletConnect" };
const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {required && <span className="text-accent">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[10px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Revisão antes do envio. Valores que mudam exigem nova confirmação explícita. */
function ReviewDialog(props: {
  quote: Quote;
  acknowledged: boolean;
  onAcknowledge: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  disabledReason: string | null;
  walletLabel: string;
  network: string;
  email: string;
  error: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, true);
  const { quote } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !props.pending) props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="review-title" tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-line bg-[#1d0f09] px-6 py-7 text-fg shadow-2xl">
        <h2 id="review-title" className="text-sm font-bold">
          Revisar pedido
        </h2>

        {!props.acknowledged && (
          <div role="alert" className="mt-4 border border-accent/60 bg-accent/15 p-3 text-[11px] text-accent">
            Preço, disponibilidade ou taxas mudaram desde a sua revisão. Confira o novo resumo e aceite os novos valores para continuar.
            <button type="button" onClick={props.onAcknowledge} className="mt-2 block rounded bg-accent px-3 py-1.5 text-[11px] font-bold text-bg hover:bg-accent-hover">
              Aceitar novos valores
            </button>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {quote.lines.map((l) => (
            <li key={`${l.nftId}-${l.edition}`} className="flex items-center justify-between gap-3 border border-line/50 bg-[#26130b] px-3 py-2 text-[11px]">
              <span className="min-w-0 truncate font-bold">
                {l.name} <span className="font-normal text-muted">· Edição {l.edition} · x{l.quantity}</span>
              </span>
              <span className="shrink-0 font-bold text-accent">{fmtEthDp(l.lineTotalEth, 2)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-line/60 pt-3 text-[11px]">
          <div className="flex justify-between"><dt className="text-muted">Carteira</dt><dd>{props.walletLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Rede</dt><dd className="capitalize">{props.network}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">E-mail</dt><dd>{props.email}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{fmtEthDp(quote.subtotalEth, 2)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Desconto{quote.couponCode ? ` (${quote.couponCode})` : ""}</dt><dd>(-) {fmtEthDp(quote.discountEth, 2)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Taxa de rede</dt><dd>{fmtEthDp(quote.networkFeeEth, 3)}</dd></div>
          <div className="flex justify-between border-t border-line/60 pt-2 text-sm font-bold"><dt>Total</dt><dd className="text-accent">{fmtEthDp(quote.totalEth, 3)}</dd></div>
        </dl>

        {props.error && (
          <p role="alert" className="mt-4 rounded border border-red-500/60 bg-red-950/40 p-2.5 text-[11px] text-red-200">
            {props.error}
          </p>
        )}
        {props.disabledReason && <p className="mt-3 text-[11px] text-muted">{props.disabledReason}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={props.onCancel} disabled={props.pending} className="flex-1 border border-line py-2.5 text-xs font-bold text-fg hover:border-accent disabled:opacity-50">
            Voltar e editar
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            disabled={props.pending || !props.acknowledged || !!props.disabledReason}
            aria-busy={props.pending}
            className="flex-1 rounded bg-accent py-2.5 text-xs font-bold text-bg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {props.pending ? "Enviando…" : "Confirmar compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const owner = useOwner();
  const { isAuthenticated, user } = useSession();
  const realtime = useRealtimeStatus();

  const cart = useCart();
  const quote = useQuote();
  const coupon = useCoupon();
  const applyCoupon = useApplyCoupon();
  const profile = useProfile();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();
  const pendingOrder = usePendingOrder();
  const createOrder = useCreateOrder();

  const draft = typeof window !== "undefined" ? loadDraft() : null;
  const validDraft = draft && (!draft.userId || draft.userId === authStore.get().userId || !authStore.get().userId) ? draft : null;

  const [displayName, setDisplayName] = useState(validDraft?.displayName ?? "");
  const [email, setEmail] = useState(validDraft?.email ?? "");
  const [notes, setNotes] = useState(validDraft?.notes ?? "");
  const [walletId, setWalletId] = useState<"primary" | "secondary">(validDraft?.walletId ?? "primary");
  const [network, setNetwork] = useState<string>(validDraft?.network ?? "");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledgedToken, setAcknowledgedToken] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = useRef(false);

  const primary = wallets.data?.primary;
  const secondary = wallets.data?.secondary ?? null;
  const registered = [primary, secondary].filter((w): w is Wallet => !!w && !!w.address);
  const wallet = registered.find((w) => w.id === walletId) ?? registered[0];
  const conn = connection.data ?? null;
  const connected = !!wallet && !!conn && conn.walletId === wallet.id && !!network && conn.network === network;

  // pré-preenche com os dados do perfil/carteira (sem sobrescrever o que o usuário já digitou)
  useEffect(() => {
    if (profile.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
      setDisplayName((v) => v || profile.data.displayName);
      setEmail((v) => v || profile.data.email);
    }
  }, [profile.data]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local de formulário com dados vindos do servidor/URL
    if (wallet?.network) setNetwork((v) => v || (wallet.network as string));
  }, [wallet?.network]);

  // rascunho: sobrevive à expiração de sessão para retomada
  useEffect(() => {
    saveDraft({ userId: authStore.get().userId ?? undefined, displayName, email, notes, walletId, network });
  }, [displayName, email, notes, walletId, network]);

  // pedido pendente (refresh/reconexão): retoma o mesmo pedido em vez de permitir outra compra
  useEffect(() => {
    if (pendingOrder.data) void navigate({ to: "/pedido/$id", params: { id: pendingOrder.data.id }, replace: true });
  }, [pendingOrder.data, navigate]);

  const q = quote.data;
  const lines = q?.lines ?? [];
  const blocking = q?.issues.filter((i) => i.kind !== "price_changed") ?? [];
  const quoteStale = !!q && acknowledgedToken !== null && q.token !== acknowledgedToken;

  const handleApplyPromo = (e: FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) {
      setPromoMessage({ type: "error", text: "Introduza um código promocional." });
      return;
    }
    applyCoupon.mutate(promoCode, {
      onSuccess: (res) => setPromoMessage({ type: "ok", text: `Código ${res.couponCode} aplicado.` }),
      onError: (err) => setPromoMessage({ type: "error", text: toApiError(err).message }),
    });
  };

  const handleConnect = () => {
    if (!wallet || !network) {
      setFeedback("Selecione uma carteira e uma rede antes de conectar.");
      return;
    }
    setFeedback(null);
    connectWallet.mutate({ walletId: wallet.id, network: network as WalletNetwork }, { onError: (err) => setFeedback(toApiError(err).message) });
  };

  const handleReview = (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitError(null);
    const errors: Record<string, string> = {};
    if (!displayName.trim()) errors["display-name"] = "Informe o nome de exibição.";
    if (!EMAIL_RE.test(email.trim())) errors["collector-email"] = "Informe um e-mail válido.";
    if (!network) errors.network = "Selecione uma rede.";
    if (!wallet) errors["wallet-address"] = "Cadastre uma carteira para continuar.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFeedback("Revise os campos destacados antes de continuar.");
      return;
    }
    if (lines.length === 0) {
      setFeedback("O seu carrinho está vazio. Adicione um NFT antes de confirmar.");
      return;
    }
    if (blocking.length) {
      setFeedback(blocking[0].message);
      return;
    }
    setAcknowledgedToken(q?.token ?? null);
    setReviewOpen(true);
  };

  const handleConfirm = () => {
    if (!q || !wallet || submitting.current) return;
    submitting.current = true; // bloqueia cliques repetidos antes mesmo do estado do React atualizar
    setSubmitError(null);
    const body: CreateOrderBody = {
      quoteToken: q.token,
      couponCode: q.couponCode,
      walletType: wallet.type as CreateOrderBody["walletType"],
      network: network as WalletNetwork,
      collectorName: displayName.trim(),
      collectorEmail: email.trim(),
      notes: notes.trim() || undefined,
    };
    // mesma tentativa => mesma chave: reenvio após timeout recupera o mesmo pedido
    const key = idempotencyKeyFor(JSON.stringify(body));
    createOrder.mutate(
      { body, key },
      {
        onSuccess: (order) => {
          setReviewOpen(false);
          void navigate({ to: "/pedido/$id", params: { id: order.id } });
        },
        onError: async (err) => {
          const e = toApiError(err);
          if (e.code === "quote_changed" || e.code === "availability_conflict") {
            const fresh = (e.details as { quote?: Quote } | undefined)?.quote;
            if (fresh) qc.setQueryData(keys.quote(owner, coupon), fresh);
            void qc.invalidateQueries({ queryKey: keys.cart(owner) });
            releaseIdempotencyKey();
            setSubmitError(e.message);
          } else if (e.code === "idempotency_conflict" && (e.details as { order?: { id: string } } | undefined)?.order) {
            void navigate({ to: "/pedido/$id", params: { id: (e.details as { order: { id: string } }).order.id } });
          } else if (e.transient) {
            // timeout/queda: o pedido pode ter sido criado. Consulta antes de oferecer novo envio.
            const found = await pendingOrder.refetch();
            if (found.data) void navigate({ to: "/pedido/$id", params: { id: found.data.id } });
            else setSubmitError(`${e.message} Se tentar de novo, o mesmo pedido será recuperado — nenhuma compra duplicada.`);
          } else if (e.code === "wallet_not_connected") {
            void qc.invalidateQueries({ queryKey: keys.connection(owner) });
            setSubmitError(e.message);
          } else {
            setSubmitError(e.message);
          }
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-300 px-6 py-24 text-center">
        <h1 className="mb-3 text-lg font-bold">Entre para finalizar a compra</h1>
        <p className="mb-6 text-xs text-muted">Seus itens e os dados já preenchidos continuam salvos.</p>
        <button type="button" onClick={() => loginModal.open({ redirect: "/pagamento" })} className="rounded-lg bg-accent px-6 py-2.5 text-xs font-bold text-bg hover:bg-accent-hover">
          Entrar
        </button>
      </div>
    );
  }

  const noWallets = wallets.isSuccess && registered.length === 0;
  const reviewDisabledReason = !connected ? "Conecte a carteira selecionada na rede escolhida para enviar o pedido." : blocking.length ? blocking[0].message : null;

  return (
    <div className="mx-auto max-w-300 px-6 pb-16 pt-4">
      <MobileTopBar title="Pagamento com carteira" />
      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-6 hidden items-center gap-2 text-xs text-muted md:flex">
        <Link to="/" search={defaultHomeSearch} className="hover:text-accent">Início</Link>
        <span aria-hidden="true">/</span>
        <Link to="/carrinho" className="hover:text-accent">Carrinho</Link>
        <span aria-hidden="true">/</span>
        <span className="text-fg">Pagamento</span>
      </nav>

      {realtime === "reconnecting" && (
        <p role="status" className="mb-4 border border-accent/60 bg-accent/10 px-3 py-2 text-[11px] text-accent">
          Conexão em tempo real interrompida. Vamos reconciliar o resumo assim que ela voltar.
        </p>
      )}

      <form onSubmit={handleReview} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Coluna esquerda: Perfil do colecionador */}
        <section className="order-2 lg:order-1 lg:col-span-7">
          <h1 className="text-sm font-bold text-fg">Perfil do colecionador</h1>

          {noWallets && (
            <p role="alert" className="mt-4 border border-accent/60 bg-accent/10 p-3 text-[11px] text-accent">
              Você ainda não tem carteira cadastrada.{" "}
              <Link to="/perfil" search={{ section: "wallets" }} className="underline">
                Cadastrar carteira
              </Link>
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="display-name" label="Nome de exibição" required error={fieldErrors["display-name"]}>
              <input id="display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-required="true" aria-invalid={!!fieldErrors["display-name"]} aria-describedby={fieldErrors["display-name"] ? "display-name-error" : undefined} className={INPUT} />
            </Field>

            <Field id="username" label="Nome de usuário">
              <input id="username" type="text" value={profile.data?.username ?? ""} readOnly className={INPUT} />
            </Field>

            <Field id="network" label="Rede " required error={fieldErrors.network}>
              <select id="network" value={network} onChange={(e) => setNetwork(e.target.value)} aria-required="true" aria-invalid={!!fieldErrors.network} aria-describedby={fieldErrors.network ? "network-error" : undefined} className={INPUT}>
                <option value="">Selecione uma rede</option>
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
                <option value="solana">Solana</option>
              </select>
            </Field>

            <Field id="profile-name" label="Nome do perfil">
              <input id="profile-name" type="text" value={wallet?.nickname ?? ""} readOnly className={INPUT} />
            </Field>

            <Field id="wallet-address" label="Endereço da carteira" required error={fieldErrors["wallet-address"]}>
              <input id="wallet-address" type="text" value={wallet?.address ?? ""} readOnly placeholder="Cadastre uma carteira" aria-invalid={!!fieldErrors["wallet-address"]} className={INPUT} />
            </Field>

            <Field id="secondary-wallet" label="Carteira secundária">
              <input id="secondary-wallet" type="text" value={secondary?.address ?? ""} readOnly placeholder="Nenhuma carteira secundária" className={INPUT} />
            </Field>

            <Field id="wallet-type" label="Tipo de carteira">
              <input id="wallet-type" type="text" value={wallet ? (WALLET_LABEL[wallet.type] ?? wallet.type) : ""} readOnly className={INPUT} />
            </Field>

            <Field id="referral-code" label="Código de indicação">
              <input id="referral-code" type="text" value={wallet?.referralCode ?? ""} readOnly className={INPUT} />
            </Field>

            <Field id="collector-email" label="E-mail" required error={fieldErrors["collector-email"]}>
              <input id="collector-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-required="true" aria-invalid={!!fieldErrors["collector-email"]} aria-describedby={fieldErrors["collector-email"] ? "collector-email-error" : undefined} className={INPUT} />
            </Field>

            <Field id="ens-name" label="Nome ENS ">
              <input id="ens-name" type="text" value={wallet ? `${wallet.ensName}${wallet.ensSuffix}` : ""} readOnly className={INPUT} />
            </Field>
          </div>

          <p className="mt-3 text-[10px] text-muted">
            Os dados da carteira vêm do seu cadastro. Para alterá-los, acesse{" "}
            <Link to="/perfil" search={{ section: "wallets" }} className="underline hover:text-accent">
              Perfil › Carteiras
            </Link>
            .
          </p>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-fg">
              <input
                type="checkbox"
                checked={walletId === "secondary"}
                disabled={!secondary}
                onChange={(e) => setWalletId(e.target.checked ? "secondary" : "primary")}
                className="accent-accent"
              />
              <span>Usar outra carteira?{!secondary && " (cadastre uma carteira secundária)"}</span>
            </label>
          </div>

          <div className="mt-4">
            <label htmlFor="collector-notes" className={LABEL}>
              Observação do colecionador (opcional)
            </label>
            <textarea id="collector-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 w-full resize-y border border-line bg-[#1d0f09] px-3 py-2 text-xs text-fg focus:border-accent focus:outline-none" />
          </div>
        </section>

        {/* Coluna direita: Seus NFTs, Resumo e Carteira e rede */}
        <aside className="order-1 lg:order-2 lg:col-span-5" aria-label="Resumo do pedido">
          <h2 className="text-sm font-bold text-fg">Seus NFTs</h2>

          <div className="mt-3 flex items-center justify-between border-b border-line pb-2 text-[11px] font-bold text-fg">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>

          {quote.isPending || cart.isPending ? (
            <div className="mt-3 space-y-2.5" aria-busy="true" aria-label="Carregando itens">
              {[0, 1].map((i) => <Skeleton key={i} className="h-[58px] w-full" />)}
            </div>
          ) : quote.isError ? (
            <div role="alert" className="mt-3 border border-red-500/60 bg-red-950/40 p-3 text-[11px] text-red-200">
              {toApiError(quote.error).message}{" "}
              <button type="button" onClick={() => void quote.refetch()} className="underline">Tentar novamente</button>
            </div>
          ) : lines.length === 0 ? (
            <div className="mt-3 border border-line/70 bg-[#1d0f09] p-4 text-xs text-muted">
              Nenhum NFT no carrinho.{" "}
              <Link to="/carrinho" className="text-accent underline">Voltar ao carrinho</Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {lines.map((item) => (
                <li key={`${item.nftId}-${item.edition}`} className="flex items-center justify-between gap-3 border border-line/70 bg-[#1d0f09] px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.imageAlt} className="size-10 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div role="img" aria-label={item.imageAlt} className="size-10 shrink-0 rounded-md" style={{ background: item.placeholderColor }} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-fg">{item.name}</p>
                      <p className="text-[10px] text-muted">ID do token: {item.tokenId} · Edição {item.edition}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-[11px] text-muted">(x {item.quantity})</span>
                    <span className="font-bold text-accent">{fmtEthDp(item.lineTotalEth, 2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {q?.issues.filter((i) => i.kind === "price_changed").map((i) => (
            <p key={`${i.nftId}-${i.edition}`} role="status" className="mt-2 text-[11px] text-accent">{i.message}</p>
          ))}
          {blocking.map((i) => (
            <p key={`${i.nftId}-${i.edition}-b`} role="alert" className="mt-2 text-[11px] text-red-300">{i.message}</p>
          ))}

          {/* Código promocional */}
          <div className="mt-4">
            <button type="button" aria-expanded={showPromoInput} onClick={() => setShowPromoInput((p) => !p)} className="text-[11px] text-muted underline hover:text-accent">
              Tem um código promocional? Aplique aqui
            </button>
            {showPromoInput && (
              <div className="mt-2 flex items-stretch gap-2">
                <label htmlFor="checkout-promo" className="sr-only">Código promocional</label>
                <input id="checkout-promo" type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Ex.: KURIO10" className="min-w-0 flex-1 border border-line bg-[#2a150d] px-3 py-2 text-[11px] text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
                <button type="button" onClick={handleApplyPromo} disabled={applyCoupon.isPending} className="bg-accent px-4 py-2 text-[11px] font-bold text-bg hover:bg-accent-hover disabled:opacity-60">
                  Aplicar
                </button>
              </div>
            )}
            {promoMessage && (
              <p role={promoMessage.type === "error" ? "alert" : "status"} className={`mt-1.5 text-[11px] ${promoMessage.type === "error" ? "text-red-300" : "text-accent"}`}>{promoMessage.text}</p>
            )}
          </div>

          {/* Totais */}
          <dl className="mt-4 space-y-2 border-b border-line pb-4 text-xs">
            <div className="flex items-center justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-bold text-fg">{fmtEthDp(q?.subtotalEth ?? "0", 2)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">Desconto do lançamento</dt><dd className="text-muted">(-) {fmtEthDp(q?.discountEth ?? "0", 2)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">Taxa de rede</dt><dd className="font-bold text-fg">{fmtEthDp(q?.networkFeeEth ?? "0", 3)}</dd></div>
            <div className="flex justify-end"><span className="text-[10px] text-muted">Taxa estimada</span></div>
          </dl>

          <div className="mt-3 flex items-center justify-between text-sm font-bold">
            <span className="text-fg">Total</span>
            <span className="text-accent">{fmtEthDp(q?.totalEth ?? "0", 3)}</span>
          </div>

          {/* Carteira e rede */}
          <fieldset className="mt-5">
            <legend className="text-xs font-bold text-fg">Carteira e rede</legend>
            <div className="mt-3 space-y-2.5 text-xs">
              {wallets.isPending && <Skeleton className="h-10 w-full" />}
              {registered.map((w) => (
                <label key={w.id} className={`flex cursor-pointer items-center gap-3 border bg-[#1d0f09] px-3.5 py-2.5 ${wallet?.id === w.id ? "border-accent/60" : "border-line/70"}`}>
                  <input type="radio" name="wallet-choice" checked={wallet?.id === w.id} onChange={() => setWalletId(w.id)} className="accent-accent" />
                  <span className="text-xs text-fg">
                    {WALLET_LABEL[w.type] ?? w.type} · {w.nickname}
                    <span className="ml-2 text-[10px] text-muted">{shortAddress(w.address)}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]" aria-live="polite">
              <span className={connected ? "font-bold text-accent" : "text-muted"}>
                {connected ? `Conectada em ${network}` : conn ? "Conexão não corresponde à seleção" : "Carteira desconectada"}
              </span>
              {connected ? (
                <button type="button" onClick={() => disconnectWallet.mutate()} disabled={disconnectWallet.isPending} className="underline hover:text-accent">
                  Desconectar
                </button>
              ) : (
                <button type="button" onClick={handleConnect} disabled={connectWallet.isPending || !wallet} className="rounded border border-accent/70 px-3 py-1.5 font-bold text-fg hover:border-accent hover:text-accent disabled:opacity-50">
                  {connectWallet.isPending ? "Conectando…" : "Conectar carteira"}
                </button>
              )}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={lines.length === 0 || createOrder.isPending || noWallets}
            className="mt-6 w-full rounded bg-accent py-2.5 text-xs font-bold text-bg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revisar pedido
          </button>

          {feedback && (
            <p role="alert" className="mt-3 rounded border border-red-500/60 bg-red-950/40 p-2.5 text-[11px] text-red-200">
              {feedback}
            </p>
          )}
          {user && <p className="mt-3 text-[10px] text-muted">Comprando como {user.email}</p>}
        </aside>
      </form>

      {reviewOpen && q && wallet && (
        <ReviewDialog
          quote={q}
          acknowledged={!quoteStale}
          onAcknowledge={() => setAcknowledgedToken(q.token)}
          onCancel={() => setReviewOpen(false)}
          onConfirm={handleConfirm}
          pending={createOrder.isPending}
          disabledReason={reviewDisabledReason}
          walletLabel={WALLET_LABEL[wallet.type] ?? wallet.type}
          network={network}
          email={email}
          error={submitError}
        />
      )}
    </div>
  );
}
