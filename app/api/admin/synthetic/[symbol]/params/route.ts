import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateSyntheticParams } from "@/lib/syntheticAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { symbol } = await params;
  const { drift, volatility } = await req.json();

  try {
    const result = await updateSyntheticParams(symbol, { drift, volatility });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "erro ao ajustar" }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/synthetic/params] erro:", err);
    return NextResponse.json({ error: "erro ao contactar synthetic-engine" }, { status: 502 });
  }
}
