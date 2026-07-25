import express from "express";
import http from "http";
import { indicesRouter } from "./routes/indices";
import { initWebSocketServer } from "./ws/server";
import { startAllActiveIndices } from "./workers/tickEngine";
import { startCandleAggregator } from "./workers/candleAggregator";
import { runHistoricalBackfill } from "./workers/historicalBackfill";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/indices", indicesRouter);

const server = http.createServer(app);
initWebSocketServer(server);

const PORT = process.env.PORT || 4001;
server.listen(PORT, async () => {
  console.log(`[synthetic-engine] a correr na porta ${PORT}`);
  await runHistoricalBackfill();
  await startAllActiveIndices();
  startCandleAggregator();
});
