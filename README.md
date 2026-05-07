# Dynamics Works — Plataforma de Trading de Opções Binárias

Plataforma de negociação de opções binárias desenvolvida para o mercado angolano.

## Requisitos

- Node.js 18+
- PostgreSQL (recomendado: [Neon](https://neon.tech) — serverless, plano gratuito disponível)
- npm

## Instalação local

```bash
# 1. Clonar o repositório
git clone <repo-url>
cd dynamics-works

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com os seus valores

# 4. Sincronizar base de dados
npx prisma db push

# 5. Iniciar em desenvolvimento
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Build para produção

```bash
npm run build
npm start
```

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de ligação PostgreSQL |
| `NEXTAUTH_SECRET` | Segredo para JWT (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL público da aplicação (ex: `https://dynamicsworks.ao`) |

### Variáveis opcionais

| Variável | Descrição | Padrão |
|---|---|---|
| `RESEND_API_KEY` | Chave API Resend para emails | Emails desativados |
| `BNA_USD_RATE` | Taxa USD→Kz de fallback | `920` |

## Criar conta administrador

Em produção, executar diretamente na base de dados:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'seu@email.com';
```

Ou via API em desenvolvimento: `GET /api/admin/seed`

## Deploy no Vercel

1. Importar o repositório no [Vercel](https://vercel.com)
2. Adicionar as variáveis de ambiente (Settings → Environment Variables)
3. O ficheiro `vercel.json` configura os crons automaticamente:

```json
{
  "crons": [
    { "path": "/api/worker",         "schedule": "* * * * *" },
    { "path": "/api/price-recorder", "schedule": "* * * * *" }
  ]
}
```

> Os crons do Vercel requerem plano Pro ou superior.

## Arquitectura

| Caminho | Descrição |
|---|---|
| `app/trade` | Página principal de trading (gráfico + painel) |
| `app/wallet` | Carteira — depósitos e levantamentos |
| `app/dashboard` | Dashboard com estatísticas |
| `app/profile` | Perfil do utilizador e KYC |
| `app/ao/admin` | Painel de administração (`/ao/admin`) |
| `app/api/worker` | Cron — resolve operações expiradas |
| `app/api/price-recorder` | Cron — regista preços Deriv na BD |
| `lib/settings.ts` | Configurações da plataforma (singleton em memória) |
| `lib/derivWebSocket.ts` | Cliente WebSocket Deriv |
| `lib/email.ts` | Envio de emails via Resend |
| `lib/notify.ts` | Notificações in-app |
| `prisma/schema.prisma` | Esquema da base de dados |
| `proxy.ts` | Middleware de autenticação e manutenção |

## Licença

Todos os direitos reservados — Dynamics Works © 2025
