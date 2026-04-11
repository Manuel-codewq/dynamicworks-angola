/**
 * deriv.ts — DynamicWorks
 * Camada de comunicação WebSocket com a API Deriv (Binary.com)
 * Usa getState() do Zustand para acesso ao store fora de componentes React.
 */

import { useStore } from '@/store';

// ── Config ──────────────────────────────────────────────────
const APP_ID = 127916;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}&l=PT`;
const DEMO_VIRTUAL_TOKEN = 'RwzXJAfqkha6BPU'; // conta virtual demo (sem dinheiro real)

// ── Estado interno ───────────────────────────────────────────
let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnTimer: ReturnType<typeof setTimeout> | null = null;
let reconnAttempts = 0;
let currentSymbol: string | null = null;
let currentSubscriptionId: string | null = null;

// Callbacks usados pelo ChartWidget
let onTickCallback: ((tick: DerivTick) => void) | null = null;
let onHistoryCallback: ((history: unknown) => void) | null = null;

// Fila de requests pendentes (enviados antes do WS abrir)
const pendingQueue: Record<string, unknown>[] = [];

// Contratos já notificados — previne duplicação quando Deriv envia is_expired + is_sold
const notifiedContracts = new Set<string>();

// ── Tipos mínimos ────────────────────────────────────────────
interface DerivTick {
  epoch: string;
  quote: string;
  symbol?: string;
}

// ── API Pública ──────────────────────────────────────────────
export const derivAPI = {

  connect() {
    if (ws && ws.readyState < WebSocket.CLOSING) return;
    ws = new WebSocket(WS_URL);
    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onclose = handleClose;
    ws.onerror = () => { /* silencioso — handleClose vai reconectar */ };
  },

  disconnect() {
    reconnAttempts = 99; // impede reconexão automática
    ws?.close();
    ws = null;
    if (pingTimer) clearInterval(pingTimer);
    if (reconnTimer) clearTimeout(reconnTimer);
  },

  send(payload: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      // Guardar para enviar assim que o WS abrir
      pendingQueue.push(payload);
    }
  },

  authorize(token: string) {
    derivAPI.send({ authorize: token });
  },

  subscribeTicks(symbol: string, callback?: (tick: DerivTick) => void) {
    const symbolChanged = symbol !== currentSymbol;
    // Só cancela subscrição anterior se o símbolo mudou
    if (symbolChanged && currentSubscriptionId) {
      derivAPI.send({ forget: currentSubscriptionId });
      currentSubscriptionId = null;
    }
    currentSymbol = symbol;
    // Só atualiza o callback se foi passado um novo
    // (evita apagar o callback do ChartWidget quando o TradingDashboard chamar sem callback)
    if (callback !== undefined) {
      onTickCallback = callback;
    }
    if (ws?.readyState === WebSocket.OPEN && symbolChanged) {
      derivAPI.send({ ticks: symbol, subscribe: 1 });
    } else if (ws?.readyState !== WebSocket.OPEN) {
      // Será enviado via pendingQueue quando o WS abrir
      pendingQueue.push({ ticks: symbol, subscribe: 1 });
    }
  },

  getHistory(
    symbol: string,
    style: 'ticks' | 'candles',
    callback: (data: unknown) => void,
    granularity: number = 60,
  ) {
    onHistoryCallback = callback;
    const payload: Record<string, unknown> = {
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 1000,
      end: 'latest',
      start: 1,
      style,
    };
    if (style === 'candles') {
      payload.granularity = granularity;
    }
    derivAPI.send(payload);
  },

  buyContract(
    amount: number,
    type: 'ACCU' | 'CALL' | 'PUT',
    symbol: string,
    growthRate = 3,
    duration?: number,
    durationUnit?: string
  ) {
    const parameters: Record<string, unknown> = {
      amount,
      basis: 'stake',
      contract_type: type,
      currency: 'USD',
      symbol,
    };

    if (type === 'ACCU') {
      parameters.growth_rate = growthRate / 100;
    } else {
      parameters.duration = duration ?? 5;
      parameters.duration_unit = durationUnit ?? 't';
    }

    derivAPI.send({ buy: 1, price: amount, parameters, subscribe: 1 });
  },

  sellContract(contractId: number) {
    derivAPI.send({ sell: contractId, price: 0 });
  },
};

// ── Handlers internos ────────────────────────────────────────
function handleOpen() {
  reconnAttempts = 0;
  if (reconnTimer) clearTimeout(reconnTimer);
  if (pingTimer) clearInterval(pingTimer);

  // Keep-alive a cada 25s
  pingTimer = setInterval(() => derivAPI.send({ ping: 1 }), 25_000);

  // ── AUTENTICAÇÃO SEGURA ─────────────────────────────────────────────────────
  // Lê o token real do utilizador guardado no localStorage após OAuth
  const realToken  = typeof window !== 'undefined' ? localStorage.getItem('dw_token') : null;
  const isDemoBypass = realToken === 'DEMO_TOKEN_BYPASS' || !realToken;

  if (isDemoBypass) {
    // Conta de treino — usa token virtual (sem dinheiro real)
    derivAPI.authorize(DEMO_VIRTUAL_TOKEN);
  } else {
    // Conta real/virtual OAuth — usa o token do utilizador
    derivAPI.authorize(realToken);
  }

  // Re-subscrever ao símbolo ativo (após reconexão / primeira ligação)
  if (currentSymbol) {
    ws!.send(JSON.stringify({ ticks: currentSymbol, subscribe: 1 }));
  }

  // Rastreio global de contratos abertos
  derivAPI.send({ proposal_open_contract: 1, subscribe: 1 });

  // Enviar todos os requests pendentes (ex: getHistory chamado antes do WS abrir)
  while (pendingQueue.length > 0) {
    const req = pendingQueue.shift()!;
    // Não re-enviar subscrições de ticks — já enviadas acima
    if (!('ticks' in req)) {
      ws!.send(JSON.stringify(req));
    }
  }
}

function handleClose() {
  if (pingTimer) clearInterval(pingTimer);
  reconnect();
}

function reconnect() {
  if (reconnAttempts >= 99) return; // desconexão manual
  reconnAttempts++;
  const delay = Math.min(3_000 * reconnAttempts, 20_000);
  reconnTimer = setTimeout(() => derivAPI.connect(), delay);
}

function handleMessage(evt: MessageEvent<string>) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(evt.data) as Record<string, unknown>;
  } catch {
    return;
  }

  // Guardar ID de subscrição activa
  const sub = data.subscription as { id?: string } | undefined;
  if (sub?.id) currentSubscriptionId = sub.id;

  // ── Forward ALL messages como CustomEvent para componentes ouvirem ──────────
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deriv-msg', { detail: data }));
  }

  const store = useStore.getState();

  switch (data.msg_type as string) {

    case 'authorize': {
      const auth = data.authorize as { balance?: string } | undefined;
      if (auth?.balance) {
        const bal = parseFloat(auth.balance);
        store.setBalance(bal.toFixed(2), (bal * 980).toFixed(0));
        derivAPI.send({ balance: 1, subscribe: 1 });
      }
      break;
    }

    case 'balance': {
      const balData = data.balance as { balance?: string } | undefined;
      if (balData?.balance) {
        const bal = parseFloat(balData.balance);
        store.setBalance(bal.toFixed(2), (bal * 980).toFixed(0));
      }
      break;
    }

    case 'tick': {
      const tick = data.tick as DerivTick | undefined;
      if (tick?.quote) {
        const price = parseFloat(tick.quote);
        if (!isNaN(price)) {
          store.setSpot(price);
          onTickCallback?.(tick);
        }
      }
      break;
    }

    case 'history': {
      const history = data.history;
      if (history && onHistoryCallback) {
        onHistoryCallback(history);
        onHistoryCallback = null;
      }
      break;
    }

    case 'candles': {
      const candles = data.candles;
      if (candles && onHistoryCallback) {
        onHistoryCallback({ candles });
        onHistoryCallback = null;
      }
      break;
    }

    case 'buy': {
      const buyResult = data.buy as Record<string, unknown> | undefined;
      if (buyResult) {
        console.info('[Deriv] Trade executado:', buyResult);
        // Notificar UI de sucesso
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('deriv-buy-ok', { detail: buyResult }));
        }
      }
      break;
    }

    case 'proposal_open_contract': {
      const contract = data.proposal_open_contract as Record<string, unknown> | undefined;
      if (!contract) break;

      const contracts = [...store.openContracts];
      const idx = contracts.findIndex(
        (c) => c.contract_id === contract.contract_id
      );

      if (contract.is_expired || contract.is_sold) {
        if (idx !== -1) {
          contracts.splice(idx, 1);
          store.setOpenContracts(contracts);
        }

        // Deduplicar — Deriv envia is_expired E is_sold para o mesmo contrato
        const contractId = String(contract.contract_id);
        if (notifiedContracts.has(contractId)) break; // Já processado
        notifiedContracts.add(contractId);
        // Limpar Set após 60s para evitar alocação infinita
        setTimeout(() => notifiedContracts.delete(contractId), 60_000);

        // ── Registar histórico e notificação ──────────────────────────────────
        const pnl    = parseFloat((contract.profit as string) ?? '0');
        const isWin  = pnl >= 0;
        const sym    = (contract.display_name as string) ?? 'Unknown';
        const ctype  = (contract.contract_type as string) ?? 'ACCU';
        const stake  = parseFloat((contract.buy_price as string) ?? '0');

        store.addTradeHistory({
          id:       contractId,
          symbol:   sym,
          type:     (ctype === 'ACCU' ? 'ACCU' : ctype === 'CALL' ? 'CALL' : 'PUT'),
          stake,
          pnl,
          result:   isWin ? 'win' : 'loss',
          closedAt: Date.now() / 1000,
        });

        store.addNotification(
          isWin
            ? `✅ ${sym} — Ganhou $${pnl.toFixed(2)}`
            : `❌ ${sym} — Perdeu $${Math.abs(pnl).toFixed(2)}`,
          isWin ? 'win' : 'loss'
        );

        // Browser notification se permitido
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`DynamicWorks — ${isWin ? 'WIN' : 'LOSS'}`, {
            body: isWin ? `+$${pnl.toFixed(2)} em ${sym}` : `-$${Math.abs(pnl).toFixed(2)} em ${sym}`,
            icon: '/favicon.ico',
          });
        }

        // ── Som de notificação ────────────────────────────────────────────────
        if (typeof window !== 'undefined' && window.AudioContext) {
          try {
            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.frequency.setValueAtTime(isWin ? 880 : 220, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(isWin ? 1760 : 110, ctx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
          } catch { /* Som opcional — ignorar erros */ }
        }

      } else {
        if (idx !== -1) contracts[idx] = contract;
        else contracts.push(contract);
        store.setOpenContracts(contracts);
      }
      break;
    }

    case 'error': {
      const err = data.error as { message?: string; code?: string } | undefined;
      console.error('[Deriv] API Error:', err?.message ?? data.error);
      // Se estava à espera de histórico, resolver com dados vazios (gráfico aceita ticks ao vivo)
      if (onHistoryCallback) {
        onHistoryCallback({ times: [], prices: [] });
        onHistoryCallback = null;
      }
      // Reencaminhar o erro para a UI (ex: trade rejeitado, saldo insuficiente)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('deriv-error', { detail: err }));
      }
      break;
    }
  }
}
