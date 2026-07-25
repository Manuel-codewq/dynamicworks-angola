import { IndexType } from "@prisma/client";
import { secureGaussian, secureRandom } from "../lib/rng";
import { broadcastTick } from "../ws/server";
import { prisma } from "../lib/prisma";

// timers activos por símbolo, para poder reconfigurar sem reiniciar o processo
const timers = new Map<string, NodeJS.Timeout>();

// "momentum" por símbolo entre ticks em tempo real — um passeio aleatório puro
// (cada choque gaussiano totalmente independente do anterior) produz um
// zig-zag nervoso tick-a-tick que não se parece com o movimento de mercado
// de plataformas reais (Quotex, Deriv, etc.), que têm tendências e correcções
// visíveis de curto prazo. Suavizar o choque com uma média móvel exponencial
// (EWMA) dá essa persistência sem alterar a distribuição de longo prazo do
// passeio aleatório.
const momentumBySymbol = new Map<string, number>();
const MOMENTUM_DECAY = 0.85; // fracção do choque anterior que "sobra" no seguinte

export function computeNextPrice(
  index: {
    symbol: string;
    type: IndexType;
    lastPrice: number;
    volatility: number;
    drift: number;
    eventProbability: number;
    eventMagnitude: number;
  },
  momentum = 0,
): { price: number; momentum: number } {
  const raw = secureGaussian();
  const smoothedShock = momentum * MOMENTUM_DECAY + raw * (1 - MOMENTUM_DECAY);
  const shock = smoothedShock * (index.volatility / 100);
  let next = index.lastPrice * (1 + shock + index.drift / 100);

  // eventos súbitos: crash (queda), boom (subida), jump (qualquer direção) —
  // saltos discretos e raros, não fazem parte do ruído contínuo, por isso
  // continuam a usar secureRandom() directamente, sem suavização.
  if (index.eventProbability > 0 && secureRandom() < index.eventProbability) {
    const magnitude = index.eventMagnitude;
    if (index.type === "CRASH") {
      next *= 1 - magnitude;
    } else if (index.type === "BOOM") {
      next *= 1 + magnitude;
    } else if (index.type === "JUMP") {
      const direction = secureRandom() < 0.5 ? -1 : 1;
      next *= 1 + direction * magnitude;
    }
  }

  // Step Index: arredonda para o "passo" mais próximo em vez de valor contínuo
  if (index.type === "STEP") {
    const stepSize = index.lastPrice * (index.volatility / 100);
    // Direcção seguida do momento suavizado (não moeda ao ar) — não faz
    // sentido o "passo" contradizer a tendência do resto do movimento.
    const direction = smoothedShock >= 0 ? 1 : -1;
    next = index.lastPrice + direction * stepSize;
  }

  return { price: next, momentum: smoothedShock };
}

async function tick(symbol: string) {
  const index = await prisma.syntheticIndex.findUnique({ where: { symbol } });
  if (!index || !index.active) {
    stopIndex(symbol);
    return;
  }

  const { price: newPrice, momentum } = computeNextPrice(index, momentumBySymbol.get(symbol) ?? 0);
  momentumBySymbol.set(symbol, momentum);

  await prisma.$transaction([
    prisma.syntheticTick.create({
      data: { symbol, price: newPrice },
    }),
    prisma.syntheticIndex.update({
      where: { symbol },
      data: { lastPrice: newPrice },
    }),
  ]);

  broadcastTick(symbol, newPrice);
}

export function startIndex(symbol: string, intervalMs: number) {
  stopIndex(symbol); // evita duplicar timers
  const handle = setInterval(() => {
    tick(symbol).catch((err) =>
      console.error(`[tickEngine] erro no símbolo ${symbol}:`, err)
    );
  }, intervalMs);
  timers.set(symbol, handle);
}

export function stopIndex(symbol: string) {
  const existing = timers.get(symbol);
  if (existing) {
    clearInterval(existing);
    timers.delete(symbol);
  }
  momentumBySymbol.delete(symbol);
}

export async function startAllActiveIndices() {
  const indices = await prisma.syntheticIndex.findMany({ where: { active: true } });
  for (const index of indices) {
    startIndex(index.symbol, index.tickIntervalMs);
  }
  console.log(`[tickEngine] ${indices.length} índices sintéticos iniciados`);
}
