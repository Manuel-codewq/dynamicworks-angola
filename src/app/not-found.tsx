import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Página Não Encontrada | DynamicWorks',
  description: 'A página que procuras não existe.',
};

export default function NotFound() {
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
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{
          fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.03em',
          color: '#fff',
        }}>
          Dynamic<span style={{ color: '#00d4ff' }}>Works</span>
        </div>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginTop: '3px' }}>
          POWERED BY DIGIKAP
        </div>
      </div>

      {/* 404 */}
      <div style={{
        fontSize: 'clamp(7rem, 20vw, 12rem)',
        fontWeight: 900,
        lineHeight: 1,
        background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.04) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        border: '1px solid rgba(0,212,255,0.08)',
        borderRadius: '24px',
        padding: '1rem 2.5rem',
        fontFamily: 'monospace',
        position: 'relative',
      }}>
        404
        {/* Scanline decoration */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '24px',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,212,255,0.02) 4px, rgba(0,212,255,0.02) 5px)',
          pointerEvents: 'none',
        }} />
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center', maxWidth: '380px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#fff' }}>
          Página Não Encontrada
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: '0 0 2rem' }}>
          A rota que tentaste aceder não existe ou foi removida.
          Verifica o endereço ou volta à plataforma.
        </p>

        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '0.75rem 2rem',
          background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
          color: '#000',
          fontWeight: 800,
          fontSize: '0.85rem',
          borderRadius: '12px',
          textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}>
          ← Voltar à Plataforma
        </Link>
      </div>

      {/* Bottom grid decoration */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px',
        background: 'linear-gradient(to top, rgba(0,212,255,0.03), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
