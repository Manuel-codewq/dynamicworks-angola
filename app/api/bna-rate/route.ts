import { NextResponse } from "next/server";

const CACHE_SECONDS = 3600;

export async function GET() {
  let usdToKz: number;
  let source: "bna" | "env" | "default";

  try {
    const res = await fetch("https://www.bna.ao/api/taxas", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`BNA HTTP ${res.status}`);

    const data = await res.json();

    // BNA response shape varies — try common paths
    const rate =
      data?.taxas?.USD ??
      data?.USD ??
      data?.data?.find?.((r: any) => r?.moeda === "USD" || r?.currency === "USD")?.taxa ??
      data?.find?.((r: any) => r?.moeda === "USD" || r?.currency === "USD")?.taxa;

    if (!rate || !isFinite(Number(rate))) throw new Error("Rate not found in BNA response");

    usdToKz = Number(rate);
    source   = "bna";
  } catch {
    const envRate = parseFloat(process.env.BNA_USD_RATE ?? "");
    usdToKz = isFinite(envRate) && envRate > 0 ? envRate : 920;
    source   = isFinite(envRate) && envRate > 0 ? "env" : "default";
  }

  return NextResponse.json(
    { usdToKz, source },
    { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } },
  );
}
