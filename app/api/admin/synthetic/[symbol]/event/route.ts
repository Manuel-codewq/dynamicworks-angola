import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { triggerSyntheticEvent } from "@/lib/syntheticAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { symbol } = await params;
  const { type, magnitude } = await req.json();

  if (!["CRASH", "BOOM", "JUMP"].includes(type)) {
    return NextResponse.json({ error: "tipo de evento inválido" }, { status: 400 });
  }

  try {
    const result = await triggerSyntheticEvent(symbol, type, magnitude);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "erro ao disparar evento" }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/synthetic/event] erro:", err);
    return NextResponse.json({ error: "erro ao contactar synthetic-engine" }, { status: 502 });
  }
}
