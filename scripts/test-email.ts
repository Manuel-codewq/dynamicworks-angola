import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const { data, error } = await resend.emails.send({
    from: "Dynamics Works <noreply@dynamicworks.ao>",
    to: ["seusburros91@gmail.com"],
    subject: "Teste",
    html: "<p>Teste</p>",
  });

  if (error) {
    console.error("❌ ERRO:", JSON.stringify(error, null, 2));
  } else {
    console.log("✅ ENVIADO! ID:", data?.id);
  }
}

main();
