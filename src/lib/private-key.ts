const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Sinh mã private key dạng TCCC-XXXXXXXXXXXX (loại ký tự dễ nhầm: 0/O, 1/I). */
export function generatePrivateKeyCode(prefix = "TCCC"): string {
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `${prefix}-${out}`;
}
