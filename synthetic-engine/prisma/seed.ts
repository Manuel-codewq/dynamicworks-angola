import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seedData = [
  // Pares "forex OTC" — formato familiar de par cambial + sufixo OTC,
  // deixa claro que não é feed de mercado real (evita confusão regulatória)
  { symbol: "EURUSD_OTC", displayName: "EUR/USD OTC", type: "VOLATILITY" as const, basePrice: 1.085, volatility: 0.15, decimals: 5 },
  { symbol: "GBPUSD_OTC", displayName: "GBP/USD OTC", type: "VOLATILITY" as const, basePrice: 1.27, volatility: 0.18, decimals: 5 },
  { symbol: "USDJPY_OTC", displayName: "USD/JPY OTC", type: "VOLATILITY" as const, basePrice: 156.5, volatility: 0.12, decimals: 3 },
  { symbol: "AUDUSD_OTC", displayName: "AUD/USD OTC", type: "VOLATILITY" as const, basePrice: 0.665, volatility: 0.2, decimals: 5 },
];

async function main() {
  for (const data of seedData) {
    await prisma.syntheticIndex.upsert({
      where: { symbol: data.symbol },
      update: {},
      create: { ...data, lastPrice: data.basePrice },
    });
  }
  console.log(`Seed concluído: ${seedData.length} índices sintéticos criados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
