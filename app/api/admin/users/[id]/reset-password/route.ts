import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (user.role === "admin") return NextResponse.json({ error: "Não é possível repor a senha de um administrador" }, { status: 403 });

  const tempPassword = generatePassword();
  const hashed = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { password: hashed, otpCode: null, otpExpires: null },
  });

  await prisma.auditLog.create({
    data: {
      adminId:   session.user.id,
      adminName: session.user.name ?? "Admin",
      action:    "RESET_PASSWORD",
      target:    id,
      detail:    `Senha de ${user.name} reposta pelo admin`,
    },
  }).catch(() => {});

  // Tentar enviar email com nova senha (silencioso se falhar)
  try {
    const { Resend } = await import("resend");
    const client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (client) {
      await client.emails.send({
        from:    "Dynamics Works <noreply@dynamicworks.ao>",
        to:      user.email,
        subject: "Senha temporária — Dynamics Works",
        html:    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
                <tr><td style="background:#111827;border:1px solid #1e2d50;border-radius:16px;padding:36px 40px;text-align:center;">
                  <div style="width:38px;height:38px;background:#f5a623;border-radius:9px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
                    <span style="color:#0a0f1e;font-size:20px;font-weight:900;">D</span>
                  </div>
                  <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 12px;">Senha temporária</h1>
                  <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">A tua senha foi reposta pelo administrador. Usa a senha abaixo para entrar e altera-a de imediato.</p>
                  <div style="background:#0a0f1e;border:2px solid #f5a623;border-radius:12px;padding:20px;margin:0 0 24px;">
                    <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Nova senha temporária</p>
                    <p style="color:#f5a623;font-size:28px;font-weight:900;letter-spacing:4px;margin:0;font-family:monospace;">${tempPassword}</p>
                  </div>
                  <p style="color:#64748b;font-size:12px;">Por razões de segurança, altera a senha após o primeiro acesso.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>`,
      });
    }
  } catch {}

  return NextResponse.json({ ok: true, tempPassword, email: user.email });
}
