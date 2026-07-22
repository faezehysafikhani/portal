// RFC 6238 TOTP (SHA-1, 6 digits, 30s period) implemented with Web Crypto.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateBase32Secret(bytes = 20): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let bits = '', out = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = ''
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return new Uint8Array(bytes)
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8)
  new DataView(msg).setUint32(4, counter) // 8-byte big-endian counter (high word stays 0)
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg))
  const off = h[h.length - 1] & 0x0f
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}

export async function verifyTotp(secretB32: string, code: string): Promise<boolean> {
  const c = String(code ?? '').replace(/\s/g, '').trim()
  if (!/^\d{6}$/.test(c)) return false
  const secret = base32Decode(secretB32)
  if (!secret.length) return false
  const counter = Math.floor(Date.now() / 30000)
  for (const k of [counter - 1, counter, counter + 1]) {
    if (await hotp(secret, k) === c) return true
  }
  return false
}

export function otpauthUri(issuer: string, account: string, secretB32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30&algorithm=SHA1`
}
