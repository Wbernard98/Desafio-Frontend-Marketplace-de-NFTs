# Kurio — Marketplace de NFTs

Desafio Frontend: React + TypeScript, TanStack Router/Query, Axios, Socket.IO, Tailwind, MSW, Playwright e Lighthouse.
Toda a API (REST **e** tempo real) é simulada na camada de rede com MSW; nenhum componente, hook ou o cliente Axios
contém resposta fictícia.

## Como executar

```bash
npm install
npm run dev            # desenvolvimento, mocks ligados (.env.development)
npm run build          # build otimizado (mocks também ligados: build de demonstração, .env.production)
npm run preview        # serve o build em http://localhost:4173
npm run typecheck      # tsc do app + dos testes E2E
npm run lint
npm run mocks:selftest # verifica REST + Socket.IO dos mocks direto no Node (sem navegador)
npx playwright install chromium
npm run e2e            # build modo e2e + preview + testes (desktop 1440 e mobile 390)
npm run e2e:update     # gera/atualiza as baselines de regressão visual
npm run e2e:report     # abre o relatório HTML
npm run lighthouse     # com o preview rodando; gera lighthouse-reports/
```

Credenciais fictícias (seed): `ana@kurio.test / Senha@123` (já tem carteira MetaMask cadastrada) e
`bruno@kurio.test / Senha@456` (sem carteiras). Cupons: `KURIO10` (10%), `WELCOME5` (5%), `EXPIRADO` (expirado), qualquer outro é inválido.
Senhas **não** são guardadas em claro: o servidor simulado armazena apenas `SHA-256(salt:senha)`.

## Arquitetura

```
src/
  app/            router (rotas, guards) e queryClient (política de cache)
  features/       catalog | cart | favorites | orders | account  (api.ts = Axios, hooks.ts = TanStack Query)
  shared/
    api/          http.ts (Axios + interceptors), types.ts (contratos), errors.ts, queryKeys.ts
    auth/         authStore (token), hooks (sessão/login/logout), loginModalStore
    realtime/     RealtimeProvider (socket.io-client), status
    ui/           Announcer (região viva), Skeleton, useFocusTrap
  mocks/          db.ts (estado + regras), handlers.ts (REST), socket.ts (Socket.IO), scenarios.ts, control.ts, fixtures.ts
  components/     telas (Header, Login, Carrinho, Detalhe, Pagamento, Pedido, Perfil, Carteiras)
e2e/              testes Playwright
scripts/          lighthouse.mjs, mock-selftest.mjs (+ loader TS para Node)
```

Rotas: `/` (início), `/nft/$id`, `/carrinho`, `/login`, `/cadastro`, `/pagamento`🔒, `/pedido/$id`🔒, `/perfil?section=…`🔒
(`profile`, `wallets`, `wishlist` funcionais; `activity`, `offers`, `downloads`, `support` e as páginas `/criadores` e `/aprenda` existem no menu do layout, mas mostram um aviso de "fora desta entrega" sem fingir funcionalidade).
`/carteiras` e `/mercado` redirecionam para o fluxo correspondente. Rotas privadas (🔒) sem sessão vão para `/login?redirect=…` e retomam o destino depois (só caminhos internos são aceitos).
Rota inexistente exibe a página "não encontrada". O modal de acesso continua sendo usado em sessão expirada e em ações pontuais (favoritar, "Entrar para finalizar"), preservando a página atual.

### Contratos REST (`src/shared/api/types.ts`)

