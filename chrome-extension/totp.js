/**
 * Generador TOTP (RFC 6238 / RFC 4226) usando Web Crypto API (HMAC-SHA1/256/512).
 * Cero dependencias externas. Compatible con navegadores y Node.js (>=18).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SUPPORTED_ALGORITHMS = new Set(["SHA-1", "SHA-256", "SHA-512"]);

/**
 * Decodifica una cadena Base32 (RFC 4648) a Uint8Array.
 * Valida caracteres y longitud canónica.
 */
function base32ToBytes(base32) {
  if (typeof base32 !== "string") {
    throw new Error("El secreto Base32 debe ser una cadena de texto.");
  }
  const cleanStr = base32.toUpperCase().replace(/[\s-]+/g, "").replace(/=+$/, "");
  if (!cleanStr) {
    throw new Error("El secreto Base32 no puede estar vacío.");
  }
  if ([1, 3, 6].includes(cleanStr.length % 8)) {
    throw new Error("Longitud Base32 inválida (posible clave incompleta o truncada).");
  }

  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (idx === -1) {
      throw new Error(`Carácter Base32 inválido en la posición ${i + 1}: "${cleanStr[i]}"`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Parsea un URI otpauth://totp/... estándar.
 */
function parseOtpAuthUri(uriString) {
  const parsed = new URL(uriString.trim());
  if (parsed.protocol !== "otpauth:" || parsed.hostname.toLowerCase() !== "totp") {
    throw new Error("URI otpauth://totp inválido.");
  }

  const secret = parsed.searchParams.get("secret");
  if (!secret) {
    throw new Error("El URI otpauth no contiene el parámetro secret.");
  }

  const rawAlgo = (parsed.searchParams.get("algorithm") || "SHA1").toUpperCase().replace(/^SHA(\d+)$/, "SHA-$1");
  const algorithm = SUPPORTED_ALGORITHMS.has(rawAlgo) ? rawAlgo : "SHA-1";
  const digits = parseInt(parsed.searchParams.get("digits") || "6", 10);
  const period = parseInt(parsed.searchParams.get("period") || "30", 10);
  const issuer = parsed.searchParams.get("issuer") || "";
  const label = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  return {
    secret: secret.toUpperCase().replace(/[\s-]+/g, ""),
    algorithm,
    digits: [6, 7, 8].includes(digits) ? digits : 6,
    period: period > 0 ? period : 30,
    issuer,
    label,
  };
}

/**
 * Genera un código TOTP según RFC 6238.
 * @param {string} secretBase32
 * @param {object} [options]
 * @param {number} [options.period=30]
 * @param {number} [options.digits=6]
 * @param {string} [options.algorithm="SHA-1"]
 * @param {number} [options.t0=0]
 * @param {number} [options.nowMs=Date.now()]
 * @returns {Promise<string>}
 */
async function generateTOTP(secretBase32, options = {}) {
  const period = Number.isFinite(options.period) && options.period > 0 ? options.period : 30;
  const digits = [6, 7, 8].includes(options.digits) ? options.digits : 6;
  const algorithm = SUPPORTED_ALGORITHMS.has(options.algorithm) ? options.algorithm : "SHA-1";
  const t0 = Number.isFinite(options.t0) ? options.t0 : 0;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();

  const keyBytes = base32ToBytes(secretBase32);
  const epochSeconds = Math.floor(nowMs / 1000);
  const counter = Math.floor((epochSeconds - t0) / period);

  const counterBytes = new Uint8Array(8);
  let temp = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) no disponible en este entorno.");
  }

  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );

  const signature = await subtle.sign("HMAC", cryptoKey, counterBytes);
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return (binary % mod).toString().padStart(digits, "0");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { base32ToBytes, parseOtpAuthUri, generateTOTP };
}
