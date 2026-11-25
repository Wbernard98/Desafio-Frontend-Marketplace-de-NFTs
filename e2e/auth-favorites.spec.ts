import { expect, test } from "@playwright/test";
import { ANA, BRUNO, login, mock, open } from "./helpers";

test.describe("Conta e sessão", () => {
  test("cadastro valida, trata conflito e cria a conta", async ({ page }) => {
    await open(page, "/cadastro");
    const dialog = page.locator("#conteudo"); // tela cheia de Cadastro
    await expect(dialog.getByRole("heading", { name: "Criar conta" }).or(dialog.getByRole("tab", { name: "Criar conta" }))).toBeVisible();
    await dialog.getByLabel("Nome de usuário").fill("carla");
    await dialog.getByLabel("E-mail").fill("ana@kurio.test"); // já existe
    await dialog.getByLabel("Senha", { exact: true }).fill("Senha@789");
    await dialog.getByLabel("Confirmar senha").fill("Senha@789");
    await dialog.getByRole("button", { name: "Criar conta" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/já existe uma conta/i);

    await dialog.getByLabel("E-mail").fill("carla@kurio.test");
    await dialog.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.getByRole("button", { name: /sair/i }).first()).toBeVisible();
  });

  test("login com senha errada mostra erro; login correto mantém a sessão após refresh", async ({ page }) => {
    await open(page, "/login");
    const dialog = page.locator("#conteudo");
    await dialog.getByLabel("E-mail").fill(ANA.email);
    await dialog.getByLabel("Senha", { exact: true }).fill("Errada@1");
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(/incorretos/i);
    await login(page, ANA);
    await page.reload();
    await expect(page.getByRole("link", { name: /meu perfil|perfil/i }).first()).toBeVisible();
  });

  test("rotas privadas redirecionam ao login e retomam depois", async ({ page }) => {
    await open(page, "/perfil");
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await login(page, ANA);
    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();
  });

  test("sessão expirada durante a navegação abre o login sobre a página e retoma o contexto", async ({ page }) => {
    await open(page, "/");
    await page.goto("/?login=1");
    await login(page, ANA);
    await page.goto("/perfil");
    await expect(page.getByLabel(/nome de exibição/i)).toHaveValue(ANA.name);
    await mock(page, "expireSessions");
    await page.getByLabel(/nome de exibição/i).fill("Nome editado");
    await page.getByRole("button", { name: "Guardar alterações" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/sessão expirou/i);
    await login(page, ANA);
    await expect(page).toHaveURL(/\/perfil/);
  });

  test("logout e troca de usuário limpam dados privados", async ({ page }) => {
    await open(page, "/?login=1");
    await login(page, ANA);
    await page.goto("/nft/emerald-ape-042");
    await page.getByRole("button", { name: /favoritar/i }).click();
    await expect(page.getByRole("button", { name: /favoritado/i })).toBeVisible();

    await page.goto("/perfil");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("button", { name: /^entrar$/i }).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("kurio:auth"))).toBeNull();

    await page.goto("/?login=1");
    await login(page, BRUNO);
    await page.goto("/nft/emerald-ape-042");
    await expect(page.getByRole("button", { name: /^favoritar/i })).toBeVisible(); // favoritos da Ana não vazam
  });
});

test.describe("Favoritos", () => {
  test("persistem após refresh; falha da mutation faz rollback e a recuperação funciona", async ({ page }) => {
    await open(page, "/?login=1");
    await login(page, ANA);
    await page.goto("/nft/emerald-ape-042");

    await page.getByRole("button", { name: /^favoritar/i }).click();
    await expect(page.getByRole("button", { name: /favoritado/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /favoritado/i })).toBeVisible();

    // falha: otimista aparece e volta (rollback)
    await mock(page, "failNext", "favorites", 1);
    await page.getByRole("button", { name: /favoritado/i }).click();
    await expect(page.getByRole("button", { name: /favoritado/i })).toBeVisible();

    // nova tentativa funciona
    await page.getByRole("button", { name: /favoritado/i }).click();
    await expect(page.getByRole("button", { name: /^favoritar/i })).toBeVisible();
  });

  test("favoritar sem sessão pede login e retorna ao NFT", async ({ page }) => {
    await open(page, "/nft/emerald-ape-042");
    await page.getByRole("button", { name: /^favoritar/i }).click();
    await login(page, ANA);
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/);
  });
});
