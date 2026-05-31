import { Resend } from "resend";

const FROM    = "Dynamic Works <noreply@dynamicworks.ao>";
const SITE    = "https://dynamicworks.ao";
const SUPPORT = "https://dynamicworks.ao/support";

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email] RESEND_API_KEY não definida — email ignorado");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function formatKz(n: number) {
  return n.toLocaleString("pt-PT") + " Kz";
}

// ── Base template ─────────────────────────────────────────────────────────────

function baseTemplate(title: string, bodyHtml: string, accentColor = "#f5a623"): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#070d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#070d1a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- Header / Logo -->
        <tr><td style="padding:0 0 20px;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:42px;height:42px;background:linear-gradient(135deg,#f5a623,#e8940f);border-radius:11px;text-align:center;vertical-align:middle;">
                <span style="color:#0a0f1e;font-size:22px;font-weight:900;line-height:42px;">D</span>
              </td>
              <td style="padding-left:11px;vertical-align:middle;">
                <div style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.4px;line-height:1.1;">Dynamic Works</div>
                <div style="color:#64748b;font-size:11px;font-weight:500;letter-spacing:0.3px;text-transform:uppercase;">Plataforma de Trading</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Accent bar -->
        <tr><td style="padding:0 0 2px;">
          <div style="height:3px;background:linear-gradient(90deg,${accentColor},transparent);border-radius:2px 2px 0 0;"></div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#111827;border:1px solid #1e2d50;border-top:none;border-radius:0 0 16px 16px;padding:32px 36px 36px;">
          <h1 style="color:#ffffff;font-size:21px;font-weight:800;margin:0 0 20px;letter-spacing:-0.3px;line-height:1.3;">${title}</h1>
          ${bodyHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 0 0;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding-bottom:16px;text-align:center;">
                <a href="${SITE}/trade"        style="color:#64748b;font-size:12px;text-decoration:none;margin:0 10px;">Plataforma</a>
                <a href="${SITE}/wallet"       style="color:#64748b;font-size:12px;text-decoration:none;margin:0 10px;">Carteira</a>
                <a href="${SUPPORT}"           style="color:#64748b;font-size:12px;text-decoration:none;margin:0 10px;">Suporte</a>
                <a href="${SITE}/security"     style="color:#64748b;font-size:12px;text-decoration:none;margin:0 10px;">Segurança</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1a2540;padding-top:16px;">
                <p style="color:#374151;font-size:11px;margin:0;line-height:1.7;">
                  © ${year} Dynamic Works · Luanda, Angola<br>
                  Este email foi enviado automaticamente — por favor não responda directamente.<br>
                  Precisas de ajuda? <a href="${SUPPORT}" style="color:#f5a623;text-decoration:none;">Contacta o suporte</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string, color = "#f5a623"): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:10px;">
    <tr><td style="background:${color};border-radius:10px;">
      <a href="${href}" style="display:inline-block;color:${color === "#f5a623" ? "#0a0f1e" : "#fff"};font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.1px;">${label}</a>
    </td></tr>
  </table>`;
}

function p(text: string, color = "#94a3b8"): string {
  return `<p style="color:${color};font-size:15px;line-height:1.65;margin:0 0 14px;">${text}</p>`;
}

function highlight(text: string): string {
  return `<span style="color:#f5a623;font-weight:700;">${text}</span>`;
}

function divider(): string {
  return `<div style="border-top:1px solid #1e2d50;margin:26px 0;"></div>`;
}

function infoBox(content: string, borderColor = "#1e2d50"): string {
  return `<div style="background:#0a0f1e;border:1px solid ${borderColor};border-radius:12px;padding:20px 24px;margin:18px 0 22px;">${content}</div>`;
}

function statRow(label: string, value: string, color = "#ffffff"): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</td>
    <td style="padding:6px 0;color:${color};font-size:15px;font-weight:800;text-align:right;">${value}</td>
  </tr>`;
}

