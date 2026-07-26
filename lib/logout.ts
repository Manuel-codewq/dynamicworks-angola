import { signOut } from "next-auth/react";

/**
 * Logout que revoga a UserSession no servidor antes de limpar o cookie —
 * signOut() sozinho só limpa o lado do cliente; sem isto, um JWT copiado
 * antes do logout continuava válido no servidor até expirar (até 7 dias).
 * Reutiliza a mesma rota que já revoga sessões individuais a partir do
 * painel "Sessões activas" (app/api/sessions/[id]/revoke/route.ts).
 */
export async function performLogout(sessionId: string | null | undefined, callbackUrl = "/login") {
  if (sessionId) {
    await fetch(`/api/sessions/${sessionId}/revoke`, { method: "POST" }).catch(() => {});
  }
  await signOut({ callbackUrl });
}
