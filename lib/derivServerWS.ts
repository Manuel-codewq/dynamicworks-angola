import WebSocket from "ws";

// A API REST (api.deriv.com/api/v1) foi descontinuada pela Deriv — devolve uma
// página HTML "Legacy Deriv API". Toda a obtenção de preços server-side passa
// por este cliente WebSocket (mesmo app_id usado pelo frontend).
const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=127916";

export interface DerivCandle {
  epoch: number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
}

export class DerivWSClient {
  private ws: WebSocket | null = null;
  private nextReqId = 1;
  private pending = new Map<number, {
    resolve: (v: any) => void;
    reject:  (e: Error) => void;
    timer:   ReturnType<typeof setTimeout>;
  }>();

  async connect(timeoutMs = 10_000): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(DERIV_WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("Deriv WS: timeout ao ligar"));
      }, timeoutMs);
      ws.on("open", () => { clearTimeout(timer); this.ws = ws; resolve(); });
      ws.on("error", (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
      ws.on("message", (data) => this.handleMessage(data.toString()));
      ws.on("close", () => {
        this.failAll(new Error("Deriv WS: ligação fechada"));
        this.ws = null;
      });
    });
  }

  private handleMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    const reqId = msg?.req_id ?? msg?.echo_req?.req_id;
    if (typeof reqId !== "number") return;
    const entry = this.pending.get(reqId);
    if (!entry) return;
    this.pending.delete(reqId);
    clearTimeout(entry.timer);
    if (msg.error) entry.reject(new Error(msg.error.message ?? "Deriv WS: erro"));
    else entry.resolve(msg);
  }

  private failAll(err: Error) {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }

  request(payload: Record<string, unknown>, timeoutMs = 10_000): Promise<any> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Deriv WS: não ligado"));
    }
    const req_id = this.nextReqId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req_id);
        reject(new Error("Deriv WS: timeout no pedido"));
      }, timeoutMs);
      this.pending.set(req_id, { resolve, reject, timer });
      ws.send(JSON.stringify({ ...payload, req_id }));
    });
  }

  async fetchCandles(symbol: string, granularity: number, count = 5): Promise<DerivCandle[]> {
    const res = await this.request({
      ticks_history: symbol,
      count,
      end: "latest",
      style: "candles",
      granularity,
    });
    const candles: any[] = res?.candles ?? res?.history?.candles ?? [];
    return candles
      .map(c => ({
        epoch: Number(c.epoch),
        open:  Number(c.open),
        high:  Number(c.high),
        low:   Number(c.low),
        close: Number(c.close),
      }))
      .filter(c => isFinite(c.close) && c.close > 0);
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}

// Uso pontual: abre a ligação, pede as velas e fecha.
export async function fetchDerivCandlesWS(
  symbol: string,
  granularity: number,
  count = 5,
): Promise<DerivCandle[]> {
  const client = new DerivWSClient();
  await client.connect();
  try {
    return await client.fetchCandles(symbol, granularity, count);
  } finally {
    client.close();
  }
}
