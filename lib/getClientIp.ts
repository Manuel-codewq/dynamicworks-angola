import { NextRequest } from "next/server";

/**
 * Extrai o IP real do cliente de forma resistente a spoofing.
 *
 * Prioridade (do mais confiável para o menos):
 *  1. x-vercel-forwarded-for  — definido pela infra Vercel, não pelo cliente
 *  2. cf-connecting-ip        — definido pela Cloudflare, não pelo cliente
 *  3. x-real-ip               — definido por proxies de confiança (nginx, etc.)
 *  4. x-forwarded-for         — apenas o ÚLTIMO IP (adicionado pelo proxy mais próximo)
 *     O primeiro IP pode ser falsificado pelo cliente; o último é adicionado pelo proxy.
 *
 * NOTA: x-forwarded-for só é seguro se o servidor de entrada strip/override o header.
 * Em ambientes sem proxy de confiança (dev local), cai para "unknown".
 */
export function getClientIp(req: NextRequest): string {
  // Vercel injeta este header no edge — não pode ser falsificado pelo cliente
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  // Cloudflare injeta este header — não pode ser falsificado pelo cliente
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Proxy de confiança (nginx/traefik configurado para sobrescrever)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback: PRIMEIRO IP do x-forwarded-for (IP original do cliente)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  return "unknown";
}
