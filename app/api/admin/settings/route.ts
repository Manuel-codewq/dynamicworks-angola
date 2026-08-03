import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { getHouseRiskState, invalidateHouseRiskCache } from "@/lib/houseRisk";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  // Estado de risco vai junto para o painel poder mostrar P&L do dia, tier
  // actual e pares suspensos sem um segundo pedido.
  const [settings, houseRisk] = await Promise.all([getSettings(), getHouseRiskState()]);
  return NextResponse.json({ ...settings, houseRisk });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await updateSettings(body);
  // O estado de risco tem cache própria e deriva de houseDailyLossLimit —
  // invalidar aqui (e não dentro de updateSettings) evita import circular
  // entre lib/settings.ts e lib/houseRisk.ts.
  invalidateHouseRiskCache();
  return NextResponse.json({ ...updated, houseRisk: await getHouseRiskState() });
}
