export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ color: "#f5a623", fontSize: 120, fontWeight: 900, lineHeight: 1, opacity: 0.3, userSelect: "none" }}>
          404
        </div>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "8px 0 12px" }}>
          Página não encontrada
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, margin: "0 0 36px" }}>
          A página que procura não existe ou foi movida.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <a href="/trade" style={{
            display: "inline-block", background: "#f5a623", color: "#0a0f1e",
            borderRadius: 10, padding: "13px 32px", fontWeight: 700, fontSize: 15,
            textDecoration: "none", width: "100%", maxWidth: 280, textAlign: "center",
          }}>
            Voltar à plataforma
          </a>
          <a href="/login" style={{
            display: "inline-block", background: "transparent", color: "#94a3b8",
            border: "1px solid #1e2d50", borderRadius: 10, padding: "13px 32px",
            fontWeight: 600, fontSize: 15, textDecoration: "none",
            width: "100%", maxWidth: 280, textAlign: "center",
          }}>
            Ir para login
          </a>
        </div>
      </div>
    </div>
  );
}
