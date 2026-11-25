
# Kurio — Marketplace de NFTs

> Desafio técnico Frontend — **Jungle Gaming**
> Implementação do *NFT Marketplace* em React + TypeScript a partir do layout no Figma, com API, autenticação, carteiras e pagamentos **simulados**.

Fluxos entregues: **descoberta** (catálogo, busca, filtros, ordenação), **compra** (carrinho, cotação, pagamento com carteira, confirmação) e **conta do colecionador** (cadastro, login, perfil, carteiras, favoritos), em desktop e mobile.

## Sumário

1. [Stack](#stack)
2. [Como executar](#como-executar)
3. [Credenciais e dados de teste](#credenciais-e-dados-de-teste)
4. [Telas e rotas](#telas-e-rotas)
5. [Arquitetura](#arquitetura)
6. [Contratos REST](#contratos-rest)
7. [Estado, cache e retries](#estado-cache-e-retries)
8. [Tempo real (Socket.IO)](#tempo-real-socketio)
9. [Mocks com MSW e cenários](#mocks-com-msw-e-cenários)
10. [Testes](#testes)
11. [Performance (Lighthouse)](#performance-lighthouse)
12. [Acessibilidade e responsividade](#acessibilidade-e-responsividade)
13. [Decisões, limitações e pendências](#decisões-limitações-e-pendências)

## Stack

| Responsabilidade | Tecnologia |
|---|---|
| Interface / Linguagem | React + TypeScript |
| Roteamento | TanStack Router |
| Estado remoto | TanStack Query |
| Cliente HTTP | Axios |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização | Tailwind CSS |
| Mocking | MSW (REST + WebSocket com `@mswjs/socket.io-binding`) |
| Testes E2E e regressão visual | Playwright |
| Auditoria | Lighthouse |
| Build | Vite |
| Fonte | Roboto (`@fontsource/roboto`, servida localmente) |

Dinheiro: valores em ETH trafegam como **strings decimais** e todo cálculo usa `decimal.js` (sem ponto flutuante). Quantidades são inteiras.

## Como executar

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev                 # desenvolvimento (mocks ligados) → http://localhost:5173
```

Build de demonstração (otimizado, **com mocks ligados**):

```bash
npm run build:demo          # checa tipos e gera o build
npx vite preview --port 4173 --strictPort   # → http://localhost:4173
```

Outros comandos:

```bash
npm run typecheck           # tsc do app e dos testes E2E
npm run lint
npm run mocks:selftest      # valida REST + Socket.IO dos mocks direto no Node
npx playwright install chromium
npm run e2e                 # testes E2E (desktop 1440 e mobile 390)
npm run e2e:update          # gera/atualiza as baselines de regressão visual
npm run e2e:report          # abre o relatório HTML
npm run lighthouse          # com o preview rodando; relatórios em lighthouse-reports/
```

### Deploy na Vercel

O repositório já traz o `vercel.json` (fallback de SPA para as rotas do TanStack Router, cache de assets e do service worker do MSW).
Na Vercel: **Add New → Project → importe o repositório**; o preset **Vite** é detectado (build `npm run build`, saída `dist`). Não precisa de variáveis de ambiente: o `.env.production` já liga os mocks, então o build publicado funciona como demonstração completa.

> Os dados simulados ficam salvos no navegador (`localStorage`). Para voltar ao estado inicial: limpe os dados do site ou rode `await window.__kurioMock.reset()` no console.

## Credenciais e dados de teste

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana | `ana@kurio.test` | `Senha@123` | Já tem carteira MetaMask cadastrada |
| Bruno | `bruno@kurio.test` | `Senha@456` | Sem carteiras |

Cupons: `KURIO10` (10%), `WELCOME5` (5%), `EXPIRADO` (expirado). Qualquer outro código é inválido.
Senhas **não** são guardadas em claro: o servidor simulado guarda apenas `SHA-256(salt:senha)`.

## Telas e rotas

| Tela | Rota |
|---|---|
| Início (destaques, catálogo, busca, filtros, ordenação, paginação) | `/` |
| Detalhes do NFT (galeria, edições, quantidade, favoritos, compra) | `/nft/$id` |
| Carrinho (quantidades, remoção, cupom, resumo) | `/carrinho` |
| Login / Cadastro | `/login`, `/cadastro` |
| Pagamento 🔒 (dados, carteira e rede, revisão, envio) | `/pagamento` |
| Confirmação de pedido 🔒 (pendente, confirmado, recusado) | `/pedido/$id` |
| Perfil, Carteiras e Lista de interesse 🔒 | `/perfil?section=profile\|wallets\|wishlist` |

🔒 exige sessão: sem login, redireciona para `/login?redirect=…` e retoma o destino depois (só caminhos internos são aceitos).

O estado de catálogo (busca, filtros, ordenação e paginação) vive na **URL**, sobrevive a refresh e funciona com o histórico do navegador. Mudar um filtro reinicia a paginação.

Itens que aparecem no layout mas estão **fora do escopo** do desafio (Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados, Suporte, login social, "esqueci a senha") exibem um aviso claro, sem fingir funcionalidade. `/carteiras` e `/mercado` redirecionam para o fluxo correspondente.

## Arquitetura

```
src/
  app/           router (rotas, guards) e queryClient (política de cache)
  features/      catalog | cart | favorites | orders | account
                 (api.ts = chamadas Axios · hooks.ts = TanStack Query)
  shared/
    api/         http.ts (Axios + interceptors) · types.ts (contratos) · errors.ts · queryKeys.ts
    auth/        authStore (token) · hooks (sessão/login/logout) · loginModalStore
    realtime/    RealtimeProvider (socket.io-client) · status
    ui/          região viva (anúncios), Skeleton, useFocusTrap
  mocks/         db.ts · handlers.ts (REST) · socket.ts (Socket.IO) · scenarios.ts · control.ts · fixtures.ts
  components/    telas (Header, Auth, Carrinho, Detalhe, Pagamento, Pedido, Perfil, Carteiras…)
e2e/             testes Playwright
scripts/         lighthouse.mjs · mock-selftest.mjs
```

Princípios: contratos tipados do transporte até a UI; nenhuma resposta fictícia em componentes, hooks ou no cliente Axios (quem responde é o MSW, na rede); dados privados com o **dono na chave de cache**.

## Contratos REST

| Recurso | Endpoints |
|---|---|
| Sessão e conta | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/session` · `POST /api/auth/logout` |
| NFTs | `GET /api/nfts?q&collection&network&min&max&tab&sort&page` · `GET /api/nfts/:id` · `GET /api/facets` |
| Favoritos | `GET /api/favorites` · `PUT\|DELETE /api/favorites/:nftId` |
| Carrinho | `GET /api/cart` · `POST /api/cart/items` · `PATCH\|DELETE /api/cart/items/:nftId?edition=` · `POST /api/cart/merge` · `POST /api/cart/acknowledge` |
| Cotação | `POST /api/quote {couponCode}` → subtotal, desconto, taxa de rede, total, `issues[]` e `token` |
| Pedidos | `POST /api/orders` (header `Idempotency-Key`) · `GET /api/orders/pending` · `GET /api/orders/:id` |
| Perfil | `GET\|PUT /api/profile` · `PUT /api/profile/password` |
| Carteiras | `GET\|PUT /api/wallets` · `GET\|POST\|DELETE /api/wallets/connection` (conexão, recusa e desconexão simuladas) |

Erros: `{ code, message, fields?, details? }` — `validation_error` (422), `invalid_credentials` / `session_invalid` / `session_expired` (401), `forbidden` (403), `not_found` (404), `email_conflict` / `availability_conflict` / `quote_changed` / `idempotency_conflict` / `wallet_not_connected` (409), `coupon_invalid` / `coupon_expired` (422), `wallet_refused` (403), `unavailable` / `internal_error` (503). O visitante é identificado por `X-Guest-Id` (carrinho do visitante no servidor, mesclado ao autenticar).

**Cotação e checkout.** A cotação da API é a referência do pedido. O pedido leva o `quoteToken`; se preço, estoque, cupom ou taxa mudarem, a API responde `409 quote_changed` (ou `availability_conflict` se algo esgotou) com a cotação nova e a UI exige **nova confirmação**. O recibo é um *snapshot* do pedido: mudanças posteriores no catálogo não o alteram. Após a confirmação, só os itens e quantidades comprados saem do carrinho; em falha, os itens são preservados.

**Idempotência.** Cada tentativa tem uma `Idempotency-Key`. Reenviar com a mesma chave (clique repetido, timeout, refresh) devolve **o mesmo pedido**; reutilizar a chave com conteúdo diferente gera `409 idempotency_conflict`.

## Estado, cache e retries

- `staleTime` 30 s, `gcTime` 5 min, sem refetch ao focar a janela (a sincronização vem do tempo real e da reconexão).
- Retries só para falhas transitórias (rede, timeout, 5xx): até 2 tentativas, backoff exponencial de 0,5 s a 4 s. 4xx nunca é repetido. **Mutations não repetem sozinhas**: a recuperação é explícita e idempotente.
- Requisições obsoletas são canceladas (`signal` do Query → Axios) e `keepPreviousData` evita "piscar" a grade ao trocar filtros. Cada consulta tem chave própria, então respostas fora de ordem não sobrescrevem a mais recente.
- Isolamento: chaves privadas incluem o usuário (`["cart", userId|"guest"]`…); logout, expiração e troca de usuário cancelam e removem o cache privado.
- Atualização otimista com rollback: favoritos, quantidade e remoção no carrinho.
- Invalidação: mutations invalidam carrinho e cotação; `nft.updated` corrige catálogo/detalhe e revalida carrinho/cotação; `order.updated` grava o pedido e invalida pendente/carrinho.
- Sessão recuperável após refresh (token validado a cada carga). Expiração durante a navegação ou o checkout abre o login **sobre a página atual**; o carrinho fica no servidor e o formulário em rascunho, então o fluxo é retomado.

## Tempo real (Socket.IO)

Cliente: `socket.io-client` real, uma conexão por sessão (token na query). Ao trocar ou encerrar a sessão, a conexão e os listeners são liberados.

| Evento | Efeito |
|---|---|
| `nft.updated` | Atualiza preço e disponibilidade no catálogo, detalhe e carrinho; revalida a cotação; anuncia a mudança em região viva |
| `order.updated` | Atualiza o pedido (pendente → confirmado/recusado); estados terminais nunca regridem |

Os eventos carregam `id` estável, `resource`, `resourceId`, `version` e `userId`. O cliente descarta **duplicatas** (por `id`) e **eventos antigos** (por `version`) e ignora eventos de outro usuário. Na reconexão, os recursos ativos são reconciliados via REST; a tela de pedido pendente faz *polling* de 2 s enquanto o socket está fora, então a compra é retomada sem criar outra.

### Transporte nos mocks e limitações

O servidor Socket.IO simulado usa `ws.link()` do MSW + `@mswjs/socket.io-binding` (`src/mocks/socket.ts`). O app não chama setters nem cache diretamente.

- Host fictício `wss://realtime.kurio.mock` (o MSW normaliza `/socket.io/` e um link por caminho colidiria com o HMR do Vite).
- Apenas transporte `websocket` (sem long-polling) e namespace `/`; sem rooms/broadcast nativos (o isolamento por usuário é feito no mock).
- O binding não implementa o ping do Engine.IO: o mock envia `2` a cada 20 s para o cliente não expirar.
- A identidade vem de `?token=` na URL da conexão.
- O `socket.io-client` captura `globalThis.WebSocket` ao ser importado, por isso o `main.tsx` sobe o MSW **antes** de importar o app.

## Mocks com MSW e cenários

Estado único em `mocks/db.ts` (42 NFTs, 2 usuários, favoritos, carrinhos, carteiras, pedidos), persistido em `localStorage` (`kurio:mock-db:v2`) para sobreviver a refresh. REST e eventos saem do mesmo estado: mudar preço/estoque atualiza as respostas **e** emite `nft.updated`. A camada é ativada por `VITE_USE_MOCKS` e está disponível no build de demonstração.

Cenários (via URL `?scenario=` e `?payment=`, ou `window.__kurioMock.setScenario(...)`):

`success` · `empty` · `slow` · `variable-latency` · `offline` · `http-4xx` · `http-5xx` · `unauthorized` · `session-expired` · `signup-conflict` · `order-timeout` · `price-changed` · `sold-out` · `wallet-refused` · e pagamento `payment=confirm|decline`.

Painel `window.__kurioMock`: `reset`, `setScenario`, `setPayment`, `failNext(chave, n)`, `expireSessions`, `patchNft(id, {priceEth, stock})`, `replayLast`, `emitRaw`, `disconnectSockets(bloquear?)`, `allowSockets`, `orders`.

## Testes

- `npm run mocks:selftest` — 12 verificações em Node (REST via Axios + Socket.IO via `socket.io-client` sobre MSW): idempotência, isolamento por usuário, ordenação de versões, sessão expirada, recusa, esgotado, queda do socket com pedido pendente e cenários de rede.
- `npm run e2e` — Playwright (Chromium) em desktop 1440×900 e mobile 390×844, contra o build otimizado (`.env.e2e`, timeout HTTP curto). Cada teste usa contexto novo (estado isolado); latência e eventos são controlados por cenários e pelo painel `__kurioMock`. Gera relatório HTML e traces das falhas.

Cobertura: catálogo (busca, filtros combinados, ordenação, paginação, histórico, erro, offline, skeleton, ordem de respostas), detalhe (acesso direto, inexistente, esgotado, limite), cadastro/login/expiração/logout/troca de usuário, favoritos (falha + rollback), carrinho (quantidade, cupons, persistência, mesclagem do visitante), compra completa, recusa, clique repetido, timeout com recuperação, preço alterado via Socket.IO, perfil/avatar/senha/carteiras, eventos duplicados/antigos, desconexão com pedido pendente, teclado/foco/formulários e regressão visual (início, detalhe, carrinho, pagamento).

> As baselines de regressão visual **não vêm versionadas**: gere-as uma vez com `npm run e2e:update` e versione `e2e/__screenshots__/`.

## Performance (Lighthouse)

`npm run lighthouse` (com o `preview` rodando) audita **início** e **detalhe**, nos perfis **mobile** e **desktop**, com 3 medições cada, e grava HTML/JSON por execução e `lighthouse-reports/summary.md` (mediana, versões, ambiente, LCP/CLS/TBT).

Metas: Performance ≥ 90 · Accessibility ≥ 95 · Best Practices ≥ 95 · SEO ≥ 90.

Resultados (preencher após rodar):

| Página | Perfil | Perf | A11y | Best Pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | | | | | | | |
| Início | desktop | | | | | | | |
| Detalhe | mobile | | | | | | | |
| Detalhe | desktop | | | | | | | |

Justificativa de qualquer resultado abaixo da meta e causas: _a preencher._

## Acessibilidade e responsividade

- Navegação por teclado, foco visível, foco preso em diálogos (login e revisão do pedido) com retorno ao gatilho e fechamento por `Esc`.
- Campos com `label`, `aria-invalid` e `aria-describedby` apontando para as mensagens de erro; `role="alert"`/`status` para feedback.
- Região viva global para mutations e eventos em tempo real (preço/estoque, pedido, reconexão).
- Skeletons com *shimmer* em catálogo, detalhe e resumo do carrinho, com dimensões preservadas (sem *layout shift*) e desligados em `prefers-reduced-motion`.
- Edições esgotadas desabilitadas e anunciadas; imagens com texto alternativo; estados que não dependem só de cor.
- Layouts verificados para 390, 768 e 1440 px. Mobile segue os frames do Figma: início, carrinho (cards + barra "Carrinho de NFTs"), detalhe (barra de compra fixa), pagamento (barra "Pagamento com carteira"), login e cadastro. Perfil, carteiras e confirmação funcionam em mobile sem frame próprio.

## Decisões, limitações e pendências

- **Fonte:** Roboto. O tx hash do recibo usa a monoespaçada do sistema.
- **Perfil × Carteiras:** apelido e ENS ficam em Carteiras; o pagamento os mostra somente leitura, vindos da carteira cadastrada.
- **Pedido como rota** (`/pedido/$id`) em vez de modal, para sobreviver a refresh; pendente e recusado têm telas próprias.
- **Explorador de blocos e avaliações** são simulados e rotulados como tal.
- **Imagens:** os 42 NFTs reutilizam 4 artes do Figma; o bloco de cor é só *fallback*.
- **Pendências:** gerar e versionar as baselines visuais; registrar as medianas do Lighthouse e a justificativa de metas não atingidas; revisar visualmente as telas mobile contra o Figma.
