export function api(path, opts) {
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}${path}`, opts)
}
