"use client";
import { Share2, Download } from "lucide-react";

interface Props {
  trade: {
    asset:      string;
    direction:  string;
    result:     string;
    profit:     number;
    amount:     number;
    payout?:    number;
    createdAt:  string;
  };
  size?: "sm" | "md";
}

function formatKz(n: number) {
  return Math.abs(Math.floor(n)).toLocaleString("pt-PT") + " Kz";
}

export default function TradeShareButton({ trade, size = "md" }: Props) {
  async function generateAndShare() {
    const canvas  = document.createElement("canvas");
    const W = 800, H = 440;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const isWin = trade.result === "win";
    const accentColor = isWin ? "#22c55e" : "#ef4444";
    const dirLabel    = trade.direction === "call" ? "▲ ALTA" : "▼ BAIXA";
    const profitAbs   = Math.abs(Math.floor(trade.profit));

    // ── Background ─────────────────────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0f1e");
    grad.addColorStop(1, "#070d1a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Glow de fundo
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 300);
    glow.addColorStop(0, isWin ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = accentColor + "44";
    ctx.lineWidth   = 2;
    roundRect(ctx, 20, 20, W - 40, H - 40, 20);
    ctx.stroke();

    // ── Logo ───────────────────────────────────────────────────────────────
    ctx.fillStyle = "#f5a623";
    roundRect(ctx, 48, 48, 44, 44, 10);
    ctx.fill();
    ctx.fillStyle = "#0a0f1e";
    ctx.font      = "bold 26px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("D", 70, 77);

    ctx.fillStyle = "#f5a623";
    ctx.font      = "bold 18px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Dynamics Works", 104, 72);

    ctx.fillStyle = "#94a3b8";
    ctx.font      = "12px system-ui";
    ctx.fillText("PLATAFORMA DE NEGOCIAÇÃO · ANGOLA", 104, 90);

    // ── Result badge ───────────────────────────────────────────────────────
    ctx.fillStyle = accentColor + "22";
    roundRect(ctx, W - 200, 44, 152, 44, 10);
    ctx.fill();
    ctx.strokeStyle = accentColor + "66";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.fillStyle = accentColor;
    ctx.font      = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(isWin ? "✓ GANHOU" : "✗ PERDEU", W - 124, 72);

    // ── Divider ────────────────────────────────────────────────────────────
    ctx.strokeStyle = "#1e2d50";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(48, 116);
    ctx.lineTo(W - 48, 116);
    ctx.stroke();

    // ── Asset & direction ─────────────────────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 38px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(trade.asset, 48, 168);

    ctx.fillStyle = trade.direction === "call" ? "#22c55e" : "#ef4444";
    ctx.font      = "bold 22px system-ui";
    ctx.fillText(dirLabel, 48, 200);

    // ── Stats grid ─────────────────────────────────────────────────────────
    const stats = [
      { label: "Investimento", value: formatKz(trade.amount), color: "#94a3b8" },
      { label: isWin ? "Lucro" : "Perda",    value: (isWin ? "+" : "−") + formatKz(profitAbs), color: accentColor },
      { label: "Payout", value: `${Math.round((trade.payout ?? 0.74) * 100)}%`, color: "#f5a623" },
    ];

    const colW = (W - 96) / 3;
    stats.forEach((s, i) => {
      const x = 48 + i * colW;
      const y = 250;

      ctx.fillStyle = "#111827";
      roundRect(ctx, x + 4, y, colW - 12, 100, 12);
      ctx.fill();
      ctx.strokeStyle = "#1e2d50";
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font      = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(s.label.toUpperCase(), x + colW / 2, y + 28);

      ctx.fillStyle = s.color;
      ctx.font      = "bold 22px system-ui";
      ctx.fillText(s.value, x + colW / 2, y + 64);
    });

    // ── Date ───────────────────────────────────────────────────────────────
    const date = new Date(trade.createdAt).toLocaleString("pt-PT", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda",
    });
    ctx.fillStyle = "#475569";
    ctx.font      = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(date + " · dynamicworks.ao", W / 2, H - 36);

    // ── Share ──────────────────────────────────────────────────────────────
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `trade-${trade.asset.replace("/", "-")}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files:  [file],
            title:  `${isWin ? "Ganhei" : "Operação"} em ${trade.asset}!`,
            text:   `${dirLabel} ${trade.asset} — ${isWin ? "+" : "−"}${formatKz(profitAbs)} · Dynamics Works Angola`,
          });
          return;
        } catch { /* fallback to download */ }
      }
      // Fallback: download
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `trade-${trade.asset.replace("/", "-")}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  const isSmall = size === "sm";
  return (
    <button
      onClick={generateAndShare}
      title="Partilhar resultado"
      style={{
        display: "flex", alignItems: "center", gap: isSmall ? 4 : 6,
        background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)",
        borderRadius: isSmall ? 6 : 8, padding: isSmall ? "4px 8px" : "6px 12px",
        color: "#f5a623", cursor: "pointer", fontSize: isSmall ? 11 : 12, fontWeight: 700,
      }}
    >
      <Share2 size={isSmall ? 11 : 13} />
      {isSmall ? "" : "Partilhar"}
    </button>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
