// Script único para criar o utilizador admin
// Uso: node seed-admin.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { createRequire } from "module";
import { readFileSync } from "fs";

// Carregar .env.local manualmente
const envFile = readFileSync(".env.local", "utf8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) {
    process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

const EMAIL    = "seusburros91@gmail.com";
const PASSWORD = "Jedilson*2005";

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where:  { email: EMAIL },
    update: {
      password:      hashed,
      role:          "admin",
      emailVerified: true,
      status:        "active",
      kycStatus:     "approved",
    },
    create: {
      name:          "Admin",
      email:         EMAIL,
      password:      hashed,
      role:          "admin",
      emailVerified: true,
      status:        "active",
      kycStatus:     "approved",
      balance:       0,
      demoBalance:   10000,
      isDemo:        false,
    },
  });

  console.log("✓ Admin criado/atualizado:", user.email, "| role:", user.role);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});
