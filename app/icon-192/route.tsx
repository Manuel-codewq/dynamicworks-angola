import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(_req: NextRequest) {
  return new ImageResponse(
    <div style={{
      width: 192, height: 192, background: "#f5a623",
      borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#0a0f1e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    </div>,
    { width: 192, height: 192 }
  );
}
