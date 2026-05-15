import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Devolve os preços de fecho reais para todos os 30 pares OTC
export async function GET() {
  try {
    const rows = await prisma.marketPrice.findMany({
      where: {
        symbol: {
          in: [
            "frxEURUSD","frxGBPUSD","frxUSDJPY","frxAUDUSD","frxUSDCAD",
            "frxEURGBP","frxUSDCHF","frxNZDUSD","frxEURJPY","frxGBPJPY",
            "frxEURCAD","frxAUDJPY","frxGBPAUD","frxEURCHF","frxAUDCAD",
            "frxAUDCHF","frxAUDNZD","frxEURAUD","frxEURNZD","frxGBPCAD",
            "frxGBPCHF","frxGBPNOK","frxGBPNZD","frxNZDJPY","frxUSDMXN",
            "frxUSDNOK","frxUSDPLN","frxUSDSEK","frxCADJPY","frxCHFJPY",
          ],
        },
      },
    });

    const closes: Record<string, number> = {};
    rows.forEach(r => { closes[r.symbol] = r.price; });

    return NextResponse.json({ closes });
  } catch {
    return NextResponse.json({ closes: {} });
  }
}
