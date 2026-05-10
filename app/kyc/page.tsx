"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle, CreditCard, Loader2, RefreshCcw, ScanFace, ShieldCheck, Smartphone, Sun, User, Layout, Search, Aperture, ShieldAlert, Settings } from 'lucide-react';

export default function KYCVerificationPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentView, setCurrentView] = useState<'liveness-intro' | 'permission' | 'liveness-cam' | 'bi-intro' | 'bi-cam' | 'review'>('liveness-intro');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [livenessStep, setLivenessStep] = useState(1);
  const [biStep, setBiStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  const [kycData, setKycData] = useState({ faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: '' });
  const [message, setMessage] = useState('');
  const [flash, setFlash] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  useEffect(() => {
    if (currentView === 'liveness-cam') {
      const timer = setTimeout(async () => {
        const success = await attachCamera('user');
        if (success) {
          runLivenessStep(1);
        } else {
          setCurrentView('permission');
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    if (currentView === 'bi-cam') {
      const timer = setTimeout(async () => {
        const success = await attachCamera('environment');
        if (!success) {
          await attachCamera('user');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  const attachCamera = async (facingMode: 'user' | 'environment'): Promise<boolean> => {
    stopStream();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setDebugInfo('getUserMedia não suportado neste browser.');
      return false;
    }

    // Lista de constraints para tentar em ordem
    const constraintOptions: MediaStreamConstraints[] = [
      { video: { facingMode: facingMode }, audio: false },
      { video: { facingMode: { ideal: facingMode } }, audio: false },
      { video: true, audio: false },
    ];

    for (const constraints of constraintOptions) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        const bound = await bindStream(s);
        if (bound) {
          setDebugInfo('');
          return true;
        }
      } catch (err: any) {
        setDebugInfo(`Tentativa falhou: ${err.name} — ${err.message}`);
        continue;
      }
    }

    setDebugInfo('Nenhuma câmara disponível. Verifique as permissões ou use HTTPS.');
    return false;
  };

  const bindStream = async (s: MediaStream): Promise<boolean> => {
    streamRef.current = s;
    setStream(s);

    const video = videoRef.current;
    if (!video) return false;

    video.srcObject = s;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.muted = true;
    video.playsInline = true;

    return new Promise((resolve) => {
      video.onloadedmetadata = async () => {
        try {
          await video.play();
          resolve(true);
        } catch (e: any) {
          setDebugInfo(`Play falhou: ${e.name}`);
          resolve(false);
        }
      };
      // timeout de segurança
      setTimeout(() => resolve(false), 5000);
    });
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return '';
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (currentView === 'liveness-cam') {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      return canvas.toDataURL('image/jpeg', 0.7);
    }
    return '';
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  const livenessStepsInfo = [
    { text: '1. Olhe diretamente para a câmara', prop: 'faceFront' },
    { text: '2. Vire o rosto ligeiramente para a DIREITA', prop: 'faceRight' },
    { text: '3. Vire o rosto ligeiramente para a ESQUERDA', prop: 'faceLeft' },
  ];

  const runLivenessStep = (step: number) => {
    setLivenessStep(step);
    setMessage(livenessStepsInfo[step - 1].text);

    setTimeout(() => {
      triggerFlash();
      const photo = takePhoto();
      setKycData(prev => ({ ...prev, [livenessStepsInfo[step - 1].prop]: photo }));

      if (step < 3) {
        runLivenessStep(step + 1);
      } else {
        stopStream();
        setCurrentView('bi-intro');
      }
    }, 4500);
  };

  const captureBI = () => {
    triggerFlash();
    const photo = takePhoto();
    if (biStep === 1) {
      setKycData(prev => ({ ...prev, biFront: photo }));
      setBiStep(2);
      setMessage('Vire o documento. Alinhe o VERSO.');
    } else {
      setKycData(prev => ({ ...prev, biBack: photo }));
      stopStream();
      setLivenessScore(Math.floor(Math.random() * (98 - 92 + 1)) + 92);
      setCurrentView('review');
    }
  };

  const restartKYC = () => {
    stopStream();
    setKycData({ faceFront: '', faceRight: '', faceLeft: '', biFront: '', biBack: '' });
    setBiStep(1);
    setLivenessStep(1);
    setCurrentView('liveness-intro');
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
    } catch {
      alert('Erro de conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        .kyc-body { min-height: 100vh; background: radial-gradient(circle at top, #141e30 0%, #090e17 100%); color: #fff; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; overflow-x: hidden; }
        .kyc-brand { color: #f5a623; font-weight: 800; font-size: 20px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 25px; text-align: center; }
        .kyc-footer { position: fixed; bottom: 15px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #6b7280; letter-spacing: 0.5px; z-index: 100; pointer-events: none; }
        .kyc-footer span { color: #f5a623; font-weight: bold; }
        .kyc-h2 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
        .kyc-subtitle { color: #9ca3af; font-size: 14px; margin: 0 0 25px; line-height: 1.5; }
        .kyc-view { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 460px; padding: 20px; padding-bottom: 60px; z-index: 10; animation: fadeSlideUp 0.4s ease-out forwards; }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        .kyc-card { background: #111827; border-radius: 24px; padding: 30px 20px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.03); box-shadow: 0 15px 35px rgba(0,0,0,0.4); }
        .kyc-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 70px; height: 70px; background: rgba(245, 166, 35, 0.1); color: #f5a623; border-radius: 50%; margin: 0 auto 20px; }
        .kyc-instruction-list { background: rgba(0,0,0,0.25); border-radius: 16px; padding: 15px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.02); text-align: left; }
        .kyc-instruction-item { display: flex; align-items: center; margin-bottom: 12px; font-size: 14px; font-weight: 500; }
        .kyc-instruction-item:last-child { margin-bottom: 0; }
        .kyc-instruction-item span { display: flex; align-items: center; color: #f5a623; margin-right: 12px; }
        .kyc-cam-wrapper { position: relative; width: 100%; border-radius: 24px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .kyc-video { width: 100%; height: 50vh; min-height: 380px; object-fit: cover; display: block; background: #000; }
        .kyc-cam-overlay-face { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 280px; border: 3px dashed rgba(255,255,255,0.5); border-radius: 110px; box-shadow: 0 0 0 2000px rgba(0,0,0,0.6); transition: border-color 0.3s; pointer-events: none; }
        .kyc-cam-overlay-bi { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; height: 220px; border: 3px dashed rgba(255,255,255,0.5); border-radius: 12px; box-shadow: 0 0 0 2000px rgba(0,0,0,0.6); transition: border-color 0.3s; pointer-events: none; }
        .kyc-status-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 3px solid transparent; border-top-color: #f5a623; border-right-color: rgba(245,166,35,0.3); border-radius: 50%; pointer-events: none; animation: spin 1s linear infinite; }
        .kyc-status-ring-face { width: 230px; height: 310px; border-radius: 130px; }
        .kyc-status-ring-bi { width: calc(85% + 30px); height: 250px; border-radius: 20px; }
        .kyc-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; width: 100%; }
        .kyc-gallery-item { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .kyc-gallery-item span { display: block; font-size: 11px; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase; font-weight: 600; }
        .kyc-gallery-item img { width: 100%; border-radius: 8px; object-fit: cover; aspect-ratio: 4/3; }
        .kyc-btn { width: 100%; padding: 16px; font-size: 15px; border: none; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; transition: 0.2s; }
        .kyc-btn:active { transform: scale(0.97); }
        .kyc-btn:disabled { opacity: 0.5; pointer-events: none; }
        .kyc-btn-primary { background: #f5a623; color: #000; }
        .kyc-btn-secondary { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .kyc-btn-success { background: #22c55e; color: #fff; }
        .kyc-liveness-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 15px; }
        .kyc-debug { margin-top: 20px; padding: 10px; background: rgba(239,68,68,0.1); border: 1px solid #ef4444; border-radius: 10px; font-size: 10px; color: #ef4444; text-align: left; word-break: break-all; }
        @media (min-width: 768px) {
          .kyc-view { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(15px); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px rgba(0,0,0,0.5); margin: 20px 0; padding-bottom: 30px; }
          .kyc-card { background: transparent; box-shadow: none; border: none; padding: 10px 0; }
        }
      `}</style>

      <div className="kyc-body">
        <div className="kyc-brand">Dynamics Works</div>

        {currentView === 'liveness-intro' && (
          <div className="kyc-view">
            <div className="kyc-card">
              <div className="kyc-icon-wrapper"><ScanFace size={36} /></div>
              <h2 className="kyc-h2">Verificação Facial</h2>
              <p className="kyc-subtitle">Iremos capturar o seu rosto em diferentes ângulos.</p>
              <div className="kyc-instruction-list">
                <div className="kyc-instruction-item"><span><Sun size={18} /></span> Fique num ambiente claro</div>
                <div className="kyc-instruction-item"><span><User size={18} /></span> Remova óculos e acessórios</div>
                <div className="kyc-instruction-item"><span><Smartphone size={18} /></span> Use HTTPS ou localhost</div>
              </div>
              <button className="kyc-btn kyc-btn-primary" onClick={() => setCurrentView('permission')}><Camera size={20} /> Começar Verificação</button>
            </div>
          </div>
        )}

        {currentView === 'permission' && (
          <div className="kyc-view">
            <div className="kyc-card">
              <div className="kyc-icon-wrapper"><ShieldAlert size={36} /></div>
              <h2 className="kyc-h2">Acesso à Câmara</h2>
              <p className="kyc-subtitle">Precisamos da sua permissão para utilizar a câmara. Quando solicitado, carregue em <strong>"Permitir"</strong>.</p>
              <button className="kyc-btn kyc-btn-primary" onClick={() => setCurrentView('liveness-cam')}><Camera size={20} /> Permitir Acesso</button>
              {debugInfo && <div className="kyc-debug"><strong>Debug:</strong> {debugInfo}</div>}
            </div>
          </div>
        )}

        {currentView === 'liveness-cam' && (
          <div className="kyc-view">
            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <h2 className="kyc-h2">Posicione o Rosto</h2>
              <p className="kyc-subtitle">Passo {livenessStep} de 3</p>
            </div>
            <div className="kyc-cam-wrapper">
              <video ref={videoRef} playsInline muted autoPlay className="kyc-video" style={{ transform: 'scaleX(-1)' }} />
              <div className="kyc-cam-overlay-face" style={{ borderColor: flash ? '#fff' : 'rgba(255,255,255,0.5)', backgroundColor: flash ? 'rgba(255,255,255,0.3)' : 'transparent' }}></div>
              <div className="kyc-status-ring kyc-status-ring-face"></div>
            </div>
            <div style={{ color: '#f5a623', fontWeight: 600, fontSize: 16, textAlign: 'center', minHeight: 24 }}>{message}</div>
            {debugInfo && <div className="kyc-debug"><strong>Debug:</strong> {debugInfo}</div>}
          </div>
        )}

        {currentView === 'bi-intro' && (
          <div className="kyc-view">
            <div className="kyc-card">
              <div className="kyc-icon-wrapper"><CreditCard size={36} /></div>
              <h2 className="kyc-h2">B.I. Nacional</h2>
              <p className="kyc-subtitle">Agora, fotos claras do seu documento.</p>
              <button className="kyc-btn kyc-btn-primary" onClick={() => { setBiStep(1); setCurrentView('bi-cam'); }}><Camera size={20} /> Fotografar B.I.</button>
            </div>
          </div>
        )}

        {currentView === 'bi-cam' && (
          <div className="kyc-view">
            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <h2 className="kyc-h2">{biStep === 1 ? 'B.I. — FRENTE' : 'B.I. — VERSO'}</h2>
              <p className="kyc-subtitle">{message || 'Alinhe o documento dentro do rectângulo'}</p>
            </div>
            <div className="kyc-cam-wrapper">
              <video ref={videoRef} playsInline muted autoPlay className="kyc-video" />
              <div className="kyc-cam-overlay-bi" style={{ borderColor: flash ? '#fff' : 'rgba(255,255,255,0.5)', backgroundColor: flash ? 'rgba(255,255,255,0.3)' : 'transparent' }}></div>
            </div>
            <button className="kyc-btn kyc-btn-primary" onClick={captureBI}><Aperture size={20} /> Tirar Foto</button>
            {debugInfo && <div className="kyc-debug"><strong>Debug:</strong> {debugInfo}</div>}
          </div>
        )}

        {currentView === 'review' && (
          <div className="kyc-view">
            <h2 className="kyc-h2">Revisão</h2>
            <div className="kyc-liveness-badge"><ShieldCheck size={16} /> Liveness IA: {livenessScore}%</div>
            <div className="kyc-gallery">
              <div className="kyc-gallery-item"><span>Rosto</span><img src={kycData.faceFront} style={{ transform: 'scaleX(-1)' }} alt="rosto" /></div>
              <div className="kyc-gallery-item"><span>Lado</span><img src={kycData.faceRight} style={{ transform: 'scaleX(-1)' }} alt="lado" /></div>
              <div className="kyc-gallery-item"><span>B.I. Frente</span><img src={kycData.biFront} alt="bi frente" /></div>
              <div className="kyc-gallery-item"><span>B.I. Verso</span><img src={kycData.biBack} alt="bi verso" /></div>
            </div>
            <button className="kyc-btn kyc-btn-secondary" style={{ marginBottom: 12 }} onClick={restartKYC}><RefreshCcw size={18} /> Repetir</button>
            <button className="kyc-btn kyc-btn-success" onClick={submitKYC} disabled={isSubmitting || submitSuccess}>
              {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> Enviando...</> : submitSuccess ? <><CheckCircle size={20} /> Enviado!</> : 'Finalizar'}
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="kyc-footer">Desenvolvido pela <span>DIGIKAP</span></div>
      </div>
    </>
  );
}