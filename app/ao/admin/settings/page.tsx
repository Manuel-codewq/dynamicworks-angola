"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Save, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import { ASSETS } from "@/lib/assets";
import CoinIcon from "@/app/components/CoinIcon";

// Pares forex OTC sintéticos (synthetic-engine) — únicos pares da plataforma
const REAL_PAIR_OPTIONS = ASSETS.map(a => ({ label: a.label, cat: a.category }));

// Durações (segundos, como string) com payout configurável por par — mesmas
// de PAYOUT_DURATIONS em lib/assets.ts. "default" cobre durações fora do
// mapa (personalizado, comutação).
const DURATION_LABELS: Record<string, string> = {
  "30": "30s", "60": "1m", "120": "2m", "180": "3m", "300": "5m",
  "600": "10m", "900": "15m", "1800": "30m", "3600": "1h", "default": "Outras (personalizado/comutação)",
};
const DURATION_ORDER = ["30", "60", "120", "180", "300", "600", "900", "1800", "3600", "default"];

interface HouseRisk {
  pnl: number;
  loss: number;
  limit: number;
  ratio: number;
  tier: "normal" | "caution" | "critical";
  payoutFactor: number;
  maxStake: number;
  suspendedPairs: string[];
}

interface Settings {
  payout:                   Record<string, Record<string, number>>;
  maintenanceMode:          boolean;
  forceRealMarket:          boolean;
  activePairs:              string[];
  weekendPairs:             string[];
  largeTradePushThreshold:  number;
  largeWithdrawalThreshold: number;
  dailyLossLimitPct:        number;
  houseDailyLossLimit:      number;
  houseRisk?:               HouseRisk;
}

// Espelha os escalões de lib/houseRisk.ts — informativo, para o admin ver o
// que vai acontecer em cada patamar. Se lá mudarem, mudar aqui também.
// `factor` identifica o escalão univocamente (há três níveis de "crítico"),
// e é por ele que se destaca a linha activa.
const RISK_TIERS = [
  { key: "normal",   factor: 1.00, label: "Normal",  range: "< 50%",    payout: "100%", stake: "500.000 Kz", color: "#22c55e" },
  { key: "caution",  factor: 0.85, label: "Atenção", range: "50-75%",   payout: "85%",  stake: "250.000 Kz", color: "#eab308" },
  { key: "critical", factor: 0.70, label: "Crítico", range: "75-100%",  payout: "70%",  stake: "100.000 Kz", color: "#f97316" },
  { key: "critical", factor: 0.55, label: "Crítico", range: "100-150%", payout: "55%",  stake: "50.000 Kz",  color: "#f97316" },
  { key: "critical", factor: 0.45, label: "Crítico", range: "≥ 150%",   payout: "45%",  stake: "25.000 Kz",  color: "#ef4444" },
];

// UI works in whole-number percentages; API uses fractions
function toPercent(v: number)  { return Math.round(v * 100); }
function toFraction(v: number) { return v / 100; }

