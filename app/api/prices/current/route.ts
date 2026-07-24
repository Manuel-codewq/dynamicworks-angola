import { NextResponse } from "next/server";

// OTC simulation removida — plataforma usa apenas pares Binance (preços reais)
export async function GET() {
  return NextResponse.json({});
}
