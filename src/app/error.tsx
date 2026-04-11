'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DynamicWorks] Runtime error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06090f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
      color: '#fff',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,61,90,0.06) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
          Dynamic<span style={{ color: '#00d4ff' }}>Works</span>
        </div>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginTop: '3px' }}>
          POWERED BY DIGIKAP
        </div>
      </div>

      {/* Error icon */}
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%',
        background: 'rgba(255,61,90,0.1)',
        border: '1px solid rgba(255,61,90,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2.2rem', marginBottom: '1.5rem',
      }}>
        ⚠️
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem', textAlign: 'center' }}>
        Ocorreu um Erro
      </h1>
      <p style={{
        fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center',
        maxWidth: '360px', lineHeight: 1.7, margin: '0 0 0.75rem',
      }}>
        Algo inesperado aconteceu na plataforma. A nossa equipa foi notificada.
      </p>

      {error?.digest && (
        <div style={{
          fontFamily: 'monospace', fontSize: '0.65rem',
          color: 'rgba(255,61,90,0.6)',
          background: 'rgba(255,61,90,0.06)',
          border: '1px solid rgba(255,61,90,0.15)',
          borderRadius: '8px', padding: '6px 12px',
          marginBottom: '1.75rem',
        }}>
          Código: {error.digest}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '0.72rem 1.75rem',
            background: 'linear-gradient(135deg, #ff3d5a 0%, #cc0022 100%)',
            color: '#fff', fontWeight: 800, fontSize: '0.82rem',
            borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↻ Tentar Novamente
        </button>
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '0.72rem 1.75rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.82rem',
          borderRadius: '12px', textDecoration: 'none',
        }}>
          ← Página Inicial
        </Link>
      </div>
    </div>
  );
}
