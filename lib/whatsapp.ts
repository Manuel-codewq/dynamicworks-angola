const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN!;
const API_URL         = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppMessage(to: string, text: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("[WhatsApp] Erro ao enviar mensagem:", err);
  }

  return res.ok;
}

export function buildWelcomeMessage(name?: string): string {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  return (
    `${greeting} Seja bem-vindo(a) à *Dynamic Works* 📈\n\n` +
    `Somos uma plataforma angolana de trading de *opções binárias*.\n\n` +
    `Para começares, entra no nosso grupo de aulas gratuitas 👇\n` +
    `https://chat.whatsapp.com/KpoqJd7os526c59DQ8eRXe\n\n` +
    `Qualquer dúvida, estou aqui para ajudar! 🚀`
  );
}
