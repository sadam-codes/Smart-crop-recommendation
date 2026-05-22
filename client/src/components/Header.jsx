import { FaCloud, FaLeaf } from 'react-icons/fa6'
import { HiArrowTrendingUp } from 'react-icons/hi2'

export default function Header({ status }) {
  const modelReady = status?.ready

  return (
    <header className="relative z-10 px-5 pb-8 pt-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#4B7922]">
          <FaLeaf className="h-5 w-5 shrink-0" aria-hidden />
          AI-powered agriculture
        </div>
        <h1 className="font-sans text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Smart crop recommendation</h1>
       
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ${
              modelReady ? 'bg-[#D9E4C5]/80 text-[#2d4714]' : 'bg-amber-100 text-amber-900'
            }`}
          >
            <HiArrowTrendingUp className="h-4 w-4 shrink-0" aria-hidden />
            {status?.training
              ? 'Training model…'
              : modelReady
                ? `${status.labels?.length ?? 0} crop classes ready`
                : status?.error || 'Model unavailable'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#D9E4C5]/60 px-3 py-1.5 text-sm font-medium text-[#2d4714] shadow-sm ring-1 ring-[#c5d4b0]/80">
            <FaCloud className="h-4 w-4 shrink-0" aria-hidden />
            Real-time weather integration
          </span>
        </div>
      </div>
    </header>
  )
}
