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
  const temperature = typeof main.temp === 'number' ? main.temp : 0;
  const humidity = typeof main.humidity === 'number' ? main.humidity : 0;

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

async function openWeatherGet(apiKey, url) {
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
  return parseOpenWeatherPayload(data);
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
  return openWeatherGet(key, url);
}

module.exports = { fetchWeather, fetchWeatherByCoords, pickOpenWeatherKey, envOpenWeatherKey };
