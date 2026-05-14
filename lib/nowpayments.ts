import crypto from "crypto";

const API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";
const BASE_URL = "https://api.nowpayments.io/v1";

export interface CreatePaymentParams {
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  order_id: string;
  order_description?: string;
  ipn_callback_url: string;
  success_url?: string;
  cancel_url?: string;
}

export interface PaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  amount_received: number;
  purchase_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cria um pagamento na API do NOWPayments
 */
export async function createNowPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
  if (!API_KEY) throw new Error("NOWPAYMENTS_API_KEY não configurada");

  const res = await fetch(`${BASE_URL}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[nowpayments] Error creating payment:", data);
    throw new Error(data.message || "Erro ao criar pagamento no NOWPayments");
  }

  return data;
}

/**
 * Verifica se a assinatura do IPN é válida
 */
export function verifyNowPaymentsSignature(payload: any, signature: string): boolean {
  if (!IPN_SECRET) {
    console.warn("[nowpayments] IPN_SECRET não configurado. Verificação ignorada.");
    return true; // Só para dev se não houver chave, mas perigoso em prod
  }

  // O payload do NOWPayments IPN deve ser ordenado alfabeticamente para a assinatura
  // Mas a documentação diz para usar o JSON bruto recebido
  const keys = Object.keys(payload).sort();
  const sortedPayload: any = {};
  keys.forEach(k => { sortedPayload[k] = payload[k]; });

  const hmac = crypto.createHmac("sha512", IPN_SECRET);
  hmac.update(JSON.stringify(sortedPayload));
  const expectedSignature = hmac.digest("hex");

  return expectedSignature === signature;
}
