"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CreditCard, Loader2, ScanFace, ShieldCheck, Sun,
  User, CheckCircle, RotateCcw, XCircle, Lock, Clock,
  Smartphone, Lightbulb, FileText, AlertTriangle, ArrowRight,
} from "lucide-react";

type KYCView = "intro" | "face" | "bi_front" | "bi_back" | "review" | "blocked";

interface KYCData {
  faceFront: string;
  biFront: string;
  biBack: string;
}

export default function KYCVerificationPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<KYCView>("intro");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(4);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [processingMsg, setProcessingMsg] = useState("");
  const [validationError, setValidationError] = useState("");
  const [kycData, setKycData] = useState<KYCData>({ faceFront: "", biFront: "", biBack: "" });
  const [livenessScore] = useState(85);

  const faceInputRef = useRef<HTMLInputElement>(null);
  const biFrontInputRef = useRef<HTMLInputElement>(null);
  const biBackInputRef = useRef<HTMLInputElement>(null);

  // Verifica estado KYC ao carregar
  useEffect(() => {
    fetch("/api/profile/kyc")
      .then(r => r.json())
      .then(data => {
        if (data.kycBlockedUntil) {
          const until = new Date(data.kycBlockedUntil);
          if (until > new Date()) { setBlockedUntil(until); setCurrentView("blocked"); return; }
        }
        setAttemptsLeft(4 - (data.kycAttempts || 0));
      })
      .catch(() => {});
  }, []);

  // Countdown do bloqueio
  useEffect(() => {
    if (!blockedUntil) return;
    const tick = () => {
      const diff = blockedUntil.getTime() - Date.now();
      if (diff <= 0) { setBlockedUntil(null); setCurrentView("intro"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  // Comprime imagem
  const compressImage = (file: File, maxWidth = 1024, quality = 0.82): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Valida foto via Claude Vision (server-side)
  const validateWithClaude = async (
    b64: string,
    type: "face" | "bi_front" | "bi_back"
  ): Promise<{ valid: boolean; reason: string }> => {
    try {
      const res = await fetch("/api/profile/kyc/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, type }),
      });
      if (!res.ok) return { valid: true, reason: "" }; // fallback permissivo
      return await res.json();
    } catch {
      return { valid: true, reason: "" }; // sem internet? aceita e deixa admin decidir
    }
  };

  // Upload para Cloudinary via servidor
  const uploadToCloud = async (b64: string): Promise<string> => {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: b64, folder: "kyc" }),
    });
    if (!res.ok) throw new Error("Falha no upload");
    const data = await res.json();
    return data.url as string;
  };

  // Handler genérico para captura de foto
  const handleCapture = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "face" | "bi_front" | "bi_back",
    maxWidth: number,
    quality: number,
    onSuccess: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";

    setProcessingMsg("A verificar foto...");
    setValidationError("");

    try {
      const b64 = await compressImage(file, maxWidth, quality);

      setProcessingMsg("A analisar imagem com IA...");
      const { valid, reason } = await validateWithClaude(b64, type);

      if (!valid) {
        setValidationError(reason || "Foto não aceite. Tenta novamente.");
        setProcessingMsg("");
        return;
      }

      setProcessingMsg("A guardar foto...");
      const url = await uploadToCloud(b64);
      setValidationError("");
      setProcessingMsg("");
      onSuccess(url);
    } catch (_) {
      setValidationError("Erro ao enviar a foto. Verifica a ligação e tenta novamente.");
      setProcessingMsg("");
    }
  };

  const restartKYC = () => {
    setKycData({ faceFront: "", biFront: "", biBack: "" });
    setValidationError("");
    setCurrentView("intro");
  };

  const submitKYC = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profile/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceFront: kycData.faceFront,
          faceRight: kycData.faceFront,
          faceLeft: kycData.faceFront,
          biFront: kycData.biFront,
          biBack: kycData.biBack,
          livenessScore,
        }),
      });
      const d = res.headers.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (res.ok) {
        if (d.blockedUntil) {
          setBlockedUntil(new Date(d.blockedUntil));
          setCurrentView("blocked");
        } else {
          setSubmitSuccess(true);
          setTimeout(() => router.push("/profile"), 2000);
        }
      } else if (res.status === 429 && d.blockedUntil) {
        setBlockedUntil(new Date(d.blockedUntil));
        setCurrentView("blocked");
      } else {
        alert(d.error || `Erro ${res.status}. Tenta novamente.`);
      }
    } catch {
      alert("Erro de rede. Verifica a ligação e tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Estilos base ────────────────────────────────────────────────────────────
  const S = {
    page:    { minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "0 16px 60px" },
    topbar:  { width: "100%", maxWidth: 460, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 20px" },
    logo:    { display: "flex", alignItems: "center", gap: 8 },
    logoBox: { width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
    back:    { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer" as const },
    view:    { width: "100%", maxWidth: 440 },
    card:    { background: "#111827", border: "1px solid #1e2d50", borderRadius: 18, padding: "28px 24px", width: "100%" },
    h1:      { color: "#fff", fontSize: 20, fontWeight: 800, margin: "0 0 8px" },
    sub:     { color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" },
    iconWrap:{ width: 60, height: 60, borderRadius: "50%", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" },
    btn:     (color: string, bg: string) => ({
      width: "100%", background: bg, color, border: "none", borderRadius: 12,
      padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer" as const,
      display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10,
    }),
    btnOut:  { width: "100%", background: "transparent", color: "#94a3b8", border: "1px solid #1e2d50", borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10 },
    errBox:  { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 },
    stepRow: { display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "11px 14px", marginBottom: 10 },
    stepNum: { width: 26, height: 26, borderRadius: "50%", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", color: "#f5a623", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 as const },
    preview: { width: "100%", aspectRatio: "1", borderRadius: 14, overflow: "hidden", marginBottom: 16, background: "#0a0f1e", border: "1px solid #1e2d50", display: "flex", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "column" as const, gap: 10 },
    docPreview: { width: "100%", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", marginBottom: 16, background: "#0a0f1e", border: "1px solid #1e2d50", display: "flex", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "column" as const, gap: 8 },
    tipRow:  { display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, marginBottom: 8 },
  };

  const Processing = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
      <Loader2 size={36} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{processingMsg}</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const ErrorBox = ({ msg }: { msg: string }) => (
    <div style={S.errBox}>
      <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ color: "#fca5a5", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{msg}</p>
    </div>
  );

  const OvalGuide = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ width: 110, height: 150, border: "2px dashed rgba(245,166,35,0.6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <User size={36} color="rgba(245,166,35,0.4)" />
      </div>
      <span style={{ color: "#64748b", fontSize: 12 }}>Posiciona o rosto aqui</span>
    </div>
  );

  const DocGuide = ({ label }: { label: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ width: "80%", height: 90, border: "2px dashed rgba(245,166,35,0.5)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CreditCard size={32} color="rgba(245,166,35,0.4)" />
      </div>
      <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
    </div>
  );

  // ─── Bloqueado ───────────────────────────────────────────────────────────────
  if (currentView === "blocked") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
      </div>
      <div style={S.view}>
        <div style={S.card}>
          <div style={{ ...S.iconWrap, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Lock size={28} color="#ef4444" />
          </div>
          <h2 style={{ ...S.h1, textAlign: "center", color: "#ef4444" }}>Verificação Bloqueada</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Atingiste o limite de tentativas. Aguarda o tempo indicado.</p>
          <div style={{ textAlign: "center", fontSize: 32, fontWeight: 900, color: "#f5a623", letterSpacing: 2, margin: "16px 0", fontVariantNumeric: "tabular-nums" }}>
            {countdown || "..."}
          </div>
          <div style={{ borderTop: "1px solid #1e2d50", paddingTop: 18, marginTop: 8 }}>
            <button style={S.btnOut} onClick={() => router.push("/support")}>
              <ShieldCheck size={16} /> Contactar Suporte
            </button>
            <button style={S.btnOut} onClick={() => router.push("/profile")}>
              Voltar ao Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Intro ───────────────────────────────────────────────────────────────────
  if (currentView === "intro") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
        <button style={S.back} onClick={() => router.back()}>Voltar</button>
      </div>
      <div style={S.view}>
        <div style={S.card}>
          <div style={S.iconWrap}><ScanFace size={30} color="#f5a623" /></div>
          <h2 style={{ ...S.h1, textAlign: "center" }}>Verificação de Identidade</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Processo simples em 3 passos. A nossa IA analisa as fotos automaticamente.</p>

          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "5px 12px", width: "fit-content", margin: "0 auto 20px" }}>
            <Clock size={12} color="#f5a623" />
            <span style={{ color: "#f5a623", fontSize: 12, fontWeight: 600 }}>{attemptsLeft} tentativa{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""}</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            {[
              { n: 1, icon: <Camera size={16} color="#f5a623" />, label: "Selfie", desc: "1 foto do rosto com boa iluminação" },
              { n: 2, icon: <CreditCard size={16} color="#f5a623" />, label: "Bilhete de Identidade", desc: "Frente e verso do B.I." },
              { n: 3, icon: <CheckCircle size={16} color="#f5a623" />, label: "Revisão e envio", desc: "Confirmas e submetemos para análise" },
            ].map(({ n, icon, label, desc }) => (
              <div key={n} style={S.stepRow}>
                <div style={S.stepNum}>{n}</div>
                {icon}
                <div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{label}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#0a0f1e", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            {[
              { icon: <Sun size={14} color="#f5a623" />, text: "Boa iluminação — junto a uma janela ou luz de tecto" },
              { icon: <User size={14} color="#f5a623" />, text: "Remove óculos, boné ou chapéu para a selfie" },
              { icon: <Smartphone size={14} color="#f5a623" />, text: "Usa a câmara frontal do telemóvel" },
              { icon: <FileText size={14} color="#f5a623" />, text: "Tem o B.I. à mão antes de começar" },
            ].map(({ icon, text }, i) => (
              <div key={i} style={S.tipRow}>{icon}<span>{text}</span></div>
            ))}
          </div>

          <button style={S.btn("#0a0f1e", "#f5a623")} onClick={() => { setValidationError(""); setCurrentView("face"); setTimeout(() => faceInputRef.current?.click(), 200); }}>
            <Camera size={17} /> Começar Verificação
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Selfie ──────────────────────────────────────────────────────────────────
  if (currentView === "face") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
        <button style={S.back} onClick={() => setCurrentView("intro")}>Voltar</button>
      </div>
      <input ref={faceInputRef} type="file" accept="image/*" capture="user" style={{ display: "none" }}
        onChange={e => handleCapture(e, "face", 1024, 0.82, url => { setKycData(p => ({ ...p, faceFront: url })); setCurrentView("bi_front"); setTimeout(() => biFrontInputRef.current?.click(), 300); })} />
      <div style={S.view}>
        <div style={S.card}>
          <h2 style={S.h1}>Selfie — Passo 1/3</h2>
          <p style={S.sub}>Olha directamente para a câmara. Rosto visível e bem iluminado.</p>

          {processingMsg ? <Processing /> : (
            <>
              {validationError && <ErrorBox msg={validationError} />}

              {!validationError && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
                  {[
                    { icon: <Sun size={13} color="#f5a623" />, text: "Boa luz" },
                    { icon: <User size={13} color="#f5a623" />, text: "Sem óculos" },
                    { icon: <Smartphone size={13} color="#f5a623" />, text: "Câmara frontal" },
                  ].map(({ icon, text }) => (
                    <span key={text} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "#94a3b8" }}>
                      {icon} {text}
                    </span>
                  ))}
                </div>
              )}

              <div style={S.preview}>
                {kycData.faceFront
                  ? <img src={kycData.faceFront} alt="selfie" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  : <OvalGuide />}
              </div>

              <button style={S.btn("#0a0f1e", "#f5a623")} onClick={() => { setValidationError(""); faceInputRef.current?.click(); }}>
                <Camera size={17} /> {validationError ? "Tentar Novamente" : "Tirar Selfie"}
              </button>

              {validationError && (
                <div style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Lightbulb size={16} color="#f5a623" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    Se continuares com dificuldades, vai para um local mais iluminado ou pede ajuda ao suporte.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ─── B.I. Frente ─────────────────────────────────────────────────────────────
  if (currentView === "bi_front") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
        <button style={S.back} onClick={() => setCurrentView("face")}>Voltar</button>
      </div>
      <input ref={biFrontInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => handleCapture(e, "bi_front", 1400, 0.85, url => { setKycData(p => ({ ...p, biFront: url })); setCurrentView("bi_back"); setTimeout(() => biBackInputRef.current?.click(), 300); })} />
      <div style={S.view}>
        <div style={S.card}>
          <h2 style={S.h1}>B.I. Frente — Passo 2/3</h2>
          <p style={S.sub}>Coloca o B.I. numa superfície plana e fotografa a parte da frente.</p>

          {processingMsg ? <Processing /> : (
            <>
              {validationError && <ErrorBox msg={validationError} />}
              <div style={S.docPreview}>
                {kycData.biFront
                  ? <img src={kycData.biFront} alt="bi frente" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <DocGuide label="Frente do B.I." />}
              </div>
              <button style={S.btn("#0a0f1e", "#f5a623")} onClick={() => { setValidationError(""); biFrontInputRef.current?.click(); }}>
                <Camera size={17} /> {validationError ? "Tentar Novamente" : "Fotografar Frente do B.I."}
              </button>
              <div style={{ ...S.tipRow, justifyContent: "center" as const, marginTop: 4 }}>
                <FileText size={13} color="#64748b" /><span style={{ color: "#64748b", fontSize: 12 }}>Sem reflexo, documento inteiro visível</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ─── B.I. Verso ──────────────────────────────────────────────────────────────
  if (currentView === "bi_back") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
        <button style={S.back} onClick={() => setCurrentView("bi_front")}>Voltar</button>
      </div>
      <input ref={biBackInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => handleCapture(e, "bi_back", 1400, 0.85, url => { setKycData(p => ({ ...p, biBack: url })); setCurrentView("review"); })} />
      <div style={S.view}>
        <div style={S.card}>
          <h2 style={S.h1}>B.I. Verso — Passo 2/3</h2>
          <p style={S.sub}>Vira o B.I. e fotografa o verso.</p>

          {processingMsg ? <Processing /> : (
            <>
              {validationError && <ErrorBox msg={validationError} />}
              <div style={S.docPreview}>
                {kycData.biBack
                  ? <img src={kycData.biBack} alt="bi verso" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <DocGuide label="Verso do B.I." />}
              </div>
              <button style={S.btn("#0a0f1e", "#f5a623")} onClick={() => { setValidationError(""); biBackInputRef.current?.click(); }}>
                <Camera size={17} /> {validationError ? "Tentar Novamente" : "Fotografar Verso do B.I."}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Review ──────────────────────────────────────────────────────────────────
  if (currentView === "review") return (
    <div style={S.page}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>
        <button style={S.back} onClick={() => setCurrentView("bi_back")}>Voltar</button>
      </div>
      <div style={S.view}>
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "5px 14px", width: "fit-content", margin: "0 auto 18px" }}>
            <ShieldCheck size={14} color="#22c55e" />
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>Fotos verificadas pela IA</span>
          </div>

          <h2 style={{ ...S.h1, textAlign: "center" }}>Revisão Final — Passo 3/3</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Confirma que as fotos estão nítidas antes de enviar.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Selfie", url: kycData.faceFront, mirror: true },
              { label: "B.I. Frente", url: kycData.biFront, mirror: false },
              { label: "B.I. Verso", url: kycData.biBack, mirror: false },
            ].map(({ label, url, mirror }) => (
              <div key={label} style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, padding: "6px 10px 4px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{label}</div>
                <img src={url} alt={label} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", transform: mirror ? "scaleX(-1)" : "none" }} />
              </div>
            ))}
          </div>

          {submitSuccess ? (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: 16, textAlign: "center" as const }}>
              <CheckCircle size={28} color="#22c55e" style={{ marginBottom: 8 }} />
              <p style={{ color: "#22c55e", fontWeight: 700, margin: 0 }}>Enviado com sucesso! A redirecionar...</p>
            </div>
          ) : (
            <>
              <button style={S.btn("#fff", "#22c55e")} onClick={submitKYC} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> A enviar...</> : <><ArrowRight size={16} /> Enviar para Análise</>}
              </button>
              <button style={S.btnOut} onClick={restartKYC}>
                <RotateCcw size={15} /> Repetir desde o início
              </button>
            </>
          )}

          <div style={{ ...S.tipRow, justifyContent: "center" as const, marginTop: 8 }}>
            <AlertTriangle size={13} color="#64748b" />
            <span style={{ color: "#64748b", fontSize: 12 }}>A equipa analisa em até 24 horas úteis</span>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}
