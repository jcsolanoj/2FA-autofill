import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { base32ToBytes, parseOtpAuthUri, generateTOTP } = require("../chrome-extension/totp.js");

// Vectores oficiales RFC 6238 Apéndice B (Seed ASCII "12345678901234567890" = Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
const RFC_SEED_SHA1 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
// SHA-256 (32 bytes): "12345678901234567890123456789012"
const RFC_SEED_SHA256 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====";
// SHA-512 (64 bytes): "1234567890123456789012345678901234567890123456789012345678901234"
const RFC_SEED_SHA512 =
  "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=";

test("RFC 6238 Test Vectors (8 digits)", async () => {
  assert.equal(await generateTOTP(RFC_SEED_SHA1, { digits: 8, algorithm: "SHA-1", nowMs: 59 * 1000 }), "94287082");
  assert.equal(await generateTOTP(RFC_SEED_SHA256, { digits: 8, algorithm: "SHA-256", nowMs: 59 * 1000 }), "46119246");
  assert.equal(await generateTOTP(RFC_SEED_SHA512, { digits: 8, algorithm: "SHA-512", nowMs: 59 * 1000 }), "90693936");
  assert.equal(
    await generateTOTP(RFC_SEED_SHA1, { digits: 8, algorithm: "SHA-1", nowMs: 1111111109 * 1000 }),
    "07081804"
  );
  assert.equal(
    await generateTOTP(RFC_SEED_SHA1, { digits: 8, algorithm: "SHA-1", nowMs: 1234567890 * 1000 }),
    "89005924"
  );
});

test("RFC 6238 uses Math.floor at .999ms boundary", async () => {
  const c1 = await generateTOTP(RFC_SEED_SHA1, { digits: 6, nowMs: 59_000 });
  const c2 = await generateTOTP(RFC_SEED_SHA1, { digits: 6, nowMs: 59_999 });
  assert.equal(c1, c2);
});

test("base32ToBytes validates malformed input", () => {
  assert.deepEqual(Array.from(base32ToBytes("JBSWY3DPEHPK3PXP")), [
    0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef,
  ]);
  assert.throws(() => base32ToBytes(""), /vacío/);
  assert.throws(() => base32ToBytes("JBSWY3"), /Longitud Base32 inválida/);
  assert.throws(() => base32ToBytes("JBSWY3D1"), /Carácter Base32 inválido/);
});

test("parseOtpAuthUri parses standard URI", () => {
  const parsed = parseOtpAuthUri(
    "otpauth://totp/Empresa:usuario@empresa.com?secret=JBSWY3DPEHPK3PXP&issuer=Empresa&algorithm=SHA256&digits=8&period=30"
  );
  assert.equal(parsed.secret, "JBSWY3DPEHPK3PXP");
  assert.equal(parsed.algorithm, "SHA-256");
  assert.equal(parsed.digits, 8);
  assert.equal(parsed.period, 30);
  assert.equal(parsed.issuer, "Empresa");
});
