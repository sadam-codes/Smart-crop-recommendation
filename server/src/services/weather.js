const axios = require('axios');

function envOpenWeatherKey() {
  const k = process.env.OPENWEATHER_API_KEY;
  return typeof k === 'string' ? k.trim() : '';
}

/**
 * Request key (query/body) overrides OPENWEATHER_API_KEY from server/.env
 */
function pickOpenWeatherKey(req) {
  const q = req.query && req.query.openWeatherApiKey;
  const b = req.body && req.body.openWeatherApiKey;
  const fromQuery = typeof q === 'string' ? q.trim() : '';
  const fromBody = typeof b === 'string' ? b.trim() : '';
  return fromQuery || fromBody || envOpenWeatherKey();
}

function requireApiKey(apiKey) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) {
    const err = new Error(
      'Missing OpenWeather API key. Set OPENWEATHER_API_KEY in server/.env or pass openWeatherApiKey in the query string or JSON body. https://openweathermap.org/api'
    );
    err.code = 'OPENWEATHER_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Crop model expects seasonal/annual rainfall (mm), not current-hour rain.
 * Uses Open-Meteo archive (last 12 months), capped to dataset bounds.
 */
async function fetchAnnualRainfallEstimate(lat, lon) {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}&start_date=${formatDate(start)}` +
    `&end_date=${formatDate(end)}&daily=precipitation_sum`;

  try {
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    const daily = res.data?.daily?.precipitation_sum;
    if (!Array.isArray(daily) || daily.length === 0) return null;
    const sum = daily.reduce((acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0), 0);
    if (!Number.isFinite(sum)) return null;
    return Math.min(350, Math.max(0, Math.round(sum * 10) / 10));
  } catch {
    return null;
  }
}

async function fetchOpenMeteoCurrent(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m&timezone=auto`;

  try {
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    const cur = res.data?.current;
    if (!cur) return null;
    const temperature =
      typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m * 10) / 10 : null;
    const humidity =
      typeof cur.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : null;
    if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) return null;
    return { temperature, humidity, observedAt: typeof cur.time === 'string' ? cur.time : null };
  } catch {
    return null;
  }
}

async function reverseGeocodeCity(apiKey, lat, lon) {
  const url =
    `https://api.openweathermap.org/geo/1.0/reverse?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}&limit=1&appid=${encodeURIComponent(apiKey)}`;
  try {
    const res = await axios.get(url, { timeout: 10000, validateStatus: () => true });
    const row = Array.isArray(res.data) ? res.data[0] : null;
    if (!row || typeof row.name !== 'string') return null;
    return {
      cityName: row.name.trim(),
      countryCode: typeof row.country === 'string' ? row.country.trim() : null,
      state: typeof row.state === 'string' ? row.state.trim() : null,
    };
  } catch {
    return null;
  }
}

function parseOpenWeatherPayload(data) {
  if (data.cod === 401 || data.cod === '401') {
    const err = new Error(
      `OpenWeather rejected the API key (${data.message || 'Unauthorized'}). New keys can take up to ~2 hours to activate — see https://openweathermap.org/faq#error401`
    );
    err.code = 'OPENWEATHER_UNAUTHORIZED';
    throw err;
  }
  const main = data.main || {};
  const rain1h = data.rain && typeof data.rain['1h'] === 'number' ? data.rain['1h'] : 0;
  const w0 = Array.isArray(data.weather) && data.weather[0] ? data.weather[0] : {};
  const temperature =
    typeof main.temp === 'number' ? Math.round(main.temp * 10) / 10 : 0;
  const humidity =
    typeof main.humidity === 'number' ? Math.round(main.humidity) : 0;

  const weatherDetails = {
    cityName: typeof data.name === 'string' ? data.name : null,
    countryCode: data.sys && typeof data.sys.country === 'string' ? data.sys.country : null,
    coordinates:
      data.coord && typeof data.coord.lat === 'number' && typeof data.coord.lon === 'number'
        ? { lat: data.coord.lat, lon: data.coord.lon }
        : null,
    description: typeof w0.description === 'string' ? w0.description : null,
    main: {
      temp: temperature,
      feelsLike: typeof main.feels_like === 'number' ? main.feels_like : null,
      tempMin: typeof main.temp_min === 'number' ? main.temp_min : null,
      tempMax: typeof main.temp_max === 'number' ? main.temp_max : null,
      pressure: typeof main.pressure === 'number' ? main.pressure : null,
      humidity,
    },
    wind: {
      speed: data.wind && typeof data.wind.speed === 'number' ? data.wind.speed : null,
      deg: data.wind && typeof data.wind.deg === 'number' ? data.wind.deg : null,
    },
    visibility: typeof data.visibility === 'number' ? data.visibility : null,
    clouds: data.clouds && typeof data.clouds.all === 'number' ? data.clouds.all : null,
    rain: { mm1h: rain1h },
  };

  return {
    temperature,
    humidity,
    rainfall: rain1h,
    weatherDetails,
  };
}

