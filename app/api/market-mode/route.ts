import { NextResponse } from "next/server";
import { isRealMarketOpen } from "@/lib/derivWebSocket";

export async function GET() {
  const isMarketOpen = isRealMarketOpen();
  const now     = new Date();
  const watHour = (now.getUTCHours() + 1) % 24; // WAT = UTC+1
  return NextResponse.json({ isMarketOpen, watHour });
}
