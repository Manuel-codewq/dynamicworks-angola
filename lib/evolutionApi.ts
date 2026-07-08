import Anthropic from "@anthropic-ai/sdk";

const EVOLUTION_URL  = process.env.EVOLUTION_API_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;
const INSTANCE_NAME  = process.env.EVOLUTION_INSTANCE ?? "DynamicWorks";

const GROUP_LINK = "https://chat.whatsapp.com/GQOuezdNDlYKEtmcfa5UKr";

export async function sendEvolutionMessage(to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "apikey": EVOLUTION_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ number: to, text }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Evolution] Erro ao enviar:", err);
    }
    return res.ok;
  } catch (e) {
    console.error("[Evolution] Falha de rede:", e);
    return false;
  }
}

const MENU = `👋 Olá! Bem-vindo ao suporte da *Dynamic Works* 📈

Escolhe uma opção:

1️⃣ Como criar conta?
2️⃣ Como depositar?
3️⃣ Como negociar?
4️⃣ Bónus e promoções
5️⃣ Grupo de aulas gratuitas
6️⃣ Falar com suporte humano

_Responde com o número da opção ou faz a tua pergunta directamente._`;

const MENU_REPLIES: Record<string, string> = {
  "1": `📝 *Como criar conta na Dynamic Works:*

1. Acede a https://dynamicworks.ao/register
2. Insere o teu NIF (Bilhete de Identidade)
3. Preenche o email e senha
4. Confirma o email
5. Pronto! Tens 10.000 AOA de bónus demo para praticar 🎉

_Tens alguma dúvida no processo?_`,

  "2": `💰 *Como depositar na Dynamic Works:*

Aceitamos depósitos em *USDT (TRC20)*:

1. Na plataforma clica em "Depositar"
2. Copia o endereço da carteira
3. Envia USDT (mínimo $5)
4. O saldo é creditado automaticamente em AOA

_Para mais informações fala com o suporte: +244 921 825 299_`,

  "3": `📊 *Como negociar opções binárias:*

1. Escolhe um par (EUR/USD, BTC/USD, etc.)
2. Analisa o gráfico
3. Define o valor da aposta
4. Clica em ⬆️ SUBIR ou ⬇️ DESCER
5. Aguarda o resultado em 30s a 5min

💡 *Dica:* Começa sempre no modo *Demo* para praticar sem risco!

_Entra no nosso grupo de aulas para aprender estratégias:_
${GROUP_LINK}`,

  "4": `🎁 *Bónus e promoções Dynamic Works:*

✅ 10.000 AOA de bónus demo ao registar
✅ Bónus de referido por cada amigo que trouxeres
✅ Promoções especiais para traders activos

_Para ver as promoções actuais acede à plataforma ou pergunta ao suporte!_`,

  "5": `📚 *Grupo de aulas gratuitas:*

Junta-te ao nosso grupo do WhatsApp onde partilhamos estratégias, análises e dicas de trading todos os dias!

👇 Entra aqui:
${GROUP_LINK}

_É gratuito e aberto a todos!_ 🚀`,

  "6": `👨‍💼 *Suporte humano:*

A nossa equipa está disponível para te ajudar!

📞 WhatsApp: *+244 921 825 299*
🌐 Plataforma: https://dynamicworks.ao
📧 Email: suporte@dynamicworks.ao

_Horário: Segunda a Sexta, 08h-18h WAT_`,
};

const GREETING_PATTERN = /^(ol[aá]|oi|ola|bom dia|boa tarde|boa noite|menu|ajuda|help|início|inicio|start|hello|hi)\b/i;

const AI_SYSTEM = `És o assistente virtual da Dynamic Works, uma plataforma angolana de negociação de opções binárias.

Informações sobre a Dynamic Works:
- Plataforma de trading de opções binárias para Angola
- Website: https://dynamicworks.ao
- Registo gratuito com 10.000 AOA de conta demo
- Depósitos em USDT (mínimo $5)
- Payout até 85% por operação ganhe
- Pares disponíveis: Forex (EUR/USD, GBP/USD, etc.), Criptomoedas (BTC/USD, ETH/USD), Metais e Índices Sintéticos OTC (24/7)
- Grupo de aulas gratuitas: ${GROUP_LINK}
- Suporte via WhatsApp: +244 921 825 299
- A empresa desenvolvedora é a Digikap Lda

Responde sempre em português de Angola, de forma amigável e concisa (máximo 3-4 frases). Não inventes informação que não tens. Se não souberes algo, sugere contactar o suporte humano.`;

export async function getAIResponse(userMessage: string, userName?: string): Promise<string> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: AI_SYSTEM,
      messages: [
        {
          role: "user",
          content: userName ? `[${userName}]: ${userMessage}` : userMessage,
        },
      ],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : MENU;
  } catch (e) {
    console.error("[AI] Erro ao gerar resposta:", e);
    return "Desculpa, ocorreu um erro. Por favor tenta novamente ou contacta o suporte em +244 921 825 299.";
  }
}

export async function handleIncomingMessage(
  from: string,
  text: string,
  userName?: string,
): Promise<void> {
  const clean = text.trim();

  if (GREETING_PATTERN.test(clean)) {
    await sendEvolutionMessage(from, MENU);
    return;
  }

  if (MENU_REPLIES[clean]) {
    await sendEvolutionMessage(from, MENU_REPLIES[clean]);
    return;
  }

  const aiReply = await getAIResponse(clean, userName);
  await sendEvolutionMessage(from, aiReply);
}

export function buildWelcomeMessageEvolution(name?: string): string {
  const greeting = name ? `Olá, *${name}*!` : "Olá!";
  return (
    `${greeting} 🎉 A tua conta na *Dynamic Works* foi criada com sucesso!\n\n` +
    `✅ Tens *10.000 AOA* de bónus demo para começar a praticar.\n\n` +
    `📚 Entra no nosso grupo de aulas gratuitas para aprenderes a negociar:\n` +
    `${GROUP_LINK}\n\n` +
    `Se tiveres alguma dúvida, é só escrever aqui! 🚀`
  );
}