async function openWeatherGet(apiKey, url, { lat, lon } = {}) {
  let data;
  try {
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    data = res.data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message || 'OpenWeather request failed';
    const err = new Error(`OpenWeather: ${msg}`);
    err.code = 'OPENWEATHER_HTTP';
    throw err;
  }
  const parsed = parseOpenWeatherPayload(data);

  const coordLat = lat ?? parsed.weatherDetails?.coordinates?.lat;
  const coordLon = lon ?? parsed.weatherDetails?.coordinates?.lon;
  if (Number.isFinite(coordLat) && Number.isFinite(coordLon)) {
    const [geo, rainfallAnnual, meteoCurrent] = await Promise.all([
      reverseGeocodeCity(apiKey, coordLat, coordLon),
      fetchAnnualRainfallEstimate(coordLat, coordLon),
      fetchOpenMeteoCurrent(coordLat, coordLon),
    ]);
    if (geo?.cityName) {
      parsed.weatherDetails.cityName = geo.cityName;
      if (geo.countryCode) parsed.weatherDetails.countryCode = geo.countryCode;
      if (geo.state) parsed.weatherDetails.state = geo.state;
    }
    if (meteoCurrent) {
      parsed.temperature = meteoCurrent.temperature;
      parsed.humidity = meteoCurrent.humidity;
      parsed.weatherDetails.main.temp = meteoCurrent.temperature;
      parsed.weatherDetails.main.humidity = meteoCurrent.humidity;
      parsed.weatherDetails.observedAt = meteoCurrent.observedAt;
      parsed.weatherDetails.weatherSource = 'open-meteo';
    } else {
      parsed.weatherDetails.weatherSource = 'openweather';
    }
    if (typeof rainfallAnnual === 'number' && Number.isFinite(rainfallAnnual)) {
      parsed.rainfall = rainfallAnnual;
      parsed.weatherDetails.rain = {
        mm1h: parsed.weatherDetails.rain?.mm1h ?? 0,
        annualEstimate: rainfallAnnual,
      };
    }
  }

  return parsed;
}

/**
 * @param {string} [apiKey] resolved key (request or env)
 * @param {string} city
 * @param {string} countryCode e.g. PK
 */
async function fetchWeather(apiKey, city, countryCode = 'PK') {
  const key = requireApiKey(apiKey);
  const q = `${encodeURIComponent(city)},${countryCode}`;
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${encodeURIComponent(key)}&units=metric`;
  return openWeatherGet(key, url);
}

/**
 * @param {string} [apiKey]
 * @param {number} lat
 * @param {number} lon
 */
async function fetchWeatherByCoords(apiKey, lat, lon) {
  const key = requireApiKey(apiKey);
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(key)}&units=metric`;
  return openWeatherGet(key, url, { lat, lon });
}

module.exports = { fetchWeather, fetchWeatherByCoords, pickOpenWeatherKey, envOpenWeatherKey };
