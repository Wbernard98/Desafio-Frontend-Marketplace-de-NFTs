// Auditoria Lighthouse: início e detalhe do NFT, perfis mobile e desktop, 3 medições cada, mediana por categoria.
// Pré-requisito: `npm run build:demo` (build otimizado com mocks) e `npx vite preview --port 4173`.
// Uso: npm run lighthouse   ->   relatórios em lighthouse-reports/ (HTML + JSON) e resumo em lighthouse-reports/summary.md
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const require = createRequire(import.meta.url);
const BASE = process.env.AUDIT_URL ?? "http://localhost:4173";
const RUNS = 3;
const pages = [
  { name: "inicio", path: "/" },
  { name: "detalhe", path: "/nft/emerald-ape-042" },
];
const profiles = {
  mobile: { /* padrão do Lighthouse: Moto G Power, 4G lento simulado */ },
  desktop: { formFactor: "desktop", screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 } },
};
const categories = ["performance", "accessibility", "best-practices", "seo"];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

mkdirSync("lighthouse-reports", { recursive: true });
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
const rows = [];
try {
  for (const [profile, settings] of Object.entries(profiles)) {
    for (const p of pages) {
      const runs = [];
      for (let i = 1; i <= RUNS; i += 1) {
        const result = await lighthouse(`${BASE}${p.path}`, { port: chrome.port, output: ["html", "json"], logLevel: "error", onlyCategories: categories }, { extends: "lighthouse:default", settings });
        const base = `lighthouse-reports/${p.name}-${profile}-run${i}`;
        writeFileSync(`${base}.html`, result.report[0]);
        writeFileSync(`${base}.json`, result.report[1]);
        const lhr = result.lhr;
        runs.push({
          scores: Object.fromEntries(categories.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)])),
          lcp: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: lhr.audits["total-blocking-time"].numericValue,
          version: lhr.lighthouseVersion,
          ua: lhr.environment.hostUserAgent,
        });
      }
      rows.push({
        profile, page: p.name,
        ...Object.fromEntries(categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        lcp: Math.round(median(runs.map((r) => r.lcp))), cls: +median(runs.map((r) => r.cls)).toFixed(3), tbt: Math.round(median(runs.map((r) => r.tbt))),
        version: runs[0].version, ua: runs[0].ua,
      });
    }
  }
} finally {
  await chrome.kill();
}

const lines = [
  "# Resumo Lighthouse (mediana de 3 execuções)",
  "",
  `Ferramentas: Lighthouse ${rows[0]?.version}, ${rows[0]?.ua}, Node ${process.version}, ${os.type()} ${os.release()} (${os.cpus().length} CPUs)`,
  `Alvo: ${BASE} (build otimizado, mocks MSW ligados, cenário padrão)`,
  "",
  "| Página | Perfil | Perf | A11y | Best Pr. | SEO | LCP (ms) | CLS | TBT (ms) |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.page} | ${r.profile} | ${r.performance} | ${r.accessibility} | ${r["best-practices"]} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`),
  "",
  "Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Justifique abaixo qualquer resultado fora da meta.",
];
writeFileSync("lighthouse-reports/summary.md", lines.join("\n"));
console.log(lines.join("\n"));
void require;