export default function AdminSettingsPage() {
  const [draft,         setDraft]         = useState<Settings | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [resetting,     setResetting]     = useState(false);
  const [resetDone,     setResetDone]     = useState(false);
  const [rankingResetAt, setRankingResetAt] = useState<string | null>(null);
  const [payoutPair,    setPayoutPair]      = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const d = await res.json();
      setDraft(d);
      setRankingResetAt(d.rankingResetAt ?? null);
    }
    setLoading(false);
  }

  async function resetRanking() {
    if (!confirm("Tens a certeza? O ranking será zerado para todos os traders. Esta acção não pode ser desfeita.")) return;
    setResetting(true);
    const res = await fetch("/api/admin/ranking/reset", { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setRankingResetAt(d.resetAt);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    }
    setResetting(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    await fetch("/api/admin/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(draft),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  function setPayoutDuration(pair: string, durKey: string, pct: number) {
    setDraft(d => d ? {
      ...d,
      payout: { ...d.payout, [pair]: { ...d.payout[pair], [durKey]: toFraction(pct) } },
    } : d);
  }

  const sectionTitle: React.CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 14px" };
  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 22px", marginBottom: 20 };

  if (loading) return <div style={{ padding: 28 }}><p style={{ color: "#94a3b8" }}>A carregar...</p></div>;
  if (!draft)  return <div style={{ padding: 28 }}><p style={{ color: "#ef4444" }}>Erro ao carregar configurações.</p></div>;

  const pairs = Object.keys(draft.payout);

  return (
    <div style={{ padding: 28, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Configurações</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Parâmetros da plataforma</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={save} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6, background: saved ? "rgba(0,192,118,0.15)" : "rgba(255,255,255,0.15)", border: `1px solid ${saved ? "rgba(0,192,118,0.3)" : "rgba(255,255,255,0.3)"}`, borderRadius: 8, padding: "8px 18px", color: saved ? "#00c076" : "#ffffff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <Save size={14} /> {saved ? "Guardado!" : saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Platform controls */}
      <div style={card}>
        <p style={sectionTitle}>Controlos da Plataforma</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>

          {/* Reset ranking */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#0a0f1e", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 220 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Zerar ranking</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {rankingResetAt
                  ? `Último reset: ${new Date(rankingResetAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Nunca foi zerado"}
              </div>
            </div>
            <button onClick={resetRanking} disabled={resetting}
              style={{ background: resetDone ? "rgba(0,192,118,0.15)" : "rgba(239,68,68,0.1)", border: `1px solid ${resetDone ? "rgba(0,192,118,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "7px 14px", color: resetDone ? "#00c076" : "#ef4444", fontWeight: 700, fontSize: 12, cursor: resetting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: resetting ? 0.6 : 1, flexShrink: 0 }}>
              <RotateCcw size={13} /> {resetDone ? "Zerado!" : resetting ? "..." : "Zerar"}
            </button>
          </div>

          {/* Maintenance mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#0a0f1e", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 220 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Modo manutenção</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Bloqueia todos os traders</div>
            </div>
            <button onClick={() => setDraft(d => d ? { ...d, maintenanceMode: !d.maintenanceMode } : d)}
              style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: draft.maintenanceMode ? "#ef4444" : "#1e2d50", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: draft.maintenanceMode ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>

          {/* Force real market */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#0a0f1e", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 220, border: draft.forceRealMarket ? "1px solid rgba(0,192,118,0.3)" : "1px solid transparent" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Forçar pares reais</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {draft.forceRealMarket ? "Pares reais activos fora de horas" : "Só activos Seg–Sex 07h–20h WAT"}
              </div>
            </div>
            <button onClick={() => setDraft(d => d ? { ...d, forceRealMarket: !d.forceRealMarket } : d)}
              style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: draft.forceRealMarket ? "#00c076" : "#1e2d50", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: draft.forceRealMarket ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>

        </div>
      </div>

      {/* Pares activos */}
      <div style={card}>
        <p style={sectionTitle}>Pares Activos</p>
        <p style={{ color: "#64748b", fontSize: 12, margin: "-8px 0 14px" }}>
          Pares disponíveis para negociar. Desactivar um par impede novas operações nesse par.
        </p>
        {REAL_PAIR_OPTIONS.length === 0 ? (
          <p style={{ color: "#334155", fontSize: 13, padding: "8px 0" }}>
            Sem activos disponíveis de momento.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {REAL_PAIR_OPTIONS.map(opt => {
              const active = draft.activePairs?.includes(opt.label) ?? true;
              return (
                <button key={opt.label} onClick={() => setDraft(d => {
                  if (!d) return d;
                  const cur = d.activePairs ?? REAL_PAIR_OPTIONS.map(o => o.label);
                  return { ...d, activePairs: active ? cur.filter(l => l !== opt.label) : [...cur, opt.label] };
                })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0f1e", borderRadius: 10, padding: "11px 14px", border: `1px solid ${active ? "rgba(0,192,118,0.3)" : "#1e2d50"}`, cursor: "pointer", transition: "border-color 0.15s" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CoinIcon label={opt.label} size={18} />
                    <span style={{ color: active ? "#fff" : "#334155", fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                  </span>
                  {active
                    ? <ToggleRight size={20} color="#00c076" />
                    : <ToggleLeft  size={20} color="#334155" />
                  }
                </button>
              );
            })}
          </div>
        )}
      </div>


      {/* Risk controls */}
      <div style={card}>
        <p style={sectionTitle}>Controlo de Risco</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>

          <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Alerta operação grande (Kz)</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              Enviar notificação push ao admin quando uma operação real abrir acima deste valor. 0 = desativado.
            </div>
            <input type="number" min={0} step={10000}
              value={draft.largeTradePushThreshold ?? 0}
              onChange={e => setDraft(d => d ? { ...d, largeTradePushThreshold: Math.max(0, Number(e.target.value)) } : d)}
              style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 12px", color: "#ffffff", fontSize: 14, fontWeight: 700, boxSizing: "border-box" }} />
          </div>

          <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Alerta levantamento grande (Kz)</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              Enviar notificação push ao admin quando um levantamento acima deste valor for submetido. 0 = desativado.
            </div>
            <input type="number" min={0} step={50000}
              value={draft.largeWithdrawalThreshold ?? 0}
              onChange={e => setDraft(d => d ? { ...d, largeWithdrawalThreshold: Math.max(0, Number(e.target.value)) } : d)}
              style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 12px", color: "#ffffff", fontSize: 14, fontWeight: 700, boxSizing: "border-box" }} />
          </div>

          <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Limite diário de perda (%)</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              Bloquear operações reais se o utilizador perdeu X% do saldo inicial hoje. 0 = desativado.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={100} step={5}
                value={draft.dailyLossLimitPct ?? 0}
                onChange={e => setDraft(d => d ? { ...d, dailyLossLimitPct: Number(e.target.value) } : d)}
                style={{ flex: 1, accentColor: "#ffffff", cursor: "pointer" }} />
              <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 14, minWidth: 48, textAlign: "right" }}>
                {draft.dailyLossLimitPct > 0 ? `${draft.dailyLossLimitPct}%` : "OFF"}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Protecção da Casa */}
      {(() => {
        const hr = draft.houseRisk;
        const active = (draft.houseDailyLossLimit ?? 0) > 0;
        // Identificar pelo factor, não pelo tier: há três escalões "crítico"
        // com payouts diferentes e o tier sozinho não os distingue.
        const tierMeta = RISK_TIERS.find(t => t.factor === hr?.payoutFactor) ?? RISK_TIERS[0];
        const pct = hr && hr.limit > 0 ? Math.round(hr.ratio * 100) : 0;
        const barPct = Math.min(100, pct); // a barra satura, o número não
        const kz = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} Kz`;

        return (
          <div style={card}>
            <p style={sectionTitle}>Protecção da Casa</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 16px" }}>
              Defines só a perda máxima diária. Conforme te aproximas dela, o sistema
              vai reduzindo o payout e o valor máximo por operação, e suspende pares
              com perda concentrada — tudo automaticamente. A plataforma nunca fecha
              operações reais nem altera o resultado de operações já abertas: quem
              ganhou pelo preço, recebe.
            </p>

            <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Perda máxima diária da casa (Kz)</div>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
                0 = protecção desligada. Conta só operações reais fora de torneio, das 00:00 de hoje.
              </div>
              <input type="number" min={0} step={10000}
                value={draft.houseDailyLossLimit ?? 0}
                onChange={e => setDraft(d => d ? { ...d, houseDailyLossLimit: Number(e.target.value) } : d)}
                style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 12px", color: "#ffffff", fontSize: 14, fontWeight: 700, boxSizing: "border-box" }} />
            </div>

            {/* Estado ao vivo */}
            {hr && (
              <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Estado hoje</span>
                  <span style={{
                    background: active ? `${tierMeta.color}22` : "rgba(255,255,255,0.06)",
                    color: active ? tierMeta.color : "#64748b",
                    border: `1px solid ${active ? tierMeta.color + "66" : "#1e2d50"}`,
                    borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 800,
                  }}>
                    {active ? tierMeta.label.toUpperCase() : "DESLIGADO"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: active ? 12 : 0 }}>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Resultado do dia</div>
                    <div style={{ color: hr.pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {hr.pnl >= 0 ? "+" : ""}{kz(hr.pnl)}
                    </div>
                  </div>
                  {active && (
                    <>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Limite consumido</div>
                        <div style={{ color: tierMeta.color, fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Payout aplicado</div>
                        <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{Math.round(hr.payoutFactor * 100)}%</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Máx. por operação</div>
                        <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{kz(hr.maxStake)}</div>
                      </div>
                    </>
                  )}
                </div>

                {active && (
                  <div style={{ height: 6, background: "#111827", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barPct}%`, background: tierMeta.color, transition: "width 0.4s ease" }} />
                  </div>
                )}

                {hr.suspendedPairs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                      Pares suspensos ({hr.suspendedPairs.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {hr.suspendedPairs.map(p => (
                        <span key={p} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Escalões — informativo */}
            <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>
                Escalões automáticos
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
                  <thead>
                    <tr style={{ color: "#475569" }}>
                      <th style={{ textAlign: "left", padding: "4px 8px 6px 0", fontWeight: 600 }}>Limite consumido</th>
                      <th style={{ textAlign: "left", padding: "4px 8px 6px 0", fontWeight: 600 }}>Estado</th>
                      <th style={{ textAlign: "left", padding: "4px 8px 6px 0", fontWeight: 600 }}>Payout</th>
                      <th style={{ textAlign: "left", padding: "4px 0 6px 0", fontWeight: 600 }}>Máx. operação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_TIERS.map(t => {
                      const isCurrent = active && hr?.payoutFactor === t.factor;
                      return (
                        <tr key={t.range} style={{ background: isCurrent ? "rgba(255,255,255,0.04)" : "transparent" }}>
                          <td style={{ color: "#94a3b8", padding: "5px 8px 5px 0" }}>{t.range}</td>
                          <td style={{ color: t.color, fontWeight: 700, padding: "5px 8px 5px 0" }}>{t.label}</td>
                          <td style={{ color: "#cbd5e1", padding: "5px 8px 5px 0" }}>{t.payout}</td>
                          <td style={{ color: "#cbd5e1", padding: "5px 0" }}>{t.stake}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 8 }}>
                Um par é suspenso quando sozinho causa ≥ 40% do limite em perdas e tem ≥ 10 operações no dia.
                Conta demo e torneios nunca são afectados.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payout % por Par × Duração */}
      <div style={card}>
        <p style={sectionTitle}>Payout por Par × Duração (50% – 95%)</p>
        {pairs.length === 0 ? (
          <p style={{ color: "#334155", fontSize: 13, padding: "8px 0" }}>
            Sem activos disponíveis de momento.
          </p>
        ) : (() => {
          const activePayoutPair = payoutPair && draft.payout[payoutPair] ? payoutPair : pairs[0];
          const durMap = draft.payout[activePayoutPair] ?? {};
          return (
            <>
              <p style={{ color: "#64748b", fontSize: 12, margin: "-8px 0 14px" }}>
                Escolhe um par para editar o payout de cada duração. "Outras" cobre durações personalizadas e o modo comutação (fecha com a vela).
              </p>

              {/* Selector de par */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #1e2d50" }}>
                {pairs.map(pair => (
                  <button key={pair} onClick={() => setPayoutPair(pair)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: activePayoutPair === pair ? "rgba(255,255,255,0.12)" : "#0a0f1e",
                      border: `1px solid ${activePayoutPair === pair ? "rgba(255,255,255,0.35)" : "#1e2d50"}`,
                      borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                    }}>
                    <CoinIcon label={pair} size={16} />
                    <span style={{ color: activePayoutPair === pair ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 600 }}>{pair}</span>
                  </button>
                ))}
              </div>

              {/* Grelha de durações do par escolhido */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {DURATION_ORDER.map(durKey => {
                  const pct = toPercent(durMap[durKey] ?? 0.85);
                  return (
                    <div key={durKey} style={{ background: "#0a0f1e", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>{DURATION_LABELS[durKey]}</span>
                        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 13 }}>{pct}%</span>
                      </div>
                      <input type="range" min={50} max={95} step={1} value={pct}
                        onChange={e => setPayoutDuration(activePayoutPair, durKey, Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#ffffff", cursor: "pointer" }} />
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

    </div>
  );
}
