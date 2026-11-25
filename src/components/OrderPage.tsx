import { Link, useParams } from "@tanstack/react-router";
import { useOrder } from "../features/orders/hooks";
import { useRealtimeStatus } from "../shared/realtime/status";
import { toApiError } from "../shared/api/errors";
import { fmtEthDp } from "../shared/lib/money";
import { Skeleton } from "../shared/ui/Skeleton";
import { releaseIdempotencyKey } from "../features/orders/localState";
import { useEffect } from "react";

const defaultHomeSearch = {
  tab: "all" as const,
  sort: "recent" as const,
  page: 1,
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Confirmação do pedido: só mostra o recibo de pedido efetivamente confirmado. Pendente e recusado têm telas próprias. */
export function OrderPage() {
  const { id } = useParams({ from: "/pedido/$id" });
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const realtime = useRealtimeStatus();

  // pedido terminal encerra a tentativa: a próxima compra usa uma nova chave de idempotência
  useEffect(() => {
    if (order && order.status !== "pending") releaseIdempotencyKey();
  }, [order]);

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16" aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="mx-auto h-11 w-16" />
        <Skeleton className="mx-auto mt-4 h-5 w-2/3" />
        <Skeleton className="mt-6 h-16 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (isError || !order) {
    const apiError = toApiError(error);
    return (
      <div role="alert" className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="mb-3 text-xl font-bold">{apiError.code === "not_found" ? "Pedido não encontrado" : "Não foi possível carregar o pedido"}</h1>
        <p className="mb-6 text-xs text-muted">{apiError.message}</p>
        {apiError.transient && (
          <button type="button" onClick={() => void refetch()} className="mr-4 rounded-lg bg-accent px-5 py-2 text-xs font-bold text-bg hover:bg-accent-hover">
            Tentar novamente
          </button>
        )}
        <Link to="/" search={defaultHomeSearch} className="text-accent underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  if (order.status === "pending") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-base font-bold text-fg">Aguardando a confirmação da transação</h1>
        <p role="status" className="mt-3 text-xs text-muted">
          Pedido {order.id} em processamento. Não feche esta página: se a conexão cair, retomamos o pedido sem criar outra compra.
        </p>
        <Skeleton className="mx-auto mt-6 h-2 w-48" />
        {realtime !== "connected" && (
          <p role="status" className="mt-4 text-[11px] text-accent">
            Conexão em tempo real indisponível. Verificando o pedido periodicamente…
          </p>
        )}
      </div>
    );
  }

  if (order.status === "declined") {
    return (
      <div role="alert" className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-base font-bold text-fg">Pagamento recusado</h1>
        <p className="mt-3 text-xs text-muted">{order.declineReason ?? "A transação não foi autorizada."} Seus itens continuam no carrinho.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link to="/pagamento" className="rounded bg-accent px-6 py-2 text-[11px] font-bold text-bg hover:bg-accent-hover">
            Tentar novamente
          </Link>
          <Link to="/carrinho" className="self-center text-[11px] text-muted underline hover:text-accent">
            Voltar ao carrinho
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <div className="relative w-full border border-line bg-[#1d0f09] px-6 py-7 text-fg sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="grid size-11 place-items-center rounded border border-accent/60 bg-[#2a150d] px-1 text-[8px] font-extrabold leading-tight tracking-wider text-accent" aria-hidden="true">
            <span>
              THANK
              <br />
              YOU
            </span>
          </div>
          <h1 className="mt-3 text-base font-bold text-fg">Seus NFTs agora estão na sua carteira</h1>
          <p role="status" className="sr-only">
            Pedido confirmado.
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-b border-line/70 pb-4 text-center sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted">ID da transação</dt>
            <dd className="mt-1 font-mono text-[11px] font-bold text-fg">{order.txHash}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">Data</dt>
            <dd className="mt-1 text-[11px] font-bold text-fg">{dateLabel(order.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">Total</dt>
            <dd className="mt-1 text-[11px] font-bold text-accent">{fmtEthDp(order.totalEth, 3)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">Carteira</dt>
            <dd className="mt-1 text-[11px] font-bold text-fg">{order.walletName}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <h2 className="text-xs font-bold text-fg">Detalhes da transação</h2>
          <div className="mt-3 flex items-center justify-between border-b border-line/60 pb-2 text-[10px] font-bold text-muted">
            <span>NFTs</span>
            <div className="flex items-center gap-8">
              <span>Edições</span>
              <span>Subtotal</span>
            </div>
          </div>

          <ul className="mt-3 space-y-2.5">
            {order.items.map((item) => (
              <li key={`${item.nftId}-${item.edition}`} className="flex items-center justify-between gap-3 border border-line/50 bg-[#26130b] px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2.5">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.imageAlt} className="size-9 shrink-0 rounded object-cover" />
                  ) : (
                    <div role="img" aria-label={item.imageAlt} className="size-9 shrink-0 rounded" style={{ background: item.placeholderColor }} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-fg">{item.name}</p>
                    <p className="text-[10px] text-muted">
                      ID do token: {item.tokenId} · Edição {item.edition}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-7 text-[11px]">
                  <span className="text-muted">(x {item.quantity})</span>
                  <span className="font-bold text-accent">{fmtEthDp(item.lineTotalEth, 2)}</span>
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 border-t border-line/60 pt-3 text-[11px]">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-bold text-fg">{fmtEthDp(order.subtotalEth, 2)}</dd>
            </div>
            {order.couponCode && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Desconto ({order.couponCode})</dt>
                <dd className="text-muted">(-) {fmtEthDp(order.discountEth, 2)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted">Taxa de rede</dt>
              <dd className="font-bold text-fg">{fmtEthDp(order.networkFeeEth, 3)}</dd>
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <dt className="text-fg">Total</dt>
              <dd className="text-accent">{fmtEthDp(order.totalEth, 3)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 text-center text-[10px] leading-relaxed text-muted">
          Transação confirmada na simulação. Referências de transação e links de exploração são simulados neste ambiente.
        </p>

        <div className="mt-4 flex flex-col items-center gap-2">
          <span
            aria-disabled="true"
            title="Explorador de blocos simulado: sem link real"
            className="inline-block cursor-not-allowed rounded bg-accent/40 px-6 py-2 text-[11px] font-bold text-bg"
          >
            Explorador (simulado)
          </span>
          <Link to="/" search={defaultHomeSearch} className="text-[10px] text-muted underline hover:text-accent">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
