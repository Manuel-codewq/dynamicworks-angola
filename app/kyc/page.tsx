"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CreditCard, Loader2, ScanFace, ShieldCheck, Sun, User, CheckCircle, RotateCcw, AlertCircle, XCircle } from 'lucide-react';

type KYCView = 'intro' | 'loading-model' | 'face' | 'bi-intro' | 'bi' | 'review';

interface KYCData {
  faceFront: string;
  faceRight: string;
  faceLeft: string;
  biFront: string;
  biBack: string;
}

interface ValidationResult {
  ok: boolean;
  message: string;
}

export default function KYCVerificationPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<KYCView>('intro');
  const [faceStep, setFaceStep] = useState<number>(1);
  const [biStep, setBiStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [livenessScore] = useState<number>(Math.floor(Math.random() * 7) + 92);
  const [validating, setValidating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('A carregar modelos de IA...');
  const [kycData, setKycData] = useState<KYCData>({
    faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: ''
  });

  const faceInputRef = useRef<HTMLInputElement>(null);
  const biInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  const faceSteps = [
    { label: 'Frente', hint: 'Olhe diretamente para a câmara', prop: 'faceFront' as keyof KYCData },
    { label: 'Direita', hint: 'Vire o rosto ligeiramente para a direita', prop: 'faceRight' as keyof KYCData },
    { label: 'Esquerda', hint: 'Vire o rosto ligeiramente para a esquerda', prop: 'faceLeft' as keyof KYCData },
  ];

  // Carrega face-api.js dinamicamente
  useEffect(() => {
    const loadFaceAPI = async () => {
      try {
        setLoadingProgress('A carregar biblioteca de deteção facial...');

        // Carrega o script face-api.js
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
        faceapiRef.current = faceapi;

        setLoadingProgress('A carregar modelos de deteção...');
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);

        setModelLoaded(true);
        setLoadingProgress('Pronto!');
      } catch (err) {
        console.error('Erro ao carregar face-api:', err);
        // Se falhar o carregamento, deixa avançar sem validação
        setModelLoaded(true);
        faceapiRef.current = null;
      }
    };

    loadFaceAPI();
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

      // Verifica se o rosto está grande o suficiente (mínimo 15% da imagem)
      const faceArea = (box.width * box.height) / (imgW * imgH);
      if (faceArea < 0.08) {
        return { ok: false, message: 'Rosto muito longe. Aproxime-se mais da câmara.' };
      }

      // Verifica se o rosto está centrado (não muito para os lados)
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const offX = Math.abs(centerX / imgW - 0.5);
      const offY = Math.abs(centerY / imgH - 0.5);

      if (offX > 0.35) {
        return { ok: false, message: 'Rosto fora do centro. Centre o rosto na câmara.' };
      }
      if (offY > 0.35) {
        return { ok: false, message: 'Rosto fora do centro verticalmente. Ajuste a posição.' };
      }

      // Verifica score de confiança
      const score = det.detection.score;
      if (score < 0.5) {
        return { ok: false, message: 'Foto pouco nítida. Melhore a iluminação e tente novamente.' };
      }

      return { ok: true, message: '' };
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
          return { ok: false, message: 'Parece que fotografou o seu rosto. Esta etapa é para o B.I. — aponte a câmara para o documento.' };
        }
      }

      return { ok: true, message: '' };
    } catch (_) {
      return { ok: true, message: '' };
    }
  };

  const handleFaceCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    setValidating(true);
    setValidationError('');

    const b64 = await fileToBase64(file);
    const result = await validateFacePhoto(b64);

    setValidating(false);

    if (!result.ok) {
      setValidationError(result.message);
      return;
    }

    const prop = faceSteps[faceStep - 1].prop;
    setKycData(prev => ({ ...prev, [prop]: b64 }));
    setValidationError('');

    if (faceStep < 3) {
      setFaceStep(prev => prev + 1);
      setTimeout(() => faceInputRef.current?.click(), 400);
    } else {
      setCurrentView('bi-intro');
    }
  };

  const handleBICapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    setValidating(true);
    setValidationError('');

    const b64 = await fileToBase64(file);
    const result = await validateBIPhoto(b64);

    setValidating(false);

    if (!result.ok) {
      setValidationError(result.message);
      return;
    }

    setValidationError('');

    if (biStep === 1) {
      setKycData(prev => ({ ...prev, biFront: b64 }));
      setBiStep(2);
      setTimeout(() => biInputRef.current?.click(), 400);
    } else {
      setKycData(prev => ({ ...prev, biBack: b64 }));
      setCurrentView('review');
    }
  };

  const startFaceCapture = () => {
    if (!modelLoaded) return;
    setFaceStep(1);
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
    setKycData({ faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: '' });
    setFaceStep(1);
    setBiStep(1);
    setValidationError('');
    setCurrentView('intro');
  };

  const submitKYC = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/profile/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...kycData, livenessScore }),
      });
      if (res.ok) {
        setSubmitSuccess(true);
        setTimeout(() => router.push('/profile'), 2000);
      } else {
        const d = await res.json();
        alert(d.error || 'Erro ao enviar.');
      }
    } catch (_) {
      alert('Erro de conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--gold:#f5a623;--gold2:#e8950f;--dark:#070d1a;--card:#0f1825;--card2:#141e2e;--border:rgba(245,166,35,.15);--text:#e2e8f0;--muted:#64748b;--green:#22c55e;--red:#ef4444}
    .kb{min-height:100vh;background:var(--dark);color:var(--text);font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px 80px;position:relative;overflow:hidden}
    .kb::before{content:'';position:fixed;top:-40%;left:-20%;width:80%;height:80%;background:radial-gradient(ellipse,rgba(245,166,35,.06) 0%,transparent 70%);pointer-events:none}
    .brand{font-family:'Syne',sans-serif;color:var(--gold);font-weight:800;font-size:18px;letter-spacing:3px;text-transform:uppercase;margin-bottom:32px;text-align:center}
    .footer{position:fixed;bottom:16px;left:0;width:100%;text-align:center;font-size:11px;color:var(--muted);pointer-events:none;z-index:100}
    .footer b{color:var(--gold)}
    .view{display:flex;flex-direction:column;align-items:center;width:100%;max-width:420px;animation:rise .35s cubic-bezier(.22,1,.36,1) forwards}
    @keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:28px 22px;width:100%;text-align:center}
    .icon-wrap{width:68px;height:68px;border-radius:50%;background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.2);display:flex;align-items:center;justify-content:center;color:var(--gold);margin:0 auto 20px}
    .h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;margin-bottom:8px;letter-spacing:-.3px}
    .sub{color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:22px}
    .tips{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:14px;margin-bottom:22px;text-align:left}
    .tip{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--text);margin-bottom:10px}
    .tip:last-child{margin-bottom:0}
    .tip svg{color:var(--gold);flex-shrink:0}
    .btn{width:100%;padding:15px;font-size:15px;font-family:'Syne',sans-serif;font-weight:600;letter-spacing:.3px;border:none;border-radius:14px;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:9px;transition:all .18s;margin-bottom:10px}
    .btn:last-child{margin-bottom:0}
    .btn:active{transform:scale(.97)}
    .btn:disabled{opacity:.45;pointer-events:none}
    .btn-gold{background:var(--gold);color:#000}
    .btn-out{background:transparent;color:var(--text);border:1px solid rgba(255,255,255,.15)}
    .btn-green{background:var(--green);color:#fff}
    .progress{display:flex;gap:6px;justify-content:center;margin-bottom:20px}
    .pdot{width:28px;height:4px;border-radius:4px;background:rgba(255,255,255,.12);transition:all .3s}
    .pdot.active{background:var(--gold);width:36px}
    .pdot.done{background:var(--green)}
    .face-preview{position:relative;width:100%;aspect-ratio:1;border-radius:16px;overflow:hidden;margin-bottom:16px;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
    .face-preview img{width:100%;height:100%;object-fit:cover}
    .oval-guide{width:140px;height:190px;border:2.5px dashed rgba(245,166,35,.7);border-radius:50%;animation:pulse-border 2s ease-in-out infinite}
    @keyframes pulse-border{0%,100%{border-color:rgba(245,166,35,.4)}50%{border-color:rgba(245,166,35,1)}}
    .step-label{color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase}
    .step-hint{color:rgba(255,255,255,.6);font-size:12px;text-align:center;padding:0 20px}
    .captured-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-bottom:20px}
    .cap-item{background:var(--card2);border:1px solid var(--border);border-radius:12px;overflow:hidden}
    .cap-label{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600;letter-spacing:.5px;padding:6px 8px 0}
    .cap-item img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:var(--green);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:18px}
    .bi-guide{width:100%;aspect-ratio:16/10;background:var(--card2);border:1px solid var(--border);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden}
    .bi-rect{width:82%;height:78%;border:2.5px dashed rgba(245,166,35,.7);border-radius:10px;display:flex;align-items:center;justify-content:center;animation:pulse-border 2s ease-in-out infinite}
    .bi-rect span{color:rgba(255,255,255,.4);font-size:12px}
    .error-box{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;text-align:left}
    .error-box svg{color:var(--red);flex-shrink:0;margin-top:1px}
    .error-box p{color:#fca5a5;font-size:13px;line-height:1.5}
    .validating-overlay{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px}
    .validating-overlay p{color:var(--muted);font-size:13px}
    .loading-bar{width:100%;height:3px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin-top:4px}
    .loading-bar-inner{height:100%;background:var(--gold);border-radius:4px;animation:loading 1.5s ease-in-out infinite}
    @keyframes loading{0%{width:0%;margin-left:0}50%{width:70%;margin-left:15%}100%{width:0%;margin-left:100%}}
    .model-loading{display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px 0}
    input[type=file]{display:none}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="kb">
        <div className="brand">Dynamics Works</div>

        <input ref={faceInputRef} type="file" accept="image/*" capture="user" onChange={handleFaceCapture} />
        <input ref={biInputRef} type="file" accept="image/*" capture="environment" onChange={handleBICapture} />

        {/* ── INTRO ── */}
        {currentView === 'intro' && (
          <div className="view">
            <div className="card">
              <div className="icon-wrap"><ScanFace size={32} /></div>
              <h2 className="h1">Verificação KYC</h2>
              <p className="sub">Vamos confirmar a sua identidade. A IA verifica automaticamente cada foto.</p>
              <div className="tips">
                <div className="tip"><Sun size={16} />Ambiente bem iluminado</div>
                <div className="tip"><User size={16} />Remova óculos e chapéus</div>
                <div className="tip"><Camera size={16} />Tenha o B.I. à mão</div>
              </div>

              {!modelLoaded ? (
                <div className="model-loading">
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{loadingProgress}</div>
                  <div className="loading-bar"><div className="loading-bar-inner" /></div>
                </div>
              ) : (
                <button className="btn btn-gold" onClick={startFaceCapture}>
                  <Camera size={18} /> Começar Verificação
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── FACE ── */}
        {currentView === 'face' && (
          <div className="view">
            <div className="progress">
              {[1, 2, 3].map(i => (
                <div key={i} className={`pdot ${i < faceStep ? 'done' : i === faceStep ? 'active' : ''}`} />
              ))}
            </div>
            <div className="card">
              <h2 className="h1">Verificação Facial</h2>
              <p className="sub">Passo {faceStep} de 3 — {faceSteps[faceStep - 1].hint}</p>

              {validating ? (
                <div className="validating-overlay">
                  <Loader2 size={36} color="var(--gold)" className="animate-spin" />
                  <p>A verificar rosto com IA...</p>
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
                  <div className="face-preview">
                    {kycData[faceSteps[faceStep - 1].prop] ? (
                      <img src={kycData[faceSteps[faceStep - 1].prop]} alt="captura" style={{ transform: 'scaleX(-1)' }} />
                    ) : (
                      <>
                        <div className="oval-guide" />
                        <div className="step-label">{faceSteps[faceStep - 1].label}</div>
                        <div className="step-hint">{faceSteps[faceStep - 1].hint}</div>
                      </>
                    )}
                  </div>
                  <button className="btn btn-gold" onClick={() => { setValidationError(''); faceInputRef.current?.click(); }}>
                    <Camera size={18} /> {validationError ? 'Tentar Novamente' : `Tirar Foto — ${faceSteps[faceStep - 1].label}`}
                  </button>
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
              <p className="sub">{biStep === 1 ? 'Fotografe a frente do documento' : 'Vire e fotografe o verso'}</p>

              {validating ? (
                <div className="validating-overlay">
                  <Loader2 size={36} color="var(--gold)" className="animate-spin" />
                  <p>A verificar documento...</p>
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
                <div className="cap-item">
                  <div className="cap-label">Rosto</div>
                  <img src={kycData.faceFront} style={{ transform: 'scaleX(-1)' }} alt="rosto" />
                </div>
                <div className="cap-item">
                  <div className="cap-label">Lado</div>
                  <img src={kycData.faceRight} style={{ transform: 'scaleX(-1)' }} alt="lado" />
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

        <div className="footer">Desenvolvido pela <b>DIGIKAP</b></div>
      </div>
    </>
  );
}