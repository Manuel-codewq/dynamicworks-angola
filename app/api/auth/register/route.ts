import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { randomInt } from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import { sendEvolutionMessage, buildWelcomeMessageEvolution } from "@/lib/evolutionApi";


const PROVINCES = [
  "Bengo","Benguela","Bié","Cabinda","Cuando Cubango","Cuanza Norte",
  "Cuanza Sul","Cunene","Huambo","Huíla","Luanda","Lunda Norte",
  "Lunda Sul","Malanje","Moxico","Namibe","Uíge","Zaire",
];

export async function POST(req: NextRequest) {
  try {
    // 5 registos por IP por hora
    const ip = getClientIp(req);

    if (!await checkRateLimit("register", ip, 5, 60 * 60_000)) {
      return NextResponse.json({ error: "Demasiados pedidos. Tente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const { email, password, phone, province, ref, nifNumero, dataNasc, genero, naturalidade } = body;

    // Validar NIF (obrigatório)
    const nif = typeof nifNumero === "string" ? nifNumero.replace(/\s/g, "").toUpperCase() : "";
    if (!nif || !/^[A-Z0-9]{9,14}$/i.test(nif)) {
      return NextResponse.json({ error: "NIF inválido ou em falta" }, { status: 400 });
    }

    // Verificar unicidade do NIF
    const existingNif = await prisma.user.findFirst({ where: { nifNumero: nif }, select: { id: true } });
    if (existingNif) {
      return NextResponse.json({ error: "Este NIF já está registado" }, { status: 409 });
    }

    // Verificar NIF via cache ou API digital.ao
    let nomeOficial: string | null = null;
    const cached = await prisma.nifCache.findUnique({ where: { nif } });
    if (cached && cached.expiresAt > new Date() && cached.valid) {
      nomeOficial = cached.nome;
    } else {
      try {
        const smeRes = await fetch(
          `https://sme.gov.ao/actions/bi.ajcall.php?bi=${encodeURIComponent(nif)}`,
          {
            signal:  AbortSignal.timeout(4000),
            headers: {
              "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
              "Referer":          "https://sme.gov.ao/ao/utentes/novo/",
              "Accept":           "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With": "XMLHttpRequest",
            },
          },
        );
        if (smeRes.ok) {
          const smeJson = await smeRes.json();
          const isOk   = smeJson.sucess === true || smeJson.success === true;
          const data   = smeJson.data;
          const nome   = typeof data?.nome_completo === "string" ? data.nome_completo.trim()
                       : typeof data?.nome          === "string" ? data.nome.trim()
                       : "";
          if (isOk && nome !== "") {
            nomeOficial = nome;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
            try {
              await prisma.nifCache.upsert({
                where:  { nif },
                create: { nif, nome: nomeOficial ?? "", valid: true, expiresAt },
                update: { nome: nomeOficial ?? "", valid: true, expiresAt },
              });
            } catch { /* cache best-effort */ }
          }
        }
      } catch { /* fail open — tratar abaixo */ }
    }

    if (!nomeOficial) {
      return NextResponse.json({ error: "BI não encontrado. Verifique o número e tente novamente." }, { status: 400 });
    }

    // Gerar código de referido único (ex: DW-A3X9)
    function genCode(): string {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "DW-";
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      return code;
    }
    let referralCode: string | null = null;
    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = genCode();
      const exists = await prisma.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
      if (!exists) { referralCode = candidate; break; }
    }

    // Validar código de referido se fornecido
    let referredBy: string | null = null;
    if (ref && typeof ref === "string") {
      const referrer = await prisma.user.findUnique({ where: { referralCode: ref.toUpperCase() }, select: { id: true } });
      if (referrer) referredBy = referrer.id;
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
    }
    if (String(email).length > 254) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }
    if (String(password).length > 128) {
      return NextResponse.json({ error: "Senha demasiado longa" }, { status: 400 });
    }
    if (/^\d+$/.test(String(password))) {
      return NextResponse.json({ error: "A senha não pode ser só números. Adiciona pelo menos uma letra" }, { status: 400 });
    }
    if (province && !PROVINCES.includes(province)) {
      return NextResponse.json({ error: "Província inválida" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email já registado" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const code = String(randomInt(100000, 1000000));
    const verifyExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name: nomeOficial,
        email: normalizedEmail,
        password: hashed,
        phone,
        province,
        nifNumero: nif,
        nomeOficial,
        kycNifValidado: true,
        dataNasc:     typeof dataNasc     === "string" && dataNasc     ? dataNasc     : undefined,
        genero:       typeof genero       === "string" && genero       ? genero       : undefined,
        naturalidade: typeof naturalidade === "string" && naturalidade ? naturalidade : undefined,
        verifyCode: code,
        verifyExpires,
        emailVerified: false,
        balance: 0,
        demoBalance: 10000,
        isDemo: true,
        twoFactorDeadline: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        ...(referralCode ? { referralCode } : {}),
        ...(referredBy   ? { referredBy }   : {}),
      },
    });

    try {
      await sendVerificationEmail(user.email, user.name, code);
    } catch (err) {
      console.error("[email] Falha ao enviar email de verificação:", err);
    }

    // Enviar mensagem de boas-vindas via WhatsApp (se o utilizador forneceu telefone)
    if (phone) {
      const phoneClean = String(phone).replace(/\D/g, "");
      if (phoneClean.length >= 9) {
        sendEvolutionMessage(phoneClean, buildWelcomeMessageEvolution(nomeOficial)).catch(e =>
          console.error("[WhatsApp] Falha ao enviar boas-vindas:", e)
        );
      }
    }

    return NextResponse.json(
      { success: true, userId: user.id, redirect: `/verify-email?email=${encodeURIComponent(normalizedEmail)}` },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
