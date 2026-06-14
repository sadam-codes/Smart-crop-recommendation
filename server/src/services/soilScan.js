const OpenAI = require('openai');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const VISION_MODEL =
  (process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct').trim() ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

/** Same ranges as crop model / client validation */
const BOUNDS = {
  N: [0, 140],
  P: [5, 145],
  K: [5, 205],
  ph: [3.5, 10],
};

let cachedClient = null;
let cachedKey = null;

function resetClient() {
  cachedClient = null;
  cachedKey = null;
}

function getClient() {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) {
    resetClient();
    return null;
  }
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key, baseURL: GROQ_BASE_URL });
  cachedKey = key;
  return cachedClient;
}

function groqErrorMessage(err) {
  const status = err?.status;
  if (status === 401) {
    return (
      'Groq API key is invalid or expired (401). Open server/.env, set a valid GROQ_API_KEY from console.groq.com/keys, ' +
      'then restart the server (stop and run npm run dev again in the server folder).'
    );
  }
  if (status === 429) {
    return 'Groq rate limit reached. Wait about a minute and try again.';
  }
  if (status === 400) {
    const msg = String(err?.message || '');
    if (/image/i.test(msg)) {
      return 'Could not read this image. Use a clear JPG or PNG photo of the soil report (HEIC/iPhone photos are not supported — save as JPEG first).';
    }
  }
  return err?.message || 'Soil scan failed.';
}

function wrapGroqError(err) {
  if (err?.status === 401) resetClient();
  const wrapped = new Error(groqErrorMessage(err));
  wrapped.code = err?.status === 401 ? 'GROQ_UNAUTHORIZED' : 'GROQ_API';
  return wrapped;
}

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;

function normalizeMime(mimeType) {
  const m = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

function isConfigured() {
  return Boolean((process.env.GROQ_API_KEY || '').trim());
}

function parseNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampField(key, raw) {
  const n = parseNum(raw);
  if (n === null) return null;
  const [lo, hi] = BOUNDS[key];
  if (n < lo || n > hi) return null;
  if (key === 'ph') return Math.round(n * 100) / 100;
  return Math.round(n);
}

function parseJsonFromModel(text) {
  const t = String(text || '').trim();
  const match = t.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not read values from the report image. Try a clearer photo.');
  return JSON.parse(match[0]);
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
async function extractSoilFromImage(buffer, mimeType) {
  const client = getClient();
  if (!client) {
    const err = new Error(
      'Soil photo scan is not configured. Add GROQ_API_KEY to server/.env and restart the server.',
    );
    err.code = 'GROQ_NOT_CONFIGURED';
    throw err;
  }

  if (!buffer?.length) {
    throw new Error('Empty image file. Choose a soil report photo and try again.');
  }
  if (buffer.length > 6 * 1024 * 1024) {
    throw new Error('Image is too large (max 6 MB). Use a smaller photo or crop the report.');
  }

  const mime = normalizeMime(mimeType);
  if (!ALLOWED_MIME.test(mime)) {
    throw new Error(
      'Unsupported image type. Save the photo as JPG or PNG (iPhone HEIC is not supported — use Share → Save as JPEG).',
    );
  }

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mime};base64,${base64}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You read agricultural soil test reports from photos (lab printouts, handwritten cards, Urdu/English labels).',
          'Extract ONLY these four numbers for the crop recommendation dataset:',
          '- N: nitrogen (integer, typical range 0–140)',
          '- P: phosphorus (integer, typical range 5–145)',
          '- K: potassium (integer, typical range 5–205)',
          '- ph: soil pH (decimal, range 3.5–10). NOT humidity %.',
          'Labels may appear as N, P, K, Nitrógeno, Phosphorus, Potassium, pH, acidity, etc.',
          'If multiple numbers appear, pick the main reported soil test result.',
          'Return strict JSON only with keys: N, P, K, ph (number or null), notes (short string).',
          'Use null for any value you cannot read confidently. Do not guess.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Read this soil report image and return JSON: {"N":number|null,"P":number|null,"K":number|null,"ph":number|null,"notes":"..."}',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  } catch (err) {
    throw wrapGroqError(err);
  }

  const rawText = completion.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    throw new Error('No response from soil scan. Try again with a clearer photo.');
  }

  let parsed;
  try {
    parsed = parseJsonFromModel(rawText);
  } catch {
    throw new Error('Could not read values from the report image. Try a clearer photo.');
  }

  const out = {
    N: clampField('N', parsed.N),
    P: clampField('P', parsed.P),
    K: clampField('K', parsed.K),
    ph: clampField('ph', parsed.ph),
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
  };

  const filled = ['N', 'P', 'K', 'ph'].filter((k) => out[k] != null);
  const missing = ['N', 'P', 'K', 'ph'].filter((k) => out[k] == null);

  if (filled.length === 0) {
    throw new Error(
      'Could not find N, P, K, or pH on this image. Take a clear photo of the soil test report or enter values manually.',
    );
  }

  return { ...out, filled, missing };
}

module.exports = { extractSoilFromImage, isConfigured };
