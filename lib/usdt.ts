import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendDepositApprovedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notify";

// USDT TRC-20 contract address (oficial Tether na Tron)
export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_DEPOSIT_METHOD = "usdt_trc20";

// Janela em que um depósito pendente pode ser casado com uma transferência real
export const DEPOSIT_MATCH_WINDOW_MS = 60 * 60 * 1000; // 60 min

// ─── Helpers ────────────────────────────────────────────────────────────────

// Adiciona cêntimos aleatórios (0.0001 a 0.0099) para tornar o montante único
// e permitir match automático com a tx que chega na blockchain.
export function generateUniqueUsdtAmount(baseUsdt: number): number {
  const cents = 1 + Math.floor(Math.random() * 99); // 1..99
  const tag = cents / 10000; // 0.0001..0.0099
  return Math.round((baseUsdt + tag) * 10000) / 10000;
}

export function aoaToUsdt(aoa: number, rate: number): number {
  if (rate <= 0) return 0;
  return aoa / rate;
}

export function usdtToAoa(usdt: number, rate: number): number {
  return usdt * rate;
}

// ─── Trongrid ────────────────────────────────────────────────────────────────

interface TrongridTrc20Tx {
  transaction_id: string;
  from: string;
  to: string;
  value: string;     // raw value (decimals=6 para USDT)
  token_info: { decimals: number; symbol: string; address: string };
  block_timestamp: number;
}

interface ParsedIncomingTx {
  txid: string;
  from: string;
  to: string;
  amount: number;       // já em USDT (depois de aplicar decimals)
  timestamp: number;
}

// Busca transferências TRC-20 recebidas pela carteira no Trongrid.
async function fetchIncomingTrc20(wallet: string, sinceMs: number): Promise<ParsedIncomingTx[]> {
  const apiKey = process.env.TRONGRID_API_KEY;
  const params = new URLSearchParams({
    only_to: "true",
    contract_address: USDT_TRC20_CONTRACT,
    limit: "50",
    min_timestamp: String(sinceMs),
  });
  const url = `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20?${params}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`[usdt] Trongrid ${res.status}: ${await res.text().catch(() => "")}`);
    return [];
  }
  const data = (await res.json()) as { data?: TrongridTrc20Tx[] };
  const txs = data.data ?? [];

  return txs.map((t) => {
    const decimals = t.token_info?.decimals ?? 6;
    const raw = BigInt(t.value ?? "0");
    const amount = Number(raw) / Math.pow(10, decimals);
    return {
      txid: t.transaction_id,
      from: t.from,
      to: t.to,
      amount: Math.round(amount * 10000) / 10000,
      timestamp: t.block_timestamp,
    };
  });
}

// ─── Match e crédito ────────────────────────────────────────────────────────

// Para cada tx recebida, tenta encontrar uma Transaction pending com mesmo
// usdtAmount dentro da janela. Se encontrar, credita o saldo do user e marca
// a transação como concluída.
export async function processIncomingUsdt(): Promise<{ checked: number; credited: number }> {
  const cfg = await getSettings();
  if (!cfg.usdtWallet) return { checked: 0, credited: 0 };

  const sinceMs = Date.now() - DEPOSIT_MATCH_WINDOW_MS;
  const incoming = await fetchIncomingTrc20(cfg.usdtWallet, sinceMs);

  let credited = 0;
  for (const tx of incoming) {
    // Já creditámos esta tx?
    const already = await prisma.transaction.findUnique({
      where: { usdtTxid: tx.txid },
      select: { id: true },
    });
    if (already) continue;

    // Procura um depósito pending criado nesta janela com este valor exato.
    const since = new Date(sinceMs);
    const pending = await prisma.transaction.findFirst({
      where: {
        type: "deposit",
        method: USDT_DEPOSIT_METHOD,
        status: "pending",
        usdtAmount: tx.amount,
        usdtTxid: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, amount: true },
    });
    if (!pending) continue;

    try {
      let creditOk = false;
      await prisma.$transaction(async (db) => {
        const updated = await db.transaction.updateMany({
          where: { id: pending.id, status: "pending", usdtTxid: null },
          data: { status: "completed", usdtTxid: tx.txid },
        });
        if (updated.count === 0) return;
        await db.user.update({
          where: { id: pending.userId },
          data: { balance: { increment: pending.amount } },
        });
        creditOk = true;
      });

      if (!creditOk) continue;

      credited += 1;
      console.log(`[usdt] creditado ${pending.id} via ${tx.txid} (${tx.amount} USDT)`);

      // Notificações — falha silenciosa para não bloquear o crédito
      try {
        const user = await prisma.user.findUnique({
          where: { id: pending.userId },
          select: { name: true, email: true },
        });
        if (user) {
          const amtFormatted = pending.amount.toLocaleString("pt-PT");
          await Promise.all([
            createNotification(
              pending.userId,
              "deposit_completed",
              "Depósito USDT confirmado",
              `O teu depósito de ${amtFormatted} Kz via USDT foi confirmado e adicionado ao teu saldo.`
            ),
            sendDepositApprovedEmail(user.email, user.name, pending.amount),
          ]);
        }
      } catch (notifErr) {
        console.error(`[usdt] notificação falhou para ${pending.id}:`, notifErr);
      }
    } catch (err) {
      console.error(`[usdt] falha a creditar ${pending.id}:`, err);
    }
  }

  return { checked: incoming.length, credited };
}
