import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const OTC_VOL: Record<string, number> = {
  "OTC_frxEURUSD": 0.00005, "OTC_frxGBPUSD": 0.00008, "OTC_frxUSDJPY": 0.006,
  "OTC_frxAUDUSD": 0.00005, "OTC_frxUSDCAD": 0.00006, "OTC_frxEURGBP": 0.00004,
  "OTC_frxUSDCHF": 0.00005, "OTC_frxNZDUSD": 0.00005, "OTC_frxEURJPY": 0.007,
  "OTC_frxGBPJPY": 0.010,   "OTC_frxEURCAD": 0.00007, "OTC_frxAUDJPY": 0.006,
  "OTC_frxGBPAUD": 0.00009, "OTC_frxEURCHF": 0.00005, "OTC_frxAUDCAD": 0.00005,
  "OTC_frxAUDCHF": 0.00004, "OTC_frxAUDNZD": 0.00005, "OTC_frxEURAUD": 0.00007,
  "OTC_frxEURNZD": 0.00008, "OTC_frxGBPCAD": 0.00008, "OTC_frxGBPCHF": 0.00007,
  "OTC_frxGBPNOK": 0.003,   "OTC_frxGBPNZD": 0.00009, "OTC_frxNZDJPY": 0.005,
  "OTC_frxUSDMXN": 0.003,   "OTC_frxUSDNOK": 0.002,   "OTC_frxUSDPLN": 0.0008,
  "OTC_frxUSDSEK": 0.002,
};

// Se o preço foi gerado há menos de 1.5s, devolve sem regenerar
const STALE_MS = 1500;

export async function GET(req: NextRequest) {
  const syms = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",").map(s => s.trim()).filter(s => OTC_VOL[s]);

  if (syms.length === 0) return NextResponse.json({});

  const result: Record<string, number> = {};

  for (const sym of syms) {
    const stored = await prisma.marketPrice.findUnique({ where: { symbol: sym } });
    const now    = Date.now();

    // Preço recente — devolver sem regenerar
    if (stored && now - stored.updatedAt.getTime() < STALE_MS) {
      result[sym] = stored.price;
      continue;
    }

    // Buscar preço real do par base (ex: frxGBPUSD para OTC_frxGBPUSD)
    const baseSymbol = sym.replace("OTC_", "");
    const baseRow    = await prisma.marketPrice.findUnique({ where: { symbol: baseSymbol } });
    const basePrice  = baseRow?.price ?? 1.0;
    const lastPrice  = stored?.price ?? basePrice;

    // Mean-reversion em torno do último preço real de fecho
    const vol      = OTC_VOL[sym];
    const drift    = (basePrice - lastPrice) * 0.02;
    const noise    = (Math.random() - 0.5) * vol * 2;
    const newPrice = Math.max(lastPrice + drift + noise, basePrice * 0.97);

    await prisma.marketPrice.upsert({
      where:  { symbol: sym },
      create: { symbol: sym, price: newPrice },
      update: { price: newPrice },
    });

    result[sym] = newPrice;
  }

  return NextResponse.json(result);
}
