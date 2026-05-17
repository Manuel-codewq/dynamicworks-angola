import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDevice } from "@/lib/parseDevice";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login_ok:            { label: "Login bem-sucedido",     color: "#22c55e" },
  login_fail:          { label: "Tentativa de login falhada", color: "#ef4444" },
  login_fail_ratelimit:{ label: "Bloqueado por excesso de tentativas", color: "#f59e0b" },
  "2fa_ok":            { label: "Verificação 2FA bem-sucedida", color: "#22c55e" },
  "2fa_fail":          { label: "Código 2FA inválido",    color: "#ef4444" },
  logout:              { label: "Logout",                  color: "#94a3b8" },
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const logs = await prisma.accessLog.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return NextResponse.json(
    logs.map(l => ({
      id:        l.id,
      action:    l.action,
      label:     ACTION_LABELS[l.action]?.label  ?? l.action,
      color:     ACTION_LABELS[l.action]?.color  ?? "#94a3b8",
      ip:        l.ip ?? "—",
      device:    parseDevice(l.userAgent ?? ""),
      createdAt: l.createdAt,
    })),
  );
}
