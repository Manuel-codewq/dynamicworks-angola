import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.marketPrice.findMany();
    const prices: Record<string, number> = {};
    rows.forEach(r => { prices[r.symbol] = r.price; });
    return NextResponse.json(prices);
  } catch {
    return NextResponse.json({});
  }
}
