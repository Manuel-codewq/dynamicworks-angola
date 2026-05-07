import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const { maintenanceMode } = await getSettings();
  return NextResponse.json({ maintenance: maintenanceMode });
}
