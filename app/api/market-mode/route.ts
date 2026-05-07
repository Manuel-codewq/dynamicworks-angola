import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const { otcMode } = await getSettings();

  if (otcMode === "force_live") {
    return NextResponse.json({ mode: "live", isMarketOpen: true, otcMode });
  }
  if (otcMode === "force_otc") {
    return NextResponse.json({ mode: "otc", isMarketOpen: false, otcMode });
  }

  // auto — weekdays 06:00–17:00 UTC
  const now          = new Date();
  const utcDay       = now.getUTCDay();
  const utcHour      = now.getUTCHours();
  const isWeekend    = utcDay === 0 || utcDay === 6;
  const isMarketOpen = !isWeekend && utcHour >= 6 && utcHour < 17;

  return NextResponse.json({ mode: isMarketOpen ? "live" : "otc", isMarketOpen, otcMode });
}
