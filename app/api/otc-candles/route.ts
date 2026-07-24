import { NextResponse } from "next/server";

// Endpoint OTC removido — plataforma usa apenas pares Binance (crypto 24/7)
export async function GET() {
  return NextResponse.json({ error: "Endpoint removido" }, { status: 410 });
}
