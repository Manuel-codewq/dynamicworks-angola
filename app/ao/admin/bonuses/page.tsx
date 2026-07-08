"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState } from "react";
import { Gift, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Copy, Check, Settings, Percent, Save } from "lucide-react";

interface PromoCode {
  id: string; code: string; type: string; value: number;
  maxUses: number; usedCount: number; active: boolean;
  expiresAt: string | null; createdAt: string;
  _count: { redemptions: number };
}

interface BonusConfig {
  depositBonusActive: boolean;
  depositBonusPct:    number;
  depositBonusMinAoa: number;
  depositBonusType:   "first" | "all";
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminBonusesPage() {
  const [codes,   setCodes]   = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", type: "balance", value: "", maxUses: "1", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [bonusCfg,     setBonusCfg]     = useState<BonusConfig>({ depositBonusActive: false, depositBonusPct: 10, depositBonusMinAoa: 50000, depositBonusType: "first" });
  const [savingBonus,  setSavingBonus]  = useState(false);
  const [bonusSaved,   setBonusSaved]   = useState(false);
  const [loadingBonus, setLoadingBonus] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/promo");
    if (res.ok) setCodes(await res.json());
    setLoading(false);
  }

  async function loadBonusConfig() {
    setLoadingBonus(true);
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setBonusCfg({
        depositBonusActive: data.depositBonusActive ?? false,
        depositBonusPct:    data.depositBonusPct    ?? 10,
        depositBonusMinAoa: data.depositBonusMinAoa ?? 50000,
        depositBonusType:   data.depositBonusType   ?? "first",
      });
    }
    setLoadingBonus(false);
  }

  useEffect(() => { load(); loadBonusConfig(); }, []);

  async function saveBonusConfig() {
    setSavingBonus(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bonusCfg),
    });
    if (res.ok) {
      setBonusSaved(true);
      setTimeout(() => setBonusSaved(false), 2500);
    }
    setSavingBonus(false);
  }

  async function create() {
    if (!form.code.trim() || !form.value) return;
    setCreating(true);
    await fetch("/api/admin/promo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, value: Number(form.value), maxUses: Number(form.maxUses) }),
    });
    setForm({ code: "", type: "balance", value: "", maxUses: "1", expiresAt: "" });
    setShowForm(false); setCreating(false); load();
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/admin/promo/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !active }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Apagar código promocional?")) return;
    await fetch(`/api/admin/promo/${id}`, { method: "DELETE" });
    load();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const inputStyle: React.CSSProperties = { width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Bónus e Promoções</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Configura bónus automáticos e códigos promocionais</p>
        </div>
      </div>

      {/* ── Bónus Automático de Depósito ─────────────────────────────────────── */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Percent size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Bónus Automático de Depósito</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Aplicado automaticamente quando um depósito é aprovado</div>
            </div>
          </div>
          {/* Toggle activo */}
          <button
            onClick={() => setBonusCfg(c => ({ ...c, depositBonusActive: !c.depositBonusActive }))}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {bonusCfg.depositBonusActive
              ? <><ToggleRight size={32} color="#22c55e" /><span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>Ativo</span></>
              : <><ToggleLeft  size={32} color="#334155" /><span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>Inativo</span></>
            }
          </button>
        </div>

        {loadingBonus ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>A carregar configuração...</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>

              {/* Percentagem */}
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>PERCENTAGEM DE BÓNUS</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number" min="1" max="100"
                    value={bonusCfg.depositBonusPct}
                    onChange={e => setBonusCfg(c => ({ ...c, depositBonusPct: Number(e.target.value) }))}
                    style={{ ...inputStyle, paddingRight: 30 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#ffffff", fontWeight: 700, fontSize: 13 }}>%</span>
                </div>
              </div>

              {/* Mínimo */}
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>DEPÓSITO MÍNIMO (Kz)</label>
                <input
                  type="number" min="0"
                  value={bonusCfg.depositBonusMinAoa}
                  onChange={e => setBonusCfg(c => ({ ...c, depositBonusMinAoa: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>TIPO DE BÓNUS</label>
                <select
                  value={bonusCfg.depositBonusType}
                  onChange={e => setBonusCfg(c => ({ ...c, depositBonusType: e.target.value as "first" | "all" }))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="first">Apenas primeiro depósito</option>
                  <option value="all">Todos os depósitos</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            <div style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Exemplo:</div>
              <div style={{ color: "#fff", fontSize: 13 }}>
                Depósito de {formatKz(bonusCfg.depositBonusMinAoa)} Kz →
                <span style={{ color: "#22c55e", fontWeight: 700 }}> +{formatKz(Math.floor(bonusCfg.depositBonusMinAoa * bonusCfg.depositBonusPct / 100))} Kz</span>
                {" "}de bónus ({bonusCfg.depositBonusPct}%)
                {" · "}{bonusCfg.depositBonusType === "first" ? "só no primeiro depósito" : "em todos os depósitos"}
              </div>
            </div>

            <button
              onClick={saveBonusConfig}
              disabled={savingBonus}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: bonusSaved ? "#22c55e" : "linear-gradient(135deg,#ffffff,#cbd5e1)", border: "none", borderRadius: 8, color: "#0a0f1e", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: savingBonus ? 0.7 : 1 }}
            >
              {bonusSaved ? <><Check size={14} /> Guardado!</> : savingBonus ? "A guardar..." : <><Save size={14} /> Guardar configuração</>}
            </button>
          </>
        )}
      </div>

      {/* ── Códigos Promocionais ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gift size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Códigos Promocionais</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{codes.length} código{codes.length !== 1 ? "s" : ""} criado{codes.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#ffffff,#cbd5e1)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#0a0f1e", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <Plus size={14} /> Novo código
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Gift size={16} color="#ffffff" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Novo código promocional</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>CÓDIGO</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ex: BONUS50" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>TIPO</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="balance">Bónus de saldo (Kz)</option>
                <option value="demo">Bónus demo (Kz)</option>
              </select>
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>VALOR (Kz)</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="5000" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>USOS MÁXIMOS</label>
              <input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} min="1" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>EXPIRA EM</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <button onClick={create} disabled={creating || !form.code.trim() || !form.value}
            style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "linear-gradient(135deg,#ffffff,#cbd5e1)", border: "none", borderRadius: 8, color: "#0a0f1e", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: creating ? 0.7 : 1 }}>
            <Plus size={14} /> {creating ? "A criar..." : "Criar código"}
          </button>
        </div>
      )}

      {/* Codes table */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <p style={{ color: "#94a3b8", padding: 20 }}>A carregar...</p>
        ) : codes.length === 0 ? (
          <p style={{ color: "#334155", padding: 20, fontSize: 13 }}>Nenhum código criado ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1526" }}>
                  {["Código", "Tipo", "Valor", "Usos", "Expira", "Estado", "Ações"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", color: "#64748b", fontSize: 11, fontWeight: 700, textAlign: "left", letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} style={{ borderTop: "1px solid #1e2d50" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{c.code}</span>
                        <button onClick={() => copyCode(c.code)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
                          {copied === c.code ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 13 }}>{c.type === "balance" ? "Saldo real" : "Demo"}</td>
                    <td style={{ padding: "12px 16px", color: "#ffffff", fontWeight: 700, fontSize: 13 }}>{formatKz(c.value)}</td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 13 }}>{c._count.redemptions}/{c.maxUses}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{formatDate(c.expiresAt)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: c.active ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)", color: c.active ? "#22c55e" : "#64748b", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => toggle(c.id, c.active)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
                          {c.active ? <ToggleRight size={20} color="#22c55e" /> : <ToggleLeft size={20} color="#334155" />}
                        </button>
                        <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={15} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
