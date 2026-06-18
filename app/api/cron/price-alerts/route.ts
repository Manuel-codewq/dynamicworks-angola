import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDerivPrice } from "@/lib/derivPrice";
import { sendPushToUser } from "@/lib/webPush";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

async function getAssetCurrentPrice(asset: string): Promise<number | null> {
  // 1. Preço ao vivo da Deriv
  const live = await getDerivPrice(asset).catch(() => null);
  if (live && live > 0) return live;

  // 2. Fallback: vela recente na DB (até 5 min)
  const cutoff = new Date(Date.now() - 300_000);
  const candle = await prisma.priceCandle.findFirst({
    where:   { asset, timestamp: { gte: cutoff } },
    orderBy: { timestamp: "desc" },
    select:  { close: true },
  });
  return candle?.close ?? null;
}

async function handle() {
  const alerts = await prisma.priceAlert.findMany({
    where:   { triggered: false },
    orderBy: { createdAt: "asc" },
  });

  if (!alerts.length) return NextResponse.json({ ok: true, triggered: 0, checked: 0 });

  // Agrupar por ativo para minimizar chamadas à API
  const byAsset = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    if (!byAsset.has(alert.asset)) byAsset.set(alert.asset, []);
    byAsset.get(alert.asset)!.push(alert);
  }

  let triggered = 0;

  for (const [asset, assetAlerts] of byAsset) {
    const price = await getAssetCurrentPrice(asset);
    if (!price) continue;

    for (const alert of assetAlerts) {
      const shouldTrigger =
        (alert.direction === "above" && price >= alert.price) ||
        (alert.direction === "below" && price <= alert.price);

      if (!shouldTrigger) continue;

      // Marcar como disparado
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data:  { triggered: true },
      }).catch(() => {});

      // Notificação push
      const dirLabel = alert.direction === "above" ? "atingiu ▲" : "desceu abaixo de ▼";
      sendPushToUser(alert.userId, {
        title: `Alerta de preço — ${asset}`,
        body:  `${asset} ${dirLabel} ${alert.price.toLocaleString("pt-PT")}`,
        url:   "/trade",
        tag:   `price-alert-${alert.id}`,
      }).catch(() => {});

      triggered++;
    }

    // Pequeno delay entre ativos para evitar rate limiting
    await new Promise(r => setTimeout(r, 120));
  }

  return NextResponse.json({ ok: true, triggered, checked: alerts.length });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    return await handle();
  } catch (err) {
    console.error("[cron/price-alerts] erro:", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