| Recurso | Endpoints |
|---|---|
| Sessão/conta | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/session` · `POST /api/auth/logout` |
| NFTs | `GET /api/nfts?q&collection&network&min&max&tab&sort&page` · `GET /api/nfts/:id` · `GET /api/facets` |
| Favoritos | `GET /api/favorites` · `PUT/DELETE /api/favorites/:nftId` |
| Carrinho | `GET /api/cart` · `POST /api/cart/items` · `PATCH/DELETE /api/cart/items/:nftId?edition=` · `POST /api/cart/merge` · `POST /api/cart/acknowledge` |
| Cotação | `POST /api/quote {couponCode}` → subtotal, desconto, taxa de rede, total, `issues[]` e `token` |
| Pedidos | `POST /api/orders` (header `Idempotency-Key`) · `GET /api/orders/pending` · `GET /api/orders/:id` |
| Perfil | `GET/PUT /api/profile` · `PUT /api/profile/password` |
| Carteiras | `GET/PUT /api/wallets` · `GET/POST/DELETE /api/wallets/connection` (simula conexão, recusa e desconexão) |

Erros seguem `{ code, message, fields?, details? }` com `validation_error` (422), `invalid_credentials`/`session_invalid`/`session_expired` (401),
`forbidden` (403), `not_found` (404), `email_conflict`/`availability_conflict`/`quote_changed`/`idempotency_conflict`/`wallet_not_connected` (409),
`coupon_invalid`/`coupon_expired` (422), `wallet_refused` (403) e `unavailable`/`internal_error` (503). O visitante é identificado por `X-Guest-Id` (carrinho do visitante no servidor).

Valores em ETH trafegam como **strings decimais** e todos os cálculos usam `decimal.js`; quantidades são inteiras.
O total que vale é o da cotação da API: o pedido leva o `quoteToken`; se qualquer preço, estoque, cupom ou taxa mudar, a API responde `409 quote_changed`
(ou `availability_conflict` quando algo esgotou) com a cotação nova, e a UI exige **nova confirmação** (“Aceitar novos valores”).

### Cache, retries e sincronização (TanStack Query)

- `staleTime` 30 s, `gcTime` 5 min, sem refetch ao focar a janela (a sincronização vem do tempo real e da reconexão).
- Retries só para falhas transitórias (rede, timeout, 5xx): até 2 tentativas, backoff exponencial 0,5 s → 4 s. 4xx nunca é repetido. **Mutations nunca repetem sozinhas**:
  a recuperação é explícita e idempotente (chave de idempotência por tentativa; reenvio devolve o mesmo pedido).
- Requisições obsoletas são canceladas (`signal` do Query → Axios) e `keepPreviousData` evita “piscar” a grade ao trocar filtros. Respostas fora de ordem não sobrescrevem a consulta mais recente (cada consulta tem chave própria).
- Dados privados têm o **dono na chave** (`["cart", userId|"guest"]`…) e são cancelados/removidos no logout, na expiração e na troca de usuário (`clearPrivateData`).
- Atualização otimista com rollback: favoritos, quantidade e remoção no carrinho.
- Invalidação: mutations invalidam carrinho/cotação; `nft.updated` corrige catálogo/detalhe no cache e revalida carrinho/cotação; `order.updated` grava o pedido e invalida pendente/carrinho.

## Tempo real (Socket.IO)

Cliente: `socket.io-client` real (`shared/realtime/RealtimeProvider.tsx`), uma conexão por sessão (token na query). Ao mudar/encerrar a sessão a conexão é fechada e os listeners removidos.
Eventos (`id` estável, `resource`, `resourceId`, `version`, `userId`, `payload`):

- `nft.updated` → preço/estoque no catálogo, detalhe e carrinho + aviso em região viva.
- `order.updated` → estado do pedido (pendente → confirmado/recusado; terminais nunca regridem).

O cliente descarta **duplicatas** (por `id`) e **eventos antigos** (por `version`); eventos de outro usuário são ignorados e o servidor simulado só entrega `order.updated` ao dono.
Na reconexão, catálogo, NFT, carrinho, cotação e pedidos ativos são reconciliados via REST. A página de pedido pendente faz polling de 2 s enquanto o socket está fora.

### Transporte nos mocks e limitações

O servidor Socket.IO simulado usa `ws.link()` do MSW + `@mswjs/socket.io-binding` (`src/mocks/socket.ts`); o app não chama setters/cache diretamente.

- Host fictício `wss://realtime.kurio.mock` (o MSW normaliza `/socket.io/` e um link por caminho colidiria com o HMR do Vite).
- Só transporte `websocket` (sem long-polling) e só o namespace `/`; sem rooms/broadcast nativos (o isolamento por usuário é feito no mock).
- O binding não implementa o ping do Engine.IO: o mock envia `2` a cada 20 s para o cliente não expirar.
- A identidade vem de `?token=` na URL da conexão.
- O `socket.io-client` captura `globalThis.WebSocket` ao ser importado: por isso `main.tsx` sobe o MSW **antes** de importar o app.

## Mocks (MSW)

Estado único em `mocks/db.ts` (catálogo com 42 NFTs, 2 usuários, favoritos, carrinhos, carteiras, pedidos), persistido em `localStorage` (`kurio:mock-db:v2`) para sobreviver a refresh.
REST e eventos saem do mesmo estado: mudar preço/estoque atualiza as respostas e emite `nft.updated`. Reset: `await window.__kurioMock.reset()` (ou limpar o storage) restaura o cenário conhecido.

