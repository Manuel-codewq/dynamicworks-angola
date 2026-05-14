"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CreditCard, Loader2, ScanFace, ShieldCheck,
  CheckCircle, RotateCcw, Lock, Clock,
  AlertTriangle, ArrowRight, Eye, RotateCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type KYCView = "intro" | "loading_mp" | "liveness" | "bi_front" | "bi_back" | "review" | "blocked";
type LivenessStep = "frontal" | "blink" | "turn_right" | "done";

interface KYCData {
  faceFront: string;
  biFront: string;
  biBack: string;
  livenessScore: number;
}

interface FaceLandmark { x: number; y: number; z: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dist(a: FaceLandmark, b: FaceLandmark) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Eye Aspect Ratio usando landmarks MediaPipe Face Mesh
// Olho esquerdo (da câmara): 33=outer, 133=inner, 159=top, 145=bottom
// Olho direito (da câmara): 362=outer, 263=inner, 386=top, 374=bottom
function getEAR(lm: FaceLandmark[]): number {
  const leftV  = dist(lm[159], lm[145]);
  const leftH  = dist(lm[33],  lm[133]);
  const rightV = dist(lm[386], lm[374]);
  const rightH = dist(lm[362], lm[263]);
  const earL = leftH  > 0 ? leftV  / leftH  : 1;
  const earR = rightH > 0 ? rightV / rightH : 1;
  return (earL + earR) / 2;
}

// Yaw: diferença horizontal nariz (4) vs centro das orelhas (234=left, 454=right)
function getYaw(lm: FaceLandmark[]): number {
  const noseTipX   = lm[4].x;
  const faceCenterX = (lm[234].x + lm[454].x) / 2;
  return noseTipX - faceCenterX;
}

// Comprime imagem para JPEG base64
function compressImage(src: string, maxW = 1200, q = 0.85): Promise<string> {
  return new Promise((res, rej) => {
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
    img.src = src;
  });
}

async function uploadToCloud(b64: string): Promise<string> {
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: b64, folder: "kyc" }),
  });
  if (!r.ok) throw new Error("Falha no upload");
  return (await r.json()).url as string;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function KYCPage() {
  const router = useRouter();
  const [view, setView]         = useState<KYCView>("intro");
  const [attemptsLeft, setAL]   = useState(4);
  const [blockedUntil, setBU]   = useState<Date | null>(null);
  const [countdown, setCD]      = useState("");
  const [livStep, setLivStep]   = useState<LivenessStep>("frontal");
  const [livMsg, setLivMsg]     = useState("Posicione o rosto no círculo");
  const [livScore, setLivScore] = useState(0);
  const [faceOk, setFaceOk]     = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [processing, setProc]   = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [kycData, setKyc]       = useState<KYCData>({ faceFront: "", biFront: "", biBack: "", livenessScore: 0 });

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const faceMeshRef   = useRef<any>(null);
  const rafRef        = useRef<number>(0);
  const livStepRef    = useRef<LivenessStep>("frontal");
  const earHistRef    = useRef<number[]>([]);
  const blinkCoolRef  = useRef(0);
  const stableRef     = useRef(0);
  const capturedRef   = useRef(false);
  const biFrontRef    = useRef<HTMLInputElement>(null);
  const biBackRef     = useRef<HTMLInputElement>(null);

  // Sync ref com state para usar dentro do RAF
  useEffect(() => { livStepRef.current = livStep; }, [livStep]);

  // ─── Fetch status inicial ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/profile/kyc").then(r => r.json()).then(d => {
      if (d.kycBlockedUntil) {
        const u = new Date(d.kycBlockedUntil);
        if (u > new Date()) { setBU(u); setView("blocked"); return; }
      }
      setAL(4 - (d.kycAttempts || 0));
    }).catch(() => {});
  }, []);

  // ─── Countdown bloqueado ──────────────────────────────────────────────────
  useEffect(() => {
    if (!blockedUntil) return;
    const id = setInterval(() => {
      const diff = blockedUntil.getTime() - Date.now();
      if (diff <= 0) { setBU(null); setView("intro"); clearInterval(id); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCD(`${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  // ─── Parar câmara ────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (faceMeshRef.current) { faceMeshRef.current.close?.(); faceMeshRef.current = null; }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── Tirar foto do canvas (espelhada) ────────────────────────────────────
  const captureFrame = useCallback((): string => {
    const video = videoRef.current!;
    const c = document.createElement("canvas");
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    return c.toDataURL("image/jpeg", 0.9);
  }, []);

  // ─── Loop de deteção facial ──────────────────────────────────────────────
  const detectionLoop = useCallback(() => {
    const fm   = faceMeshRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!fm || !video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    let results: any;
    try { results = fm.process(video); } catch { rafRef.current = requestAnimationFrame(detectionLoop); return; }

    // Desenhar overlay no canvas (transparente — video fica por baixo)
    canvas.width  = video.videoWidth  || canvas.offsetWidth;
    canvas.height = video.videoHeight || canvas.offsetHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lm: FaceLandmark[] | undefined = results?.multiFaceLandmarks?.[0];
    const step = livStepRef.current;

    if (!lm) {
      setFaceOk(false);
      stableRef.current = 0;
      setLivMsg("Nenhum rosto detetado. Posicione-se em frente à câmara.");
      // Desenhar ellipse cinza
      const cx2 = canvas.width / 2, cy2 = canvas.height / 2;
      const rx2 = canvas.width * 0.22, ry2 = canvas.height * 0.33;
      ctx.beginPath(); ctx.ellipse(cx2, cy2, rx2, ry2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 3; ctx.stroke();
      rafRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    setFaceOk(true);
    const ear = getEAR(lm);
    const yaw = getYaw(lm);

    // Desenhar overlay de guia
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const rx = canvas.width * 0.22, ry = canvas.height * 0.33;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = step === "done" ? "#22c55e" : "#f5a623";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lógica por passo
    if (step === "frontal") {
      const centered = Math.abs(yaw) < 0.04;
      if (centered) {
        stableRef.current++;
        setLivMsg(`Fique imóvel... ${Math.min(100, Math.round(stableRef.current / 0.6))}%`);
        if (stableRef.current > 60 && !capturedRef.current) {
          capturedRef.current = true;
          const frame = captureFrame();
          setKyc(p => ({ ...p, faceFront: frame }));
          setLivScore(30);
          setLivStep("blink");
          stableRef.current = 0;
          capturedRef.current = false;
          setLivMsg("Agora pisca os olhos!");
        }
      } else {
        stableRef.current = 0;
        setLivMsg("Centre o rosto no círculo");
      }
    }

    if (step === "blink") {
      earHistRef.current.push(ear);
      if (earHistRef.current.length > 5) earHistRef.current.shift();

      const now = Date.now();
      if (now < blinkCoolRef.current) {
        setLivMsg("Pisca os olhos! ✓ Detetado — aguarda...");
      } else {
        const avg = earHistRef.current.reduce((a, b) => a + b, 0) / earHistRef.current.length;
        if (avg < 0.18 && earHistRef.current.length >= 3) {
          blinkCoolRef.current = now + 1500;
          setLivScore(65);
          setLivStep("turn_right");
          setLivMsg("Ótimo! Agora vira o rosto para a DIREITA");
        } else {
          setLivMsg(`Pisca os olhos! (EAR: ${ear.toFixed(2)})`);
        }
      }
    }

    if (step === "turn_right") {
      // Yaw > 0 = nariz para a direita da câmara = utilizador vira à esquerda
      // Como o vídeo está espelhado para o user: user vira DIREITA = yaw negativo no frame real
      const turned = yaw < -0.06;
      if (turned) {
        stableRef.current++;
        setLivMsg(`Mantém... ${Math.min(100, Math.round(stableRef.current / 0.2))}%`);
        if (stableRef.current > 20) {
          setLivScore(100);
          setLivStep("done");
          setLivMsg("✓ Verificação concluída!");
          stableRef.current = 0;
          setTimeout(() => {
            stopCamera();
            setView("bi_front");
            setTimeout(() => biFrontRef.current?.click(), 400);
          }, 1200);
        }
      } else {
        stableRef.current = 0;
        setLivMsg("Vira o rosto para a DIREITA (yaw " + yaw.toFixed(2) + ")");
      }
    }

    rafRef.current = requestAnimationFrame(detectionLoop);
  }, [captureFrame, stopCamera]);

  // ─── Iniciar liveness ────────────────────────────────────────────────────
  const startLiveness = useCallback(async () => {
    setView("loading_mp");
    setLivStep("frontal");
    livStepRef.current = "frontal";
    stableRef.current = 0;
    capturedRef.current = false;
    earHistRef.current = [];
    setLivScore(0);
    setFaceOk(false);

    // Carregar MediaPipe Face Mesh via CDN
    if (!(window as any).FaceMesh) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js";
        s.crossOrigin = "anonymous";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Falha ao carregar MediaPipe"));
        document.head.appendChild(s);
      });
    }

    const fm = new (window as any).FaceMesh({
      locateFile: (f: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    fm.initialize().then(() => {}).catch(() => {});
    faceMeshRef.current = fm;

    // Câmara
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch {
      alert("Não foi possível aceder à câmara. Verifique as permissões.");
      setView("intro");
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setView("liveness");
    setLivMsg("A inicializar deteção facial...");
    rafRef.current = requestAnimationFrame(detectionLoop);
  }, [detectionLoop]);

  // ─── Captura BI (ficheiro) ────────────────────────────────────────────────
  const handleBI = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "biFront" | "biBack",
    nextView: KYCView,
    nextClick?: () => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    setProc("A guardar imagem...");
    setUploadErr("");
    try {
      const reader = new FileReader();
      const b64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(b64, 1400);
      const url = await uploadToCloud(compressed);
      setKyc(p => ({ ...p, [field]: url }));
      setProc("");
      setView(nextView);
      if (nextClick) setTimeout(nextClick, 300);
    } catch {
      setProc("");
      setUploadErr("Erro ao enviar a imagem. Verifica a ligação e tenta novamente.");
    }
  };

  // ─── Submeter KYC ────────────────────────────────────────────────────────
  const submitKYC = async () => {
    setSubmitting(true);
    try {
      // Upload selfie (capturada do canvas — ainda é base64)
      let faceFrontUrl = kycData.faceFront;
      if (faceFrontUrl.startsWith("data:")) {
        setProc("A fazer upload da selfie...");
        faceFrontUrl = await uploadToCloud(faceFrontUrl);
        setProc("");
      }

      const res = await fetch("/api/profile/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceFront: faceFrontUrl,
          faceRight: faceFrontUrl,
          faceLeft:  faceFrontUrl,
          biFront:   kycData.biFront,
          biBack:    kycData.biBack,
          livenessScore: kycData.livenessScore,
        }),
      });
      const d = res.headers.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (res.ok) {
        if (d.blockedUntil) { setBU(new Date(d.blockedUntil)); setView("blocked"); }
        else { setSubmitOk(true); setTimeout(() => router.push("/profile"), 2000); }
      } else if (res.status === 429 && d.blockedUntil) {
        setBU(new Date(d.blockedUntil)); setView("blocked");
      } else {
        alert(d.error || `Erro ${res.status}. Tenta novamente.`);
      }
    } catch {
      alert("Erro de rede. Verifica a ligação e tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Reiniciar ────────────────────────────────────────────────────────────
  const restart = () => {
    stopCamera();
    setKyc({ faceFront: "", biFront: "", biBack: "", livenessScore: 0 });
    setUploadErr("");
    setSubmitOk(false);
    setView("intro");
  };

  // Sincronizar livenessScore no kycData
  useEffect(() => {
    setKyc(p => ({ ...p, livenessScore: livScore }));
  }, [livScore]);

  // ─── Estilos ─────────────────────────────────────────────────────────────
  const S = {
    page:    { minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "0 16px 60px" },
    wrap:    { width: "100%", maxWidth: 460 },
    topbar:  { width: "100%", maxWidth: 460, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 20px" },
    logo:    { display: "flex", alignItems: "center", gap: 8 },
    logoBox: { width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
    back:    { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer" as const },
    card:    { background: "#111827", border: "1px solid #1e2d50", borderRadius: 18, padding: "28px 24px", width: "100%" },
    h1:      { color: "#fff", fontSize: 20, fontWeight: 800, margin: "0 0 8px" },
    sub:     { color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" },
    btnGold: { width: "100%", background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10 },
    btnGreen:{ width: "100%", background: "#22c55e", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10 },
    btnOut:  { width: "100%", background: "transparent", color: "#94a3b8", border: "1px solid #1e2d50", borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: "pointer" as const, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 10 },
    errBox:  { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start" as const, gap: 10 },
    docPrev: { width: "100%", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", marginBottom: 16, background: "#0a0f1e", border: "1px solid #1e2d50", display: "flex", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "column" as const, gap: 8 },
  };

  const Topbar = ({ onBack }: { onBack?: () => void }) => (
    <div style={S.topbar}>
      <div style={S.logo}>
        <div style={S.logoBox}><ScanFace size={18} color="#0a0f1e" /></div>
        <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
      </div>
      {onBack && <button style={S.back} onClick={onBack}>Voltar</button>}
    </div>
  );

  // ─── BLOCKED ─────────────────────────────────────────────────────────────
  if (view === "blocked") return (
    <div style={S.page}>
      <Topbar />
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Lock size={28} color="#ef4444" />
          </div>
          <h2 style={{ ...S.h1, textAlign: "center", color: "#ef4444" }}>Verificação Bloqueada</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Atingiste o limite de tentativas.</p>
          <div style={{ textAlign: "center", fontSize: 32, fontWeight: 900, color: "#f5a623", letterSpacing: 2, margin: "16px 0" }}>{countdown || "..."}</div>
          <button style={S.btnOut} onClick={() => router.push("/profile")}>Voltar ao Perfil</button>
        </div>
      </div>
    </div>
  );

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (view === "intro") return (
    <div style={S.page}>
      <Topbar />
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <ScanFace size={30} color="#f5a623" />
          </div>
          <h2 style={{ ...S.h1, textAlign: "center" }}>Verificação de Identidade</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Sistema de liveness detection com IA. Segue os 3 passos abaixo.</p>

          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "5px 12px", width: "fit-content", margin: "0 auto 20px" }}>
            <Clock size={12} color="#f5a623" />
            <span style={{ color: "#f5a623", fontSize: 12, fontWeight: 600 }}>{attemptsLeft} tentativa{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""}</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            {[
              { icon: <ScanFace size={16} color="#f5a623" />, label: "Liveness Detection",   desc: "Fique imóvel → pisca olhos → vira à direita" },
              { icon: <CreditCard size={16} color="#f5a623" />, label: "B.I. — Frente e Verso", desc: "Foto clara do Bilhete de Identidade" },
              { icon: <CheckCircle size={16} color="#f5a623" />, label: "Confirmar e enviar", desc: "A equipa analisa em até 24h" },
            ].map(({ icon, label, desc }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "11px 14px", marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", color: "#f5a623", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                {icon}
                <div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{label}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button style={S.btnGold} onClick={startLiveness}>
            <Camera size={17} /> Começar Verificação
          </button>
        </div>
      </div>
    </div>
  );

  // ─── LOADING MEDIAPIPE ────────────────────────────────────────────────────
  if (view === "loading_mp") return (
    <div style={S.page}>
      <Topbar />
      <div style={S.wrap}>
        <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
          <Loader2 size={48} color="#f5a623" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }} />
          <h2 style={S.h1}>A carregar sistema de IA...</h2>
          <p style={{ ...S.sub, margin: 0 }}>Aguarda enquanto iniciamos a deteção facial.</p>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    </div>
  );

  // ─── LIVENESS ────────────────────────────────────────────────────────────
  if (view === "liveness") {
    const stepInfo: Record<LivenessStep, { icon: React.ReactNode; label: string; color: string }> = {
      frontal:    { icon: <ScanFace size={16} />,  label: "Fique imóvel",     color: "#f5a623" },
      blink:      { icon: <Eye size={16} />,        label: "Pisca os olhos",   color: "#f5a623" },
      turn_right: { icon: <RotateCw size={16} />,   label: "Vira à direita",   color: "#f5a623" },
      done:       { icon: <CheckCircle size={16} />, label: "Concluído!",      color: "#22c55e" },
    };
    const steps: LivenessStep[] = ["frontal", "blink", "turn_right", "done"];
    const curIdx = steps.indexOf(livStep);

    return (
      <div style={S.page}>
        <Topbar onBack={() => { stopCamera(); setView("intro"); }} />
        <div style={S.wrap}>
          {/* Steps indicator */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            {steps.slice(0, 3).map((s, i) => {
              const done = i < curIdx;
              const active = i === curIdx;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: done ? "#22c55e" : active ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${done ? "#22c55e" : active ? "#f5a623" : "#1e2d50"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: done ? "#fff" : active ? "#f5a623" : "#4b5563", fontSize: 12, fontWeight: 700,
                  }}>
                    {done ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  {i < 2 && <div style={{ width: 24, height: 2, background: done ? "#22c55e" : "#1e2d50" }} />}
                </div>
              );
            })}
          </div>

          {/* Camera */}
          <div style={{ position: "relative", width: "100%", borderRadius: 18, overflow: "hidden", background: "#000", border: `2px solid ${faceOk ? "#f5a623" : "#1e2d50"}`, marginBottom: 16, transition: "border-color .3s" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: 320, objectFit: "cover", display: "block", transform: "scaleX(-1)" }} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

            {/* Score badge */}
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.7)", borderRadius: 20, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={13} color={livScore >= 65 ? "#22c55e" : "#f5a623"} />
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{livScore}%</span>
            </div>

            {/* Face indicator */}
            {!faceOk && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
                <span style={{ color: "#f5a623", fontWeight: 700, fontSize: 14 }}>Sem rosto detetado</span>
              </div>
            )}
          </div>

          {/* Instruction card */}
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ color: stepInfo[livStep].color }}>{stepInfo[livStep].icon}</div>
              <span style={{ color: stepInfo[livStep].color, fontWeight: 700, fontSize: 15 }}>{stepInfo[livStep].label}</span>
            </div>
            <p style={{ color: "#fff", fontSize: 14, margin: 0, lineHeight: 1.5 }}>{livMsg}</p>

            {/* Progress bar */}
            <div style={{ marginTop: 14, background: "#0a0f1e", borderRadius: 8, height: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${livScore}%`, background: livScore >= 100 ? "#22c55e" : "#f5a623", borderRadius: 8, transition: "width .4s" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── BI FRENTE ────────────────────────────────────────────────────────────
  if (view === "bi_front") return (
    <div style={S.page}>
      <Topbar onBack={() => setView("intro")} />
      <input ref={biFrontRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => handleBI(e, "biFront", "bi_back", () => biBackRef.current?.click())} />
      <div style={S.wrap}>
        <div style={S.card}>
          <h2 style={S.h1}>B.I. Frente — Passo 2 de 3</h2>
          <p style={S.sub}>Coloca o B.I. numa superfície plana e fotografa a frente.</p>

          {processing ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Loader2 size={36} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 12 }}>{processing}</p>
              <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {uploadErr && (
                <div style={S.errBox}>
                  <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{uploadErr}</p>
                </div>
              )}
              <div style={S.docPrev}>
                {kycData.biFront
                  ? <img src={kycData.biFront} alt="bi frente" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <CreditCard size={48} color="#1e2d50" />}
              </div>
              <button style={S.btnGold} onClick={() => { setUploadErr(""); biFrontRef.current?.click(); }}>
                <Camera size={17} /> {kycData.biFront ? "Fotografar outra vez" : "Fotografar Frente"}
              </button>
              {kycData.biFront && (
                <button style={S.btnGreen} onClick={() => { setView("bi_back"); setTimeout(() => biBackRef.current?.click(), 200); }}>
                  <ArrowRight size={16} /> Continuar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ─── BI VERSO ─────────────────────────────────────────────────────────────
  if (view === "bi_back") return (
    <div style={S.page}>
      <Topbar onBack={() => setView("bi_front")} />
      <input ref={biBackRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => handleBI(e, "biBack", "review")} />
      <div style={S.wrap}>
        <div style={S.card}>
          <h2 style={S.h1}>B.I. Verso — Passo 2 de 3</h2>
          <p style={S.sub}>Vira o B.I. e fotografa o verso.</p>

          {processing ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Loader2 size={36} color="#f5a623" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 12 }}>{processing}</p>
            </div>
          ) : (
            <>
              {uploadErr && (
                <div style={S.errBox}>
                  <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{uploadErr}</p>
                </div>
              )}
              <div style={S.docPrev}>
                {kycData.biBack
                  ? <img src={kycData.biBack} alt="bi verso" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <CreditCard size={48} color="#1e2d50" />}
              </div>
              <button style={S.btnGold} onClick={() => { setUploadErr(""); biBackRef.current?.click(); }}>
                <Camera size={17} /> {kycData.biBack ? "Fotografar outra vez" : "Fotografar Verso"}
              </button>
              {kycData.biBack && (
                <button style={S.btnGreen} onClick={() => setView("review")}>
                  <ArrowRight size={16} /> Continuar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ─── REVIEW ───────────────────────────────────────────────────────────────
  if (view === "review") return (
    <div style={S.page}>
      <Topbar onBack={() => setView("bi_back")} />
      <div style={S.wrap}>
        <div style={S.card}>
          <h2 style={{ ...S.h1, textAlign: "center" }}>Confirmar — Passo 3 de 3</h2>
          <p style={{ ...S.sub, textAlign: "center" }}>Verifica se as imagens estão nítidas.</p>

          {/* Liveness score */}
          <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={18} color="#22c55e" />
            <div>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Liveness: {kycData.livenessScore}%</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Verificação facial concluída</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Selfie",       url: kycData.faceFront, mirror: kycData.faceFront.startsWith("data:") },
              { label: "B.I. Frente",  url: kycData.biFront,   mirror: false },
              { label: "B.I. Verso",   url: kycData.biBack,    mirror: false },
            ].map(({ label, url, mirror }) => (
              <div key={label} style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, padding: "6px 10px 4px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{label}</div>
                <img src={url} alt={label} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", transform: mirror ? "scaleX(-1)" : "none" }} />
              </div>
            ))}
          </div>

          {processing && (
            <div style={{ textAlign: "center", padding: "12px 0", color: "#94a3b8", fontSize: 14 }}>
              <Loader2 size={20} color="#f5a623" style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
              {processing}
            </div>
          )}

          {submitOk ? (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: 20, textAlign: "center" as const }}>
              <CheckCircle size={32} color="#22c55e" style={{ marginBottom: 10 }} />
              <p style={{ color: "#22c55e", fontWeight: 700, margin: 0, fontSize: 15 }}>Enviado! A redirecionar...</p>
            </div>
          ) : (
            <>
              <button
                style={{ ...S.btnGreen, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? "not-allowed" as const : "pointer" as const }}
                onClick={submitKYC} disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> A enviar...</>
                  : <><ArrowRight size={16} /> Enviar para Análise</>}
              </button>
              <button style={S.btnOut} onClick={restart}>
                <RotateCcw size={15} /> Repetir desde o início
              </button>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
            <AlertTriangle size={13} color="#64748b" />
            <span style={{ color: "#64748b", fontSize: 12 }}>A equipa analisa em até 24 horas úteis</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return null;
}
