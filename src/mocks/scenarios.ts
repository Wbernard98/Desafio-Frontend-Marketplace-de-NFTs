/**
 * Cenários de rede/negócio do MSW. Configuráveis e reproduzíveis:
 *  - URL:      ?scenario=slow&payment=decline   (valores ficam em sessionStorage)
 *  - Runtime:  window.__kurioMock.setScenario("slow")   (usado pelos testes Playwright)
 */
export const SCENARIOS = [
  "success", // padrão
  "empty", // catálogo sem resultados
  "slow", // todas as respostas demoram 2,5s
  "variable-latency", // latência determinística por requisição -> respostas fora de ordem
  "offline", // falha de conexão (HttpResponse.error)
  "http-4xx", // 400 no catálogo
  "http-5xx", // 503 nos endpoints de dados
  "unauthorized", // 403 nos endpoints privados
  "session-expired", // a primeira chamada autenticada recebe 401 session_expired
  "signup-conflict", // cadastro sempre devolve e-mail em conflito
  "order-timeout", // pedido é criado, mas a resposta excede o timeout do cliente
  "price-changed", // preço muda durante a criação do pedido (409 quote_changed)
  "sold-out", // edição esgota durante a criação do pedido (409 availability_conflict)
  "wallet-refused", // a carteira recusa a conexão (403 wallet_refused)
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const PAYMENT_MODES = ["confirm", "decline"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface MockConfig {
  scenario: Scenario;
  payment: PaymentMode;
  /** Falhas pontuais: "favorites" -> próxima(s) N chamadas retornam 503. */
  failNext: Record<string, number>;
  /** Flags de "uma vez só" dos cenários (limpas no reset/troca de cenário). */
  fired: Record<string, boolean>;
}

export const config: MockConfig = {
  scenario: "success",
  payment: "confirm",
  failNext: {},
  fired: {},
};

const STORE_KEY = "kurio:mock-config";

const isScenario = (v: unknown): v is Scenario => SCENARIOS.includes(v as Scenario);
const isPayment = (v: unknown): v is PaymentMode => PAYMENT_MODES.includes(v as PaymentMode);

export function setScenario(s: Scenario) {
  config.scenario = s;
  config.fired = {};
  persistConfig();
}
export function setPayment(p: PaymentMode) {
  config.payment = p;
  persistConfig();
}
export function failNext(key: string, times = 1) {
  config.failNext[key] = times;
}
export function consumeFailure(key: string): boolean {
  const n = config.failNext[key] ?? 0;
  if (n <= 0) return false;
  config.failNext[key] = n - 1;
  return true;
}
export function resetConfig() {
  config.scenario = "success";
  config.payment = "confirm";
  config.failNext = {};
  config.fired = {};
  persistConfig();
}

function persistConfig() {
  try {
    globalThis.sessionStorage?.setItem(STORE_KEY, JSON.stringify({ scenario: config.scenario, payment: config.payment }));
  } catch {
    /* sessionStorage indisponível (ex.: Node) */
  }
}

/** Lê ?scenario= / ?payment= (prioridade) ou o último valor salvo na sessão. */
export function loadConfigFromEnvironment() {
  try {
    const saved = JSON.parse(globalThis.sessionStorage?.getItem(STORE_KEY) ?? "{}") as Partial<MockConfig>;
    if (isScenario(saved.scenario)) config.scenario = saved.scenario;
    if (isPayment(saved.payment)) config.payment = saved.payment;
  } catch {
    /* ignora */
  }
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("scenario");
    const p = sp.get("payment");
    if (isScenario(s)) config.scenario = s;
    if (isPayment(p)) config.payment = p;
    persistConfig();
  }
}

export const getScenario = (): Scenario => config.scenario;
