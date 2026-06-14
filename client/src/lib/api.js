export function api(path, opts) {
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}${path}`, opts)
}

/** Browser fetch network failures (server down, proxy error, CORS). */
export function isNetworkFetchError(err) {
  if (!(err instanceof TypeError)) return false
  const msg = String(err.message || '').toLowerCase()
  return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')
}

export const NETWORK_ERROR_MESSAGE =
  'Cannot reach the API server. Make sure `npm run dev` is running in the server folder (port 5000), wait a few seconds if it just restarted, then try again.'
