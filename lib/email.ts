import { Resend } from "resend";

const FROM = "Dynamics Works <noreply@dynamicworks.ao>";

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email] RESEND_API_KEY não definida — email ignorado");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
}

// ── Base template ─────────────────────────────────────────────────────────────

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding:0 0 24px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:38px;height:38px;background:#f5a623;border-radius:9px;text-align:center;vertical-align:middle;">
                <span style="color:#0a0f1e;font-size:20px;font-weight:900;">D</span>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="color:#f5a623;font-size:18px;font-weight:800;letter-spacing:-0.3px;">Dynamics Works</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#111827;border:1px solid #1e2d50;border-radius:16px;padding:36px 40px;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 16px;">${title}</h1>
          ${bodyHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="color:#374151;font-size:12px;margin:0;">
            © ${new Date().getFullYear()} Dynamics Works · Angola<br>
            Este email foi enviado automaticamente. Por favor não responda.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f5a623;color:#0a0f1e;font-weight:800;font-size:14px;padding:13px 28px;border-radius:9px;text-decoration:none;margin-top:8px;">${label}</a>`;
}

function p(text: string, color = "#94a3b8"): string {
  return `<p style="color:${color};font-size:15px;line-height:1.6;margin:0 0 14px;">${text}</p>`;
}

function highlight(text: string): string {
  return `<span style="color:#f5a623;font-weight:700;">${text}</span>`;
}

function divider(): string {
  return `<div style="border-top:1px solid #1e2d50;margin:24px 0;"></div>`;
}

