import { NextResponse } from "next/server";

// OTC config removida — plataforma usa apenas pares Binance (preços reais)
export async function GET() {
  return NextResponse.json({ closes: {} });
}
