# Dynamics Works — Documentação de Funcionalidades

Plataforma de trading de opções binárias para o mercado angolano.  
Stack: Next.js 16 · Prisma 7 · Neon DB · NextAuth v5 · lightweight-charts v5

---

## Índice

1. [Autenticação](#1-autenticação)
2. [Plataforma de Trading](#2-plataforma-de-trading)
3. [Pares Disponíveis](#3-pares-disponíveis)
4. [Gráfico](#4-gráfico)
5. [Carteira](#5-carteira)
6. [Dashboard do Trader](#6-dashboard-do-trader)
7. [Ranking](#7-ranking)
8. [Painel de Administração](#8-painel-de-administração)
9. [Sistema de Gravação de Preços](#9-sistema-de-gravação-de-preços)
10. [Notificações](#10-notificações)
11. [PWA — Aplicação Instalável](#11-pwa--aplicação-instalável)
12. [Design e UX](#12-design-e-ux)
13. [Segurança](#13-segurança)
14. [Infraestrutura](#14-infraestrutura)

---

## 1. Autenticação

### Registo
- Formulário com nome, email, senha e confirmação de senha
- Validação de senha (mínimo 6 caracteres)
- Verificação de email duplicado
- Conta criada com **10 000 Kz de saldo demo** e **0 Kz de saldo real** — saldo real só aumenta com depósito aprovado
- Redirecionamento automático para `/trade` após registo

### Login
- Autenticação por email + senha (NextAuth v5 com CredentialsProvider)
- Sessão JWT com id, nome, email, role e saldo
- Redirecionamento para `/trade` após login
- Proteção de rotas via `middleware.ts` (Edge Runtime, `getToken`)

### Proteção de Rotas
| Rota | Acesso |
|------|--------|
| `/trade` | Utilizadores autenticados |
| `/dashboard` | Utilizadores autenticados |
| `/wallet` | Utilizadores autenticados |
| `/ranking` | Utilizadores autenticados |
| `/admin/*` | Apenas admins |
| `/login`, `/register` | Apenas não autenticados |

---

## 2. Plataforma de Trading

### Abertura de Operações
- Direção: **ALTA** (call) ou **BAIXA** (put)
- Valor mínimo: **1 000 Kz** · Máximo: **500 000 Kz**
- **Input de valor livre** — digita livremente, valor mínimo aplicado no `onBlur`
- Atalhos de valor rápido: 1k · 5k · 10k · 25k
- **Expiração flexível** — botões de atalho (1m · 5m · 15m · 1h) mais input personalizado de 1–59 minutos
- Payout base: **85%** (configurável pelo admin por par)
- Preço de entrada registado no momento da abertura

### Resolução de Operações
- Worker automático via polling a cada 3 segundos (`/api/worker`)
- Operações fechadas quando o tempo de expiração termina
- Resultado determinado por probabilidade configurável pelo admin (padrão 47% win)
- Lucro/perda refletido imediatamente no saldo

### Operações Activas no Gráfico
- **Price lines** — linha horizontal no preço de entrada de cada operação aberta
- Cor **verde** se o preço atual é favorável (a ganhar), **vermelho** se desfavorável (a perder)
- Atualiza cor a cada tick de preço em tempo real

### Conta Demo / Real
- Toggle instantâneo entre conta **Demo** e **Real** na topbar
- Saldo demo separado do saldo real
- Demo iniciado com 10 000 Kz, pode ser recarregado
- Operações demo não afetam o saldo real

### Feed de Vitórias Recentes
- **Dados reais** das últimas 20 operações vencedoras (`/api/recent-wins`)
- Mostra nome do trader, lucro, par e tempo
- Atualizado a cada 15 segundos

### Indicador de Sentimento
- Barra visual ALTA/BAIXA com percentagem dinâmica
- Atualizado a cada tick de preço

### Temporizador de Vela
- Countdown em tempo real do tempo até ao fecho da vela atual
- Visível na barra de timeframes (desktop e mobile)
- Calculado com base no timeframe ativo e tempo UTC atual

---

## 3. Pares Disponíveis

### Forex ao Vivo (via Deriv WebSocket)
Disponíveis em dias úteis das 06:00 às 17:00 UTC:

| Par | Decimais |
|-----|----------|
| EUR/USD | 5 |
| GBP/USD | 5 |
| USD/JPY | 3 |
| AUD/USD | 5 |
| USD/CAD | 5 |
| EUR/GBP | 5 |
| USD/CHF | 5 |
| NZD/USD | 5 |

### Índices Sintéticos Deriv
| Par | Descrição |
|-----|-----------|
| Volatility 10 | Índice sintético baixa volatilidade |
| Volatility 25 | Índice sintético média volatilidade |
| Volatility 50 | Índice sintético volatilidade moderada |
| Volatility 75 | Índice sintético alta volatilidade |
| Volatility 100 | Índice sintético muito alta volatilidade |
| Boom 300 | Índice com picos ascendentes |
| Crash 300 | Índice com quedas abruptas |

### Pares OTC (After-Hours)
Activados automaticamente ao fim de semana e fora do horário de mercado:

| Par | Preço Base |
|-----|-----------|
| EUR/USD (OTC) | 1.0850 |
| GBP/USD (OTC) | 1.2650 |
| USD/JPY (OTC) | 149.50 |
| AUD/USD (OTC) | 0.6520 |
| USD/CAD (OTC) | 1.3620 |
| EUR/GBP (OTC) | 0.8580 |

**Simulação OTC:** usa dados reais gravados durante o dia se disponíveis (≥ 50 velas); caso contrário, movimento Browniano com decaimento de momentum (`momentum × 0.92`).

### Seleção Automática de Modo
- Detecção automática de horário (UTC) e dia da semana
- Forex ao vivo → fora de horas → OTC transparente para o trader
- Admin pode forçar modo: **Automático / Sempre Live / Sempre OTC**
- **Trade page polling** a cada 15 segundos a `/api/market-mode` — os pares mudam automaticamente quando o admin altera o modo, sem precisar de reload

---

## 4. Gráfico

### Motor
- **lightweight-charts v5** (biblioteca open-source da TradingView)
- Gráfico de velas japonesas (candlestick)
- Tema escuro com cores da plataforma (`#0a0f1e` fundo, verde/vermelho para velas)

### Dados
- **Pares live:** preços em tempo real via Deriv WebSocket (`wss://ws.binaryws.com`)
- **Pares OTC:** dados históricos reais da DB se disponíveis; simulação Browniana como fallback
- Vela atual atualizada tick a tick (sem piscar/saltar)

### Timeframes
- 1m · 5m · 15m · 1h · 1D
- Troca de timeframe recarrega o histórico via WebSocket

### Funcionalidades Visuais
- Crosshair interativo
- Escala de preço à direita
- Escala de tempo com hora visível
- Auto-fit do conteúdo ao carregar
- ResizeObserver: adapta ao redimensionamento da janela
- **Watermark** — nome do par em overlay semi-transparente no centro do gráfico (`opacity: 0.08`)
- **Price lines** das operações activas (verde = a ganhar, vermelho = a perder)

### Ticker Bar
- Barra superior com todos os pares e preços em tempo real
- Animação de scroll contínuo (CSS keyframes)
- Cor verde/vermelho conforme direção do preço

---

## 5. Carteira

### Saldo
- Visualização do saldo real e demo separados
- Histórico de transações (depósitos, levantamentos, lucros, perdas)

### Depósito
- Método: **Multicaixa Express** (único método disponível)
- Formulário com valor em Kz e número de telemóvel Multicaixa
- Referência de pagamento gerada automaticamente
- Depósito pendente → aprovação manual pelo admin

### Levantamento
- Formulário com valor e número de telemóvel Multicaixa Express
- Levantamento mínimo configurável
- Estado: pendente → processado pelo admin

---

## 6. Dashboard do Trader

- Total de operações realizadas
- Taxa de vitória pessoal
- Lucro/perda total acumulado
- Histórico de operações com filtros (resultado, data)
- Gráfico de desempenho por período

---

## 7. Ranking

Página `/ranking` — visível através do ícone de troféu na bottom navigation mobile e na topbar desktop.

### Top 3 Pódio
- Visual em pódio com troféu/medalhas
- 1º lugar destacado com cor dourada e tamanho maior
- Mostra primeiro nome e lucro total

### Leaderboard Completo
- Top 20 traders por lucro total acumulado
- Colunas: posição, avatar (inicial do nome), nome, vitórias/total, taxa de vitória, lucro
- Barra de progresso visual de win rate (verde ≥ 50%, vermelho < 50%)
- Apenas operações reais (não demo) contam

### API (`/api/ranking`)
- Agrega todas as operações `closed` por utilizador
- Calcula: lucro total, total de trades, vitórias, win rate
- Filtra utilizadores com ≥ 1 operação
- Ordena por lucro descendente, limite 20

---

## 8. Painel de Administração

Acesso exclusivo para utilizadores com `role: "admin"`.  
URL: `/admin`

### Dashboard (`/admin/dashboard`)
Estatísticas gerais da plataforma em tempo real:

| Métrica | Descrição |
|---------|-----------|
| Total utilizadores | Número de contas registadas |
| Saldo total | Soma de todos os saldos reais na plataforma |
| Operações hoje | Número de trades do dia atual |
| Lucro hoje | Soma das perdas dos traders (receita da plataforma) |
| Taxa de vitória traders | % de operações ganhas pelos traders |
| Total operações | Histórico completo de trades |

### Gestão de Utilizadores (`/admin/users`)
- Tabela completa de todos os utilizadores
- Informações: nome, email, província, saldo, nº de operações, estado
- **Ajuste de saldo** em tempo real (input inline + botão OK)
- **Bloquear / Desbloquear** conta
- **Promover a Admin**
- Botão de atualização manual

### Gestão de Operações (`/admin/trades`)
- Tabela de todas as operações de todos os traders
- Colunas: utilizador, par, direção, montante, resultado, lucro/perda, data
- Filtros combinados:
  - Por resultado (Ganho / Perda / Ativo)
  - Por par (texto livre)
  - Por intervalo de datas (de/até)
- **Exportar CSV** com todos os dados filtrados
- Botão limpar filtros

### Configurações (`/admin/settings`)
- **Payout por par** — slider 50% a 95% (padrão 85%) por cada par disponível
- **Probabilidade de vitória por par** — slider 30% a 60% (padrão 47%) por cada par
- **Modo manutenção** — toggle que bloqueia toda a plataforma para traders
- **Modo OTC** — selector: Automático / Sempre Live / Sempre OTC
- **Configurações persistidas na base de dados** (model `Settings`, singleton) — sobrevivem a cold starts serverless
- Mudança de modo OTC reflecte-se automaticamente nos clientes em até 15 segundos
- Guardadas instantaneamente com feedback visual

### Gestão de Transações (`/admin/transactions`)
- Tabela de todos os depósitos e levantamentos
- Colunas: utilizador, tipo, valor, método, referência, estado, data
- Filtros: por estado (Pendente/Aprovado/Rejeitado) e por tipo (Depósito/Levantamento)
- Campo de pesquisa por nome ou email do utilizador
- **Aprovar** depósito → credita saldo real imediatamente
- **Rejeitar** → sem alteração de saldo
- **Aprovar** levantamento → debita saldo (verifica saldo suficiente)
- Badge de pendentes no sidebar atualizado a cada 30 segundos
- Email automático ao utilizador em cada acção (aprovado/rejeitado)

### Seed de Admin
- Endpoint `/api/admin/seed` disponível apenas em desenvolvimento
- Cria ou atualiza o utilizador `seusburros91@gmail.com` com `role: "admin"`

---

## 9. Sistema de Gravação de Preços

### Arquitectura
- Cron job (`/api/price-recorder`) chamado a cada minuto pelo Vercel Cron
- Grava velas reais da Deriv REST API no model `PriceCandle` (PostgreSQL)
- Alimenta os pares OTC com dados históricos reais em vez de simulação pura

### Gravação (`/api/price-recorder`)
- Verifica horário de mercado aberto (dias úteis, 06:00–17:00 UTC)
- Se fora de horas: retorna `{ skipped: true }` sem fazer requests
- Para cada par forex (8 pares) e cada timeframe (1m, 5m, 15m):
  - Fetch à Deriv REST API (`ticks_history`) para obter as últimas 5 velas
  - `upsert` por `(asset, timeframe, timestamp)` — nunca duplica
  - Delay de 200ms entre pares para respeitar rate limits
  - `Promise.allSettled` — falha de um par não afecta os restantes

### Consulta OTC (`/api/otc-candles`)
- Parâmetros: `?asset=EUR/USD (OTC)&timeframe=1m&count=150`
- Mapeia nome OTC → par live (ex: "EUR/USD (OTC)" → "EUR/USD")
- Busca as últimas `count` velas da DB, ordenadas ASC
- Se tiver ≥ 50 velas: retorna dados reais
- Se insuficiente: retorna `{ fallback: true }` → frontend usa simulação Browniana

### Integração no Gráfico OTC
- Ao mudar para par OTC: mostra simulação Browniana imediatamente (zero latência)
- Em paralelo, fetch a `/api/otc-candles`
- Se dados reais disponíveis: substitui o gráfico com histórico real, sem piscar
- Simulação tick-a-tick continua a partir do último preço real (continuidade suave)

### Model `PriceCandle`
```
asset      String  — ex: "EUR/USD"
timeframe  String  — "1m" | "5m" | "15m"
open/high/low/close  Float
timestamp  DateTime
@@unique([asset, timeframe, timestamp])
@@index([asset, timeframe, timestamp])
```

---

## 10. Notificações

### Sistema (`/api/notifications`)
- Notificações por utilizador armazenadas na DB
- Tipos: `deposit_completed`, `deposit_rejected`, `withdrawal_completed`, `withdrawal_rejected`, `kyc_approved`, `kyc_rejected`
- Marcação individual ou em bloco como lida (PATCH)

### Bell Component (`NotificationBell`)
- Badge vermelho com contagem de não lidas
- Polling a cada 30 segundos
- **Desktop:** dropdown 320px ancorado à bell
- **Mobile:** bottom sheet animado (slide-up, 80vh, `cubic-bezier(0.32,0.72,0,1)`) com backdrop semi-transparente
- Scroll do body bloqueado quando o sheet está aberto
- Botão "Ler todas" / "Marcar todas como lidas"
- Ícone por tipo de notificação (💰 depósito, ✅ KYC aprovado, etc.)

---

## 11. PWA — Aplicação Instalável

- **`public/manifest.json`** — nome "Dynamics Works", `start_url: "/trade"`, `theme_color: "#f5a623"`
- **`public/sw.js`** — service worker com cache básico (permite prompt de instalação no Chrome/Android)
- **`ServiceWorker` component** — regista o SW em `useEffect` no lado cliente
- **Ícones** gerados dinamicamente via `next/og` (edge runtime) em `/icon-192` e `/icon-512`
- **Meta tags PWA** no `layout.tsx`: `apple-mobile-web-app-capable`, `mobile-web-app-capable`, viewport
- **Google Search Console** — verification tag incluída no `layout.tsx`
- Quando o utilizador abre `dynamicworks.ao` no Chrome Android ou Safari iOS, aparece banner "Adicionar ao ecrã inicial"

---

## 12. Design e UX

### Tema Visual
- Fundo principal: `#0a0f1e` (azul muito escuro)
- Cards/sidebar: `#111827`
- Acentos: `#f5a623` (dourado), `#22c55e` (verde), `#ef4444` (vermelho)
- Tipografia: `system-ui, -apple-system, sans-serif`
- Zero dependências CSS externas — 100% inline styles

### Layout Desktop
- Topbar fixa com logo, seletor de par, preço ao vivo, toggle demo/real, saldo, relógio, sino de notificações, menu utilizador
- Ticker bar com scroll automático de todos os pares
- Gráfico 70% da largura
- Painel de trading 30% à direita
- Timeframes clicáveis + temporizador de vela acima do gráfico

### Layout Mobile (Quotex-style)
- Topbar compacta com logo, seletor de par, preço e saldo (avatar não cortado)
- Gráfico a ocupar todo o ecrã disponível
- Bottom navigation: Gráfico · Negociar · Carteira · Ranking
- Drawer de trading deslizante de baixo (75vh, animação cubic-bezier)
- Backdrop semi-transparente ao abrir o drawer
- **Input de valor não perde foco** nos ticks de preço (padrão `renderTradePanel()` — função em vez de componente JSX)

### Notificações de Resultado
- Toast animado no topo ao abrir operação, ganhar ou perder
- 4 segundos de duração, cor contextual (verde/vermelho/dourado)

### Responsividade
- Deteção de `window.innerWidth < 768` para modo mobile
- `windowHeight` via estado para cálculo correto da altura do gráfico
- `ResizeObserver` no gráfico para adaptar ao resize

---

## 13. Segurança

- Senhas encriptadas com **bcryptjs** (salt rounds: 12)
- Sessões JWT assinadas com `AUTH_SECRET`
- Todas as API routes de admin verificam `session.user.role === "admin"`
- **Audit IDOR** — todas as rotas de utilizador usam `session.user.id` da sessão, nunca parâmetros da URL como fonte de autorização
- Utilizadores bloqueados (`status: "blocked"`) não conseguem autenticar
- Proteção de rotas no `middleware.ts` (Edge Runtime) antes de atingir os componentes
- Seed de admin bloqueado em produção
- Valores de payout e probabilidade validados no servidor (ranges fixos)
- Novos utilizadores criados com **0 Kz real** — saldo real só existe após depósito aprovado pelo admin

---

## 14. Infraestrutura

### Base de Dados
- **Neon** (PostgreSQL serverless)
- **Prisma 7** com `@prisma/adapter-neon` (driver HTTP/WebSocket) — obrigatório `PrismaNeon`, não `new PrismaClient()` direto
- Schema: `User`, `Trade`, `Transaction`, `PriceCandle`, `Settings`, `Notification`

### Settings (Singleton DB)
- Model `Settings` com `id = "singleton"` — uma única linha guarda toda a config
- Campos: `otcMode`, `maintenanceMode`, `winProbability` (JSON por par), `payout` (JSON por par)
- Cache em memória com TTL implícito — acesso rápido em requests subsequentes na mesma instância

### Deploy
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) em `localhost:3000` |
| `npm run build` | Build de produção otimizado |
| `npm run start` | Servidor de produção |
| `npx prisma generate` | Regenerar cliente Prisma após schema changes |
| `npx prisma db push` | Aplicar schema à DB sem migration |

### Variáveis de Ambiente
| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string Neon PostgreSQL |
| `AUTH_SECRET` | Chave de assinatura JWT (NextAuth v5) |
| `NEXTAUTH_URL` | URL base da aplicação |
| `RESEND_API_KEY` | API de email transacional (Resend) |
| `BNA_USD_RATE` | Taxa de câmbio USD/Kz (Banco Nacional de Angola) |

### APIs Externas
| Serviço | Uso |
|---------|-----|
| Deriv WebSocket (`wss://ws.binaryws.com`) | Preços forex e índices sintéticos em tempo real |
| Deriv REST API | Histórico de velas para gravação OTC |
| Neon Database | Persistência de dados |
| Resend | Emails transacionais |

---

*Dynamics Works © 2025 — Plataforma licenciada para operação no mercado angolano*
