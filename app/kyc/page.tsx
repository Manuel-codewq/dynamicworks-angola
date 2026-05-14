"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CreditCard, ScanFace, ShieldCheck,
  CheckCircle, RotateCcw, Lock, Clock,
  AlertTriangle, ArrowRight, Loader2, User,
} from "lucide-react";

interface KYCData {
  selfie: string;
  biFront: string;
  biBack: string;
}

async function uploadToCloud(b64: string): Promise<string> {
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: b64, folder: "kyc" }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || "Falha no upload");
  }
  return (await r.json()).url as string;
}

function compressImage(file: File, maxW = 1400, q = 0.85): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = rej;
      img.src = reader.result as string;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

export default function KYCPage() {
  const router = useRouter();

  const [attemptsLeft, setAL]   = useState<number | null>(null);
  const [blockedUntil, setBU]   = useState<Date | null>(null);
  const [countdown, setCD]      = useState("");
  const [kyc, setKyc]           = useState<KYCData>({ selfie: "", biFront: "", biBack: "" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState("");
  const [submitting, setSub]    = useState(false);
  const [done, setDone]         = useState(false);

  const selfieRef   = useRef<HTMLInputElement>(null);
  const biFrontRef  = useRef<HTMLInputElement>(null);
  const biBackRef   = useRef<HTMLInputElement>(null);

  // Fetch status
  React.useEffect(() => {
    fetch("/api/profile/kyc").then(r => r.json()).then(d => {
      if (d.kycBlockedUntil) {
        const u = new Date(d.kycBlockedUntil);
        if (u > new Date()) { setBU(u); return; }
      }
      setAL(4 - (d.kycAttempts || 0));
    }).catch(() => setAL(4));
  }, []);

  // Countdown
  React.useEffect(() => {
    if (!blockedUntil) return;
    const id = setInterval(() => {
      const diff = blockedUntil.getTime() - Date.now();
      if (diff <= 0) { setBU(null); clearInterval(id); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCD(`${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof KYCData,
    label: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    setUploadErr("");
    setUploading(label);
    try {
      const b64 = await compressImage(file);
      const url = await uploadToCloud(b64);
      setKyc(p => ({ ...p, [field]: url }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Erro ao enviar. Tenta novamente.");
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!kyc.selfie || !kyc.biFront || !kyc.biBack) return;
    setSub(true);
    try {
      const res = await fetch("/api/profile/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceFront: kyc.selfie,
          faceRight: kyc.selfie,
          faceLeft:  kyc.selfie,
          biFront:   kyc.biFront,
          biBack:    kyc.biBack,
          livenessScore: 0,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.blockedUntil) { setBU(new Date(d.blockedUntil)); }
        else { setDone(true); setTimeout(() => router.push("/profile"), 2000); }
      } else if (res.status === 429 && d.blockedUntil) {
        setBU(new Date(d.blockedUntil));
      } else {
        setUploadErr(d.error || `Erro ${res.status}. Tenta novamente.`);
      }
    } catch {
      setUploadErr("Erro de rede. Verifica a ligação.");
    } finally {
      setSub(false);
    }
  };

  const allUploaded = kyc.selfie && kyc.biFront && kyc.biBack;

  // ─── Estilos ────────────────────────────────────────────────────────────
  const S = {
    page:    { minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "0 16px 60px" },
    topbar:  { width: "100%", maxWidth: 460, display: "flex", alignItems: "center", gap: 10, padding: "20px 0" },
    card:    { background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "24px", width: "100%", maxWidth: 460, marginBottom: 14 },
    h2:      { color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 4px" },
    sub:     { color: "#64748b", fontSize: 13, margin: "0 0 16px" },
    btnGold: { width: "100%", background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "13px", fontWeight: 700, fontSize: 14, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
    btnGreen:{ width: "100%", background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontWeight: 700, fontSize: 14, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10 },
    btnOut:  { width: "100%", background: "transparent", color: "#94a3b8", border: "1px solid #1e2d50", borderRadius: 10, padding: "13px", fontWeight: 600, fontSize: 14, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
    photoBox:{ width: "100%", aspectRatio: "4/3", borderRadius: 12, overflow: "hidden", background: "#0a0f1e", border: "1px solid #1e2d50", display: "flex", alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 10, position: "relative" as const },
    tick:    { position: "absolute" as const, top: 8, right: 8, background: "#22c55e", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center" as const, justifyContent: "center" as const },
  };

  // ─── Bloqueado ────────────────────────────────────────────────────────────
  if (blockedUntil) return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><ScanFace size={18} color="#0a0f1e" /></div>
        <span style={{ color: "#f5a623", fontWeight: 800 }}>Dynamics Works</span>
      </div>
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock size={26} color="#ef4444" />
        </div>
        <h2 style={{ ...S.h2, color: "#ef4444", textAlign: "center" }}>Verificação Bloqueada</h2>
        <p style={{ ...S.sub, textAlign: "center", marginBottom: 16 }}>Atingiste o limite de tentativas.</p>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#f5a623", marginBottom: 20 }}>{countdown || "..."}</div>
        <button style={S.btnOut} onClick={() => router.push("/profile")}>Voltar ao Perfil</button>
      </div>
    </div>
  );

  // ─── Sucesso ─────────────────────────────────────────────────────────────
  if (done) return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><ScanFace size={18} color="#0a0f1e" /></div>
        <span style={{ color: "#f5a623", fontWeight: 800 }}>Dynamics Works</span>
      </div>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 24px" }}>
        <CheckCircle size={48} color="#22c55e" style={{ marginBottom: 16 }} />
        <h2 style={{ ...S.h2, textAlign: "center", fontSize: 20 }}>Documentos enviados!</h2>
        <p style={{ ...S.sub, textAlign: "center" }}>A equipa analisa em até 24 horas. A redirecionar...</p>
      </div>
    </div>
  );

  // ─── Main ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><ScanFace size={18} color="#0a0f1e" /></div>
        <span style={{ color: "#f5a623", fontWeight: 800 }}>Dynamics Works</span>
        <button onClick={() => router.push("/profile")} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>Voltar</button>
      </div>

      {/* Header */}
      <div style={{ ...S.card, background: "transparent", border: "none", padding: "0 0 4px", marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={20} color="#f5a623" />
          <h1 style={{ color: "#fff", fontSize: 19, fontWeight: 800, margin: 0 }}>Verificação de Identidade</h1>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Envia as 3 fotos abaixo. A equipa analisa em até 24h.</p>
        {attemptsLeft !== null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "4px 10px", marginTop: 10 }}>
            <Clock size={12} color="#f5a623" />
            <span style={{ color: "#f5a623", fontSize: 12, fontWeight: 600 }}>{attemptsLeft} tentativa{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Erro global */}
      {uploadErr && (
        <div style={{ width: "100%", maxWidth: 460, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{uploadErr}</p>
        </div>
      )}

      {/* Selfie */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Camera size={16} color="#f5a623" />
          <h2 style={S.h2}>Selfie</h2>
          {kyc.selfie && <CheckCircle size={15} color="#22c55e" style={{ marginLeft: "auto" }} />}
        </div>
        <p style={S.sub}>Câmara frontal, rosto bem iluminado, sem óculos.</p>
        <input ref={selfieRef} type="file" accept="image/*" capture="user" style={{ display: "none" }}
          onChange={e => handleFile(e, "selfie", "Selfie")} />
        <div style={S.photoBox}>
          {uploading === "Selfie" ? (
            <Loader2 size={28} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
          ) : kyc.selfie ? (
            <>
              <img src={kyc.selfie} alt="selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={S.tick}><CheckCircle size={14} color="#fff" /></div>
            </>
          ) : (
            <User size={40} color="#1e2d50" />
          )}
        </div>
        <button style={S.btnGold} onClick={() => { setUploadErr(""); selfieRef.current?.click(); }}>
          <Camera size={16} /> {kyc.selfie ? "Tirar outra selfie" : "Tirar Selfie"}
        </button>
      </div>

      {/* BI Frente */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <CreditCard size={16} color="#f5a623" />
          <h2 style={S.h2}>B.I. — Frente</h2>
          {kyc.biFront && <CheckCircle size={15} color="#22c55e" style={{ marginLeft: "auto" }} />}
        </div>
        <p style={S.sub}>Câmara traseira, B.I. plano, sem reflexos.</p>
        <input ref={biFrontRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => handleFile(e, "biFront", "BI Frente")} />
        <div style={{ ...S.photoBox, aspectRatio: "16/10" }}>
          {uploading === "BI Frente" ? (
            <Loader2 size={28} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
          ) : kyc.biFront ? (
            <>
              <img src={kyc.biFront} alt="bi frente" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={S.tick}><CheckCircle size={14} color="#fff" /></div>
            </>
          ) : (
            <CreditCard size={40} color="#1e2d50" />
          )}
        </div>
        <button style={S.btnGold} onClick={() => { setUploadErr(""); biFrontRef.current?.click(); }}>
          <Camera size={16} /> {kyc.biFront ? "Fotografar outra vez" : "Fotografar Frente"}
        </button>
      </div>

      {/* BI Verso */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <CreditCard size={16} color="#f5a623" />
          <h2 style={S.h2}>B.I. — Verso</h2>
          {kyc.biBack && <CheckCircle size={15} color="#22c55e" style={{ marginLeft: "auto" }} />}
        </div>
        <p style={S.sub}>Vira o B.I. e fotografa o verso.</p>
        <input ref={biBackRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => handleFile(e, "biBack", "BI Verso")} />
        <div style={{ ...S.photoBox, aspectRatio: "16/10" }}>
          {uploading === "BI Verso" ? (
            <Loader2 size={28} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
          ) : kyc.biBack ? (
            <>
              <img src={kyc.biBack} alt="bi verso" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={S.tick}><CheckCircle size={14} color="#fff" /></div>
            </>
          ) : (
            <CreditCard size={40} color="#1e2d50" />
          )}
        </div>
        <button style={S.btnGold} onClick={() => { setUploadErr(""); biBackRef.current?.click(); }}>
          <Camera size={16} /> {kyc.biBack ? "Fotografar outra vez" : "Fotografar Verso"}
        </button>
      </div>

      {/* Enviar */}
      <div style={{ width: "100%", maxWidth: 460 }}>
        {!allUploaded && (
          <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", marginBottom: 10 }}>
            Faltam {[!kyc.selfie && "selfie", !kyc.biFront && "B.I. frente", !kyc.biBack && "B.I. verso"].filter(Boolean).join(", ")}
          </p>
        )}
        <button
          style={{ ...S.btnGreen, opacity: (!allUploaded || submitting) ? 0.5 : 1, cursor: (!allUploaded || submitting) ? "not-allowed" as const : "pointer" as const }}
          onClick={submit}
          disabled={!allUploaded || submitting}
        >
          {submitting
            ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> A enviar...</>
            : <><ArrowRight size={16} /> Enviar para Análise</>}
        </button>
        <button style={S.btnOut} onClick={() => { setKyc({ selfie: "", biFront: "", biBack: "" }); setUploadErr(""); }}>
          <RotateCcw size={14} /> Recomeçar
        </button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
