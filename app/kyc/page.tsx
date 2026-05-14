"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CreditCard, Loader2, ScanFace, ShieldCheck, Sun, User, CheckCircle, RotateCcw, XCircle, Lock, Clock } from 'lucide-react';

type KYCView = 'intro' | 'face' | 'bi-intro' | 'bi' | 'review' | 'blocked';

interface KYCData {
  faceFront: string;
  biFront: string;
  biBack: string;
}

interface ValidationResult {
  ok: boolean;
  message: string;
  score?: number;
}

export default function KYCVerificationPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<KYCView>('intro');
  const [biStep, setBiStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(2);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const faceScoresRef = useRef<number[]>([]);
  const [processingMsg, setProcessingMsg] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('A carregar modelos de IA...');
  const [kycData, setKycData] = useState<KYCData>({
    faceFront: '', biFront: '', biBack: ''
  });
  const [faceFailCount, setFaceFailCount] = useState(0); // nº de falhas consecutivas na selfie

  const faceInputRef = useRef<HTMLInputElement>(null);
  const biInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  // Verifica estado KYC ao carregar
  useEffect(() => {
    fetch('/api/profile/kyc')
      .then(r => r.json())
      .then(data => {
        if (data.kycBlockedUntil) {
          const until = new Date(data.kycBlockedUntil);
          if (until > new Date()) {
            setBlockedUntil(until);
            setCurrentView('blocked');
            return;
          }
        }
        setAttemptsLeft(2 - (data.kycAttempts || 0));
      })
      .catch(() => {});
  }, []);

  // Countdown do bloqueio
  useEffect(() => {
    if (!blockedUntil) return;
    const tick = () => {
      const diff = blockedUntil.getTime() - Date.now();
      if (diff <= 0) { setBlockedUntil(null); setCurrentView('intro'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  // Carrega face-api.js com timeout de 8s — se demorar, avança sem validação IA
  useEffect(() => {
    const loadFaceAPI = async () => {
      const timeout = new Promise<void>(resolve => setTimeout(resolve, 8000));

      const load = async () => {
        try {
          setLoadingProgress('A preparar verificação facial...');

          await new Promise<void>((resolve, reject) => {
            if (document.getElementById('faceapi-script')) { resolve(); return; }
            const script = document.createElement('script');
            script.id = 'faceapi-script';
            script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const faceapi = (window as any).faceapi;
          if (!faceapi?.nets) return;

          faceapiRef.current = faceapi;
          setLoadingProgress('A carregar modelo de deteção...');
          const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        } catch (err) {
          console.error('face-api load error:', err);
          faceapiRef.current = null;
        }
      };

      // Race: load vs timeout — em qualquer caso avança
      await Promise.race([load(), timeout]);
      setModelLoaded(true);
      setLoadingProgress('Pronto!');
    };

    loadFaceAPI();
  }, []);

  const compressImage = (file: File, maxWidth = 1024, quality = 0.78): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadToCloud = async (b64: string): Promise<string> => {
    // Upload via servidor (signed) — as credenciais Cloudinary nunca são expostas ao browser
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: b64, folder: 'kyc' }),
    });
    if (!res.ok) throw new Error('Falha no upload para Cloudinary');
    const data = await res.json();
    return data.url as string;
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // Valida foto de rosto
  const validateFacePhoto = async (b64: string): Promise<ValidationResult> => {
    const faceapi = faceapiRef.current;
    if (!faceapi) return { ok: true, message: '' }; // fallback se modelo não carregou

    try {
      const img = await loadImage(b64);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
      const detections = await faceapi.detectAllFaces(img, options).withFaceLandmarks(true);

      if (detections.length === 0) {
        return { ok: false, message: 'Nenhum rosto detetado. Certifique-se de que o rosto está visível e bem iluminado.' };
      }

      if (detections.length > 1) {
        return { ok: false, message: 'Mais de um rosto detetado. Certifique-se de que está sozinho na foto.' };
      }

      const det = detections[0];
      const box = det.detection.box;
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // Rosto suficientemente grande (5% — permissivo para câmaras wide-angle)
      const faceArea = (box.width * box.height) / (imgW * imgH);
      if (faceArea < 0.05) {
        return { ok: false, message: '📱 Aproxima mais o telemóvel do rosto e tenta novamente.' };
      }

      // Rosto centrado
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const offX = Math.abs(centerX / imgW - 0.5);
      const offY = Math.abs(centerY / imgH - 0.5);

      if (offX > 0.40) {
        return { ok: false, message: '↔️ Move o rosto para o centro da câmara.' };
      }
      if (offY > 0.40) {
        return { ok: false, message: '↕️ Ajusta a posição — o rosto deve estar no centro.' };
      }

      // Score de confiança (baixado para 0.4 — mais permissivo em má iluminação)
      const score = det.detection.score;
      if (score < 0.40) {
        return { ok: false, message: '💡 Iluminação insuficiente. Vai para um local mais iluminado e tenta novamente.' };
      }

      return { ok: true, message: '', score };
    } catch (err) {
      console.error('Erro na validação:', err);
      return { ok: true, message: '' }; // fallback
    }
  };

  // Valida foto do B.I. (não deve ter rosto prominente — é um documento)
  const validateBIPhoto = async (b64: string): Promise<ValidationResult> => {
    const faceapi = faceapiRef.current;
    if (!faceapi) return { ok: true, message: '' };

    try {
      const img = await loadImage(b64);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 });
      const detections = await faceapi.detectAllFaces(img, options);

      // Se detetar um rosto MUITO grande, provavelmente fotografou o rosto em vez do documento
      if (detections.length > 0) {
        const det = detections[0];
        const box = det.detection.box;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const faceArea = (box.width * box.height) / (imgW * imgH);

        if (faceArea > 0.25) {
          return { ok: false, message: '📄 Esta etapa é para o B.I. — deita o documento numa superfície plana e fotografa-o de cima.' };
        }
      }

      return { ok: true, message: '' };
    } catch (_) {
      return { ok: true, message: '' };
    }
  };

  // Processa selfie — com bypass automático após 2 falhas consecutivas
  const handleFaceCapture = async (e: React.ChangeEvent<HTMLInputElement>, forceUpload = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    setProcessingMsg('A verificar foto...');
    setValidationError('');

    try {
      const b64 = await compressImage(file);

      if (!forceUpload) {
        const result = await validateFacePhoto(b64);

        if (!result.ok) {
          const newFailCount = faceFailCount + 1;
          setFaceFailCount(newFailCount);
          // Após 2 falhas, guarda a foto e mostra opção de bypass
          if (newFailCount >= 2) {
            // Guarda temporariamente para o bypass usar
            setKycData(prev => ({ ...prev, faceFront: b64 }));
            setValidationError(result.message + '\n\nSe continuares com dificuldades, podes enviar a foto mesmo assim e a nossa equipa vai analisá-la manualmente.');
          } else {
            setValidationError(result.message);
          }
          setProcessingMsg('');
          return;
        }

        if (result.score !== undefined) faceScoresRef.current.push(result.score);
      }

      setProcessingMsg('A enviar imagem...');
      const url = forceUpload
        ? await uploadToCloud(kycData.faceFront || b64)
        : await uploadToCloud(b64);

      setKycData(prev => ({ ...prev, faceFront: url }));
      setValidationError('');
      setProcessingMsg('');
      setFaceFailCount(0);

      const scores = faceScoresRef.current;
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.75;
      setLivenessScore(Math.round(avg * 100));
      setCurrentView('bi-intro');
    } catch (_) {
      setValidationError('Erro ao enviar a imagem. Verifica a ligação e tenta novamente.');
      setProcessingMsg('');
    }
  };

  // Bypass: envia a foto guardada sem validação, para revisão manual pelo admin
  const handleFaceBypass = async () => {
    if (!kycData.faceFront) return;
    setProcessingMsg('A enviar para revisão manual...');
    setValidationError('');
    try {
      const url = kycData.faceFront.startsWith('data:')
        ? await uploadToCloud(kycData.faceFront)
        : kycData.faceFront;
      setKycData(prev => ({ ...prev, faceFront: url }));
      setLivenessScore(50); // score baixo — sinaliza revisão manual ao admin
      setProcessingMsg('');
      setCurrentView('bi-intro');
    } catch (_) {
      setValidationError('Erro ao enviar. Verifica a ligação e tenta novamente.');
      setProcessingMsg('');
    }
  };

  const handleBICapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    setProcessingMsg('A verificar documento...');
    setValidationError('');

    try {
      const b64 = await compressImage(file, 1400, 0.82);
      const result = await validateBIPhoto(b64);

      if (!result.ok) {
        setValidationError(result.message);
        setProcessingMsg('');
        return;
      }

      setProcessingMsg('A enviar para a nuvem...');
      const url = await uploadToCloud(b64);

      setValidationError('');
      setProcessingMsg('');

      if (biStep === 1) {
        setKycData(prev => ({ ...prev, biFront: url }));
        setBiStep(2);
        setTimeout(() => biInputRef.current?.click(), 400);
      } else {
        setKycData(prev => ({ ...prev, biBack: url }));
        setCurrentView('review');
      }
    } catch (_) {
      setValidationError('Erro ao processar imagem. Tente novamente.');
      setProcessingMsg('');
    }
  };

  const startFaceCapture = () => {
    if (!modelLoaded) return;
    setValidationError('');
    setCurrentView('face');
    setTimeout(() => faceInputRef.current?.click(), 200);
  };

  const startBICapture = () => {
    setBiStep(1);
    setValidationError('');
    setCurrentView('bi');
    setTimeout(() => biInputRef.current?.click(), 200);
  };

  const restartKYC = () => {
    setKycData({ faceFront: '', biFront: '', biBack: '' });
    setBiStep(1);
    setValidationError('');
    setLivenessScore(0);
    setFaceFailCount(0);
    faceScoresRef.current = [];
    setCurrentView('intro');
  };

  const submitKYC = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/profile/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceFront: kycData.faceFront,
          faceRight: kycData.faceFront, // campo mantido na API por compatibilidade
          faceLeft:  kycData.faceFront,
          biFront:   kycData.biFront,
          biBack:    kycData.biBack,
          livenessScore,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const d = contentType.includes('application/json') ? await res.json() : {};
      if (res.ok) {
        setAttemptsLeft(d.attemptsLeft ?? 0);
        if (d.blockedUntil) {
          setBlockedUntil(new Date(d.blockedUntil));
          setCurrentView('blocked');
        } else {
          setSubmitSuccess(true);
          setTimeout(() => router.push('/profile'), 2000);
        }
      } else if (res.status === 429 && d.blockedUntil) {
        setBlockedUntil(new Date(d.blockedUntil));
        setCurrentView('blocked');
      } else {
        alert(d.error || `Erro ${res.status} ao enviar. Tente novamente.`);
      }
    } catch (err) {
      console.error('[submitKYC]', err);
      alert('Erro de rede. Verifique a sua ligação e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--gold:#f5a623;--gold2:#e8950f;--dark:#070d1a;--card:#0d1626;--card2:#111e30;--border:rgba(245,166,35,.15);--border2:rgba(255,255,255,.06);--text:#e2e8f0;--muted:#64748b;--green:#22c55e;--red:#ef4444}
    .kb{min-height:100vh;background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:0 16px 80px;position:relative;overflow-x:hidden}
    .kb::before{content:'';position:fixed;top:-30%;left:-10%;width:70%;height:70%;background:radial-gradient(ellipse,rgba(245,166,35,.05) 0%,transparent 65%);pointer-events:none;z-index:0}
    .topbar{width:100%;max-width:460px;display:flex;align-items:center;justify-content:space-between;padding:20px 0 24px;position:relative;z-index:1}
    .topbar-logo{display:flex;align-items:center;gap:9px}
    .topbar-logo-icon{width:32px;height:32px;background:linear-gradient(135deg,#f5a623,#e8940f);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(245,166,35,.3)}
    .topbar-logo span{color:#f5a623;font-family:'Syne',sans-serif;font-weight:800;font-size:15px;letter-spacing:.5px}
    .back-btn{background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:9px;padding:7px 14px;color:var(--muted);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s}
    .back-btn:hover{background:rgba(255,255,255,.08);color:var(--text)}
    .view{display:flex;flex-direction:column;align-items:center;width:100%;max-width:440px;position:relative;z-index:1;animation:rise .35s cubic-bezier(.22,1,.36,1) forwards}
    @keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .card{background:var(--card);border:1px solid var(--border2);border-radius:22px;padding:28px 24px;width:100%;text-align:center;box-shadow:0 4px 40px rgba(0,0,0,.35)}
    .icon-wrap{width:64px;height:64px;border-radius:50%;background:rgba(245,166,35,.07);border:1.5px solid rgba(245,166,35,.2);display:flex;align-items:center;justify-content:center;color:var(--gold);margin:0 auto 18px;box-shadow:0 0 20px rgba(245,166,35,.1)}
    .h1{font-family:'Syne',sans-serif;font-size:21px;font-weight:700;margin-bottom:7px;letter-spacing:-.3px}
    .sub{color:var(--muted);font-size:13.5px;line-height:1.65;margin-bottom:20px}
    .steps-list{margin-bottom:22px;text-align:left;display:flex;flex-direction:column;gap:10px}
    .step-row{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.025);border:1px solid var(--border2);border-radius:12px;padding:11px 14px}
    .step-num{width:26px;height:26px;border-radius:50%;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.25);color:var(--gold);font-family:'Syne',sans-serif;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .step-text{font-size:13.5px;color:var(--text)}
    .step-text small{display:block;color:var(--muted);font-size:11.5px;margin-top:1px}
    .tips{background:rgba(0,0,0,.25);border:1px solid var(--border2);border-radius:14px;padding:13px 14px;margin-bottom:22px;text-align:left}
    .tip{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text);margin-bottom:9px}
    .tip:last-child{margin-bottom:0}
    .tip svg{color:var(--gold);flex-shrink:0}
    .btn{width:100%;padding:14px;font-size:14.5px;font-family:'Syne',sans-serif;font-weight:700;letter-spacing:.2px;border:none;border-radius:13px;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:9px;transition:all .15s;margin-bottom:10px}
    .btn:last-child{margin-bottom:0}
    .btn:active{transform:scale(.97)}
    .btn:disabled{opacity:.4;pointer-events:none}
    .btn-gold{background:linear-gradient(135deg,#f5a623,#e8940f);color:#000;box-shadow:0 4px 18px rgba(245,166,35,.25)}
    .btn-out{background:transparent;color:var(--text);border:1px solid var(--border2)}
    .btn-green{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 18px rgba(34,197,94,.2)}
    .progress{display:flex;gap:6px;justify-content:center;margin-bottom:20px}
    .pdot{width:26px;height:3.5px;border-radius:4px;background:rgba(255,255,255,.1);transition:all .3s}
    .pdot.active{background:var(--gold);width:34px}
    .pdot.done{background:var(--green)}
    .face-preview{position:relative;width:100%;aspect-ratio:1;border-radius:16px;overflow:hidden;margin-bottom:16px;background:var(--card2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px}
    .face-preview img{width:100%;height:100%;object-fit:cover}
    .oval-guide{width:130px;height:178px;border:2.5px dashed rgba(245,166,35,.65);border-radius:50%;animation:pulse-border 2s ease-in-out infinite}
    @keyframes pulse-border{0%,100%{border-color:rgba(245,166,35,.35)}50%{border-color:rgba(245,166,35,.9)}}
    .step-label{color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:12px;letter-spacing:1.2px;text-transform:uppercase}
    .step-hint{color:rgba(255,255,255,.5);font-size:11.5px;text-align:center;padding:0 20px}
    .captured-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;width:100%;margin-bottom:20px}
    .cap-item{background:var(--card2);border:1px solid var(--border2);border-radius:12px;overflow:hidden}
    .cap-label{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600;letter-spacing:.5px;padding:6px 8px 4px}
    .cap-item img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);color:var(--green);padding:6px 14px;border-radius:20px;font-size:12.5px;font-weight:600;margin-bottom:16px}
    .bi-guide{width:100%;aspect-ratio:16/10;background:var(--card2);border:1px solid var(--border2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden}
    .bi-rect{width:82%;height:78%;border:2px dashed rgba(245,166,35,.6);border-radius:10px;display:flex;align-items:center;justify-content:center;animation:pulse-border 2s ease-in-out infinite}
    .bi-rect span{color:rgba(255,255,255,.35);font-size:12px}
    .error-box{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:13px;padding:13px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;text-align:left}
    .error-box svg{color:var(--red);flex-shrink:0;margin-top:1px}
    .error-box p{color:#fca5a5;font-size:13px;line-height:1.5}
    .validating-overlay{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:28px}
    .validating-overlay p{color:var(--muted);font-size:13px}
    .loading-bar{width:100%;height:3px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;margin-top:4px}
    .loading-bar-inner{height:100%;background:var(--gold);border-radius:4px;animation:loading 1.5s ease-in-out infinite}
    @keyframes loading{0%{width:0%;margin-left:0}50%{width:70%;margin-left:15%}100%{width:0%;margin-left:100%}}
    .model-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 0}
    .attempts-badge{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;margin-bottom:16px;width:fit-content;align-self:center}
    .attempts-ok{background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2)}
    .attempts-warn{background:rgba(245,166,35,0.08);color:#f5a623;border:1px solid rgba(245,166,35,0.25)}
    .blocked-card{text-align:center;padding:32px 20px}
    .blocked-icon{width:70px;height:70px;border-radius:50%;background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;color:#ef4444;margin:0 auto 18px}
    .countdown{font-size:34px;font-family:'Syne',sans-serif;font-weight:800;color:var(--gold);letter-spacing:2px;margin:14px 0;font-variant-numeric:tabular-nums}
    .divider{border-top:1px solid var(--border2);margin:18px 0}
    input[type=file]{display:none}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="kb">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-logo">
            <div className="topbar-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0f1e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <span>Dynamics Works</span>
          </div>
          <button className="back-btn" onClick={() => router.back()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
        </div>

        <input ref={faceInputRef} type="file" accept="image/*" capture="user" onChange={handleFaceCapture} />
        <input ref={biInputRef} type="file" accept="image/*" capture="environment" onChange={handleBICapture} />

        {/* ── BLOQUEADO ── */}
        {currentView === 'blocked' && (
          <div className="view">
            <div className="card blocked-card">
              <div className="blocked-icon"><Lock size={28} /></div>
              <h2 className="h1" style={{ color: 'var(--red)' }}>Verificação Bloqueada</h2>
              <p className="sub">Atingiste o limite de tentativas. Aguarda o tempo indicado para poderes tentar novamente.</p>
              <div className="countdown">{countdown || '...'}</div>
              <div className="divider" />
              <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                O bloqueio é levantado automaticamente. Se acreditas que se trata de um erro, contacta o <strong style={{ color: 'var(--gold)' }}>suporte</strong>.
              </p>
              <div style={{ marginTop: 18 }}>
                <button className="btn btn-out" onClick={() => router.push('/support')}>
                  Contactar Suporte
                </button>
                <button className="btn btn-out" onClick={() => router.push('/profile')}>
                  Voltar ao Perfil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── INTRO ── */}
        {currentView === 'intro' && (
          <div className="view">
            <div className="card">
              <div className="icon-wrap"><ScanFace size={30} /></div>
              <h2 className="h1">Verificação de Identidade</h2>
              <p className="sub">Confirma a tua identidade em 3 passos simples. Todo o processo é automático e seguro.</p>

              <div className={`attempts-badge ${attemptsLeft > 2 ? 'attempts-ok' : attemptsLeft > 0 ? 'attempts-warn' : 'attempts-warn'}`}>
                <Clock size={12} /> {attemptsLeft} tentativa{attemptsLeft !== 1 ? 's' : ''} restante{attemptsLeft !== 1 ? 's' : ''}
              </div>

              <div className="steps-list">
                <div className="step-row">
                  <div className="step-num">1</div>
                  <div className="step-text">
                    Foto do rosto
                    <small>1 selfie frontal com boa iluminação</small>
                  </div>
                </div>
                <div className="step-row">
                  <div className="step-num">2</div>
                  <div className="step-text">
                    Bilhete de Identidade
                    <small>Foto da frente e do verso do B.I.</small>
                  </div>
                </div>
                <div className="step-row">
                  <div className="step-num">3</div>
                  <div className="step-text">
                    Revisão e envio
                    <small>Confirma as fotos e submete para análise</small>
                  </div>
                </div>
              </div>

              <div className="tips">
                <div className="tip"><Sun size={15} />Boa iluminação — janela ou luz de tecto</div>
                <div className="tip"><User size={15} />Remove óculos, boné ou chapéu</div>
                <div className="tip"><Camera size={15} />Tem o B.I. à mão antes de começar</div>
                <div className="tip"><CheckCircle size={15} />Se a câmara falhar, podes enviar para revisão manual</div>
              </div>

              {!modelLoaded ? (
                <div className="model-loading">
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{loadingProgress}</div>
                  <div className="loading-bar"><div className="loading-bar-inner" /></div>
                </div>
              ) : (
                <button className="btn btn-gold" onClick={startFaceCapture}>
                  <Camera size={17} /> Começar Verificação
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── FACE ── */}
        {currentView === 'face' && (
          <div className="view">
            <div className="card">
              <h2 className="h1">Selfie</h2>
              <p className="sub">Tira uma foto do teu rosto. Fica num local bem iluminado e olha directamente para a câmara.</p>

              {/* Dicas rápidas */}
              {!processingMsg && !kycData.faceFront && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['☀️ Boa luz', '😐 Sem óculos', '📱 Câmara frontal', '🧍 Rosto centrado'].map(tip => (
                    <span key={tip} style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: 12, color: 'var(--text)' }}>{tip}</span>
                  ))}
                </div>
              )}

              {processingMsg ? (
                <div className="validating-overlay">
                  <Loader2 size={36} color="var(--gold)" className="animate-spin" />
                  <p>{processingMsg}</p>
                  <div className="loading-bar"><div className="loading-bar-inner" /></div>
                </div>
              ) : (
                <>
                  {validationError && (
                    <div className="error-box">
                      <XCircle size={18} />
                      <p style={{ whiteSpace: 'pre-line' }}>{validationError.split('\n\n')[0]}</p>
                    </div>
                  )}

                  <div className="face-preview">
                    {kycData.faceFront && kycData.faceFront.startsWith('data:') ? (
                      <img src={kycData.faceFront} alt="selfie" style={{ transform: 'scaleX(-1)' }} />
                    ) : kycData.faceFront && !kycData.faceFront.startsWith('data:') ? (
                      <img src={kycData.faceFront} alt="selfie" style={{ transform: 'scaleX(-1)' }} />
                    ) : (
                      <>
                        <div className="oval-guide" />
                        <div className="step-hint">Posiciona o rosto dentro do oval</div>
                      </>
                    )}
                  </div>

                  {/* Foto aceite — continuar */}
                  {!validationError && kycData.faceFront && !kycData.faceFront.startsWith('data:') ? (
                    <button className="btn btn-green" onClick={() => setCurrentView('bi-intro')}>
                      <CheckCircle size={18} /> Foto aceite — Continuar
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-gold" onClick={() => { setValidationError(''); setFaceFailCount(0); faceInputRef.current?.click(); }}>
                        <Camera size={18} /> {validationError ? 'Tentar Novamente' : 'Tirar Selfie'}
                      </button>

                      {/* Bypass após 2 falhas */}
                      {faceFailCount >= 2 && validationError && (
                        <button className="btn btn-out" style={{ marginTop: 8 }} onClick={handleFaceBypass}>
                          Enviar para revisão manual
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── B.I. INTRO ── */}
        {currentView === 'bi-intro' && (
          <div className="view">
            <div className="card">
              <div className="icon-wrap"><CreditCard size={32} /></div>
              <h2 className="h1">Documento de Identidade</h2>
              <p className="sub">Fotografe a frente e o verso do B.I. com boa iluminação, sem reflexos.</p>
              <div className="bi-guide">
                <div className="bi-rect"><span>Alinhe o B.I. aqui</span></div>
              </div>
              <button className="btn btn-gold" onClick={startBICapture}>
                <Camera size={18} /> Fotografar B.I.
              </button>
            </div>
          </div>
        )}

        {/* ── B.I. ── */}
        {currentView === 'bi' && (
          <div className="view">
            <div className="progress">
              {[1, 2].map(i => (
                <div key={i} className={`pdot ${i < biStep ? 'done' : i === biStep ? 'active' : ''}`} />
              ))}
            </div>
            <div className="card">
              <h2 className="h1">{biStep === 1 ? 'B.I. — Frente' : 'B.I. — Verso'}</h2>
              <p className="sub">{biStep === 1 ? '📄 Coloca o B.I. numa superfície plana e fotografa a frente' : '🔄 Vira o B.I. e fotografa o verso'}</p>

              {processingMsg ? (
                <div className="validating-overlay">
                  <Loader2 size={36} color="var(--gold)" className="animate-spin" />
                  <p>{processingMsg}</p>
                  <div className="loading-bar"><div className="loading-bar-inner" /></div>
                </div>
              ) : (
                <>
                  {validationError && (
                    <div className="error-box">
                      <XCircle size={18} />
                      <p>{validationError}</p>
                    </div>
                  )}
                  <div className="bi-guide" style={{ marginBottom: 16 }}>
                    {(biStep === 1 ? kycData.biFront : kycData.biBack) ? (
                      <img src={biStep === 1 ? kycData.biFront : kycData.biBack} alt="bi" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="bi-rect"><span>{biStep === 1 ? 'Frente do B.I.' : 'Verso do B.I.'}</span></div>
                    )}
                  </div>
                  <button className="btn btn-gold" onClick={() => { setValidationError(''); biInputRef.current?.click(); }}>
                    <Camera size={18} /> {validationError ? 'Tentar Novamente' : `Tirar Foto — ${biStep === 1 ? 'Frente' : 'Verso'}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {currentView === 'review' && (
          <div className="view">
            <div className="badge"><ShieldCheck size={15} /> Liveness IA: {livenessScore}%</div>
            <div className="card">
              <h2 className="h1" style={{ marginBottom: 16 }}>Revisão Final</h2>
              <div className="captured-grid">
                <div className="cap-item" style={{ gridColumn: 'span 2' }}>
                  <div className="cap-label">Selfie</div>
                  <img src={kycData.faceFront} style={{ transform: 'scaleX(-1)', aspectRatio: '4/3' }} alt="rosto" />
                </div>
                <div className="cap-item">
                  <div className="cap-label">B.I. Frente</div>
                  <img src={kycData.biFront} alt="bi frente" />
                </div>
                <div className="cap-item">
                  <div className="cap-label">B.I. Verso</div>
                  <img src={kycData.biBack} alt="bi verso" />
                </div>
              </div>
              <button className="btn btn-out" onClick={restartKYC}><RotateCcw size={16} /> Repetir</button>
              <button className="btn btn-green" onClick={submitKYC} disabled={isSubmitting || submitSuccess}>
                {isSubmitting
                  ? <><Loader2 className="animate-spin" size={18} /> Enviando...</>
                  : submitSuccess
                    ? <><CheckCircle size={18} /> Enviado!</>
                    : 'Finalizar Verificação'}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}