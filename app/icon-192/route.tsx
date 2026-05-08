import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#f5a623",
          borderRadius: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* SVG candlestick inline via img não funciona no edge — usar divs */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, paddingBottom: 14 }}>

          {/* Vela 1 — bearish (preenchida) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ width: 3, height: 14, background: "#0a0f1e", borderRadius: 2 }} />
            <div style={{ width: 22, height: 46, background: "#0a0f1e", borderRadius: 5 }} />
            <div style={{ width: 3, height: 20, background: "#0a0f1e", borderRadius: 2 }} />
          </div>

          {/* Vela 2 — bullish (contorno) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginBottom: 10 }}>
            <div style={{ width: 3, height: 18, background: "#0a0f1e", borderRadius: 2 }} />
            <div style={{
              width: 22, height: 58,
              background: "transparent",
              border: "3px solid #0a0f1e",
              borderRadius: 5,
            }} />
            <div style={{ width: 3, height: 10, background: "#0a0f1e", borderRadius: 2 }} />
          </div>

          {/* Vela 3 — bearish curta (preenchida) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginBottom: 4 }}>
            <div style={{ width: 3, height: 12, background: "#0a0f1e", borderRadius: 2 }} />
            <div style={{ width: 22, height: 36, background: "#0a0f1e", borderRadius: 5 }} />
            <div style={{ width: 3, height: 22, background: "#0a0f1e", borderRadius: 2 }} />
          </div>
        </div>

        {/* Linha de base */}
        <div style={{
          position: "absolute",
          bottom: 22,
          left: 16,
          right: 16,
          height: 3,
          background: "#0a0f1e",
          borderRadius: 2,
          opacity: 0.35,
        }} />
      </div>
    ),
    { width: 192, height: 192 }
  );
}