Cenários (`?scenario=` e `?payment=` na URL, ou `window.__kurioMock.setScenario(...)`; ficam na sessão):
`success`, `empty`, `slow`, `variable-latency`, `offline`, `http-4xx`, `http-5xx`, `unauthorized`, `session-expired`, `signup-conflict`, `order-timeout`, `price-changed`, `sold-out`, `wallet-refused`; pagamento: `payment=confirm|decline`.
Painel `window.__kurioMock`: `reset`, `setScenario`, `setPayment`, `failNext(chave, n)`, `expireSessions`, `patchNft(id, {priceEth, stock})`, `replayLast`, `emitRaw`, `disconnectSockets(bloquear?)`, `allowSockets`, `orders`.

## Testes

- `npm run mocks:selftest`: 12 verificações em Node (REST via Axios + Socket.IO via `socket.io-client` sobre MSW): idempotência, isolamento por usuário, ordenação de versões, sessão expirada, recusa, esgotado, queda do socket com pedido pendente, cenários de rede.
- `npm run e2e`: Playwright (Chromium) em desktop 1440×900 e mobile 390×844, build otimizado em modo `e2e`, relatório HTML (`playwright-report/`) e traces das falhas. Cada teste usa um contexto novo (estado isolado). Latência e eventos são controlados por cenários e pelo painel `__kurioMock`.
  Cobertura: catálogo (busca/filtros/ordenação/paginação/histórico/erro/offline/skeleton/ordem de respostas), detalhe, cadastro/login/expiração/logout/troca de usuário, favoritos (falha + rollback), carrinho (quantidade, cupons, persistência, mesclagem do visitante), compra completa, recusa, clique repetido, timeout com recuperação, preço alterado via Socket.IO, perfil/avatar/senha/carteiras, eventos duplicados/antigos, desconexão com pedido pendente, teclado/foco/formulários e regressão visual (início, detalhe, carrinho, pagamento).
- **As baselines de regressão visual não estão versionadas**: gere-as uma vez com `npm run e2e:update` e versione `e2e/__screenshots__/`.

## Lighthouse

`npm run lighthouse` (com `npm run build:demo && npx vite preview --port 4173` rodando) audita início e detalhe, perfis mobile e desktop, 3 execuções cada, e grava HTML/JSON por execução e `lighthouse-reports/summary.md` (mediana, versões, ambiente, LCP/CLS/TBT).
Os resultados **não foram medidos** nesta entrega: execute o script e registre aqui as medianas e a justificativa de qualquer meta não atingida (Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90).

## Decisões e ajustes em relação ao layout

- Fonte: **Roboto** (`@fontsource/roboto` 400/500/700, servida localmente). Rode `npm install` após atualizar. O tx hash do recibo usa a monoespaçada do sistema.
- Menus: o menu superior (Início, Mercado, Criadores, Aprenda) e o lateral do perfil (Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte, Sair) seguem o Figma. Fora do escopo do desafio e sem fingir sucesso: Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados e Suporte exibem um aviso. "Lista de interesse" é a lista de favoritos (API).
- Login e Cadastro são telas completas (desktop e mobile), mais o modal para sessão expirada. Login social e "esqueci a senha" estão desabilitados/indisponíveis.
- Mobile: início (já existia), carrinho (cards empilhados + barra "Carrinho de NFTs"), detalhe (barra superior com voltar/favoritar e barra de compra fixa com quantidade, preço e "Comprar NFT"), pagamento (barra "Pagamento com carteira"; resumo e carteira vêm antes do formulário) e login/cadastro. Perfil, carteiras e confirmação funcionam em mobile sem frame próprio, como pede o enunciado. **Confira cada tela em 390 px contra o Figma**: os ajustes foram feitos pelos prints dos frames, sem acesso ao arquivo de design.
- Perfil: ENS e apelido da carteira migraram para **Carteiras**; o pagamento mostra esses dados somente leitura, vindos da carteira cadastrada.
- Pedido: a confirmação virou a rota `/pedido/$id` (em vez de modal) para sobreviver a refresh; pendente e recusado têm telas próprias.
- Acessibilidade: foco preso/retorno em diálogos (login e revisão), `aria-invalid`/`aria-describedby` nos campos, regiões vivas para mutations e eventos, skeletons com shimmer (desligado com `prefers-reduced-motion`), edições esgotadas desabilitadas e anunciadas.
- Imagens: todos os NFTs do catálogo usam os assets do Figma (4 artes que se repetem nos 42 itens); o bloco de cor (`placeholderColor`) fica só como fallback caso um NFT venha sem imagem.
