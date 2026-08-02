import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ASSET_TO_SYNTHETIC_SYMBOL } from "@/lib/assets";

// "symbol" aqui é, na prática, o mesmo valor usado como `DerivPair.symbol`
// no frontend (o syntheticSymbol do par, ex: "EURUSD_OTC") — validado contra
// os símbolos realmente permitidos para não guardar lixo arbitrário.
const ALLOWED_SYMBOLS = new Set(Object.values(ASSET_TO_SYNTHETIC_SYMBOL));

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    select: { symbol: true },
  });
  return NextResponse.json({ symbols: favorites.map(f => f.symbol) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { symbol } = await req.json().catch(() => ({}));
  if (typeof symbol !== "string" || !ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  await prisma.userFavorite.upsert({
    where: { userId_symbol: { userId: session.user.id, symbol } },
    create: { userId: session.user.id, symbol },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { symbol } = await req.json().catch(() => ({}));
  if (typeof symbol !== "string") {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  await prisma.userFavorite.deleteMany({
    where: { userId: session.user.id, symbol },
  });
  return NextResponse.json({ ok: true });
}
