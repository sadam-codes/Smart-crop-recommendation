const express = require('express');
const multer = require('multer');
const cropModel = require('../services/cropModel');
const { fetchWeather, fetchWeatherByCoords, pickOpenWeatherKey } = require('../services/weather');
const cropExplanation = require('../services/cropExplanation');
const soilScan = require('../services/soilScan');

const router = express.Router();

const soilUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else {
      cb(
        new Error(
          'Only JPG or PNG images are allowed. iPhone HEIC is not supported — save the photo as JPEG first.',
        ),
      );
    }
  },
});

/** Aligned with Crop_recommendation.csv + sensible weather API bounds */
const BOUNDS = {
  N: [0, 140],
  P: [5, 145],
  K: [5, 205],
  ph: [3.5, 10],
  temperature: [0, 50],
  humidity: [0, 100],
  rainfall: [0, 350],
};

function validateFeatures(input) {
  const { N: n, P: p, K: k, ph: phVal, temperature: t, humidity: h, rainfall: r } = input;
  if (phVal < BOUNDS.ph[0] || phVal > BOUNDS.ph[1]) {
    return {
      error: `pH must be between ${BOUNDS.ph[0]} and ${BOUNDS.ph[1]} (soil scale). If you see ~80, that is usually humidity (%), not pH.`,
    };
  }
  if (n < BOUNDS.N[0] || n > BOUNDS.N[1]) {
    return { error: `N must be between ${BOUNDS.N[0]} and ${BOUNDS.N[1]} (dataset range).` };
  }
  if (p < BOUNDS.P[0] || p > BOUNDS.P[1]) {
    return { error: `P must be between ${BOUNDS.P[0]} and ${BOUNDS.P[1]} (dataset range).` };
  }
  if (k < BOUNDS.K[0] || k > BOUNDS.K[1]) {
    return { error: `K must be between ${BOUNDS.K[0]} and ${BOUNDS.K[1]} (dataset range).` };
  }
  if (t < BOUNDS.temperature[0] || t > BOUNDS.temperature[1]) {
    return { error: `Temperature must be between ${BOUNDS.temperature[0]} and ${BOUNDS.temperature[1]} °C.` };
  }
  if (h < BOUNDS.humidity[0] || h > BOUNDS.humidity[1]) {
    return { error: `Humidity must be between ${BOUNDS.humidity[0]} and ${BOUNDS.humidity[1]}%.` };
  }
  if (r < BOUNDS.rainfall[0] || r > BOUNDS.rainfall[1]) {
    return { error: `Rainfall must be between ${BOUNDS.rainfall[0]} and ${BOUNDS.rainfall[1]} mm.` };
  }
  return null;
}

function parseNum(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

router.get('/status', (req, res) => {
  const key = process.env.OPENWEATHER_API_KEY;
  const openWeatherConfigured = typeof key === 'string' && key.trim().length > 0;
  res.json({
    ...cropModel.getStatus(),
    openWeatherConfigured,
    openAIConfigured: cropExplanation.isConfigured(),
    soilScanConfigured: soilScan.isConfigured(),
  });
});

/** Read N, P, K, pH from a soil report photo (Groq vision). */
router.post('/soil-scan', soilUpload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Upload a soil report image (field name: image).' });
    }
    const result = await soilScan.extractSoilFromImage(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error('soil-scan:', err.message || err);
    const code = err.code;
    const status =
      code === 'GROQ_NOT_CONFIGURED'
        ? 503
        : code === 'GROQ_UNAUTHORIZED'
          ? 401
          : /image|Unsupported|Empty|too large/i.test(err.message || '')
            ? 400
            : 502;
    res.status(status).json({ error: err.message || 'Soil scan failed.' });
  }
});

