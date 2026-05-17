const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32Decode(input: string): Uint8Array {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "")) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(key: Uint8Array, counter: number): Promise<string> {
  const data = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { data[i] = c & 0xff; c = Math.floor(c / 256); }

  const keyBuf  = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const dataBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBuf, { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, dataBuf));
  const off  = sig[19] & 0xf;
  const code = (
    ((sig[off]     & 0x7f) << 24) |
    ((sig[off + 1] & 0xff) << 16) |
    ((sig[off + 2] & 0xff) <<  8) |
     (sig[off + 3] & 0xff)
  ) % 1_000_000;

  return code.toString().padStart(6, "0");
}

export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return b32Encode(bytes);
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    const key     = b32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    for (const offset of [-2, -1, 0, 1, 2]) {
      if ((await hotp(key, counter + offset)) === token) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getTotpUri(email: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent("Dynamics Works")}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent("Dynamics Works")}&algorithm=SHA1&digits=6&period=30`;
}
