import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test.describe("Catálogo", () => {
  test("busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh/histórico", async ({ page }) => {
    await open(page, "/?network=polygon&sort=price-asc");
    const cards = page.locator('a[href^="/nft/"]');
    await expect(cards.first()).toBeVisible();
    await expect(page.locator("p[aria-live='polite']").first()).toContainText("NFTs encontrados");

    // paginação
    await page.getByRole("button", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("button", { name: "Página 2" })).toHaveAttribute("aria-current", "page");

    // mudar filtro reinicia a paginação
    await page.getByLabel(/ordenar por/i).selectOption("price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(page).toHaveURL(/page=1|^(?!.*page=2)/);

    // refresh mantém o estado
    await page.reload();
    await expect(page).toHaveURL(/network=polygon/);
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(page.getByLabel(/ordenar por/i)).toHaveValue("price-desc");

    // histórico restaura o estado anterior
    await page.goBack();
    await expect(page.getByRole("button", { name: "Página 2" })).toHaveAttribute("aria-current", "page");
  });

  test("busca por nome filtra os resultados e estado vazio oferece limpar filtros", async ({ page }) => {
    await open(page, "/?q=Emerald");
    await expect(page.getByRole("link", { name: /Emerald Ape #042/ })).toBeVisible();
    await open(page, "/?q=zzzz-nao-existe");
    await expect(page.getByText("Nenhum NFT encontrado com esses filtros.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.locator('a[href^="/nft/"]').first()).toBeVisible();
  });

  test("falha 5xx mostra erro e a nova tentativa recupera", async ({ page }) => {
    await open(page, "/", { scenario: "http-5xx" });
    await expect(page.getByRole("alert")).toContainText("Erro 503");
    await page.evaluate(() => window.__kurioMock!.setScenario("success"));
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.locator('a[href^="/nft/"]').first()).toBeVisible();
  });

  test("offline mostra feedback de conexão", async ({ page }) => {
    await open(page, "/", { scenario: "offline" });
    await expect(page.getByRole("alert")).toContainText("Sem conexão");
  });

  test("skeletons aparecem durante o carregamento lento", async ({ page }) => {
    await open(page, "/", { scenario: "slow" });
    await expect(page.locator("[data-skeleton]").first()).toBeVisible();
    await expect(page.locator('a[href^="/nft/"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  });

  test("respostas fora de ordem não sobrescrevem a busca mais recente", async ({ page }) => {
    await open(page, "/", { scenario: "variable-latency" });
    await page.goto("/?q=Emerald");
    await page.goto("/?q=Golden");
    await expect(page.getByRole("link", { name: /Golden/ }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Emerald Ape/ })).toHaveCount(0);
  });
});

test.describe("Detalhe", () => {
  test("acesso direto, NFT inexistente e edição esgotada", async ({ page }) => {
    await open(page, "/nft/violet-nomad-314");
    await expect(page.getByRole("heading", { name: /Violet Nomad/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^1\/1(?!0)/ })).toBeDisabled(); // edição esgotada

    await page.goto("/nft/nao-existe");
    await expect(page.getByRole("heading", { name: "NFT não encontrado" })).toBeVisible();
  });

  test("limite de quantidade respeita o estoque da edição", async ({ page }) => {
    await open(page, "/nft/emerald-ape-042");
    await page.getByRole("button", { name: /^1\/1(?!0)/ }).click(); // estoque 1
    await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
  });
});
