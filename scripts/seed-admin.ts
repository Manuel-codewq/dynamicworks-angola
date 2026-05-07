import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("Jedilson*2005", 12);
  await prisma.user.create({
    data: {
      name:        "Jedilson",
      email:       "seusburros91@gmail.com",
      password,
      role:        "admin",
      status:      "active",
      balance:     0,
      demoBalance: 0,
    },
  });
  console.log("Admin criado: seusburros91@gmail.com / Jedilson*2005");
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
