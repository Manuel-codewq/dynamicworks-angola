import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "seusburros91@gmail.com" }
  });

  if (!user) {
    console.log("❌ Utilizador NÃO encontrado!");
    return;
  }

  console.log("✅ Utilizador encontrado:");
  console.log("  email:", user.email);
  console.log("  role:", user.role);
  console.log("  status:", user.status);
  console.log("  emailVerified:", (user as any).emailVerified);

  const passwordOk = await bcrypt.compare("Jedilson*2005", user.password);
  console.log("  password correcta:", passwordOk ? "✅ SIM" : "❌ NÃO");

  if (!passwordOk) {
    const newHash = await bcrypt.hash("Jedilson*2005", 12);
    await prisma.user.update({
      where: { email: "seusburros91@gmail.com" },
      data: {
        password: newHash,
        emailVerified: true,
        role: "admin",
      } as any
    });
    console.log("🔧 Password e emailVerified corrigidos!");
  } else {
    await prisma.user.update({
      where: { email: "seusburros91@gmail.com" },
      data: { emailVerified: true } as any
    });
    console.log("🔧 emailVerified marcado como true!");
  }
}

main().then(() => prisma.$disconnect()).catch(console.error);
