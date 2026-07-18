export async function apiFetch(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  })
  if (response.status === 401 && !input.includes('/auth/')) {
    localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('permissions')
    if (location.pathname !== '/login') location.assign('/login')
  }
  const method=String(init.method||'GET').toUpperCase()
  if(response.ok&&!['GET','HEAD','OPTIONS'].includes(method)){
    window.dispatchEvent(new CustomEvent('portal:data-changed',{detail:{input,method}}))
    try{const channel=new BroadcastChannel('portal-data-updates');channel.postMessage({input,method,at:Date.now()});channel.close()}catch{}
  }
  return response
}