// ── Email functions ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>, bem-vindo(a) à plataforma de trading da Dynamics Works!`)}
    ${p("A tua conta foi criada com sucesso. Para começares já, tens disponível:")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:10px;padding:18px 22px;margin:16px 0 20px;">
      <p style="color:#f5a623;font-size:24px;font-weight:800;margin:0 0 4px;">${highlight("10 000 Kz")} em conta demo</p>
      <p style="color:#64748b;font-size:13px;margin:0;">Pratica sem risco antes de investir capital real.</p>
    </div>
    ${p("Quando estiveres pronto(a), muda para conta real e começa a operar nos mercados forex e índices sintéticos.")}
    ${divider()}
    ${btn("Ir para a plataforma →", "https://dynamicsworks.ao/trade")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Bem-vindo à Dynamics Works!",
      html:    baseTemplate("Bem-vindo(a) 🎉", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar welcome email:", err);
  }
}

export async function sendDepositApprovedEmail(to: string, name: string, amount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("O teu pedido de depósito foi <strong style=\"color:#22c55e;\">aprovado</strong> e o valor já está disponível na tua conta real.")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:10px;padding:18px 22px;margin:16px 0 20px;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Valor creditado</p>
      <p style="color:#22c55e;font-size:26px;font-weight:800;margin:0;">+ ${highlight(formatKz(Math.floor(amount)))}</p>
    </div>
    ${p("Podes começar a operar imediatamente com o saldo disponível na tua conta real.")}
    ${divider()}
    ${btn("Operar agora →", "https://dynamicsworks.ao/trade")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Depósito aprovado ✅",
      html:    baseTemplate("Depósito aprovado", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar deposit approved email:", err);
  }
}

export async function sendDepositRejectedEmail(to: string, name: string, amount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Infelizmente o teu pedido de depósito <strong style=\"color:#ef4444;\">não foi aprovado</strong>.")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:10px;padding:18px 22px;margin:16px 0 20px;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Valor do pedido</p>
      <p style="color:#ef4444;font-size:26px;font-weight:800;margin:0;">${formatKz(Math.floor(amount))}</p>
    </div>
    ${p("Possíveis motivos: comprovativo não reconhecido, referência incorreta ou dados bancários em falta.")}
    ${p("Se acreditas que se trata de um erro, por favor entra em contacto com o nosso suporte respondendo a este email ou através da plataforma.")}
    ${divider()}
    ${btn("Ir para a carteira →", "https://dynamicsworks.ao/wallet")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Depósito não aprovado",
      html:    baseTemplate("Pedido de depósito não aprovado", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar deposit rejected email:", err);
  }
}

export async function sendWithdrawalApprovedEmail(to: string, name: string, amount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("O teu pedido de levantamento foi <strong style=\"color:#22c55e;\">aprovado</strong> e está a ser processado.")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:10px;padding:18px 22px;margin:16px 0 20px;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Valor em processamento</p>
      <p style="color:#22c55e;font-size:26px;font-weight:800;margin:0;">${highlight(formatKz(Math.floor(amount)))}</p>
    </div>
    ${p("O valor será transferido para a tua conta bancária no prazo de <strong style=\"color:#fff;\">1 a 3 dias úteis</strong>.")}
    ${p("Caso não recebas o valor dentro do prazo, contacta o nosso suporte.")}
    ${divider()}
    ${btn("Ver carteira →", "https://dynamicsworks.ao/wallet")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Levantamento aprovado ✅",
      html:    baseTemplate("Levantamento aprovado", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar withdrawal approved email:", err);
  }
}

export async function sendVerificationEmail(to: string, name: string, code: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Para activares a tua conta, introduz o seguinte código de verificação:")}
    <div style="background:#0a0f1e;border:2px solid #f5a623;border-radius:14px;padding:28px;margin:20px 0;text-align:center;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Código de Verificação</p>
      <p style="color:#f5a623;font-size:40px;font-weight:900;margin:0;letter-spacing:10px;font-variant-numeric:tabular-nums;">${code}</p>
    </div>
    ${p("Este código é válido durante <strong style=\"color:#fff;\">15 minutos</strong>.")}
    ${p("Se não criaste uma conta na Dynamics Works, ignora este email.", "#64748b")}
    ${divider()}
    ${btn("Verificar conta →", "https://dynamicsworks.ao/verify-email")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Código de verificação — Dynamics Works",
      html:    baseTemplate("Verifica o teu email", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar verification email:", err);
  }
}

export async function sendTransactionOtpEmail(to: string, name: string, code: string, type: "deposit" | "withdrawal", amount: number) {
  const client = getClient();
  if (!client) return;

  const label  = type === "deposit" ? "Depósito" : "Levantamento";
  const color  = type === "deposit" ? "#22c55e" : "#ef4444";

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p(`Recebemos um pedido de <strong style="color:${color};">${label}</strong> de <strong style="color:#fff;">${formatKz(Math.floor(amount))}</strong>.`)}
    ${p("Para confirmar esta operação, introduz o código abaixo na plataforma:")}
    <div style="background:#0a0f1e;border:2px solid #f5a623;border-radius:14px;padding:28px;margin:20px 0;text-align:center;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Código OTP</p>
      <p style="color:#f5a623;font-size:42px;font-weight:900;margin:0;letter-spacing:12px;font-variant-numeric:tabular-nums;">${code}</p>
    </div>
    ${p("Este código é válido durante <strong style=\"color:#fff;\">10 minutos</strong>. Não o partilhes com ninguém.")}
    ${p("Se não iniciaste esta operação, ignora este email. A tua conta está segura.", "#64748b")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: `Código OTP — ${label} de ${formatKz(Math.floor(amount))}`,
      html:    baseTemplate(`Confirmar ${label}`, body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar OTP email:", err);
  }
}

export async function sendWithdrawalRejectedEmail(to: string, name: string, amount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Infelizmente o teu pedido de levantamento <strong style=\"color:#ef4444;\">não foi aprovado</strong>.")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:10px;padding:18px 22px;margin:16px 0 20px;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Valor do pedido</p>
      <p style="color:#ef4444;font-size:26px;font-weight:800;margin:0;">${formatKz(Math.floor(amount))}</p>
    </div>
    ${p("Possíveis motivos: dados bancários incorretos, IBAN inválido ou saldo insuficiente no momento do processamento.")}
    ${p("Se precisares de ajuda, entra em contacto com o nosso suporte ou tenta novamente através da plataforma.")}
    ${divider()}
    ${btn("Ir para a carteira →", "https://dynamicsworks.ao/wallet")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Levantamento não aprovado",
      html:    baseTemplate("Pedido de levantamento não aprovado", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar withdrawal rejected email:", err);
  }
}
