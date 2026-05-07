import { NextResponse } from "next/server";
import { settings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json({ maintenance: settings.maintenanceMode });
}
