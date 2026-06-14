/**
 * @returns {Promise<{ lat: number, lon: number, accuracy?: number }>}
 */
export function requestUserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser. Use Manual weather instead.'))
      return
    }

    const onSuccess = (pos) => {
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        reject(new Error('Could not read a valid location from your device.'))
        return
      }
      resolve({
        lat,
        lon,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
      })
    }

    const onError = (err) => {
      const msg =
        err.code === 1
          ? 'Location permission denied. Allow location in your browser, or switch to Manual weather.'
          : err.code === 2
            ? 'Location unavailable. Try again or use Manual weather.'
            : err.code === 3
              ? 'Location request timed out. Try again or use Manual weather.'
              : 'Could not detect your location. Try again or use Manual weather.'
      reject(new Error(msg))
    }

    const highAccuracy = { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    const lowAccuracy = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(onSuccess, onError, lowAccuracy)
          return
        }
        onError(err)
      },
      highAccuracy,
    )
  })
}
