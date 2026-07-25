/**
 * Guarda de regressão: garante que a plataforma se comporta bem quando
 * lib/assets.ts:ASSETS está vazio (sem pares/activos definidos) — 200 em
 * vez de 500, estados vazios em vez de "a carregar" para sempre, nada a
 * gravar em silêncio.
 *
 * Não depende de uma framework de testes (o projecto não tem nenhuma
 * instalada) — corre como script simples, falha com exit code 1.
 *
 * Duas partes:
 *   1. Lógica pura (sempre corre, independente do estado actual de ASSETS):
 *      testa toDerivPairs()/getActiveAssets()-style com um array vazio
 *      sintético, para garantir que a transformação em si nunca rebenta,
 *      mesmo que ASSETS volte a ter pares no futuro.
 *   2. Estado ao vivo (só corre se ASSETS estiver mesmo vazio agora, e só
 *      se o dev server em localhost:3000 responder — falha suave, não
 *      bloqueia se o servidor não estiver a correr): confirma que
 *      /api/pairs e /api/trade nunca devolvem 500.
 *
 * Uso: npx tsx scripts/test-empty-assets.ts
 */

let failed = false;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failed = true;
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

async function main() {
  const { ASSETS, ASSET_LABELS, ASSET_TO_BINANCE_SYMBOL, BINANCE_SYMBOL_TO_COINGECKO_ID, ALLOWED_ASSET_LABELS, getActiveAssets, toDerivPairs } =
    await import("../lib/assets");

  console.log("── 1. Lógica pura — array vazio sintético (independente do ASSETS real) ──");
  const emptySynthetic: typeof ASSETS = [];
  check("toDerivPairs([]) não rebenta e devolve []", (() => {
    try { return toDerivPairs(emptySynthetic).length === 0; } catch { return false; }
  })());
  check("getActiveAssets() nunca rebenta (independente do conteúdo actual)", (() => {
    try { getActiveAssets(); return true; } catch { return false; }
  })());

  console.log("\n── 2. Estado ao vivo de lib/assets.ts ──");
  if (ASSETS.length > 0) {
    console.log(`  (ASSETS tem ${ASSETS.length} par(es) neste momento — testes de estado vazio da BD/API não se aplicam agora, só a lógica pura acima)`);
  } else {
    check("ASSET_LABELS é [] quando ASSETS é []", ASSET_LABELS.length === 0);
    check("ASSET_TO_BINANCE_SYMBOL é {} quando ASSETS é []", Object.keys(ASSET_TO_BINANCE_SYMBOL).length === 0);
    check("BINANCE_SYMBOL_TO_COINGECKO_ID é {} quando ASSETS é []", Object.keys(BINANCE_SYMBOL_TO_COINGECKO_ID).length === 0);
    check("ALLOWED_ASSET_LABELS.has(qualquer coisa) é false, não rebenta", ALLOWED_ASSET_LABELS.has("BTC/USD") === false);
    check("getActiveAssets() é [] quando ASSETS é []", getActiveAssets().length === 0);

    const { CRYPTO_PAIRS, getAvailablePairs } = await import("../lib/derivWebSocket");
    check("CRYPTO_PAIRS (lib/derivWebSocket.ts) é [] quando ASSETS é []", CRYPTO_PAIRS.length === 0);
    check("getAvailablePairs() é [] quando ASSETS é []", getAvailablePairs().length === 0);

    const { DEFAULT_PAYOUT, DEFAULT_WIN_PROBABILITY, ALL_REAL_PAIR_LABELS, ALL_PAIR_KEYS } = await import("../lib/settings");
    check("DEFAULT_PAYOUT (lib/settings.ts) é {} quando ASSETS é []", Object.keys(DEFAULT_PAYOUT).length === 0);
    check("DEFAULT_WIN_PROBABILITY é {} quando ASSETS é []", Object.keys(DEFAULT_WIN_PROBABILITY).length === 0);
    check("ALL_REAL_PAIR_LABELS é [] quando ASSETS é []", ALL_REAL_PAIR_LABELS.length === 0);
    check("ALL_PAIR_KEYS é [] quando ASSETS é []", ALL_PAIR_KEYS.length === 0);
  }

  console.log("\n── 3. Endpoints HTTP ao vivo (localhost:3000 — falha suave se o servidor não estiver a correr) ──");
  const BASE = "http://localhost:3000";
  let serverUp = true;
  try {
    const r = await fetch(`${BASE}/api/pairs`, { signal: AbortSignal.timeout(4000) });
    check("GET /api/pairs nunca devolve 500", r.status !== 500, `status recebido: ${r.status}`);
    if (r.status === 200) {
      const body = await r.json() as { pairs: unknown[] };
      check("GET /api/pairs devolve { pairs: [] } (array, mesmo que vazio)", Array.isArray(body.pairs));
    }
  } catch {
    serverUp = false;
    console.log("  (servidor em localhost:3000 não respondeu — testes de endpoint HTTP saltados, não contam como falha)");
  }

  if (serverUp) {
    try {
      const r = await fetch(`${BASE}/api/trade?limit=5`, { signal: AbortSignal.timeout(4000) });
      // Sem sessão, o esperado é 401 (não autenticado) — nunca 500.
      check("GET /api/trade nunca devolve 500", r.status !== 500, `status recebido: ${r.status}`);
    } catch {
      console.log("  (falha de rede ao testar /api/trade — não contabilizada)");
    }
  }

  console.log();
  if (failed) {
    console.error("FALHOU — ver ✗ acima.");
    process.exitCode = 1;
  } else {
    console.log("OK — todos os pontos verificados passaram.");
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
