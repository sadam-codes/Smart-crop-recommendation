import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      offset={20}
      gap={12}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'sonner-toast group relative flex w-[min(100%,26rem)] items-center gap-4 rounded-2xl border px-5 py-4 pr-14 font-sans shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)]',
          content: 'flex min-w-0 flex-1 flex-col justify-center',
          title: 'text-[0.9375rem] font-bold leading-snug text-slate-900',
          description: 'text-sm leading-snug text-slate-600',
          success: 'border-[#c5d9a8] bg-gradient-to-br from-[#f7faf0] to-[#eef4e4] text-slate-900',
          error: 'border-red-200/90 bg-gradient-to-br from-[#fff8f8] to-[#fff0f0] text-slate-900',
          warning: 'border-amber-200/90 bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] text-slate-900',
          info: 'border-slate-200 bg-white text-slate-900',
        },
      }}
    />
  </StrictMode>,
)
