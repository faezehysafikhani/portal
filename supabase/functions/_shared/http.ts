import { corsHeaders } from './cors.ts'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export async function body<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json() as T
  } catch {
    throw new HttpError(400, 'بدنه درخواست معتبر نیست')
  }
}

export function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key.length ? key[0].toLowerCase() + key.slice(1) : key,
      camelize(item),
    ]))
  }
  return value
}

export function pascalize(value: Record<string, unknown>, allowed?: readonly string[]): Record<string, unknown> {
  const entries = Object.entries(value).map(([key, item]) => [
    key.length ? key[0].toUpperCase() + key.slice(1) : key,
    item,
  ])
  return Object.fromEntries(allowed ? entries.filter(([key]) => allowed.includes(key)) : entries)
}

export function uuid(): string {
  return crypto.randomUUID()
}

