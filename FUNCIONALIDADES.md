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
7. [Painel de Administração](#7-painel-de-administração)
8. [Design e UX](#8-design-e-ux)
9. [Segurança](#9-segurança)
10. [Infraestrutura](#10-infraestrutura)

---

## 1. Autenticação

### Registo
- Formulário com nome, email, senha e confirmação de senha
- Validação de senha (mínimo 6 caracteres)
- Verificação de email duplicado
- Conta criada com **10 000 Kz de saldo demo** automaticamente
- Redirecionamento automático para `/trade` após registo

### Login
- Autenticação por email + senha (NextAuth v5 com CredentialsProvider)
- Sessão JWT com id, nome, email, role e saldo
- Redirecionamento para `/trade` após login
- Proteção de rotas via `proxy.ts` (middleware Next.js)

### Proteção de Rotas
| Rota | Acesso |
|------|--------|
| `/trade` | Utilizadores autenticados |
| `/dashboard` | Utilizadores autenticados |
| `/wallet` | Utilizadores autenticados |
| `/admin/*` | Apenas admins |
| `/login`, `/register` | Apenas não autenticados |

---

## 2. Plataforma de Trading

### Abertura de Operações
- Direção: **ALTA** (call) ou **BAIXA** (put)
- Valor mínimo: **1 000 Kz** · Máximo: **500 000 Kz**
- Atalhos de valor rápido: 1k · 5k · 10k · 25k
- Tempos de expiração: **1 min · 5 min · 15 min · 1 hora**
- Payout base: **85%** (configurável pelo admin por par)
- Preço de entrada registado no momento da abertura

### Resolução de Operações
- Worker automático via polling a cada 3 segundos
- Operações fechadas quando o tempo de expiração termina
- Resultado determinado por probabilidade configurável (padrão 47% win)
- Lucro/perda refletido imediatamente no saldo

### Conta Demo / Real
- Toggle instantâneo entre conta **Demo** e **Real** na topbar
- Saldo demo separado do saldo real
- Demo iniciado com 10 000 Kz, pode ser recarregado
- Operações demo não afetam o saldo real

### Feed de Vitórias Recentes
- Simulação de vitórias de outros traders (nomes angolanos reais)
- Atualizado a cada 4 segundos
- Cria prova social na interface de trading

### Indicador de Sentimento
- Barra visual ALTA/BAIXA com percentagem dinâmica
- Atualizado a cada tick de preço

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

**Simulação OTC:** movimento Browniano com decaimento de momentum (`momentum × 0.92`) — preços suaves e realistas sem fonte externa.

### Seleção Automática de Modo
- Detecção automática de horário (UTC) e dia da semana
- Forex ao vivo → fora de horas → OTC transparente para o trader
- Admin pode forçar modo: **Automático / Sempre Live / Sempre OTC**

---

## 4. Gráfico

### Motor
- **lightweight-charts v5** (biblioteca open-source da TradingView)
- Gráfico de velas japonesas (candlestick)
- Tema escuro com cores da plataforma (#0a0f1e fundo, verde/vermelho para velas)

### Dados
- **Pares live:** preços em tempo real via Deriv WebSocket (`wss://ws.binaryws.com`)
- **Pares OTC:** simulação local com histórico de 150 velas gerado na inicialização
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
- Formulário com valor em Kz
- Métodos de pagamento angolanos:
  - Multicaixa Express
  - Transferência Bancária (BFA, BAI, BIC, Millennium Atlântico)
  - TPA (Terminal de Pagamento)
- Referência de pagamento gerada automaticamente
- Depósito pendente → aprovação manual pelo admin

### Levantamento
- Formulário com valor, banco e IBAN/conta
- Levantamento mínimo configurável
- Estado: pendente → processado

---

## 6. Dashboard do Trader

- Total de operações realizadas
- Taxa de vitória pessoal
- Lucro/perda total acumulado
- Histórico de operações com filtros (resultado, data)
- Gráfico de desempenho por período

---

## 7. Painel de Administração

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
- Configurações em memória no servidor (sem necessidade de base de dados)
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

### Seed de Admin (`/api/admin/seed`)
- Disponível apenas em desenvolvimento (`NODE_ENV !== "production"`)
- Cria ou atualiza (`upsert`) o utilizador `seusburros91@gmail.com` com role admin
- Password: `Jedilson*2005`

---

## 8. Sistema de Gravação de Preços Reais

### Arquitectura
- Cron job (`/api/price-recorder`) chamado a cada minuto pelo Vercel Cron
- Grava velas reais da Deriv REST API no model `PriceCandle` (PostgreSQL)
- Utilizado para alimentar os pares OTC com dados históricos reais em vez de simulação pura

### Gravação (`/api/price-recorder`)
- Verifica horário de mercado aberto (dias úteis, 06:00–17:00 UTC)
- Se fora de horas: retorna `{ skipped: true }` sem fazer requests
- Para cada par forex (8 pares) e cada timeframe (1m, 5m, 15m):
  - Faz fetch à Deriv REST API (`ticks_history`) para obter as últimas 5 velas
  - `upsert` por `(asset, timeframe, timestamp)` — nunca duplica
  - Delay de 200ms entre pares para respeitar rate limits
  - `Promise.allSettled` — falha de um par não afecta os restantes

### Consulta OTC (`/api/otc-candles`)
- Parâmetros: `?asset=EUR/USD (OTC)&timeframe=1m&count=150`
- Mapeia nome OTC → par live (ex: "EUR/USD (OTC)" → "EUR/USD")
- Busca as últimas `count` velas da DB, ordenadas ASC
- Se tiver ≥ 50 velas: retorna dados reais
- Se insuficiente: retorna `{ fallback: true }` para o frontend usar simulação

### Integração no Gráfico OTC (`app/trade/page.tsx`)
- Ao mudar para par OTC: mostra simulação Browniana imediatamente (zero latência)
- Em paralelo, faz fetch a `/api/otc-candles`
- Se dados reais disponíveis: substitui o gráfico com histórico real, sem piscar
- Simulação tick-a-tick continua a partir do último preço real (continuidade suave)
- Se sem dados (primeiros minutos de uso): simulação pura como fallback

### Model `PriceCandle`
```
asset     String  — ex: "EUR/USD"
timeframe String  — "1m" | "5m" | "15m"
open/high/low/close Float
timestamp DateTime
@@unique([asset, timeframe, timestamp])
@@index([asset, timeframe, timestamp])
```

---

## 9. Design e UX

### Tema Visual
- Fundo principal: `#0a0f1e` (azul muito escuro)
- Cards/sidebar: `#111827`
- Acentos: `#f5a623` (dourado), `#22c55e` (verde), `#ef4444` (vermelho)
- Tipografia: `system-ui, -apple-system, sans-serif`
- Zero dependências CSS externas — 100% inline styles

### Layout Desktop
- Topbar fixa com logo, seletor de par, preço ao vivo, toggle demo/real, saldo, relógio, menu utilizador
- Ticker bar com scroll automático de todos os pares
- Gráfico 70% da largura
- Painel de trading 30% à direita
- Timeframes clicáveis acima do gráfico

### Layout Mobile (Quotex-style)
- Topbar compacta com logo, seletor de par, preço e saldo
- Gráfico a ocupar todo o ecrã disponível
- Bottom navigation: Gráfico · Negociar · Carteira · Conta
- Drawer de trading deslizante de baixo (75vh, animação cubic-bezier)
- Backdrop semi-transparente ao abrir o drawer
- Notificações de resultado posicionadas abaixo da topbar

### Notificações
- Toast animado no topo ao abrir operação, ganhar ou perder
- 4 segundos de duração, cor contextual (verde/vermelho/dourado)

### Responsividade
- Deteção de `window.innerWidth < 768` para modo mobile
- `windowHeight` via estado para cálculo correto da altura do gráfico
- `ResizeObserver` no gráfico para adaptar ao resize

---

## 10. Segurança

- Senhas encriptadas com **bcryptjs** (salt rounds: 12)
- Sessões JWT assinadas com `NEXTAUTH_SECRET`
- Todas as API routes de admin verificam `session.user.role === "admin"`
- Utilizadores bloqueados (`status: "blocked"`) não conseguem autenticar
- Proteção de rotas no middleware (`proxy.ts`) antes de atingir os componentes
- Seed de admin bloqueado em produção
- Valores de payout e probabilidade validados no servidor (ranges fixos)

---

## 11. Infraestrutura

### Base de Dados
- **Neon** (PostgreSQL serverless)
- **Prisma 7** com `@prisma/adapter-neon` (driver HTTP/WebSocket)
- Schema: `User`, `Trade`, `Transaction`, `PriceCandle`

### Deploy
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) em `localhost:3000` |
| `npm run build` | Build de produção otimizado |
| `npm run start` | Servidor de produção |

### Variáveis de Ambiente
| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string Neon PostgreSQL |
| `NEXTAUTH_SECRET` | Chave de assinatura JWT |
| `NEXTAUTH_URL` | URL base da aplicação |
| `JWT_SECRET` | Chave JWT adicional |
| `RESEND_API_KEY` | API de email transacional (Resend) |
| `BNA_USD_RATE` | Taxa de câmbio USD/Kz (Banco Nacional de Angola) |

### APIs Externas
| Serviço | Uso |
|---------|-----|
| Deriv WebSocket (`wss://ws.binaryws.com`) | Preços forex e índices sintéticos em tempo real |
| Neon Database | Persistência de dados |
| Resend | Emails transacionais |

---

*Dynamics Works © 2025 — Plataforma licenciada para operação no mercado angolano*
