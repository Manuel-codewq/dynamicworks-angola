import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDevice } from "@/lib/parseDevice";

const PAGE_SIZE = 50;

const ATTACK_ACTIONS = new Set(["login_fail", "login_fail_ratelimit", "2fa_fail"]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const filter = searchParams.get("filter") ?? "all"; // all | attacks | logins
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");

  const where: any = {};

  if (filter === "attacks") {
    where.action = { in: ["login_fail", "login_fail_ratelimit", "2fa_fail"] };
  } else if (filter === "logins") {
    where.action = { in: ["login_ok", "2fa_ok"] };
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [logs, total, statsToday] = await Promise.all([
    prisma.accessLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.accessLog.count({ where }),
    prisma.accessLog.groupBy({
      by:    ["action"],
      where: { createdAt: { gte: todayStart } },
      _count: { action: true },
    }),
  ]);

  const attacksToday = statsToday
    .filter(s => ATTACK_ACTIONS.has(s.action))
    .reduce((sum, s) => sum + s._count.action, 0);

  const loginsToday = statsToday
    .filter(s => s.action === "login_ok")
    .reduce((sum, s) => sum + s._count.action, 0);

  const blockedToday = statsToday
    .filter(s => s.action === "login_fail_ratelimit")
    .reduce((sum, s) => sum + s._count.action, 0);

  return NextResponse.json({
    logs: logs.map(l => ({
      id:        l.id,
      action:    l.action,
      email:     l.email ?? "—",
      userName:  l.user?.name ?? null,
      ip:        l.ip ?? "—",
      country:   l.country ?? null,
      city:      l.city ?? null,
      device:    parseDevice(l.userAgent ?? ""),
      createdAt: l.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    stats: { attacksToday, loginsToday, blockedToday },
  });
}
