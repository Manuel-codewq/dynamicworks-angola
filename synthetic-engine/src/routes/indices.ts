import { Router } from "express";
import { startIndex, stopIndex } from "../workers/tickEngine";
import { prisma } from "../lib/prisma";

export const indicesRouter = Router();

// GET /api/indices - lista todos os índices activos (para o front popular o selector de pares)
indicesRouter.get("/", async (_req, res) => {
  try {
    const indices = await prisma.syntheticIndex.findMany({
      where: { active: true },
      select: {
        symbol: true,
        displayName: true,
        type: true,
        lastPrice: true,
        decimals: true,
      },
    });
    res.json(indices);
  } catch (err) {
    console.error("[indices] erro em GET /:", err);
    res.status(500).json({ error: "erro ao consultar índices" });
  }
});

// GET /api/indices/:symbol/candles?timeframe=1m&limit=200 - histórico OHLC
indicesRouter.get("/:symbol/candles", async (req, res) => {
  try {
    const { symbol } = req.params;
    const timeframe = (req.query.timeframe as string) || "1m";
    const limit = Math.min(Number(req.query.limit) || 200, 1000);

    const candles = await prisma.syntheticCandle.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    res.json(candles.reverse());
  } catch (err) {
    console.error("[indices] erro em GET /:symbol/candles:", err);
    res.status(500).json({ error: "erro ao consultar candles" });
  }
});

// POST /api/indices - cria novo índice sintético (admin)
indicesRouter.post("/", async (req, res) => {
  try {
    const {
      symbol,
      displayName,
      type,
      basePrice,
      volatility,
      drift,
      decimals,
      eventProbability,
      eventMagnitude,
      tickIntervalMs,
    } = req.body;

    const index = await prisma.syntheticIndex.create({
      data: {
        symbol,
        displayName,
        type,
        basePrice,
        lastPrice: basePrice,
        volatility,
        drift: drift ?? 0,
        decimals: decimals ?? 5,
        eventProbability: eventProbability ?? 0,
        eventMagnitude: eventMagnitude ?? 0,
        tickIntervalMs: tickIntervalMs ?? 1000,
      },
    });

    startIndex(index.symbol, index.tickIntervalMs);
    res.status(201).json(index);
  } catch (err) {
    console.error("[indices] erro em POST /:", err);
    res.status(500).json({ error: "erro ao criar índice" });
  }
});

// PATCH /api/indices/:symbol/toggle - liga/desliga um índice (admin)
indicesRouter.patch("/:symbol/toggle", async (req, res) => {
  try {
    const { symbol } = req.params;
    const index = await prisma.syntheticIndex.findUnique({ where: { symbol } });
    if (!index) return res.status(404).json({ error: "índice não encontrado" });

    const updated = await prisma.syntheticIndex.update({
      where: { symbol },
      data: { active: !index.active },
    });

    if (updated.active) {
      startIndex(updated.symbol, updated.tickIntervalMs);
    } else {
      stopIndex(updated.symbol);
    }

    res.json(updated);
  } catch (err) {
    console.error("[indices] erro em PATCH /:symbol/toggle:", err);
    res.status(500).json({ error: "erro ao actualizar índice" });
  }
});
