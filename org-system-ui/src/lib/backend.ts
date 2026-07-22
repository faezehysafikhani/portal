const legacyOrigin = 'http://localhost:5043'
const configuredOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

const nativeFetch = globalThis.fetch.bind(globalThis)

// آیا این درخواست، درخواستی احراز‌هویت‌شده است (هدر Authorization دارد)؟
function hasAuthHeader(input: RequestInfo | URL, init?: RequestInit): boolean {
  const h = init?.headers
  if (h instanceof Headers) return h.has('authorization')
  if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === 'authorization')
  if (h && typeof h === 'object') return Object.keys(h).some(k => k.toLowerCase() === 'authorization')
  if (input instanceof Request) return input.headers.has('authorization')
  return false
}

function rewriteTarget(input: RequestInfo | URL): RequestInfo | URL {
  if (!configuredOrigin) return input
  if (typeof input === 'string' && input.startsWith(legacyOrigin)) return configuredOrigin + input.slice(legacyOrigin.length)
  if (input instanceof URL && input.origin === legacyOrigin) return new URL(configuredOrigin + input.pathname + input.search)
  if (input instanceof Request && input.url.startsWith(legacyOrigin)) return new Request(configuredOrigin + input.url.slice(legacyOrigin.length), input)
  return input
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const authenticated = hasAuthHeader(input, init)
  const response = await nativeFetch(rewriteTarget(input), init)
  // نشست باطل/منقضی/کاربر مسدود: خروج خودکار و بازگشت به صفحه ورود.
  if (response.status === 401 && authenticated && localStorage.getItem('token') && !location.pathname.startsWith('/login')) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
    localStorage.removeItem('force-password-change')
    location.assign('/login')
  }
  return response
}

export const backendBaseUrl = configuredOrigin ?? legacyOrigin
