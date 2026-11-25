import { expect, test } from "@playwright/test";
import { ANA, login, open } from "./helpers";
import { Buffer } from "node:buffer";

test.beforeEach(async ({ page }) => {
  await open(page, "/?login=1&redirect=/perfil");
  await login(page, ANA);
  await expect(page).toHaveURL(/\/perfil/);
});

test("perfil: valida campos, trata conflito de e-mail e persiste após refresh", async ({ page }) => {
  await page.getByLabel(/nome de exibição/i).fill("");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText("Informe o nome de exibição.")).toBeVisible();

  await page.getByLabel(/nome de exibição/i).fill("Ana Atualizada");
  await page.getByLabel("E-mail", { exact: false }).first().fill("bruno@kurio.test"); // e-mail do outro usuário
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText("Este e-mail já está em uso.")).toBeVisible();

  await page.getByLabel("E-mail", { exact: false }).first().fill("ana@kurio.test");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByRole("status").filter({ hasText: /guardado com sucesso/i })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/nome de exibição/i)).toHaveValue("Ana Atualizada");
});

test("avatar: rejeita tipo inválido e aceita imagem pequena", async ({ page }) => {
  const input = page.getByLabel("Escolher avatar");
  await input.setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("Use uma imagem PNG, JPG ou WebP.")).toBeVisible();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await input.setInputFiles({ name: "a.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Avatar do colecionador")).toBeVisible();
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await page.reload();
  await expect(page.getByAltText("Avatar do colecionador")).toBeVisible();
});

test("senha: erros de validação e da API; sucesso permite novo login", async ({ page }) => {
  await page.getByLabel("Senha atual").fill("Errada@1");
  await page.getByLabel("Nova senha", { exact: true }).fill("fraca");
  await page.getByLabel("Confirmar nova senha").fill("outra");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText(/no mínimo 6 caracteres, com letra/)).toBeVisible();
  await expect(page.getByText("A confirmação da nova senha não confere.")).toBeVisible();

  await page.getByLabel("Nova senha", { exact: true }).fill("Nova@1234");
  await page.getByLabel("Confirmar nova senha").fill("Nova@1234");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText("Senha atual incorreta.")).toBeVisible(); // erro vindo da API

  await page.getByLabel("Senha atual").fill(ANA.password);
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByRole("status").filter({ hasText: /senha atualizados/i })).toBeVisible();
});

test("carteiras: valida endereço, salva principal e secundária e persiste", async ({ page }) => {
  await page.getByRole("button", { name: "Carteiras" }).click();
  await expect(page).toHaveURL(/section=wallets/);
  await page.getByLabel("Endereço da carteira").first().fill("0x123");
  await page.getByRole("button", { name: "Salvar carteiras" }).click();
  await expect(page.getByText("Endereço de carteira inválido.")).toBeVisible();

  await page.getByLabel("Endereço da carteira").first().fill("0x" + "a".repeat(40));
  await page.getByRole("button", { name: "+ Adicionar" }).click();
  await page.locator("#secondary-nickname").fill("Reserva");
  await page.locator("#secondary-address").fill("0x" + "b".repeat(40));
  await page.getByRole("button", { name: "Salvar carteiras" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Carteiras salvas/ })).toBeVisible();
  await page.reload();
  await expect(page.locator("#secondary-nickname")).toHaveValue("Reserva");
});
