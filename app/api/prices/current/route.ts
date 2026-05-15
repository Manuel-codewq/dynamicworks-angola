import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const OTC_VOL: Record<string, number> = {
  "OTC_frxEURUSD": 0.00006, "OTC_frxGBPUSD": 0.00010, "OTC_frxUSDJPY": 0.008,
  "OTC_frxAUDUSD": 0.00007, "OTC_frxUSDCAD": 0.00008, "OTC_frxEURGBP": 0.00005,
  "OTC_frxUSDCHF": 0.00007, "OTC_frxNZDUSD": 0.00006, "OTC_frxEURJPY": 0.009,
  "OTC_frxGBPJPY": 0.012,   "OTC_frxEURCAD": 0.00009, "OTC_frxAUDJPY": 0.007,
  "OTC_frxGBPAUD": 0.00012, "OTC_frxEURCHF": 0.00006,
};

const OTC_FALLBACK: Record<string, number> = {
  "OTC_frxEURUSD": 1.08500, "OTC_frxGBPUSD": 1.26500, "OTC_frxUSDJPY": 149.500,
  "OTC_frxAUDUSD": 0.65200, "OTC_frxUSDCAD": 1.36200, "OTC_frxEURGBP": 0.85800,
  "OTC_frxUSDCHF": 0.89700, "OTC_frxNZDUSD": 0.60700, "OTC_frxEURJPY": 162.500,
  "OTC_frxGBPJPY": 188.700, "OTC_frxEURCAD": 1.47500, "OTC_frxAUDJPY": 97.500,
  "OTC_frxGBPAUD": 1.96500, "OTC_frxEURCHF": 0.96800,
};

// Se o preço foi gerado há menos de 1.5s, devolver sem regenerar
const STALE_MS = 1500;

export async function GET(req: NextRequest) {
  const syms = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(s => OTC_VOL[s]);

  if (syms.length === 0) return NextResponse.json({});

  const result: Record<string, number> = {};

  for (const sym of syms) {
    const stored = await prisma.marketPrice.findUnique({ where: { symbol: sym } });
    const now = Date.now();

    // Preço recente — devolver sem regenerar (evita race conditions entre clientes)
    if (stored && now - stored.updatedAt.getTime() < STALE_MS) {
      result[sym] = stored.price;
      continue;
    }

    // Buscar último preço real guardado (ex: frxGBPUSD para OTC_frxGBPUSD)
    const baseSymbol = sym.replace("OTC_", "");
    const baseRow = await prisma.marketPrice.findUnique({ where: { symbol: baseSymbol } });
    const basePrice = baseRow?.price ?? OTC_FALLBACK[sym] ?? 1.0;
    const lastPrice = stored?.price ?? basePrice;

    // Gerar próximo preço no servidor: mean-reversion + ruído
    const vol      = OTC_VOL[sym];
    const drift    = (basePrice - lastPrice) * 0.015;
    const noise    = (Math.random() - 0.5) * vol * 2;
    const newPrice = Math.max(lastPrice + drift + noise, basePrice * 0.95);

    await prisma.marketPrice.upsert({
      where:  { symbol: sym },
      create: { symbol: sym, price: newPrice },
      update: { price: newPrice },
    });

    result[sym] = newPrice;
  }

  return NextResponse.json(result);
}
