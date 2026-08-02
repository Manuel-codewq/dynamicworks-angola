import { Coins, Droplet, type LucideIcon } from "lucide-react";
import { CURRENCY_FLAGS, CRYPTO_ICONS } from "@/lib/assets";

// Matérias-primas não têm pacote de ícones equivalente ao flag-icons/
// cryptocurrency-icons — usa-se o que já existe em lucide-react (já é
// dependência do projecto) em vez de instalar mais um pacote só para 3 ícones.
const COMMODITY_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  XAU: { Icon: Coins,   color: "#eab308" }, // ouro
  XAG: { Icon: Coins,   color: "#94a3b8" }, // prata
  WTI: { Icon: Droplet, color: "#1e293b" }, // petróleo
};

type Badge = { kind: "img"; src: string } | { kind: "icon"; Icon: LucideIcon; color: string };

function resolveBadge(code: string): Badge | undefined {
  if (CURRENCY_FLAGS[code]) return { kind: "img", src: CURRENCY_FLAGS[code] };
  if (CRYPTO_ICONS[code])   return { kind: "img", src: CRYPTO_ICONS[code] };
  if (COMMODITY_ICONS[code]) return { kind: "icon", ...COMMODITY_ICONS[code] };
  return undefined;
}

function BadgeCircle({ badge, size, overlap }: { badge: Badge; size: number; overlap?: boolean }) {
  const style: React.CSSProperties = overlap
    ? { position: "absolute", bottom: -1, right: -1, width: size, height: size, borderRadius: "50%", border: "1.5px solid #0a0f1e" }
    : { position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: "50%" };

  if (badge.kind === "img") {
    return <img src={badge.src} alt="" style={{ ...style, objectFit: "cover", display: "block" }} />;
  }
  const { Icon, color } = badge;
  return (
    <span style={{ ...style, background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={Math.round(size * 0.62)} color={color} strokeWidth={2.5} />
    </span>
  );
}

/**
 * Ícone de um par/instrumento:
 * - Par com "/" (forex, cripto, matérias-primas — ex: "EUR/USD OTC",
 *   "BTC/USD OTC", "XAU/USD OTC"): duas badges sobrepostas (base + quote).
 * - Instrumento único, sem "/" (acções — ex: "AAPL OTC"): um único círculo
 *   cinza neutro com a sigla, sem tentar imitar o logo real da empresa (sem
 *   licença para isso).
 */
export default function CoinIcon({ label, size = 22 }: { label: string; size?: number }) {
  const pairMatch = label.match(/^([A-Z]{3})\/([A-Z]{3})/);
  if (pairMatch) {
    const base  = resolveBadge(pairMatch[1]);
    const quote = resolveBadge(pairMatch[2]);
    if (!base || !quote) return null;
    const small = Math.round(size * 0.62);
    return (
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
        <BadgeCircle badge={base} size={size} />
        <BadgeCircle badge={quote} size={small} overlap />
      </span>
    );
  }

  const tickerMatch = label.match(/^([A-Z]{2,6})\b/);
  if (!tickerMatch) return null;
  const ticker = tickerMatch[1];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#2a3348", color: "#cbd5e1", fontWeight: 800, fontFamily: "monospace",
      fontSize: Math.max(7, size * 0.28),
    }}>
      {ticker.length > 4 ? ticker.slice(0, 4) : ticker}
    </span>
  );
}
