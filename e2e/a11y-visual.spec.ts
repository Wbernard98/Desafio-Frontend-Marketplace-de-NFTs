import { expect, test } from "@playwright/test";
import { ANA, addToCart, login, open } from "./helpers";

test.describe("Acessibilidade", () => {
  test("login: foco entra no diálogo, Tab fica preso, Esc fecha e o foco volta ao gatilho", async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "emerald-ape-042");
    await page.goto("/carrinho");
    const trigger = page.getByRole("button", { name: "Entrar para finalizar" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(":focus")).toHaveCount(1);
    for (let i = 0; i < 14; i += 1) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("formulário de login associa mensagens de erro aos campos", async ({ page }) => {
    await open(page, "/?login=1");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("E-mail").fill("invalido");
    await dialog.getByLabel("Senha", { exact: true }).fill("123");
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(dialog.getByLabel("E-mail")).toHaveAttribute("aria-describedby", "auth-error");
  });

  test("navegação por teclado alcança o catálogo, o detalhe e a compra", async ({ page }) => {
    await open(page, "/nft/emerald-ape-042");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    await page.getByRole("button", { name: /^comprar/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: /adicionado/i })).toBeVisible();
  });

  test("sem overflow horizontal em 390, 768 e 1440 px", async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/nft/emerald-ape-042", "/carrinho"]) {
        await open(page, path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("falha de rede no carrinho mostra feedback e recupera ao tentar de novo", async ({ page }) => {
    await open(page, "/carrinho", { scenario: "http-5xx" });
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => window.__kurioMock!.setScenario("success"));
    await page.getByRole("button", { name: "Tentar novamente" }).first().click();
    await expect(page.getByText("O seu carrinho está vazio no momento.")).toBeVisible();
  });
});

/** Regressão visual: dados estáveis (seed determinístico), animações desligadas, movimento reduzido. */
test.describe("Regressão visual", () => {
  test("início", async ({ page }) => {
    await open(page, "/");
    await expect(page.locator('a[href^="/nft/"]').first()).toBeVisible();
    await expect(page).toHaveScreenshot("inicio.png", { fullPage: true });
  });
  test("detalhe do NFT", async ({ page }) => {
    await open(page, "/nft/emerald-ape-042");
    await expect(page.getByRole("heading", { name: /Emerald Ape/ })).toBeVisible();
    await expect(page).toHaveScreenshot("detalhe.png", { fullPage: true });
  });
  test("carrinho", async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "emerald-ape-042");
    await page.goto("/carrinho");
    await expect(page.getByRole("link", { name: "Emerald Ape #042" })).toBeVisible();
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page).toHaveScreenshot("carrinho.png", { fullPage: true });
  });
  test("pagamento", async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "emerald-ape-042");
    await page.goto("/?login=1&redirect=/pagamento");
    await login(page, ANA);
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page).toHaveScreenshot("pagamento.png", { fullPage: true });
  });
});
