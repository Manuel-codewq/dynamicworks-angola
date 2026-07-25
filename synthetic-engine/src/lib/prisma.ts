import { PrismaClient } from "@prisma/client";

// Instância única partilhada — antes cada ficheiro (tickEngine, candleAggregator,
// routes/indices) criava o seu próprio `new PrismaClient()`, cada um com o seu
// próprio pool de ligações (5 por omissão), multiplicando o número real de
// ligações abertas contra a BD e contribuindo para o esgotamento do pool sob a
// cadência de ticks (4 índices × 1/s) + candleAggregator (30s) + pedidos da API.
export const prisma = new PrismaClient();
