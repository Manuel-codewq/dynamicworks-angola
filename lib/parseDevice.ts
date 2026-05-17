export function parseDevice(userAgent: string): string {
  if (!userAgent) return "Dispositivo desconhecido";

  const ua = userAgent.toLowerCase();

  let os = "Desconhecido";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "Desconhecido";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";

  return `${browser} — ${os}`;
}
