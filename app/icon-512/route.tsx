import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#f5a623",
          borderRadius: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {/* Candlesticks */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 26 }}>

            {/* Vela 1 — bearish */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 8, height: 38, background: "#0a0f1e", borderRadius: 4 }} />
              <div style={{ width: 58, height: 122, background: "#0a0f1e", borderRadius: 12 }} />
              <div style={{ width: 8, height: 52, background: "#0a0f1e", borderRadius: 4 }} />
            </div>

            {/* Vela 2 — bullish (contorno) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
              <div style={{ width: 8, height: 48, background: "#0a0f1e", borderRadius: 4 }} />
              <div style={{
                width: 58, height: 156,
                background: "transparent",
                border: "8px solid #0a0f1e",
                borderRadius: 12,
              }} />
              <div style={{ width: 8, height: 28, background: "#0a0f1e", borderRadius: 4 }} />
            </div>

            {/* Vela 3 — bearish curta */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 8, height: 32, background: "#0a0f1e", borderRadius: 4 }} />
              <div style={{ width: 58, height: 96, background: "#0a0f1e", borderRadius: 12 }} />
              <div style={{ width: 8, height: 60, background: "#0a0f1e", borderRadius: 4 }} />
            </div>
          </div>

          {/* Linha de base */}
          <div style={{
            width: 260,
            height: 8,
            background: "#0a0f1e",
            borderRadius: 4,
            opacity: 0.3,
            marginTop: 10,
          }} />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
