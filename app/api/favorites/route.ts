import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ASSET_TO_SYNTHETIC_SYMBOL } from "@/lib/assets";
import { checkRateLimit } from "@/lib/rateLimit";

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

  // Marcar/desmarcar favoritos é barato mas escreve na BD — 60/min por
  // utilizador é folgado para uso normal (são cliques na estrela) e trava
  // um script a martelar o endpoint.
  if (!await checkRateLimit("favorites", session.user.id, 60, 60_000)) {
    return NextResponse.json({ error: "Demasiados pedidos. Aguarda um momento." }, { status: 429 });
  }

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

  if (!await checkRateLimit("favorites", session.user.id, 60, 60_000)) {
    return NextResponse.json({ error: "Demasiados pedidos. Aguarda um momento." }, { status: 429 });
  }

  const { symbol } = await req.json().catch(() => ({}));
  if (typeof symbol !== "string") {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  await prisma.userFavorite.deleteMany({
    where: { userId: session.user.id, symbol },
  });
  return NextResponse.json({ ok: true });
}