// ── Email functions ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>, bem-vindo(a) à Dynamic Works!`)}
    ${p("A tua conta foi criada. Antes de começares a operar com dinheiro real, explora a plataforma em modo demo — completamente gratuito e sem risco.")}
    ${infoBox(`
      <div style="color:#f5a623;font-size:26px;font-weight:900;margin:0 0 6px;">10.000 Kz</div>
      <div style="color:#94a3b8;font-size:13px;margin:0 0 16px;">Saldo demo disponível para praticar</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;">Forex, Cripto, Metais, Índices</td>
          <td style="padding:4px 0;color:#22c55e;font-size:13px;text-align:right;font-weight:700;">Disponível</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;">Conta Demo ilimitada</td>
          <td style="padding:4px 0;color:#22c55e;font-size:13px;text-align:right;font-weight:700;">Disponível</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;">Payout até 85%</td>
          <td style="padding:4px 0;color:#22c55e;font-size:13px;text-align:right;font-weight:700;">Disponível</td>
        </tr>
      </table>
    `)}
    ${p("Para começar a operar a sério, completa a verificação de identidade (KYC) e faz o teu primeiro depósito a partir de <strong style=\"color:#fff;\">5.000 Kz</strong>.")}
    ${divider()}
    ${btn("Começar a negociar →", `${SITE}/trade`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Bem-vindo à Dynamic Works — A tua conta está pronta",
      html:    baseTemplate("Bem-vindo(a) à Dynamic Works!", body),
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
    ${p("O teu depósito foi <strong style=\"color:#22c55e;\">aprovado</strong> e creditado na tua conta real. Já podes começar a operar.")}
    ${infoBox(`
      <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Valor creditado</div>
      <div style="color:#22c55e;font-size:32px;font-weight:900;letter-spacing:-0.5px;">+${formatKz(Math.floor(amount))}</div>
    `, "rgba(34,197,94,0.25)")}
    ${p("O saldo já está disponível na tua conta real. Podes verificar na tua carteira ou começar a operar directamente.")}
    ${divider()}
    ${btn("Operar agora →", `${SITE}/trade`, "#22c55e")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: `Depósito de ${formatKz(Math.floor(amount))} aprovado`,
      html:    baseTemplate("Depósito aprovado", body, "#22c55e"),
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
    ${btn("Ir para a carteira →", `${SITE}/wallet`)}
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

  const net = Math.floor(amount * 0.95);
  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("O teu pedido de levantamento foi <strong style=\"color:#22c55e;\">aprovado</strong> e está em processamento.")}
    ${infoBox(`
      <table width="100%" cellpadding="0" cellspacing="0">
        ${statRow("Valor solicitado", formatKz(Math.floor(amount)))}
        ${statRow("Taxa (5%)", `−${formatKz(Math.floor(amount * 0.05))}`, "#ef4444")}
        <tr><td colspan="2" style="border-top:1px solid #1e2d50;padding-top:10px;"></td></tr>
        ${statRow("A receber", formatKz(net), "#22c55e")}
      </table>
    `, "rgba(34,197,94,0.2)")}
    ${p("A transferência será efectuada no prazo de <strong style=\"color:#fff;\">1 a 3 dias úteis</strong>. Receberás uma notificação assim que o valor for enviado.")}
    ${p("Se não receberes dentro do prazo, contacta o nosso suporte.", "#64748b")}
    ${divider()}
    ${btn("Ver carteira →", `${SITE}/wallet`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: `Levantamento de ${formatKz(Math.floor(amount))} aprovado`,
      html:    baseTemplate("Levantamento aprovado", body, "#22c55e"),
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
    ${btn("Verificar conta →", `${SITE}/verify-email`)}
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
    ${p("Este código é válido durante <strong style=\"color:#fff;\">30 minutos</strong>. Não o partilhes com ninguém.")}
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

export async function sendPasswordOtpEmail(to: string, name: string, code: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Recebemos um pedido para alterar a senha da tua conta. Usa o código abaixo para confirmar:")}
    <div style="background:#0a0f1e;border:2px solid #f5a623;border-radius:14px;padding:28px;margin:20px 0;text-align:center;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Código de segurança</p>
      <p style="color:#f5a623;font-size:42px;font-weight:900;margin:0;letter-spacing:12px;font-variant-numeric:tabular-nums;">${code}</p>
    </div>
    ${p("Este código é válido durante <strong style=\"color:#fff;\">30 minutos</strong>. Não o partilhes com ninguém.")}
    ${p("Se não solicitaste esta alteração, ignora este email. A tua senha não será alterada.", "#64748b")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Código para alteração de senha — Dynamics Works",
      html:    baseTemplate("Confirmar alteração de senha", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar password OTP email:", err);
  }
}

export async function sendKycSubmittedEmail(to: string, name: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Recebemos os teus documentos de verificação de identidade (KYC). A nossa equipa está a analisar as informações submetidas.")}
    <div style="background:#0a0f1e;border:1px solid #1e2d50;border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <p style="color:#f5a623;font-size:15px;font-weight:800;margin:0 0 8px;">Em análise</p>
      <p style="color:#64748b;font-size:13px;margin:0;">O processo de verificação demora normalmente até <strong style="color:#fff;">24 horas</strong> nos dias úteis. Receberás um email quando o processo estiver concluído.</p>
    </div>
    ${p("Enquanto aguardas, podes continuar a negociar em modo Demo com os teus 10.000 Kz virtuais.")}
    ${divider()}
    ${btn("Ir para a plataforma →", `${SITE}/trade`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "KYC submetido — Dynamics Works",
      html:    baseTemplate("Os teus documentos estão em análise", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar KYC submitted email:", err);
  }
}

export async function sendKycApprovedEmail(to: string, name: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("A tua verificação de identidade foi <strong style=\"color:#22c55e;\">aprovada</strong> com sucesso!")}
    <div style="background:#0a0f1e;border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <p style="color:#22c55e;font-size:15px;font-weight:800;margin:0 0 8px;">Identidade verificada</p>
      <p style="color:#64748b;font-size:13px;margin:0;">A tua conta está agora totalmente desbloqueada. Podes efectuar depósitos, levantamentos e negociar sem restrições.</p>
    </div>
    ${p("Bem-vindo(a) à Dynamics Works! Começa a negociar com a tua conta real.")}
    ${divider()}
    ${btn("Começar a negociar →", `${SITE}/trade`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "KYC aprovado — Conta verificada",
      html:    baseTemplate("Identidade verificada com sucesso!", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar KYC approved email:", err);
  }
}

export async function sendKycRejectedEmail(to: string, name: string, attemptsLeft: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Infelizmente a tua verificação de identidade <strong style=\"color:#ef4444;\">não foi aprovada</strong>.")}
    <div style="background:#0a0f1e;border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <p style="color:#ef4444;font-size:15px;font-weight:800;margin:0 0 8px;">Documentos rejeitados</p>
      <p style="color:#64748b;font-size:13px;margin:0 0 12px;">Possíveis motivos: imagens desfocadas, documentos ilegíveis, rosto não visível ou BI expirado.</p>
      ${attemptsLeft > 0 ? `<p style="color:#f5a623;font-size:13px;font-weight:700;margin:0;">Tens ainda <strong>${attemptsLeft} tentativa${attemptsLeft === 1 ? "" : "s"}</strong> disponível${attemptsLeft === 1 ? "" : "eis"} para re-submeter.</p>` : `<p style="color:#ef4444;font-size:13px;font-weight:700;margin:0;">Esgotaste as tuas tentativas. Contacta o suporte para ajuda.</p>`}
    </div>
    ${p("Certifica-te de que as fotos estão nítidas, bem iluminadas e que o BI está dentro da validade.")}
    ${divider()}
    ${attemptsLeft > 0 ? btn("Submeter novamente →", `${SITE}/kyc`) : btn("Contactar suporte →", SUPPORT)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "KYC rejeitado — Dynamics Works",
      html:    baseTemplate("Verificação não aprovada", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar KYC rejected email:", err);
  }
}

export async function send2FAEmail(to: string, name: string, code: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Alguém está a tentar entrar na tua conta. Usa o código abaixo para confirmar o acesso:")}
    <div style="background:#0a0f1e;border:2px solid #f5a623;border-radius:14px;padding:28px;margin:20px 0;text-align:center;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Código de verificação 2FA</p>
      <p style="color:#f5a623;font-size:42px;font-weight:900;margin:0;letter-spacing:12px;font-variant-numeric:tabular-nums;">${code}</p>
    </div>
    ${p("Este código é válido durante <strong style=\"color:#fff;\">10 minutos</strong>. Não o partilhes com ninguém.")}
    ${p("Se não foste tu, altera a tua senha imediatamente.", "#ef4444")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Código de verificação 2FA — Dynamics Works",
      html:    baseTemplate("Verificação em dois passos", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar 2FA email:", err);
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
    ${btn("Ir para a carteira →", `${SITE}/wallet`)}
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

export async function sendTradeWinEmail(to: string, name: string, asset: string, amount: number, profit: number, returnAmount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p(`A tua operação em <strong style="color:#fff;">${asset}</strong> foi encerrada com <strong style="color:#22c55e;">ganho</strong>.`)}
    ${infoBox(`
      <table width="100%" cellpadding="0" cellspacing="0">
        ${statRow("Par negociado", asset, "#fff")}
        ${statRow("Investimento", formatKz(Math.floor(amount)))}
        ${statRow("Lucro", `+${formatKz(Math.floor(profit))}`, "#22c55e")}
        <tr><td colspan="2" style="border-top:1px solid #1e2d50;padding:10px 0 4px;"></td></tr>
        ${statRow("Total recebido", formatKz(Math.floor(returnAmount)), "#f5a623")}
      </table>
    `, "rgba(34,197,94,0.2)")}
    ${p("O valor foi creditado automaticamente na tua conta. Bom trading!")}
    ${divider()}
    ${btn("Operar novamente →", `${SITE}/trade`, "#22c55e")}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: `Ganho de ${formatKz(Math.floor(profit))} em ${asset}`,
      html:    baseTemplate(`Ganho em ${asset}`, body, "#22c55e"),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar trade win email:", err);
  }
}

export async function sendNewLoginEmail(to: string, name: string, ip: string, device: string, dateStr: string) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p("Detectámos um <strong style=\"color:#f5a623;\">novo acesso</strong> à tua conta a partir de um dispositivo ou localização não reconhecida.")}
    <div style="background:#0a0f1e;border:1px solid rgba(245,166,35,0.3);border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:10px;">
          <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Dispositivo</span><br>
          <span style="color:#fff;font-size:14px;font-weight:600;">${device}</span>
        </td></tr>
        <tr><td style="padding-bottom:10px;">
          <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Endereço IP</span><br>
          <span style="color:#fff;font-size:14px;font-weight:600;">${ip}</span>
        </td></tr>
        <tr><td>
          <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Data e hora</span><br>
          <span style="color:#fff;font-size:14px;font-weight:600;">${dateStr}</span>
        </td></tr>
      </table>
    </div>
    ${p("Se foste tu, podes ignorar este email. Se <strong style=\"color:#ef4444;\">não reconheces</strong> este acesso, altera a tua senha imediatamente e activa o 2FA.")}
    ${divider()}
    ${btn("Alterar senha →", `${SITE}/security`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: "Novo acesso detectado — Dynamics Works",
      html:    baseTemplate("Novo acesso à tua conta", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar new login email:", err);
  }
}

export async function sendTradeLossEmail(to: string, name: string, asset: string, amount: number) {
  const client = getClient();
  if (!client) return;

  const body = `
    ${p(`Olá <strong style="color:#fff;">${name}</strong>,`)}
    ${p(`A tua operação em <strong style="color:#fff;">${asset}</strong> foi encerrada com <strong style="color:#ef4444;">perda</strong>.`)}
    <div style="background:#0a0f1e;border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:20px 24px;margin:16px 0 20px;">
      <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Valor perdido</span><br>
      <span style="color:#ef4444;font-size:24px;font-weight:900;">− ${formatKz(Math.floor(amount))}</span>
    </div>
    ${p("Faz parte do trading. Analisa o mercado, ajusta a tua estratégia e volta mais forte.")}
    ${p("Lembra-te: só opera o que estás disposto(a) a perder e mantém sempre a gestão de risco.", "#64748b")}
    ${divider()}
    ${btn("Tentar novamente →", `${SITE}/trade`)}
  `;

  try {
    await client.emails.send({
      from:    FROM,
      to,
      subject: `Operação encerrada — ${asset}`,
      html:    baseTemplate("Operação encerrada", body),
    });
  } catch (err) {
    console.error("[email] Erro ao enviar trade loss email:", err);
  }
}
