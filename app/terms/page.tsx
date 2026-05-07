import { TrendingUp } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Sobre a Plataforma",
    body: `A Dynamics Works é uma plataforma de trading de opções binárias desenvolvida e licenciada para operar no mercado angolano, criada pela Digikap — empresa angolana de tecnologia e inovação digital. O acesso à plataforma está disponível a maiores de 18 anos residentes em Angola. A utilização dos serviços implica a aceitação integral dos presentes termos.`,
  },
  {
    title: "2. Conta Demo",
    body: `A conta demonstrativa (Demo) tem fins exclusivamente educativos e de treino. O saldo virtual disponibilizado não tem qualquer valor monetário real e não pode ser levantado ou convertido. Os resultados obtidos na conta Demo não são representativos dos resultados que poderão ser obtidos numa conta real.`,
  },
  {
    title: "3. Conta Real e Risco de Capital",
    body: `A negociação de opções binárias com dinheiro real envolve risco significativo e pode resultar na perda total do capital investido. Não invista valores que não pode perder. A Dynamics Works não garante quaisquer rendimentos ou lucros. Antes de operar com fundos reais, recomendamos que utilize a conta Demo até se sentir confortável com a plataforma.`,
  },
  {
    title: "4. Depósitos e Levantamentos",
    body: `O valor mínimo de depósito é de 5.000 Kz. O valor mínimo de levantamento é de 5.000 Kz. Os pedidos de levantamento são processados em 1 a 3 dias úteis após aprovação pela equipa de suporte. A Dynamics Works reserva-se o direito de solicitar documentação adicional antes de processar qualquer levantamento, nomeadamente para cumprir os requisitos KYC/AML.`,
  },
  {
    title: "5. Limitação de Responsabilidade",
    body: `A Dynamics Works não se responsabiliza por perdas resultantes de operações de trading, sejam elas devidas a decisões do utilizador, condições de mercado, falhas técnicas, interrupções de serviço ou quaisquer outros factores. O utilizador aceita que o trading de opções binárias é uma actividade de alto risco e que opera por sua própria conta e risco.`,
  },
  {
    title: "6. Verificação de Identidade (KYC)",
    body: `Para fins de conformidade regulatória e prevenção de branqueamento de capitais, a verificação de identidade (KYC) é obrigatória para realizar levantamentos. O utilizador deve submeter um documento de identificação válido (Bilhete de Identidade angolano). A não conclusão do processo KYC pode limitar o acesso a determinadas funcionalidades da plataforma.`,
  },
  {
    title: "7. Contacto e Suporte",
    body: `Para questões relacionadas com a sua conta, depósitos, levantamentos ou qualquer outro assunto, contacte a nossa equipa de suporte através do endereço de correio electrónico suporte@dynamicsworks.ao. O nosso horário de atendimento é de segunda a sexta-feira, das 8h às 17h (hora de Luanda, WAT).`,
  },
];

export default function TermsPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e",
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#94a3b8",
    }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "0 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={20} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Dynamics Works</span>
          </div>
          <a href="javascript:history.back()"
            style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", borderRadius: 8, padding: "7px 14px" }}>
            ← Voltar
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>
          Termos de Uso
        </h1>
        <p style={{ fontSize: 13, margin: "0 0 48px", color: "#475569" }}>
          Última actualização: Janeiro de 2025
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {SECTIONS.map(s => (
            <section key={s.title}>
              <h2 style={{ color: "#f5a623", fontSize: 16, fontWeight: 700, margin: "0 0 12px", letterSpacing: 0.2 }}>
                {s.title}
              </h2>
              <p style={{ lineHeight: 1.75, fontSize: 15, margin: 0, color: "#94a3b8" }}>
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid #1e2d50", textAlign: "center" }}>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 6px" }}>
            Dynamics Works © {new Date().getFullYear()} — Plataforma licenciada para o mercado angolano
          </p>
          <p style={{ color: "#374151", fontSize: 12, margin: 0 }}>
            Desenvolvida pela{" "}
            <span style={{ color: "#f5a623", fontWeight: 700 }}>Digikap</span>
            {" "}— Tecnologia & Inovação Digital · Angola
          </p>
        </div>
      </div>
    </div>
  );
}
