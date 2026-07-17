const legacyOrigin = 'http://localhost:5043'
const configuredOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

if (configuredOrigin) {
  const nativeFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === 'string' && input.startsWith(legacyOrigin)) {
      return nativeFetch(configuredOrigin + input.slice(legacyOrigin.length), init)
    }
    if (input instanceof URL && input.origin === legacyOrigin) {
      return nativeFetch(new URL(configuredOrigin + input.pathname + input.search), init)
    }
    if (input instanceof Request && input.url.startsWith(legacyOrigin)) {
      return nativeFetch(new Request(configuredOrigin + input.url.slice(legacyOrigin.length), input), init)
    }
    return nativeFetch(input, init)
  }
}

export const backendBaseUrl = configuredOrigin ?? legacyOrigin

