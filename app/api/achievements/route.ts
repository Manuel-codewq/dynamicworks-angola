import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface Achievement {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  unlocked:    boolean;
  progress:    number; // 0–100
  detail:      string; // ex: "7/10 trades"
  category:    "trades" | "wins" | "streak" | "volume" | "special";
  rarity:      "common" | "rare" | "epic" | "legendary";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const trades = await prisma.trade.findMany({
    where:   { userId: session.user.id, status: "closed", isDemo: false },
    select:  { result: true, profit: true, amount: true, asset: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const total      = trades.length;
  const wins       = trades.filter(t => t.result === "win").length;
  const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const totalVolume = trades.reduce((s, t) => s + t.amount, 0);
  const assets     = new Set(trades.map(t => t.asset));

  // Maior sequência de vitórias consecutivas
  let maxStreak = 0, curStreak = 0;
  for (const t of trades) {
    if (t.result === "win") { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
    else curStreak = 0;
  }

  // Dias distintos com trades
  const tradeDays = new Set(trades.map(t => new Date(t.createdAt).toISOString().slice(0, 10))).size;

  // Dias consecutivos (máximo)
  const daysSorted = Array.from(new Set(trades.map(t => new Date(t.createdAt).toISOString().slice(0, 10)))).sort();
  let maxConsecDays = 0, curConsecDays = 1;
  for (let i = 1; i < daysSorted.length; i++) {
    const prev = new Date(daysSorted[i - 1]);
    const curr = new Date(daysSorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { curConsecDays++; maxConsecDays = Math.max(maxConsecDays, curConsecDays); }
    else curConsecDays = 1;
  }
  if (daysSorted.length === 1) maxConsecDays = 1;

  function pct(val: number, target: number) { return Math.min(100, Math.round((val / target) * 100)); }

  const achievements: Achievement[] = [
    // ── Trades ──────────────────────────────────────────────────────────────
    {
      id: "first_trade", title: "Primeiro Passo", icon: "target",
      description: "Abrir a primeira operação real.",
      unlocked: total >= 1, progress: pct(total, 1), detail: `${total}/1 operações`,
      category: "trades", rarity: "common",
    },
    {
      id: "trades_10", title: "A Aquecer", icon: "flame",
      description: "Completar 10 operações reais.",
      unlocked: total >= 10, progress: pct(total, 10), detail: `${total}/10 operações`,
      category: "trades", rarity: "common",
    },
    {
      id: "trades_50", title: "Experiente", icon: "dumbbell",
      description: "Completar 50 operações reais.",
      unlocked: total >= 50, progress: pct(total, 50), detail: `${total}/50 operações`,
      category: "trades", rarity: "rare",
    },
    {
      id: "trades_100", title: "Centurião", icon: "medal",
      description: "Completar 100 operações reais.",
      unlocked: total >= 100, progress: pct(total, 100), detail: `${total}/100 operações`,
      category: "trades", rarity: "rare",
    },
    {
      id: "trades_500", title: "Veterano", icon: "swords",
      description: "Completar 500 operações reais.",
      unlocked: total >= 500, progress: pct(total, 500), detail: `${total}/500 operações`,
      category: "trades", rarity: "epic",
    },
    // ── Vitórias ─────────────────────────────────────────────────────────────
    {
      id: "first_win", title: "Primeira Vitória", icon: "star",
      description: "Ganhar a primeira operação real.",
      unlocked: wins >= 1, progress: pct(wins, 1), detail: `${wins}/1 vitórias`,
      category: "wins", rarity: "common",
    },
    {
      id: "wins_10", title: "Em Forma", icon: "sparkles",
      description: "Ganhar 10 operações reais.",
      unlocked: wins >= 10, progress: pct(wins, 10), detail: `${wins}/10 vitórias`,
      category: "wins", rarity: "common",
    },
    {
      id: "wins_50", title: "Imparável", icon: "gem",
      description: "Ganhar 50 operações reais.",
      unlocked: wins >= 50, progress: pct(wins, 50), detail: `${wins}/50 vitórias`,
      category: "wins", rarity: "rare",
    },
    {
      id: "wins_100", title: "Mestre Trader", icon: "crown",
      description: "Ganhar 100 operações reais.",
      unlocked: wins >= 100, progress: pct(wins, 100), detail: `${wins}/100 vitórias`,
      category: "wins", rarity: "epic",
    },
    {
      id: "wins_250", title: "Lenda", icon: "award",
      description: "Ganhar 250 operações reais.",
      unlocked: wins >= 250, progress: pct(wins, 250), detail: `${wins}/250 vitórias`,
      category: "wins", rarity: "legendary",
    },
    // ── Sequências ───────────────────────────────────────────────────────────
    {
      id: "streak_3", title: "Hat-Trick", icon: "target",
      description: "Ganhar 3 operações consecutivas.",
      unlocked: maxStreak >= 3, progress: pct(maxStreak, 3), detail: `Melhor: ${maxStreak}/3 seguidas`,
      category: "streak", rarity: "common",
    },
    {
      id: "streak_5", title: "Em Chama", icon: "flame",
      description: "Ganhar 5 operações consecutivas.",
      unlocked: maxStreak >= 5, progress: pct(maxStreak, 5), detail: `Melhor: ${maxStreak}/5 seguidas`,
      category: "streak", rarity: "rare",
    },
    {
      id: "streak_10", title: "Invencível", icon: "zap",
      description: "Ganhar 10 operações consecutivas.",
      unlocked: maxStreak >= 10, progress: pct(maxStreak, 10), detail: `Melhor: ${maxStreak}/10 seguidas`,
      category: "streak", rarity: "epic",
    },
    // ── Volume ───────────────────────────────────────────────────────────────
    {
      id: "vol_100k", title: "Primeiro Volume", icon: "wallet",
      description: "Negociar 100.000 Kz em volume total.",
      unlocked: totalVolume >= 100_000, progress: pct(totalVolume, 100_000), detail: `${Math.round(totalVolume / 1000)}k / 100k Kz`,
      category: "volume", rarity: "common",
    },
    {
      id: "vol_1m", title: "Milionário do Volume", icon: "rocket",
      description: "Negociar 1.000.000 Kz em volume total.",
      unlocked: totalVolume >= 1_000_000, progress: pct(totalVolume, 1_000_000), detail: `${Math.round(totalVolume / 1000)}k / 1.000k Kz`,
      category: "volume", rarity: "epic",
    },
    // ── Especial ─────────────────────────────────────────────────────────────
    {
      id: "first_profit", title: "Primeiro Lucro", icon: "trending-up",
      description: "Ter lucro positivo no total.",
      unlocked: totalProfit > 0, progress: totalProfit > 0 ? 100 : 50, detail: totalProfit > 0 ? "Alcançado!" : "Ainda negativo",
      category: "special", rarity: "common",
    },
    {
      id: "consistent_7", title: "Consistente", icon: "calendar",
      description: "Operar em 7 dias diferentes.",
      unlocked: tradeDays >= 7, progress: pct(tradeDays, 7), detail: `${tradeDays}/7 dias`,
      category: "special", rarity: "rare",
    },
    {
      id: "consec_days_5", title: "Disciplinado", icon: "calendar-days",
      description: "Operar 5 dias consecutivos.",
      unlocked: maxConsecDays >= 5, progress: pct(maxConsecDays, 5), detail: `Melhor: ${maxConsecDays}/5 dias seguidos`,
      category: "special", rarity: "rare",
    },
    {
      id: "multi_asset", title: "Diversificado", icon: "globe",
      description: "Operar em 5 pares diferentes.",
      unlocked: assets.size >= 5, progress: pct(assets.size, 5), detail: `${assets.size}/5 pares`,
      category: "special", rarity: "common",
    },
    {
      id: "profit_10k", title: "Em Lucro", icon: "banknote",
      description: "Acumular 10.000 Kz de lucro real.",
      unlocked: totalProfit >= 10_000, progress: pct(Math.max(0, totalProfit), 10_000), detail: `${Math.round(totalProfit / 1000)}k / 10k Kz`,
      category: "special", rarity: "rare",
    },
    {
      id: "profit_100k", title: "Grande Ganho", icon: "trophy",
      description: "Acumular 100.000 Kz de lucro real.",
      unlocked: totalProfit >= 100_000, progress: pct(Math.max(0, totalProfit), 100_000), detail: `${Math.round(totalProfit / 1000)}k / 100k Kz`,
      category: "special", rarity: "legendary",
    },
  ];

  const unlocked = achievements.filter(a => a.unlocked).length;
  return NextResponse.json({ achievements, unlocked, total: achievements.length });
}
