export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Se a secret key não estiver configurada, ignorar verificação
  if (!secret) return true;

  // Token vazio → falhar
  if (!token) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    // Em caso de falha de rede, deixar passar para não bloquear utilizadores legítimos
    return true;
  }
}
