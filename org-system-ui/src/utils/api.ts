export async function apiFetch(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  })
  if (response.status === 401 && !input.includes('/auth/')) {
    localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('permissions')
    if (location.pathname !== '/login') location.assign('/login')
  }
  return response
}
