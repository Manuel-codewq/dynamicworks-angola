import { CURRENCY_FLAGS } from "@/lib/assets";

/** Duas bandeiras sobrepostas (moeda base + moeda quote) para um par tipo "EUR/USD OTC". */
export default function CoinIcon({ label, size = 22 }: { label: string; size?: number }) {
  const match = label.match(/^([A-Z]{3})\/([A-Z]{3})/);
  const base  = match ? CURRENCY_FLAGS[match[1]] : undefined;
  const quote = match ? CURRENCY_FLAGS[match[2]] : undefined;
  if (!base || !quote) return null;
  const small = Math.round(size * 0.62);
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <img src={base} alt="" style={{
        position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: "50%",
        objectFit: "cover", display: "block",
      }} />
      <img src={quote} alt="" style={{
        position: "absolute", bottom: -1, right: -1, width: small, height: small, borderRadius: "50%",
        objectFit: "cover", display: "block", border: "1.5px solid #0a0f1e",
      }} />
    </span>
  );
}
