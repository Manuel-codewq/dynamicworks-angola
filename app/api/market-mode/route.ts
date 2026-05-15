import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIG_KEY = "market_mode_override";

// WAT = UTC+1. Forex: Seg-Sex 07h-20h WAT. Fora disso → OTC.
function getAutoMode(): "forex" | "otc" {
  const now    = new Date();
  const utcDay = now.getUTCDay();
  const utcH   = now.getUTCHours();
  const isOpen = utcDay >= 1 && utcDay <= 5 && utcH >= 6 && utcH < 19;
  return isOpen ? "forex" : "otc";
}

export async function GET() {
  const autoMode = getAutoMode();
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    const override = (row?.value as "forex" | "otc" | null) ?? null;
    return NextResponse.json({
      mode:       override ?? autoMode,
      autoMode,
      override,
      isOverridden: !!override,
    });
  } catch {
    return NextResponse.json({ mode: autoMode, autoMode, override: null, isOverridden: false });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const { mode } = await req.json(); // "forex" | "otc" | null (null = limpar override)

  if (mode === null) {
    await prisma.systemConfig.deleteMany({ where: { key: CONFIG_KEY } });
    return NextResponse.json({ ok: true, override: null });
  }

  if (mode !== "forex" && mode !== "otc") {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }

  await prisma.systemConfig.upsert({
    where:  { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: mode },
    update: { value: mode },
  });

  return NextResponse.json({ ok: true, override: mode });
}
