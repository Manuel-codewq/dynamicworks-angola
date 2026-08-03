import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getHouseRiskState, applyPayoutFactor } from "@/lib/houseRisk";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const [{ payout }, risk] = await Promise.all([getSettings(), getHouseRiskState()]);

  // CRÍTICO: o payout devolvido aqui é o que o cliente vê no ecrã antes de
  // decidir, e tem de ser exactamente o mesmo que app/api/trade/route.ts grava
  // na operação — por isso ambos aplicam applyPayoutFactor() sobre o mesmo
  // estado de risco. Se divergirem, o cliente vê um valor e recebe outro.
  return NextResponse.json({
    payout: applyPayoutFactor(payout, risk.payoutFactor),
    maxStake: risk.maxStake,
    suspendedPairs: risk.suspendedPairs,
    tradingBlocked: risk.tier === "blocked",
  });
}
