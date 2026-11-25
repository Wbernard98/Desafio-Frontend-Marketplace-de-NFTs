// Loader mínimo para rodar os mocks (TypeScript + imports sem extensão + assets) direto no Node.
// Usado só por scripts/mock-selftest.mjs (verificação rápida da camada de rede simulada).
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ASSET = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (existsSync(candidate) && !candidate.endsWith("/") && /\.(ts|tsx|png|jpe?g|svg|webp|gif|avif)$/.test(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (ASSET.test(url)) {
    return { format: "module", source: `export default ${JSON.stringify("/assets/" + url.split("/").pop())};`, shortCircuit: true };
  }
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
