// Formata número com pontos como separador de milhares (1.000.000)
// Garante formato consistente em todos os browsers e ambientes SSR
export function formatNum(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = n < 0 ? "-" : "";
  return decPart !== undefined ? `${sign}${withDots},${decPart}` : `${sign}${withDots}`;
}

// Formata valor em Kwanza: 1.500.000 Kz
export function formatKz(n: number): string {
  return formatNum(Math.floor(n)) + " Kz";
}

// Formata valor em USDT: 12,3500 USDT
export function formatUsdt(n: number): string {
  return formatNum(n, 4) + " USDT";
}
