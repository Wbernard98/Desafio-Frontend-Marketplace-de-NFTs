import { expect, type Page } from "@playwright/test";
import type { MockControl } from "../src/mocks/control";

export const ANA = { email: "ana@kurio.test", password: "Senha@123", name: "Ana Colecionadora" };
export const BRUNO = { email: "bruno@kurio.test", password: "Senha@456", name: "Bruno Mendes" };

/** Executa um comando do painel de mocks (window.__kurioMock) dentro da página. */
export async function mock<K extends keyof MockControl>(page: Page, method: K, ...args: Parameters<MockControl[K]>) {
  return page.evaluate(([m, a]) => (window.__kurioMock as unknown as Record<string, (...x: unknown[]) => unknown>)[m as string](...(a as unknown[])), [method, args] as const);
}

/** Abre a rota já com o cenário desejado (?scenario= / ?payment=) e espera os mocks subirem. */
export async function open(page: Page, path = "/", opts: { scenario?: string; payment?: string } = {}) {
  const url = new URL(path, "http://x");
  if (opts.scenario) url.searchParams.set("scenario", opts.scenario);
  if (opts.payment) url.searchParams.set("payment", opts.payment);
  await page.goto(url.pathname + url.search + url.hash);
  await page.waitForFunction(() => !!window.__kurioMock);
}

/** Faz login pelo modal (quando aberto) ou pela tela /login; não clica em "Entrar" do cabeçalho. */
export async function login(page: Page, user = ANA) {
  const dialog = page.getByRole("dialog");
  const inDialog = await dialog.isVisible();
  const scope = inDialog ? dialog : page.locator("#conteudo");
  await scope.getByLabel("E-mail").fill(user.email);
  await scope.getByLabel("Senha", { exact: true }).fill(user.password);
  await scope.getByRole("button", { name: "Entrar", exact: true }).last().click();
  if (inDialog) await expect(dialog).toBeHidden();
  else await expect(page).not.toHaveURL(/\/login/);
}

export async function addToCart(page: Page, nftId = "emerald-ape-042", times = 1) {
  await page.goto(`/nft/${nftId}`);
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: /^comprar/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /adicionado/i })).toBeVisible();
  }
}

/** Carteira da Ana já vem cadastrada; conecta na rede padrão. */
export async function connectWallet(page: Page) {
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await expect(page.getByText(/Conectada em/)).toBeVisible();
}

export async function reviewAndConfirm(page: Page) {
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  const dialog = page.getByRole("dialog", { name: "Revisar pedido" });
  await expect(dialog).toBeVisible();
  return dialog;
}
