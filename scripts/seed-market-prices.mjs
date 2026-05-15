import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

// Preços reais do fecho + 2 pares calculados (CAD/JPY e CHF/JPY)
const PRICES = [
  ["frxEURUSD", 1.16234], ["frxGBPUSD", 1.33172], ["frxUSDJPY", 158.799],
  ["frxAUDUSD", 0.71458], ["frxUSDCAD", 1.37531], ["frxEURGBP", 0.87285],
  ["frxUSDCHF", 0.78687], ["frxNZDUSD", 0.58373], ["frxEURJPY", 184.58],
  ["frxGBPJPY", 211.477], ["frxEURCAD", 1.59859], ["frxAUDJPY", 113.477],
  ["frxGBPAUD", 1.86351], ["frxEURCHF", 0.91462], ["frxAUDCAD", 0.98278],
  ["frxAUDCHF", 0.56229], ["frxAUDNZD", 1.22417], ["frxEURAUD", 1.62660],
  ["frxEURNZD", 1.99122], ["frxGBPCAD", 1.83155], ["frxGBPCHF", 1.04788],
  ["frxGBPNOK", 12.39649],["frxGBPNZD", 2.28145], ["frxNZDJPY", 92.697],
  ["frxUSDMXN", 17.3409], ["frxUSDNOK", 9.3088],  ["frxUSDPLN", 3.6559],
  ["frxUSDSEK", 9.44328],
  // Calculados: CAD/JPY = USDJPY/USDCAD, CHF/JPY = USDJPY/USDCHF
  ["frxCADJPY", parseFloat((158.799 / 1.37531).toFixed(3))],
  ["frxCHFJPY", parseFloat((158.799 / 0.78687).toFixed(3))],
];

for (const [symbol, price] of PRICES) {
  await prisma.marketPrice.upsert({
    where:  { symbol },
    create: { symbol, price },
    update: { price },
  });
  console.log(`✅ ${symbol.padEnd(12)} = ${price}`);
}

await prisma.$disconnect();
console.log(`\n${PRICES.length} preços guardados.`);
