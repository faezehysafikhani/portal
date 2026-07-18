import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/backend'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import faIR from 'antd/locale/fa_IR'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={faIR}
        direction="rtl"
        theme={{
          token: {
            colorPrimary: '#8B1A6B',
            borderRadius: 8,
            fontFamily: "'IRANSans', Tahoma, sans-serif",
            fontSize: 10,
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
)

const currentEntry=document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
if(currentEntry){
  window.setInterval(async()=>{
    if(document.visibilityState!=='visible')return
    try{
      const html=await fetch(`/?__build_check=${Date.now()}`,{cache:'no-store'}).then(response=>response.text())
      const nextEntry=html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1]
      if(nextEntry&&new URL(nextEntry,location.origin).href!==currentEntry)location.reload()
    }catch{}
  },60_000)
}
