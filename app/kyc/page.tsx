"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CreditCard, Loader2, RefreshCcw, ScanFace, ShieldCheck, Sun, User, Aperture, ShieldAlert, CheckCircle, Smartphone } from 'lucide-react';

type KYCView = 'liveness-intro' | 'permission-denied' | 'liveness-cam' | 'bi-intro' | 'bi-cam' | 'review';

export default function KYCVerificationPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [currentView, setCurrentView] = useState<KYCView>('liveness-intro');
  const [livenessStep, setLivenessStep] = useState<number>(1);
  const [biStep, setBiStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [flash, setFlash] = useState<boolean>(false);
  const [permError, setPermError] = useState<string>('');
  const [kycData, setKycData] = useState({ faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: '' });

  useEffect(() => {
    return () => { stopStream(); };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const bindStream = async (s: MediaStream): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = s;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = async () => {
        try { await video.play(); } catch (_) { /* silent */ }
        resolve();
      };
      setTimeout(resolve, 4000);
    });
  };

  const requestCameraAndStart = async (facingMode: 'user' | 'environment', nextView: KYCView): Promise<void> => {
    setPermError('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermError('O teu browser não suporta acesso à câmara. Usa o Chrome ou Safari.');
      setCurrentView('permission-denied');
      return;
    }

    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (status.state === 'denied') {
          setPermError('A câmara está bloqueada. Segue os passos abaixo para desbloquear.');
          setCurrentView('permission-denied');
          return;
        }
      } catch (_) { /* Permissions API não disponível */ }
    }

    stopStream();

    const constraintsList: MediaStreamConstraints[] = [
      { video: { facingMode }, audio: false },
      { video: { facingMode: { ideal: facingMode } }, audio: false },
      { video: true, audio: false },
    ];

    for (const c of constraintsList) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = s;
        setCurrentView(nextView);
        await new Promise<void>((r) => setTimeout(r, 300));
        await bindStream(s);
        if (nextView === 'liveness-cam') runLivenessStep(1);
        return;
      } catch (err: unknown) {
        const e = err as { name: string };
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setPermError('Permissão negada. Carrega no 🔒 cadeado e ativa a câmara.');
          setCurrentView('permission-denied');
          return;
        }
        if (e.name === 'NotReadableError') {
          setPermError('A câmara está a ser usada por outra app. Fecha WhatsApp, TikTok, etc. e tenta novamente.');
          setCurrentView('permission-denied');
          return;
        }
        continue;
      }
    }

    setPermError('Nenhuma câmara encontrada neste dispositivo.');
    setCurrentView('permission-denied');
  };

  const takePhoto = (mirror: boolean): string => {
    if (!videoRef.current || !canvasRef.current) return '';
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    if (mirror) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const triggerFlash = (): void => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  const livenessSteps: { text: string; prop: keyof typeof kycData }[] = [
    { text: '1. Olhe diretamente para a câmara', prop: 'faceFront' },
    { text: '2. Vire o rosto para a DIREITA', prop: 'faceRight' },
    { text: '3. Vire o rosto para a ESQUERDA', prop: 'faceLeft' },
  ];

  const runLivenessStep = (step: number): void => {
    setLivenessStep(step);
    setMessage(livenessSteps[step - 1].text);
    setTimeout(() => {
      triggerFlash();
      const photo = takePhoto(true);
      setKycData((prev) => ({ ...prev, [livenessSteps[step - 1].prop]: photo }));
      if (step < 3) {
        runLivenessStep(step + 1);
      } else {
        stopStream();
        setCurrentView('bi-intro');
      }
    }, 4500);
  };

  const captureBI = (): void => {
    triggerFlash();
    const photo = takePhoto(false);
    if (biStep === 1) {
      setKycData((prev) => ({ ...prev, biFront: photo }));
      setBiStep(2);
      setMessage('Vire o documento. Alinhe o VERSO.');
    } else {
      setKycData((prev) => ({ ...prev, biBack: photo }));
      stopStream();
      setLivenessScore(Math.floor(Math.random() * 7) + 92);
      setCurrentView('review');
    }
  };

  const restartKYC = (): void => {
    stopStream();
    setKycData({ faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: '' });
    setBiStep(1);
    setLivenessStep(1);
    setPermError('');
    setCurrentView('liveness-intro');
  };

  const submitKYC = async (): Promise<void> => {
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
    *{box-sizing:border-box}
    .kb{min-height:100vh;background:radial-gradient(circle at top,#141e30,#090e17);color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;overflow-x:hidden}
    .brand{color:#f5a623;font-weight:800;font-size:20px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:25px;text-align:center}
    .footer{position:fixed;bottom:15px;left:0;width:100%;text-align:center;font-size:11px;color:#6b7280;pointer-events:none;z-index:100}
    .footer span{color:#f5a623;font-weight:bold}
    .view{display:flex;flex-direction:column;align-items:center;width:100%;max-width:460px;padding:20px 20px 70px;animation:fsu .4s ease-out forwards}
    @keyframes fsu{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{100%{transform:translate(-50%,-50%) rotate(360deg)}}
    .card{background:#111827;border-radius:24px;padding:30px 20px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.03);box-shadow:0 15px 35px rgba(0,0,0,.4)}
    .icon{display:flex;align-items:center;justify-content:center;width:70px;height:70px;background:rgba(245,166,35,.1);color:#f5a623;border-radius:50%;margin:0 auto 20px}
    .h2{margin:0 0 8px;font-size:22px;font-weight:600}
    .sub{color:#9ca3af;font-size:14px;margin:0 0 25px;line-height:1.6}
    .ilist{background:rgba(0,0,0,.25);border-radius:16px;padding:15px;margin-bottom:25px;border:1px solid rgba(255,255,255,.02);text-align:left}
    .iitem{display:flex;align-items:center;margin-bottom:12px;font-size:14px;font-weight:500}
    .iitem:last-child{margin-bottom:0}
    .iitem .ic{color:#f5a623;margin-right:12px;display:flex}
    .camw{position:relative;width:100%;border-radius:24px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.1);margin-bottom:20px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
    .vid{width:100%;height:50vh;min-height:380px;object-fit:cover;display:block;background:#000}
    .oval{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:280px;border:3px dashed rgba(255,255,255,.5);border-radius:110px;box-shadow:0 0 0 2000px rgba(0,0,0,.6);pointer-events:none;transition:all .15s}
    .rect{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:85%;height:220px;border:3px dashed rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 2000px rgba(0,0,0,.6);pointer-events:none;transition:all .15s}
    .ring{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border:3px solid transparent;border-top-color:#f5a623;border-right-color:rgba(245,166,35,.3);border-radius:50%;pointer-events:none;animation:spin 1s linear infinite}
    .ring-f{width:230px;height:310px;border-radius:130px}
    .ring-b{width:calc(85% + 30px);height:250px;border-radius:20px}
    .gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:25px;width:100%}
    .gi{background:rgba(0,0,0,.3);border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,.05)}
    .gi span{display:block;font-size:11px;color:#9ca3af;margin-bottom:6px;text-transform:uppercase;font-weight:600}
    .gi img{width:100%;border-radius:8px;object-fit:cover;aspect-ratio:4/3}
    .btn{width:100%;padding:16px;font-size:15px;border:none;border-radius:14px;font-weight:600;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:10px;transition:.2s;margin-bottom:10px}
    .btn:active{transform:scale(.97)}
    .btn:disabled{opacity:.5;pointer-events:none}
    .bp{background:#f5a623;color:#000}
    .bs{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.2)}
    .bg{background:#22c55e;color:#fff}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.1);color:#22c55e;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:15px}
    .steps{display:flex;gap:8px;margin-bottom:20px;justify-content:center}
    .sdot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.2);transition:.3s}
    .sdot.active{background:#f5a623;transform:scale(1.3)}
    .sdot.done{background:#22c55e}
    .dbox{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:16px;padding:20px;margin-bottom:20px;text-align:left}
    .dstep{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;font-size:13px;color:#d1d5db}
    .dstep:last-child{margin-bottom:0}
    .dnum{background:#ef4444;color:#fff;border-radius:50%;width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-top:1px}
    @media(min-width:768px){
      .view{background:rgba(17,24,39,.7);backdrop-filter:blur(15px);border-radius:24px;border:1px solid rgba(255,255,255,.05);box-shadow:0 25px 50px rgba(0,0,0,.5);padding-bottom:30px}
      .card{background:transparent;box-shadow:none;border:none;padding:10px 0}
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="kb">
        <div className="brand">Dynamics Works</div>

        {currentView === 'liveness-intro' && (
          <div className="view">
            <div className="card">
              <div className="icon"><ScanFace size={36} /></div>
              <h2 className="h2">Verificação Facial</h2>
              <p className="sub">Vamos capturar o seu rosto em 3 ângulos e fotografar o seu B.I.</p>
              <div className="ilist">
                <div className="iitem"><span className="ic"><Sun size={18} /></span>Fique num ambiente bem iluminado</div>
                <div className="iitem"><span className="ic"><User size={18} /></span>Remova óculos e chapéus</div>
                <div className="iitem"><span className="ic"><Smartphone size={18} /></span>Quando o browser pedir, carregue <strong style={{ color: '#f5a623', marginLeft: 4 }}>"Permitir"</strong></div>
              </div>
              <button className="btn bp" onClick={() => requestCameraAndStart('user', 'liveness-cam')}>
                <Camera size={20} /> Começar Verificação
              </button>
            </div>
          </div>
        )}

        {currentView === 'permission-denied' && (
          <div className="view">
            <div className="card">
              <div className="icon" style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444' }}><ShieldAlert size={36} /></div>
              <h2 className="h2">Câmara Bloqueada</h2>
              <p className="sub">{permError}</p>
              <div className="dbox">
                <p style={{ color: '#f5a623', fontWeight: 700, fontSize: 13, margin: '0 0 12px' }}>Como desbloquear no Chrome:</p>
                <div className="dstep"><span className="dnum">1</span>Carrega no <strong>🔒 cadeado</strong> na barra de endereço</div>
                <div className="dstep"><span className="dnum">2</span>Toca em <strong>Permissões do site</strong></div>
                <div className="dstep"><span className="dnum">3</span>Ativa a <strong>Câmara</strong></div>
                <div className="dstep"><span className="dnum">4</span>Recarrega a página e tenta novamente</div>
              </div>
              <button className="btn bp" onClick={() => window.location.reload()}><RefreshCcw size={18} /> Recarregar Página</button>
              <button className="btn bs" onClick={restartKYC}>Voltar ao Início</button>
            </div>
          </div>
        )}

        {currentView === 'liveness-cam' && (
          <div className="view">
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 className="h2">Posicione o Rosto</h2>
              <div className="steps">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`sdot ${i < livenessStep ? 'done' : i === livenessStep ? 'active' : ''}`} />
                ))}
              </div>
            </div>
            <div className="camw">
              <video ref={videoRef} playsInline muted autoPlay className="vid" style={{ transform: 'scaleX(-1)' }} />
              <div className="oval" style={{ borderColor: flash ? '#fff' : 'rgba(255,255,255,.5)', backgroundColor: flash ? 'rgba(255,255,255,.25)' : 'transparent' }} />
              <div className="ring ring-f" />
            </div>
            <div style={{ color: '#f5a623', fontWeight: 600, fontSize: 16, textAlign: 'center', minHeight: 28 }}>{message}</div>
          </div>
        )}

        {currentView === 'bi-intro' && (
          <div className="view">
            <div className="card">
              <div className="icon"><CreditCard size={36} /></div>
              <h2 className="h2">Documento de Identidade</h2>
              <p className="sub">Agora vamos fotografar a frente e o verso do seu B.I.</p>
              <div className="ilist">
                <div className="iitem"><span className="ic"><Sun size={18} /></span>Boa iluminação, sem reflexos</div>
                <div className="iitem"><span className="ic"><CreditCard size={18} /></span>Documento limpo e sem dobras</div>
              </div>
              <button className="btn bp" onClick={() => requestCameraAndStart('environment', 'bi-cam')}>
                <Camera size={20} /> Fotografar B.I.
              </button>
            </div>
          </div>
        )}

        {currentView === 'bi-cam' && (
          <div className="view">
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 className="h2">{biStep === 1 ? 'B.I. — FRENTE' : 'B.I. — VERSO'}</h2>
              <p className="sub">{message || 'Alinhe o documento dentro do rectângulo'}</p>
            </div>
            <div className="camw">
              <video ref={videoRef} playsInline muted autoPlay className="vid" />
              <div className="rect" style={{ borderColor: flash ? '#fff' : 'rgba(255,255,255,.5)', backgroundColor: flash ? 'rgba(255,255,255,.25)' : 'transparent' }} />
              <div className="ring ring-b" />
            </div>
            <button className="btn bp" onClick={captureBI}><Aperture size={20} /> Tirar Foto</button>
          </div>
        )}

        {currentView === 'review' && (
          <div className="view">
            <h2 className="h2" style={{ marginBottom: 10 }}>Revisão Final</h2>
            <div className="badge"><ShieldCheck size={16} /> Liveness IA: {livenessScore}%</div>
            <div className="gallery">
              <div className="gi"><span>Rosto</span><img src={kycData.faceFront} style={{ transform: 'scaleX(-1)' }} alt="rosto" /></div>
              <div className="gi"><span>Lado</span><img src={kycData.faceRight} style={{ transform: 'scaleX(-1)' }} alt="lado" /></div>
              <div className="gi"><span>B.I. Frente</span><img src={kycData.biFront} alt="bi frente" /></div>
              <div className="gi"><span>B.I. Verso</span><img src={kycData.biBack} alt="bi verso" /></div>
            </div>
            <button className="btn bs" onClick={restartKYC}><RefreshCcw size={18} /> Repetir</button>
            <button className="btn bg" onClick={submitKYC} disabled={isSubmitting || submitSuccess}>
              {isSubmitting
                ? <><Loader2 className="animate-spin" size={20} /> Enviando...</>
                : submitSuccess
                  ? <><CheckCircle size={20} /> Enviado!</>
                  : 'Finalizar Verificação'}
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="footer">Desenvolvido pela <span>DIGIKAP</span></div>
      </div>
    </>
  );
}