// AES-GCM encryption for secrets at rest (same scheme/master key as integration keys).
async function key(): Promise<CryptoKey> {
  const master = Deno.env.get('INTEGRATION_MASTER_KEY')
  if (!master || master.length < 32) throw new Error('INTEGRATION_MASTER_KEY must contain at least 32 characters')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)))
  return `edge:v1:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...encrypted))}`
}

export async function decryptSecret(value: string): Promise<string> {
  const [, , iv64, data64] = value.split(':')
  const iv = Uint8Array.from(atob(iv64), (c) => c.charCodeAt(0))
  const data = Uint8Array.from(atob(data64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), data))
}
