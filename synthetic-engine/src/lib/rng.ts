import crypto from "crypto";

/**
 * Retorna um float uniforme em [0, 1) usando crypto.randomBytes,
 * em vez de Math.random() (não seguro para geração de preços,
 * porque a sequência do PRNG interno do V8 é previsível em teoria).
 */
function secureUniform(): number {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32LE(0) / 0xffffffff;
}

/**
 * Amostra de uma distribuição normal N(0, 1) via transformação Box-Muller,
 * usando o gerador criptográfico acima como fonte de uniformidade.
 */
export function secureGaussian(): number {
  let u1 = secureUniform();
  // evita log(0)
  if (u1 === 0) u1 = 1e-12;
  const u2 = secureUniform();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Uniforme em [0, 1) — usado para decidir eventos (crash/boom/jump). */
export function secureRandom(): number {
  return secureUniform();
}
