import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  const now       = new Date();
  const startDate = now;
  const endDate   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 dias

  const tournament = await prisma.tournament.create({
    data: {
      name:        "1º Torneio Dynamics Works — Inauguração",
      description: "O primeiro torneio oficial da Dynamics Works chegou! Esta é a tua oportunidade de fazer história e ser o primeiro campeão da corretora angolana de opções binárias. Durante 30 dias, os melhores traders vão competir pelo topo do ranking — cada operação real conta. Demonstra a tua estratégia, disciplina e consistência. Os 3 primeiros classificados garantem o seu lugar nos anais da Dynamics Works. Estás pronto para reclamar o título?",
      rules:        "• Apenas operações reais contam para a classificação\n• Mínimo de 5 operações para figurar no ranking\n• A classificação é baseada no lucro total acumulado em Kwanzas\n• Em caso de empate, vence quem tiver maior taxa de vitória\n• Operações demo não são contabilizadas\n• Cada participante paga 1.000 Kz de inscrição\n• Os prémios são creditados automaticamente no saldo real após o encerramento\n• A Dynamics Works reserva o direito de desqualificar contas com actividade suspeita\n• Resultados actualizados em tempo real",
      startDate,
      endDate,
      prizePool:       10000,
      prizes: [
        { position: 1, amount: 5000 },
        { position: 2, amount: 3000 },
        { position: 3, amount: 2000 },
      ],
      status:          "active",
      isFree:          false,
      entryFee:        1000,
      maxParticipants: 100,
      bannerColor:     "#f5a623",
    },
  });

  console.log("✅ Torneio criado com sucesso!");
  console.log(`   ID:        ${tournament.id}`);
  console.log(`   Nome:      ${tournament.name}`);
  console.log(`   Início:    ${tournament.startDate.toLocaleDateString("pt-AO")}`);
  console.log(`   Fim:       ${tournament.endDate.toLocaleDateString("pt-AO")}`);
  console.log(`   Prémio:    10.000 Kz  (5k / 3k / 2k)`);
  console.log(`   Entrada:   1.000 Kz`);
  console.log(`   Vagas:     100 participantes`);
  console.log(`   URL:       /tournaments/${tournament.id}`);
}

main()
  .catch(e => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
