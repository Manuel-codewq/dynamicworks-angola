import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "../.env.local"), "utf8");
const DATABASE_URL = env.match(/DATABASE_URL="?([^"\n]+)"?/)?.[1]?.trim();

const adapter = new PrismaNeon({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const result = await prisma.trade.updateMany({
  where: { status: "active" },
  data:  { status: "closed", result: "loss", closedAt: new Date() },
});

console.log(`Operações ativas fechadas: ${result.count}`);
await prisma.$disconnect();
