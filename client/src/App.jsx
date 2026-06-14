import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, isNetworkFetchError, NETWORK_ERROR_MESSAGE } from './lib/api.js'
import {
  hasLiveWeatherPreview,
  isSoilValid,
  isWeatherStepValid,
  parseNum,
  soilErrors,
  weatherErrors,
} from './lib/cropValidation.js'
import { requestUserLocation } from './lib/geolocation.js'
import Header from './components/Header.jsx'
import SoilSection from './components/SoilSection.jsx'
import WeatherSection from './components/WeatherSection.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import AppFooter from './components/AppFooter.jsx'
import WizardStepper from './components/WizardStepper.jsx'
import { FaWandMagicSparkles } from 'react-icons/fa6'

const weatherFields = (state) => ({
  lat: state.geoLat,
  lon: state.geoLon,
  geoError: state.geoError,
  liveWeather: state.liveWeatherPreview,
  temperature: state.temperature,
  humidity: state.humidity,
  rainfall: state.rainfall,
})

export default function App() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  /** @type {{ message: string, input?: object } | null} */
  const [predictionError, setPredictionError] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(1)

  /** After failed Next: show "required" on empty fields */
  const [soilHighlightRequired, setSoilHighlightRequired] = useState(false)
  const [weatherHighlightRequired, setWeatherHighlightRequired] = useState(false)

  const [N, setN] = useState('')
  const [P, setP] = useState('')
  const [K, setK] = useState('')
  const [ph, setPh] = useState('')

  const [soilScanning, setSoilScanning] = useState(false)
  const [soilScanError, setSoilScanError] = useState(/** @type {string | null} */ (null))
  const [soilScanPreviewUrl, setSoilScanPreviewUrl] = useState(/** @type {string | null} */ (null))

  const [weatherMode, setWeatherMode] = useState('api')
  /** Resolved from OpenWeather after geolocation (for preview / review). */
  const [city, setCity] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [rainfall, setRainfall] = useState('')

  const [geoLat, setGeoLat] = useState(/** @type {number | null} */ (null))
  const [geoLon, setGeoLon] = useState(/** @type {number | null} */ (null))
  const [geoError, setGeoError] = useState(/** @type {string | null} */ (null))
  const [geoAttempt, setGeoAttempt] = useState(0)

  /** OpenWeather snapshot when using Live API (before predict). */
  const [liveWeatherPreview, setLiveWeatherPreview] = useState(null)
  /** Frozen on leaving step 2 so step 3 submit does not lose weather/location. */
  const [weatherSnapshot, setWeatherSnapshot] = useState(/** @type {null | { geoLat: number, geoLon: number, city: string, countryCode: string, liveWeather: object }} */ (null))

  const wf = weatherFields({
    geoLat,
    geoLon,
    geoError,
    liveWeatherPreview,
    temperature,
    humidity,
    rainfall,
  })

  const activeLiveWeather =
    step >= 3 && weatherSnapshot?.liveWeather ? weatherSnapshot.liveWeather : liveWeatherPreview
  const activeCity = step >= 3 && weatherSnapshot ? weatherSnapshot.city : city
  const activeCountryCode = step >= 3 && weatherSnapshot ? weatherSnapshot.countryCode : countryCode
  const activeGeoLat = step >= 3 && weatherSnapshot ? weatherSnapshot.geoLat : geoLat
  const activeGeoLon = step >= 3 && weatherSnapshot ? weatherSnapshot.geoLon : geoLon

  const detectedLocationLabel =
    activeLiveWeather?.cityName != null
      ? `${activeLiveWeather.cityName}${activeLiveWeather.countryCode ? `, ${activeLiveWeather.countryCode}` : ''}`
      : activeCity.trim()
        ? `${activeCity.trim()}${activeCountryCode.trim() ? `, ${activeCountryCode.trim().toUpperCase()}` : ''}`
        : ''

  const locationStatus =
    weatherMode !== 'api'
      ? 'idle'
      : geoError
        ? 'error'
        : !Number.isFinite(geoLat) || !Number.isFinite(geoLon)
          ? 'detecting'
          : !hasLiveWeatherPreview(liveWeatherPreview)
            ? 'loading'
            : 'ready'

  const soilErr = soilErrors(N, P, K, ph, { showErrors: soilHighlightRequired })
  const weatherErr = weatherErrors(weatherMode, wf, { showErrors: weatherHighlightRequired })

  const soilComplete = isSoilValid(N, P, K, ph)
  const weatherComplete =
    step === 3 && weatherMode === 'api' && weatherSnapshot
      ? hasLiveWeatherPreview(weatherSnapshot.liveWeather)
      : isWeatherStepValid(weatherMode, wf)

  const refreshStatus = useCallback(() => {
    api('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ready: false, error: 'API offline' }))
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [refreshStatus])

  useEffect(() => {
    if (soilHighlightRequired && isSoilValid(N, P, K, ph)) setSoilHighlightRequired(false)
  }, [N, P, K, ph, soilHighlightRequired])

  useEffect(() => {
    if (
      weatherHighlightRequired &&
      isWeatherStepValid(weatherMode, weatherFields({ city, countryCode, temperature, humidity, rainfall }))
    ) {
      setWeatherHighlightRequired(false)
    }
  }, [weatherMode, geoLat, geoLon, geoError, liveWeatherPreview, temperature, humidity, rainfall, weatherHighlightRequired])

  /** Live API: browser geolocation — only on step 2 (step 3 keeps snapshot). */
  useEffect(() => {
    if (weatherMode !== 'api') {
      setGeoLat(null)
      setGeoLon(null)
      setGeoError(null)
      return
    }
    if (step < 2) {
      setGeoLat(null)
      setGeoLon(null)
      setGeoError(null)
      return
    }
    if (step > 2) {
      return
    }

    let cancelled = false
    setGeoError(null)
    setGeoLat(null)
    setGeoLon(null)
    setLiveWeatherPreview(null)
    setCity('')
    setCountryCode('')
    setWeatherSnapshot(null)

    ;(async () => {
      try {
        const { lat, lon } = await requestUserLocation()
        if (cancelled) return
        setGeoLat(lat)
        setGeoLon(lon)
      } catch (e) {
        if (cancelled) return
        setGeoError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [step, weatherMode, geoAttempt])

  /** Live API: fetch weather for coords → preview grid + city name (step 2 only). */
  useEffect(() => {
    if (weatherMode !== 'api' || step !== 2) {
      return
    }
    if (!Number.isFinite(geoLat) || !Number.isFinite(geoLon)) {
      return
    }

    let cancelled = false
    const ac = new AbortController()
    const q = new URLSearchParams({ lat: String(geoLat), lon: String(geoLon) })

    ;(async () => {
      try {
        const res = await api(`/api/weather-preview?${q}`, { signal: ac.signal })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Weather preview failed')
        setLiveWeatherPreview({
          temperature: data.temperature,
          humidity: data.humidity,
          rainfall: data.rainfall,
          cityName: data.cityName,
          countryCode: data.countryCode,
        })
        if (typeof data.cityName === 'string' && data.cityName.trim()) setCity(data.cityName.trim())
        if (typeof data.countryCode === 'string' && data.countryCode.trim()) {
          setCountryCode(data.countryCode.trim().toUpperCase())
        }
      } catch (e) {
        if (cancelled || e.name === 'AbortError') return
        setLiveWeatherPreview(null)
        setGeoError(e instanceof Error ? e.message : 'Weather preview failed.')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [step, weatherMode, geoLat, geoLon])

  function retryLocation() {
    setGeoError(null)
    setGeoLat(null)
    setGeoLon(null)
    setLiveWeatherPreview(null)
    setCity('')
    setCountryCode('')
    setGeoAttempt((n) => n + 1)
  }

  function resetForm() {
    setStep(1)
    setSoilHighlightRequired(false)
    setWeatherHighlightRequired(false)
    setN('')
    setP('')
    setK('')
    setPh('')
    setSoilScanning(false)
    setSoilScanError(null)
    if (soilScanPreviewUrl) URL.revokeObjectURL(soilScanPreviewUrl)
    setSoilScanPreviewUrl(null)
    setWeatherMode('api')
    setCity('')
    setCountryCode('')
    setTemperature('')
    setHumidity('')
    setRainfall('')
    setGeoLat(null)
    setGeoLon(null)
    setGeoError(null)
    setGeoAttempt(0)
    setLiveWeatherPreview(null)
    setWeatherSnapshot(null)
    setPredictionError(null)
    setResult(null)
  }

  function handleSoilChange(key, value) {
    if (key === 'N') setN(value)
    if (key === 'P') setP(value)
    if (key === 'K') setK(value)
    if (key === 'ph') setPh(value)
  }

  function applyScannedValue(key, value) {
    const s = value == null ? '' : String(value)
    handleSoilChange(key, s)
  }

  async function handleSoilReportImage(file) {
    setSoilScanError(null)
    setSoilHighlightRequired(false)
    if (soilScanPreviewUrl) URL.revokeObjectURL(soilScanPreviewUrl)
    setSoilScanPreviewUrl(URL.createObjectURL(file))
    setSoilScanning(true)

    const fd = new FormData()
    fd.append('image', file)

    try {
      const res = await api('/api/soil-scan', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read the soil report.')

      if (data.N != null) applyScannedValue('N', data.N)
      if (data.P != null) applyScannedValue('P', data.P)
      if (data.K != null) applyScannedValue('K', data.K)
      if (data.ph != null) applyScannedValue('ph', data.ph)

      const filled = Array.isArray(data.filled) ? data.filled : []
      const missing = Array.isArray(data.missing) ? data.missing : []

      if (missing.length > 0) {
        toast.success('Report partly read', {
          description: `Filled: ${filled.join(', ')}. Please enter: ${missing.join(', ')} manually.`,
          id: 'soil-scan-partial',
        })
      } else {
        toast.success('Soil report read', {
          description: data.notes || 'Values filled from your photo. You can still edit them below.',
          id: 'soil-scan-ok',
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSoilScanError(msg)
      toast.error('Could not read report', { description: msg, id: 'soil-scan-fail' })
    } finally {
      setSoilScanning(false)
    }
  }

  function validateSoilForNext() {
    if (!isSoilValid(N, P, K, ph)) {
      setSoilHighlightRequired(true)
      return false
    }
    setSoilHighlightRequired(false)
    return true
  }

  function validateWeatherForNext() {
    if (!isWeatherStepValid(weatherMode, wf)) {
      setWeatherHighlightRequired(true)
      return false
    }
    setWeatherHighlightRequired(false)
    return true
  }

  function goNext() {
    if (step === 1) {
      if (!validateSoilForNext()) return
      setStep(2)
      return
    }
    if (step === 2) {
      if (!validateWeatherForNext()) return
      if (weatherMode === 'api' && hasLiveWeatherPreview(liveWeatherPreview)) {
        setWeatherSnapshot({
          geoLat,
          geoLon,
          city,
          countryCode,
          liveWeather: liveWeatherPreview,
        })
      } else {
        setWeatherSnapshot(null)
      }
      setStep(3)
    }
  }

  function goBack() {
    if (step === 3) setWeatherSnapshot(null)
    if (step > 1) setStep((s) => s - 1)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (step !== 3) return

    setPredictionError(null)
    setResult(null)

    if (!isSoilValid(N, P, K, ph)) {
      setSoilHighlightRequired(true)
      setStep(1)
      toast.error('Soil data incomplete', { description: 'Please fix the soil fields.', id: 'submit-soil' })
      return
    }
    if (!isWeatherStepValid(weatherMode, wf)) {
      setWeatherHighlightRequired(true)
      setStep(2)
      toast.error('Weather data incomplete', { description: 'Please fix the weather fields.', id: 'submit-weather' })
      return
    }

    const n = parseNum(N)
    const p = parseNum(P)
    const k = parseNum(K)
    const phVal = parseNum(ph)
    const body = { N: n, P: p, K: k, ph: phVal }

    if (weatherMode === 'api') {
      const snap = weatherSnapshot
      const lw = snap?.liveWeather ?? liveWeatherPreview
      body.lat = snap?.geoLat ?? geoLat
      body.lon = snap?.geoLon ?? geoLon
      const cityName =
        snap?.liveWeather?.cityName || snap?.city || lw?.cityName || city
      const cc =
        snap?.liveWeather?.countryCode || snap?.countryCode || lw?.countryCode || countryCode
      if (cityName) body.city = String(cityName).trim()
      if (cc) body.countryCode = String(cc).trim().toUpperCase()
      if (hasLiveWeatherPreview(lw)) {
        body.temperature = lw.temperature
        body.humidity = lw.humidity
        body.rainfall = lw.rainfall
      }
    } else {
      body.temperature = parseNum(temperature)
      body.humidity = parseNum(humidity)
      body.rainfall = parseNum(rainfall)
    }

    setLoading(true)
    try {
      const res = await api('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || data.detail || 'Request failed'
        setPredictionError({
          message: msg,
          input: data.input,
        })
        toast.error('Could not run prediction', { description: msg, id: 'predict-fail' })
        return
      }
      setResult(data)
      toast.success('Recommendation ready', {
        description: `Suggested crop: ${data.recommendedCrop}`,
        id: 'predict-ok',
      })
    } catch (err) {
      const msg = isNetworkFetchError(err) ? NETWORK_ERROR_MESSAGE : err instanceof Error ? err.message : String(err)
      setPredictionError({ message: msg })
      toast.error('Request failed', { description: msg, id: 'predict-net' })
    } finally {
      setLoading(false)
    }
  }

  const modelReady = status?.ready
  const soilScanAvailable = status?.soilScanConfigured !== false
  const showError = Boolean(predictionError?.message)
  const canRunModel = soilComplete && weatherComplete && modelReady && !loading

  useEffect(() => {
    return () => {
      if (soilScanPreviewUrl) URL.revokeObjectURL(soilScanPreviewUrl)
    }
  }, [soilScanPreviewUrl])

  return (
    <div className="min-h-svh bg-[#F9F8F3] font-sans text-slate-800 antialiased">
      <Header status={status} />

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="mb-10 w-full">
          <WizardStepper currentStep={step} soilComplete={soilComplete} weatherComplete={weatherComplete} />
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div className="flex min-h-[200px] flex-col gap-4">
            {step === 1 && (
              <SoilSection
                N={N}
                P={P}
                K={K}
                ph={ph}
                onChange={handleSoilChange}
                errors={soilErr}
                onReportImage={handleSoilReportImage}
                scanning={soilScanning}
                scanError={soilScanError}
                scanPreviewUrl={soilScanPreviewUrl}
                soilScanAvailable={soilScanAvailable}
              />
            )}

            {step === 2 && (
              <WeatherSection
                weatherMode={weatherMode}
                setWeatherMode={setWeatherMode}
                locationStatus={locationStatus}
                detectedLocation={detectedLocationLabel}
                liveWeatherPreview={liveWeatherPreview}
                onRetryLocation={retryLocation}
                temperature={temperature}
                setTemperature={setTemperature}
                humidity={humidity}
                setHumidity={setHumidity}
                rainfall={rainfall}
                setRainfall={setRainfall}
                errors={weatherErr}
              />
            )}

            {step === 3 && (
              <div className="rounded-3xl border border-[#eee] bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.05)] sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4B7922]/90">Ready</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Review your inputs</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  Confirm values below, then run the model
                  {weatherMode === 'api' ? ' (weather from your live location).' : '.'}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">N</dt>
                    <dd className="font-bold text-slate-900">{N || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">P</dt>
                    <dd className="font-bold text-slate-900">{P || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">K</dt>
                    <dd className="font-bold text-slate-900">{K || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">pH</dt>
                    <dd className="font-bold text-slate-900">{ph || '—'}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Weather</dt>
                    <dd className="font-semibold text-slate-800">
                      {weatherMode === 'api'
                        ? hasLiveWeatherPreview(activeLiveWeather)
                          ? `${detectedLocationLabel || '—'} · ${activeLiveWeather.temperature} °C · ${activeLiveWeather.humidity}% humidity · ${activeLiveWeather.rainfall} mm rainfall (12 mo est.)`
                          : `${detectedLocationLabel || '—'} · Live API`
                        : `${temperature || '—'} °C · ${humidity || '—'}% humidity · ${rainfall || '—'} mm rainfall`}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="cursor-pointer min-h-[48px] rounded-2xl border-2 border-[#D9E4C5] bg-white px-6 py-3 text-sm font-bold text-[#2d4714] shadow-sm transition hover:bg-[#fcfaf7]"
                >
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 2 && !weatherComplete}
                  className="cursor-pointer min-h-[48px] rounded-2xl bg-[#4B7922] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#3d621b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  type="submit"
                  disabled={!canRunModel}
                  className="flex min-h-[52px] min-w-[200px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#4B7922] px-5 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-[#3d621b] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
                >
                  {loading ? (
                    <>
                      <span className="cursor-pointer h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                      Running…
                    </>
                  ) : (
                    <>
                      <FaWandMagicSparkles className="cursor-pointer h-5 w-5 text-white" aria-hidden />
                      Get recommendation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <ResultPanel
              result={result}
              preview={{
                N,
                P,
                K,
                ph,
                weatherMode,
                city,
                countryCode,
                temperature,
                humidity,
                rainfall,
                liveWeather: activeLiveWeather,
                geoLat: activeGeoLat,
                geoLon: activeGeoLon,
              }}
              errorMessage={showError ? predictionError.message : null}
              onTryAgain={resetForm}
            />
          </div>
        </form>
      </main>

      <AppFooter />
    </div>
  )
}
