import { expect, test } from "@playwright/test";
import { ANA, addToCart, connectWallet, login, mock, open, reviewAndConfirm } from "./helpers";

test.describe("Carrinho", () => {
  test("quantidades, remoção, cupom e persistência após refresh", async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "emerald-ape-042");
    await page.goto("/carrinho");
    const row = page.getByRole("listitem").filter({ hasText: "Emerald Ape #042" });
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: /aumentar quantidade de emerald/i }).click();
    await expect(row.getByText("2", { exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByText("2", { exact: true })).toBeVisible(); // persiste após refresh

    // cupons
    await page.getByLabel("Código promocional").fill("NOPE");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText(/inválido/i)).toBeVisible();
    await page.getByLabel("Código promocional").fill("EXPIRADO");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText(/expirou/i)).toBeVisible();
    await page.getByLabel("Código promocional").fill("KURIO10");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Código KURIO10 aplicado.")).toBeVisible();
    await expect(page.getByText(/\(-\) 0\.24 ETH/)).toBeVisible(); // 10% de 2 x 1.19 = 0.238
    await page.getByRole("button", { name: "Remover", exact: true }).click();

    await page.getByRole("button", { name: /remover emerald/i }).click();
    await expect(page.getByText("O seu carrinho está vazio no momento.")).toBeVisible();
  });

  test("itens do visitante são preservados ao autenticar", async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "golden-beat-207");
    await page.goto("/?login=1");
    await login(page, ANA);
    await page.goto("/carrinho");
    await expect(page.getByRole("link", { name: "Golden Beat #207" })).toBeVisible();
  });
});

test.describe("Compra", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/");
    await addToCart(page, "emerald-ape-042");
    await page.goto("/?login=1&redirect=/pagamento");
    await login(page, ANA);
    await expect(page).toHaveURL(/\/pagamento/);
  });

  test("compra completa do catálogo ao recibo confirmado", async ({ page }) => {
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    await dialog.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page).toHaveURL(/\/pedido\/ord_/);
    await expect(page.getByRole("heading", { name: /Seus NFTs agora estão na sua carteira/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/0x[0-9A-F]{4}\.\.\.[0-9A-F]{4}/i)).toBeVisible();
    await expect(page.getByText("1.206 ETH")).toBeVisible(); // 1.19 + 0.016
    await page.goto("/carrinho");
    await expect(page.getByText("O seu carrinho está vazio no momento.")).toBeVisible(); // só o comprado sai
  });

  test("pagamento recusado preserva os itens e não mostra confirmação", async ({ page }) => {
    await mock(page, "setPayment", "decline");
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    await dialog.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("heading", { name: "Pagamento recusado" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Seus NFTs agora estão/)).toHaveCount(0);
    await page.goto("/carrinho");
    await expect(page.getByRole("link", { name: "Emerald Ape #042" })).toBeVisible();
  });

  test("clique repetido cria um único pedido", async ({ page }) => {
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    const confirm = dialog.getByRole("button", { name: "Confirmar compra" });
    await confirm.dblclick();
    await expect(page).toHaveURL(/\/pedido\/ord_/);
    const orders = await mock(page, "orders");
    expect(orders).toHaveLength(1);
  });

  test("timeout após criar o pedido recupera o mesmo pedido (idempotência)", async ({ page }) => {
    await mock(page, "setScenario", "order-timeout");
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    await dialog.getByRole("button", { name: "Confirmar compra" }).click();
    // a resposta estoura o timeout do cliente; a UI consulta o pedido pendente e retoma o mesmo
    await expect(page).toHaveURL(/\/pedido\/ord_0001/, { timeout: 15_000 });
    const orders = await mock(page, "orders");
    expect(orders).toHaveLength(1);
  });

  test("preço muda via Socket.IO durante o checkout: exige nova confirmação", async ({ page }) => {
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    await mock(page, "patchNft", "emerald-ape-042", { priceEth: "1.50" });
    await expect(dialog.getByText(/mudaram desde a sua revisão/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Aceitar novos valores" }).click();
    await expect(dialog.getByText("1.516 ETH")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page).toHaveURL(/\/pedido\/ord_/);
  });

  test("cenário price-changed: API recusa cotação desatualizada com 409", async ({ page }) => {
    await mock(page, "setScenario", "price-changed");
    await connectWallet(page);
    const dialog = await reviewAndConfirm(page);
    await dialog.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Aceitar novos valores" })).toBeVisible();
  });

  test("conexão de carteira: recusa e desconexão", async ({ page }) => {
    await mock(page, "setScenario", "wallet-refused");
    await page.getByRole("button", { name: "Conectar carteira" }).click();
    await expect(page.getByText(/recusou a conexão/i)).toBeVisible();
    await mock(page, "setScenario", "success");
    await connectWallet(page);
    await page.getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Carteira desconectada")).toBeVisible();
  });
});
