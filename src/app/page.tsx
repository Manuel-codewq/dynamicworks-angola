'use client';

import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import TradingDashboard from '@/components/TradingDashboard';
import { useStore } from '@/store';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const setAcct = useStore((state) => state.setAcct);
  const setIsDemo = useStore((state) => state.setIsDemo);

  useEffect(() => {
    // 1. Processar token de login caso a Deriv redirecione de volta com os dados no URL
    const parseCallback = () => {
      const str = (window.location.hash || '').replace('#', '') || (window.location.search || '').replace('?', '');
      if (!str) return false;
      
      const params: Record<string, string> = {};
      str.split('&').forEach(p => {
        const kv = p.split('=');
        if (kv.length >= 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      });
      
      if (params.acct1 && params.token1) {
        // Limpar os parametros do URL para ficar bonito
        try { window.history.replaceState(null, '', window.location.pathname); } catch(e){}
        
        localStorage.setItem('dw_token', params.token1);
        localStorage.setItem('dw_token_ts', Date.now().toString());
        localStorage.setItem('dw_acct', params.acct1);
        sessionStorage.setItem('dw_oauth_acct', params.acct1);
        
        setAcct(params.acct1);
        setIsDemo(params.acct1.startsWith('VRTC'));
        return true;
      }
      return false;
    };

    const hasNewToken = parseCallback();

    // 2. Verificar a sessão
    const checkSession = async () => {
      const acct = localStorage.getItem('dw_acct');
      const token = localStorage.getItem('dw_token') || sessionStorage.getItem('dw_oauth_token');
      
      // Validação simples (token expira apos 24h na versao vanilla)
      if (acct && token) {
        setAcct(acct);
        setIsDemo(acct.startsWith('VRTC') || token === 'DEMO');
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    
    checkSession();
  }, []);

  const AFFILIATE_LINK = 'https://deriv.partners/rx?sidc=B479A9FF-7DC5-4C81-9632-335E7571345B&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU301183';

  const handleLoginClick = () => {
    // Redirecionar para o OAuth da Deriv com App ID próprio
    const r = encodeURIComponent(window.location.origin + window.location.pathname);
    const APP_ID = 127916;
    const url = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&redirect_uri=${r}&l=PT`;
    window.location.href = url;
  };

  const handleRegisterClick = () => {
    // Link de parceiro DynamicWorks — atribui o novo utilizador à conta de afiliado
    window.open(AFFILIATE_LINK, '_blank');
  };

  const handleDemoAccess = () => {
    const demoAcct = 'VRTC-DEMO-BYPASS';
    const demoToken = 'DEMO_TOKEN_BYPASS';
    localStorage.setItem('dw_acct', demoAcct);
    localStorage.setItem('dw_token', demoToken);
    setAcct(demoAcct);
    setIsDemo(true);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dw_acct');
    localStorage.removeItem('dw_token');
    localStorage.removeItem('dw_token_ts');
    sessionStorage.removeItem('dw_oauth_token');
    sessionStorage.removeItem('dw_oauth_acct');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div id="s-loading" className="screen active" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06090f" }}>
        <div style={{ position: "absolute", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle,rgba(0,212,255,.07) 0%,transparent 70%)", pointerEvents: "none", top: "50%", left: "50%", transform: "translate(-50%,-60%)" }}></div>
        <div className="loading-logo">Dynamic<b>Works</b></div>
        <div className="loading-tagline">🇦🇴 Angola · Trading Platform</div>
        <div className="loading-text">A verificar sessão...</div>
        <div style={{fontSize: "0.6rem", color: "var(--text3)", position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", letterSpacing: "1px", fontWeight: "700"}}>Desenvolvido por DIGIKAP AO</div>
      </div>
    );
  }

  return (
    <main>
      {!isAuthenticated ? (
        <LandingPage onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} onDemoAccess={handleDemoAccess} />
      ) : (
        <TradingDashboard onLogout={handleLogout} />
      )}
    </main>
  );
}