/** Current weather for the wizard preview (step 2+) — city or lat/lon. */
router.get('/weather-preview', async (req, res) => {
  try {
    const lat = parseNum(req.query.lat, null);
    const lon = parseNum(req.query.lon, null);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    const c = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const ccRaw = typeof req.query.countryCode === 'string' ? req.query.countryCode.trim() : '';
    const cc = (ccRaw || 'PK').toUpperCase();

    const owKey = pickOpenWeatherKey(req);
    let w;
    if (hasCoords) {
      w = await fetchWeatherByCoords(owKey, lat, lon);
    } else {
      if (!c) {
        return res.status(400).json({ error: 'Provide lat & lon, or city.' });
      }
      if (ccRaw && !/^[A-Za-z]{2}$/.test(ccRaw)) {
        return res.status(400).json({ error: 'countryCode must be exactly 2 letters if provided.' });
      }
      w = await fetchWeather(owKey, c, cc);
    }
    const details = w.weatherDetails || {};
    res.json({
      temperature: w.temperature,
      humidity: w.humidity,
      rainfall: w.rainfall,
      cityName: details.cityName,
      countryCode: details.countryCode,
    });
  } catch (err) {
    console.error(err);
    const code = err.code;
    const status = code === 'OPENWEATHER_NOT_CONFIGURED' ? 503 : 502;
    res.status(status).json({ error: err.message || 'Weather preview failed.' });
  }
});

router.post('/predict', async (req, res) => {
  try {
    const status = cropModel.getStatus();
    if (!status.ready) {
      return res.status(503).json({
        error: 'Model is still training or failed to load.',
        detail: status.error,
      });
    }

    const { N, P, K, ph, temperature, humidity, rainfall, city, countryCode, lat, lon } = req.body || {};

    const n = parseNum(N);
    const p = parseNum(P);
    const k = parseNum(K);
    const phVal = parseNum(ph);

    if (![n, p, k, phVal].every((x) => Number.isFinite(x))) {
      return res.status(400).json({ error: 'N, P, K, and ph are required numbers.' });
    }

    let t = parseNum(temperature, null);
    let h = parseNum(humidity, null);
    let r = parseNum(rainfall, null);
    let weatherSource = 'manual';
    let locationRequest = null;
    let weatherFromApi = null;

    const latVal = parseNum(lat, null);
    const lonVal = parseNum(lon, null);
    const hasCoords = Number.isFinite(latVal) && Number.isFinite(lonVal);
    const c = typeof city === 'string' ? city.trim() : '';
    const cc = typeof countryCode === 'string' && countryCode.trim() ? countryCode.trim() : 'PK';

    const hasAllWeather = [t, h, r].every((x) => Number.isFinite(x));
    if (!hasAllWeather) {
      if (!hasCoords && !c) {
        return res.status(400).json({
          error:
            'Provide temperature, humidity, and rainfall, or allow live location / supply city for weather from the server.',
        });
      }
      const owKey = pickOpenWeatherKey(req);
      const w = hasCoords
        ? await fetchWeatherByCoords(owKey, latVal, lonVal)
        : await fetchWeather(owKey, c, cc);
      t = w.temperature;
      h = w.humidity;
      r = w.rainfall;
      weatherSource = 'api';
      const details = w.weatherDetails || {};
      locationRequest = hasCoords
        ? {
            lat: latVal,
            lon: lonVal,
            city: details.cityName || c || null,
            countryCode: details.countryCode || cc,
          }
        : { city: c, countryCode: cc };
      weatherFromApi = w.weatherDetails || null;
    } else if (hasCoords || c) {
      // Live API: client already sent weather snapshot + location (do not mark as manual)
      weatherSource = 'api';
      locationRequest = hasCoords
        ? { lat: latVal, lon: lonVal, city: c || null, countryCode: cc }
        : { city: c, countryCode: cc };
    }
// final data that goes to the model
    const input = {
      N: n,
      P: p,
      K: k,
      temperature: t,
      humidity: h,
      ph: phVal,
      rainfall: r,
    };

    const invalid = validateFeatures(input);
    if (invalid) {
      return res.status(400).json({ error: invalid.error, input });
    }

    const { recommendedCrop, topCrops } = await cropModel.predictCropDetails(input, 5);

    const explanation = await cropExplanation.generateExplanation({
      crop: recommendedCrop,
      input,
      topCrops,
    });

    res.json({
      recommendedCrop,
      recommendationExplanation: explanation.text,
      explanationSource: explanation.source,
      topCrops,
      input,
      weatherSource,
      locationRequest,
      weatherFromApi,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Prediction failed.' });
  }
});

module.exports = router;
