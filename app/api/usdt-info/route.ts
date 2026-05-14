import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

// Rota pública — devolve apenas o necessário para o frontend mostrar info USDT
export async function GET() {
  const cfg = await getSettings();
  return NextResponse.json({
    rateAoa:    cfg.usdtRateAoa,
    minUsdt:    cfg.usdtMinDeposit,
    minAoa:     cfg.usdtRateAoa > 0 ? Math.ceil(cfg.usdtMinDeposit * cfg.usdtRateAoa) : 0,
    available:  !!cfg.usdtWallet && cfg.usdtRateAoa > 0,
  });
}
