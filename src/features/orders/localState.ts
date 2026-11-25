/**
 * Estado local mínimo do checkout (nada de dados de negócio):
 *  - rascunho do formulário, para retomar após expiração de sessão;
 *  - chave de idempotência da tentativa em andamento, para reenviar o MESMO pedido após timeout/refresh.
 */
const DRAFT_KEY = "kurio:checkout-draft";
const IDEM_KEY = "kurio:idempotency";

export interface CheckoutDraft {
  userId?: string;
  displayName: string;
  email: string;
  notes: string;
  walletId: "primary" | "secondary";
  network: string;
}

export function loadDraft(): CheckoutDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(draft: CheckoutDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignora */
  }
}

interface IdemRecord { key: string; signature: string }
export function idempotencyKeyFor(signature: string): string {
  try {
    const raw = window.localStorage.getItem(IDEM_KEY);
    const rec = raw ? (JSON.parse(raw) as IdemRecord) : null;
    if (rec && rec.signature === signature) return rec.key;
    const next: IdemRecord = { key: `idem_${crypto.randomUUID()}`, signature };
    window.localStorage.setItem(IDEM_KEY, JSON.stringify(next));
    return next.key;
  } catch {
    return `idem_${Date.now()}`;
  }
}
export function releaseIdempotencyKey() {
  try {
    window.localStorage.removeItem(IDEM_KEY);
  } catch {
    /* ignora */
  }
}

export function clearCheckoutLocalState() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(IDEM_KEY);
  } catch {
    /* ignora */
  }
}
