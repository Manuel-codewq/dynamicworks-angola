import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Símbolos reais que têm par OTC equivalente
const ALLOWED = new Set([
  "frxEURUSD","frxGBPUSD","frxUSDJPY","frxAUDUSD","frxUSDCAD",
  "frxEURGBP","frxUSDCHF","frxNZDUSD","frxEURJPY","frxGBPJPY",
  "frxEURCAD","frxAUDJPY","frxGBPAUD","frxEURCHF",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { symbol?: string; price?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { symbol, price } = body;
  if (!symbol || !ALLOWED.has(symbol) || !price || price <= 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await prisma.marketPrice.upsert({
    where:  { symbol },
    create: { symbol, price },
    update: { price },
  });

  return NextResponse.json({ ok: true });
}
