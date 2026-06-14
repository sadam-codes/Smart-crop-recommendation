import { FaCloud, FaLocationCrosshairs, FaRotateRight } from 'react-icons/fa6'

const baseInput =
  'min-h-11 w-full rounded-xl border bg-[#fcfaf7] px-3 py-2.5 text-sm font-medium text-slate-800 transition focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const inputOk = 'border-[#eee] focus:border-[#4B7922] focus:ring-[#4B7922]/20'
const inputErr = 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200'

const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-stone-500'

const BOUNDS_T = '0–50 °C'
const BOUNDS_H = '0–100%'
const BOUNDS_R = '0–350 mm'

const toggleBtn = (active) =>
  active
    ? 'bg-[#4B7922] text-white shadow-sm'
    : 'bg-[#E8E4DC] text-slate-800 hover:bg-[#ddd8cf]'

function FieldHint({ id, error }) {
  if (!error) return null
  return (
    <p id={id} className="text-xs font-medium text-red-600" role="alert">
      {error}
    </p>
  )
}

/**
 * @param {object} props
 * @param {Record<string, string | null | undefined>} [props.errors]
 * @param {'idle'|'detecting'|'loading'|'ready'|'error'} [props.locationStatus]
 * @param {{ temperature?: number, humidity?: number, rainfall?: number } | null} [props.liveWeatherPreview]
 */
export default function WeatherSection({
  weatherMode,
  setWeatherMode,
  locationStatus = 'idle',
  detectedLocation = '',
  liveWeatherPreview = null,
  onRetryLocation,
  temperature,
  setTemperature,
  humidity,
  setHumidity,
  rainfall,
  setRainfall,
  errors = {},
}) {
  const eLoc = errors.location ?? null
  const eT = errors.temperature ?? null
  const eH = errors.humidity ?? null
  const eR = errors.rainfall ?? null

  const cn = (err) => `${baseInput} ${err ? inputErr : inputOk}`

  const statusText =
    locationStatus === 'detecting'
      ? 'Detecting your location…'
      : locationStatus === 'loading'
        ? 'Loading weather for your area…'
        : locationStatus === 'ready' && detectedLocation
          ? detectedLocation
          : locationStatus === 'error'
            ? 'Location unavailable'
            : 'Waiting for location…'

  const showLiveStats =
    locationStatus === 'ready' &&
    liveWeatherPreview &&
    [liveWeatherPreview.temperature, liveWeatherPreview.humidity, liveWeatherPreview.rainfall].every(
      (x) => typeof x === 'number' && Number.isFinite(x),
    )

  const fmt = (n, digits = 1) => {
    const v = Number(n)
    return Number.isFinite(v) ? v.toFixed(digits) : '—'
  }

  return (
    <section className="rounded-3xl border border-[#eee] bg-white p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="mb-5 flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D9E4C5] text-[#4B7922]">
          <FaCloud className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Weather data</h2>
          <p className="mt-0.5 text-sm text-stone-600">How temperature, humidity &amp; rainfall are provided</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#fcfaf7] p-1.5 ring-1 ring-[#eee]" role="group" aria-label="Weather source">
        <button
          type="button"
          className={`cursor-pointer rounded-xl py-3 text-sm font-bold transition ${toggleBtn(weatherMode === 'api')}`}
          onClick={() => setWeatherMode('api')}
          aria-pressed={weatherMode === 'api'}
        >
          Live API
        </button>
        <button
          type="button"
          className={`cursor-pointer rounded-xl py-3 text-sm font-bold transition ${toggleBtn(weatherMode === 'manual')}`}
          onClick={() => setWeatherMode('manual')}
          aria-pressed={weatherMode === 'manual'}
        >
          Manual
        </button>
      </div>

      {weatherMode === 'api' ? (
        <div>
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
              eLoc ? 'border-red-300 bg-red-50/40' : 'border-[#D9E4C5] bg-[#fcfaf7]'
            }`}
            aria-live="polite"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D9E4C5] text-[#4B7922]">
              {locationStatus === 'detecting' || locationStatus === 'loading' ? (
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-[#4B7922]/25 border-t-[#4B7922]"
                  aria-hidden
                />
              ) : (
                <FaLocationCrosshairs className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={labelClass}>Your location</p>
              <p className="mt-1 text-base font-bold text-slate-900">{statusText}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                We use your browser GPS for location, then load current temperature &amp; humidity from Open-Meteo (closer to Google Weather). Rainfall is a 12-month estimate for the crop model.
              </p>
            </div>
            {(locationStatus === 'error' || locationStatus === 'ready') && (
              <button
                type="button"
                onClick={onRetryLocation}
                className="cursor-pointer flex shrink-0 items-center gap-1.5 rounded-xl border border-[#D9E4C5] bg-white px-3 py-2 text-xs font-bold text-[#4B7922] transition hover:bg-[#fcfaf7]"
              >
                <FaRotateRight className="h-3.5 w-3.5" aria-hidden />
                Retry
              </button>
            )}
          </div>
          {showLiveStats ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#D9E4C5] bg-white px-4 py-3">
                <p className={labelClass}>Temperature</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{fmt(liveWeatherPreview.temperature, 1)} °C</p>
              </div>
              <div className="rounded-2xl border border-[#D9E4C5] bg-white px-4 py-3">
                <p className={labelClass}>Humidity</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{fmt(liveWeatherPreview.humidity, 0)}%</p>
              </div>
              <div className="rounded-2xl border border-[#D9E4C5] bg-white px-4 py-3">
                <p className={labelClass}>Rainfall (12 mo est.)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{fmt(liveWeatherPreview.rainfall, 1)} mm</p>
              </div>
            </div>
          ) : null}
          <FieldHint id="err-w-loc" error={eLoc} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Temperature · {BOUNDS_T}</span>
            <input
              className={cn(eT)}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder=""
              aria-invalid={Boolean(eT)}
              aria-describedby={eT ? 'err-w-t' : undefined}
            />
            <FieldHint id="err-w-t" error={eT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Humidity · {BOUNDS_H}</span>
            <input
              className={cn(eH)}
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder=""
              aria-invalid={Boolean(eH)}
              aria-describedby={eH ? 'err-w-h' : undefined}
            />
            <FieldHint id="err-w-h" error={eH} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Rainfall · {BOUNDS_R}</span>
            <input
              className={cn(eR)}
              value={rainfall}
              onChange={(e) => setRainfall(e.target.value)}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder=""
              aria-invalid={Boolean(eR)}
              aria-describedby={eR ? 'err-w-r' : undefined}
            />
            <FieldHint id="err-w-r" error={eR} />
          </label>
        </div>
      )}
    </section>
  )
}
