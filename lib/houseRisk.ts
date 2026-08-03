import { prisma } from "./prisma";
import { getSettings } from "./settings";

/**
 * Protecção da casa — travões automáticos derivados de UM único valor
 * configurado pelo admin (`Settings.houseDailyLossLimit`).
 *
 * REGRA QUE NÃO SE ATRAVESSA: nada aqui altera o resultado de uma operação já
 * aberta. O resultado continua a vir exclusivamente do preço
 * (lib/resolveExpiredTrade.ts). Todos os travões actuam ANTES de a operação
 * abrir, sobre condições que o cliente vê no ecrã antes de decidir — payout
 * mais baixo, valor máximo menor, par indisponível, ou plataforma a não
 * aceitar novas operações reais. Uma operação que o preço decidiu ganhar,
 * paga.
 */

export type HouseRiskTier = "normal" | "caution" | "critical" | "blocked";

export interface HouseRiskState {
  /** P&L da casa hoje, em Kz. Negativo = casa a perder. */
  pnl: number;
  /** Perda actual (0 se a casa está a ganhar). */
  loss: number;
  /** Limite configurado (0 = protecção desligada). */
  limit: number;
  /** loss / limit — 0 quando a protecção está desligada. */
  ratio: number;
  tier: HouseRiskTier;
  /** Multiplicador aplicado ao payout de cada par/duração. */
  payoutFactor: number;
  /** Tecto por operação, em Kz. */
  maxStake: number;
  /** Pares (labels) suspensos por perda concentrada. */
  suspendedPairs: string[];
}

/** Tecto por operação quando a protecção está desligada ou em tier normal. */
export const DEFAULT_MAX_STAKE = 500_000;
export const MIN_STAKE = 1_000;

// Escalões fixos de propósito: o admin define só o limite, o resto é regra
// automática. Deixar os escalões configuráveis convidaria a afiná-los caso a
// caso, que é exactamente o que se quer evitar (decisão previsível e igual
// para todos, não ajuste discricionário quando dá jeito).
const TIERS: { minRatio: number; tier: HouseRiskTier; payoutFactor: number; maxStake: number }[] = [
  { minRatio: 1.00, tier: "blocked",  payoutFactor: 0.70, maxStake: 0 },
  { minRatio: 0.75, tier: "critical", payoutFactor: 0.70, maxStake: 100_000 },
  { minRatio: 0.50, tier: "caution",  payoutFactor: 0.85, maxStake: 250_000 },
  { minRatio: 0,    tier: "normal",   payoutFactor: 1.00, maxStake: DEFAULT_MAX_STAKE },
];

// Suspensão de um par: exige perda concentrada E volume mínimo. Sem o volume
// mínimo, um único cliente com sorte num par pouco negociado bastava para o
// suspender — reagir a ruído em vez de tendência.
const PAIR_SUSPEND_RATIO = 0.40;
const PAIR_SUSPEND_MIN_TRADES = 10;

const CACHE_TTL_MS = 15_000;
let cache: { state: HouseRiskState; at: number } | null = null;

/** Início do dia local — mesmo corte usado pelo limite diário do utilizador. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function disabledState(): HouseRiskState {
  return {
    pnl: 0, loss: 0, limit: 0, ratio: 0,
    tier: "normal", payoutFactor: 1, maxStake: DEFAULT_MAX_STAKE, suspendedPairs: [],
  };
}

/**
 * Estado de risco da casa hoje. Cache de 15s — isto é consultado a cada
 * abertura de operação E no polling de payout de cada cliente (30s), não pode
 * ser uma agregação nova de cada vez.
 */
export async function getHouseRiskState(): Promise<HouseRiskState> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.state;

  let limit = 0;
  try {
    limit = (await getSettings()).houseDailyLossLimit ?? 0;
  } catch {
    return disabledState(); // sem definições legíveis, não travar nada
  }
  if (!(limit > 0)) {
    const state = disabledState();
    cache = { state, at: Date.now() };
    return state;
  }

  let trades: { asset: string; result: string | null; amount: number; payout: number }[];
  try {
    trades = await prisma.trade.findMany({
      where: {
        status: "closed",
        isDemo: false,
        // Torneios movem tournamentBalance, não saldo real — a casa não paga
        // do bolso (o prize pool é fixo), por isso não entram no risco.
        tournamentParticipantId: null,
        closedAt: { gte: startOfToday() },
      },
      select: { asset: true, result: true, amount: true, payout: true },
    });
  } catch {
    // BD indisponível: falhar aberto (não travar a plataforma inteira por
    // causa de uma query de risco), mas sem cachear o estado degradado.
    return disabledState();
  }

  let pnl = 0;
  const byPair: Record<string, { pnl: number; count: number }> = {};
  for (const t of trades) {
    // Empate devolve o valor apostado — não move o P&L da casa.
    const delta = t.result === "win" ? -(t.amount * t.payout)
                : t.result === "loss" ? t.amount
                : 0;
    pnl += delta;
    const p = (byPair[t.asset] ??= { pnl: 0, count: 0 });
    p.pnl += delta;
    p.count++;
  }

  const loss = Math.max(0, -pnl);
  const ratio = loss / limit;
  const scale = TIERS.find(t => ratio >= t.minRatio) ?? TIERS[TIERS.length - 1];

  const suspendedPairs = Object.entries(byPair)
    .filter(([, p]) => p.count >= PAIR_SUSPEND_MIN_TRADES && -p.pnl >= limit * PAIR_SUSPEND_RATIO)
    .map(([asset]) => asset);

  const state: HouseRiskState = {
    pnl, loss, limit, ratio,
    tier: scale.tier,
    payoutFactor: scale.payoutFactor,
    maxStake: scale.maxStake,
    suspendedPairs,
  };
  cache = { state, at: Date.now() };
  return state;
}

/** Limpa a cache — usar depois de o admin gravar um limite novo. */
export function invalidateHouseRiskCache() {
  cache = null;
}

/**
 * Aplica o factor de redução a um mapa de payout aninhado por duração.
 * Usado tanto por /api/payout (o que o cliente vê) como por /api/trade (o que
 * é gravado) — TÊM de partilhar esta função, senão o cliente vê um payout e
 * recebe outro.
 */
export function applyPayoutFactor(
  payout: Record<string, Record<string, number>>,
  factor: number,
): Record<string, Record<string, number>> {
  if (factor >= 1) return payout;
  return Object.fromEntries(
    Object.entries(payout).map(([label, entry]) => [
      label,
      Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, Math.round(v * factor * 100) / 100])),
    ]),
  );
}
