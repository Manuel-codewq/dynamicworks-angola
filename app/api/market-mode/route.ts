import { NextResponse } from "next/server";

export async function GET() {
  const now    = new Date();
  const utcDay = now.getUTCDay();
  const utcH   = now.getUTCHours();
  const watHour = (utcH + 1) % 24;
  const isMarketOpen = utcDay >= 1 && utcDay <= 5 && utcH >= 6 && utcH < 19;
  return NextResponse.json({ isMarketOpen, watHour });
}
