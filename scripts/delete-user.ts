import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "petilsonfigura@gmail.com" }
  });

  if (!user) {
    console.log("❌ Utilizador não encontrado");
    return;
  }

  await prisma.trade.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { email: "petilsonfigura@gmail.com" } });

  console.log("✅ Utilizador petilsonfigura@gmail.com apagado!");
}

main().then(() => prisma.$disconnect()).catch(console.error);
