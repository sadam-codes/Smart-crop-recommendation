/** Aligned with server `routes/crop.js` BOUNDS */
export const BOUNDS = {
  N: [0, 140],
  P: [5, 145],
  K: [5, 205],
  ph: [3.5, 10],
  temperature: [0, 50],
  humidity: [0, 100],
  rainfall: [0, 350],
}

export function parseNum(v) {
  const t = String(v ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

const LABELS = {
  N: 'N',
  P: 'P',
  K: 'K',
  ph: 'pH',
  temperature: 'Temperature',
  humidity: 'Humidity',
  rainfall: 'Rainfall',
}

function rangeMsg(key, lo, hi, unit = '') {
  const name = LABELS[key] || key
  return `${name} must be between ${lo} and ${hi}${unit ? ` ${unit}` : ''} (dataset range).`
}

/** @returns {string | null} */
export function soilFieldError(key, raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return 'This field is required.'
  const n = Number(t)
  if (!Number.isFinite(n)) return 'Enter a valid number.'
  const [lo, hi] = BOUNDS[key]
  if (n < lo || n > hi) {
    if (key === 'ph') {
      return `pH must be between ${lo} and ${hi}. If you see ~80, that is usually humidity (%), not pH.`
    }
    return rangeMsg(key, lo, hi)
  }
  return null
}

/** All soil fields valid (filled + in range). */
export function isSoilValid(N, P, K, ph) {
  return !soilFieldError('N', N) && !soilFieldError('P', P) && !soilFieldError('K', K) && !soilFieldError('ph', ph)
}

/** @returns {Record<'N'|'P'|'K'|'ph', string | null>} */
export function soilErrors(N, P, K, ph, { showErrors = false } = {}) {
  const keys = ['N', 'P', 'K', 'ph']
  const values = { N, P, K, ph }
  /** @type {Record<string, string | null>} */
  const out = {}
  for (const key of keys) {
    if (!showErrors) {
      out[key] = null
      continue
    }
    out[key] = soilFieldError(key, values[key])
  }
  return /** @type {Record<'N'|'P'|'K'|'ph', string | null>} */ (out)
}

/** Manual weather field error */
export function manualWeatherFieldError(key, raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return 'This field is required.'
  const n = Number(t)
  if (!Number.isFinite(n)) return 'Enter a valid number.'
  const [lo, hi] = BOUNDS[key]
  const unit = key === 'humidity' ? '%' : key === 'temperature' ? '°C' : key === 'rainfall' ? 'mm' : ''
  if (n < lo || n > hi) {
    return rangeMsg(key, lo, hi, unit).replace(' (dataset range).', '.')
  }
  return null
}

export function isManualWeatherValid(temperature, humidity, rainfall) {
  return (
    !manualWeatherFieldError('temperature', temperature) &&
    !manualWeatherFieldError('humidity', humidity) &&
    !manualWeatherFieldError('rainfall', rainfall)
  )
}

/** Live API: needs coords + loaded weather preview */
export function hasLiveWeatherPreview(preview) {
  if (!preview) return false
  return [preview.temperature, preview.humidity, preview.rainfall].every(
    (x) => typeof x === 'number' && Number.isFinite(x),
  )
}

/** @param {{ lat: number | null, lon: number | null, geoError?: string | null, liveWeather?: object | null }} api */
export function apiLocationError({ lat, lon, geoError, liveWeather }) {
  if (geoError) return geoError
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Detecting your location…'
  if (!hasLiveWeatherPreview(liveWeather)) return 'Loading weather for your location…'
  return null
}

export function isApiWeatherValid({ lat, lon, geoError, liveWeather }) {
  return !apiLocationError({ lat, lon, geoError, liveWeather })
}

/**
 * @returns {Record<string, string | null>}
 */
export function weatherErrors(
  weatherMode,
  { lat, lon, geoError, liveWeather, temperature, humidity, rainfall },
  { showErrors = false } = {},
) {
  if (!showErrors) {
    return {
      location: null,
      temperature: null,
      humidity: null,
      rainfall: null,
    }
  }
  if (weatherMode === 'api') {
    const locErr = apiLocationError({ lat, lon, geoError, liveWeather })
    return {
      location: locErr,
      temperature: null,
      humidity: null,
      rainfall: null,
    }
  }
  return {
    location: null,
    temperature: manualWeatherFieldError('temperature', temperature),
    humidity: manualWeatherFieldError('humidity', humidity),
    rainfall: manualWeatherFieldError('rainfall', rainfall),
  }
}

export function isWeatherStepValid(weatherMode, fields) {
  const e = weatherErrors(weatherMode, fields, { showErrors: true })
  return !Object.values(e).some(Boolean)
}
