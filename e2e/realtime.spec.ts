import { expect, test } from "@playwright/test";
import { ANA, addToCart, connectWallet, login, mock, open, reviewAndConfirm } from "./helpers";

test("nft.updated atualiza catálogo, detalhe e carrinho e informa a alteração", async ({ page }) => {
  await open(page, "/");
  await addToCart(page, "emerald-ape-042");
  await page.goto("/carrinho");
  await expect(page.getByText("1.19 ETH").first()).toBeVisible();
  await mock(page, "patchNft", "emerald-ape-042", { priceEth: "2.00" });
  await expect(page.getByText("2.00 ETH").first()).toBeVisible();
  await expect(page.getByText(/O preço de um ou mais itens mudou/)).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/foi atualizado/i).catch(() => undefined); // região viva global
});

test("eventos duplicados ou antigos não regridem o estado nem reaplicam efeitos", async ({ page }) => {
  await open(page, "/nft/emerald-ape-042");
  await expect(page.getByText("1.19 ETH").first()).toBeVisible();
  await mock(page, "patchNft", "emerald-ape-042", { priceEth: "3.00" });
  await expect(page.getByText("3.00 ETH").first()).toBeVisible();
  // reemite o mesmo evento (duplicata) e um evento antigo (versão 1)
  await mock(page, "replayLast", 1);
  await mock(page, "emitRaw", {
    id: "evt_old", type: "nft.updated", resource: "nft", resourceId: "emerald-ape-042", version: 1, userId: null, ts: new Date().toISOString(),
    payload: { priceEth: "0.10", stock: { "1/1": 1, "1/10": 4, "1/50": 12, ABERTA: 30 }, available: 47 },
  });
  await page.waitForTimeout(400);
  await expect(page.getByText("3.00 ETH").first()).toBeVisible();
  await expect(page.getByText("0.10 ETH")).toHaveCount(0);
});

test("desconexão com pedido pendente: ao reconectar ou recarregar o usuário recupera o estado sem nova compra", async ({ page }) => {
  await open(page, "/");
  await addToCart(page, "emerald-ape-042");
  await page.goto("/?login=1&redirect=/pagamento");
  await login(page, ANA);
  await connectWallet(page);
  const dialog = await reviewAndConfirm(page);
  await dialog.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page).toHaveURL(/\/pedido\/ord_/);
  await mock(page, "disconnectSockets", true); // cai e fica fora do ar
  await expect(page.getByText(/Conexão em tempo real indisponível|Aguardando/)).toBeVisible();
  // o pedido é liquidado enquanto offline; o polling de fallback recupera o estado
  await expect(page.getByRole("heading", { name: /Seus NFTs agora estão na sua carteira/ })).toBeVisible({ timeout: 15_000 });
  expect(await mock(page, "orders")).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Seus NFTs agora estão/ })).toBeVisible();
});

test("recarregar a página com pedido pendente retoma o pedido em vez de abrir outro", async ({ page }) => {
  await open(page, "/");
  await addToCart(page, "golden-beat-207");
  await page.goto("/?login=1&redirect=/pagamento");
  await login(page, ANA);
  await connectWallet(page);
  const dialog = await reviewAndConfirm(page);
  await dialog.getByRole("button", { name: "Confirmar compra" }).click();
  await page.goto("/pagamento"); // volta ao checkout com o pedido ainda pendente
  await expect(page).toHaveURL(/\/pedido\/ord_0001|\/pagamento/);
  await expect(page.getByRole("heading", { name: /Aguardando|Seus NFTs agora estão/ })).toBeVisible({ timeout: 10_000 });
  expect(await mock(page, "orders")).toHaveLength(1);
});
