import { NextResponse } from "next/server";

export async function GET() {
  const now          = new Date();
  const utcDay       = now.getUTCDay();
  const utcHour      = now.getUTCHours();
  const isWeekend    = utcDay === 0 || utcDay === 6;
  const isMarketOpen = !isWeekend && utcHour >= 6 && utcHour < 17;

  return NextResponse.json({ isMarketOpen });
}
