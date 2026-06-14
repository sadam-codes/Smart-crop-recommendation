import { FaLeaf } from 'react-icons/fa6'
import { IoSparkles } from 'react-icons/io5'

function fmt(n, digits = 2) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

/** Live form value: formatted number when valid, otherwise raw text or em dash */
function previewCell(raw, digits = 2) {
  const t = String(raw ?? '').trim()
  if (t === '') return '—'
  const n = Number(t)
  if (Number.isFinite(n)) return fmt(n, digits)
  return t
}

function previewLocation(weatherMode, city, countryCode, liveWeather) {
  if (weatherMode === 'manual') return 'Manual'
  const lwCity = liveWeather?.cityName != null ? String(liveWeather.cityName).trim() : ''
  const lwCc =
    liveWeather?.countryCode != null ? String(liveWeather.countryCode).trim().toUpperCase() : ''
  const c = lwCity || String(city ?? '').trim()
  const cc = lwCc || String(countryCode ?? '').trim()
  if (!c && !cc) return '—'
  if (c && cc) return `${c}, ${cc}`
  return c || cc
}

function Cell({ label, value }) {
  return (
    <div className="rounded-xl border border-white/70 bg-[#fcfaf7] px-2 py-3 text-center shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  )
}

function locationLabel(result) {
  if (!result) return '—'
  if (result.weatherSource === 'manual') return 'Manual'
  const lr = result.locationRequest
  if (lr?.city) {
    const cc = lr.countryCode || ''
    return cc ? `${lr.city}, ${cc}` : lr.city
  }
  return '—'
}

/**
 * Right column: idle grid (live preview), success (perfect match + grid), or error.
 * @param {object} [preview] — current form values while editing (before / without a result)
 */
export default function ResultPanel({ result, preview, errorMessage, onTryAgain }) {
  const input = result?.input || {}
  const crop = result?.recommendedCrop
  const recommendationExplanation = result?.recommendationExplanation
  const pv = preview || {}

  const gridN = crop ? fmt(input.N, 0) : previewCell(pv.N, 0)
  const gridP = crop ? fmt(input.P, 0) : previewCell(pv.P, 0)
  const gridK = crop ? fmt(input.K, 0) : previewCell(pv.K, 0)
  const gridPh = crop ? fmt(input.ph, 2) : previewCell(pv.ph, 2)

  const lw = pv.liveWeather
  const hasLivePreview =
    lw &&
    [lw.temperature, lw.humidity, lw.rainfall].every((x) => typeof x === 'number' && Number.isFinite(x))

  const gridTemp = crop
    ? fmt(input.temperature, 1)
    : pv.weatherMode === 'manual'
      ? previewCell(pv.temperature, 1)
      : hasLivePreview
        ? fmt(lw.temperature, 1)
        : '—'
  const gridHum = crop
    ? fmt(input.humidity, 0)
    : pv.weatherMode === 'manual'
      ? previewCell(pv.humidity, 0)
      : hasLivePreview
        ? fmt(lw.humidity, 0)
        : '—'
  const gridRain = crop
    ? fmt(input.rainfall, 1)
    : pv.weatherMode === 'manual'
      ? previewCell(pv.rainfall, 1)
      : hasLivePreview
        ? fmt(lw.rainfall, 1)
        : '—'

  const gridLoc = crop
    ? locationLabel(result)
    : previewLocation(pv.weatherMode, pv.city, pv.countryCode, pv.liveWeather)

  if (errorMessage) {
    return (
      <div className="flex min-h-[320px] flex-col rounded-3xl border border-red-200/80 bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Something went wrong</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{errorMessage}</p>
        <button
          type="button"
          onClick={onTryAgain}
          className="mt-auto w-full rounded-xl bg-[#4B7922] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#3d621b]"
        >
          Try another
        </button>
      </div>
    )
  }

  if (!crop) {
    return (
      <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-[#D9E4C5] bg-[#D9E4C5]/45 p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)] sm:p-8">
        <IoSparkles className="absolute right-5 top-5 h-6 w-6 text-amber-500/90" aria-hidden />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#4B7922]/25 text-[#4B7922]">
            <FaLeaf className="h-8 w-8" aria-hidden />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4B7922]/80">Recommendation</p>
            <p className="mt-1 text-lg font-bold text-slate-700">Fill the form to see your match</p>
            <p className="mt-2 text-sm text-slate-600">The grid below mirrors your soil and weather inputs as you type.</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell label="N" value={gridN} />
          <Cell label="P" value={gridP} />
          <Cell label="K" value={gridK} />
          <Cell label="pH" value={gridPh} />
          <Cell label="Temp (°C)" value={gridTemp} />
          <Cell label="Humidity (%)" value={gridHum} />
          <Cell label="Rainfall (mm)" value={gridRain} />
          <Cell label="Location" value={gridLoc} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-[#D9E4C5] bg-[#D9E4C5]/45 p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)] sm:p-8">
      <IoSparkles className="absolute right-5 top-5 h-6 w-6 text-amber-500/90" aria-hidden />

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 sm:items-start">
        <div className="row-start-1 flex h-16 w-16 shrink-0 items-center justify-center justify-self-start rounded-full bg-[#4B7922] text-white shadow-md">
          <FaLeaf className="h-8 w-8" aria-hidden />
        </div>
        <div className="row-start-1 min-w-0 self-center sm:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4B7922]">Perfect match</p>
          <p className="mt-1 font-sans text-4xl font-bold capitalize leading-tight text-slate-900 sm:text-5xl">{crop}</p>
        </div>
        {recommendationExplanation ? (
          <p className="col-span-2 row-start-2 text-sm leading-relaxed text-justify text-slate-700">{recommendationExplanation}</p>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cell label="N" value={gridN} />
        <Cell label="P" value={gridP} />
        <Cell label="K" value={gridK} />
        <Cell label="pH" value={gridPh} />
        <Cell label="Temp (°C)" value={gridTemp} />
        <Cell label="Humidity (%)" value={gridHum} />
        <Cell label="Rainfall (mm)" value={gridRain} />
        <Cell label="Location" value={gridLoc} />
      </div>

      <button
        type="button"
        onClick={onTryAgain}
        className="cursor-pointer mt-8 w-full rounded-xl bg-[#4B7922] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#3d621b]"
      >
        Try another
      </button>
    </div>
  )
}
