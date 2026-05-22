const OpenAI = require('openai');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

let cachedClient = null;
let cachedKey = null;

function getClient() {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key, baseURL: GROQ_BASE_URL });
  cachedKey = key;
  return cachedClient;
}

/**
 * Tiny in-memory LRU-ish cache so repeated identical inputs don't re-bill the LLM.
 * Keyed by crop + bucketed feature values (rounded to keep cache useful).
 */
const MAX_CACHE = 200;
const cache = new Map();

function cacheKey(crop, input, confidencePct) {
  const b = (n, d = 0) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 'na';
    const f = 10 ** d;
    return String(Math.round(v * f) / f);
  };
  return [
    String(crop || '').toLowerCase(),
    `c${confidencePct ?? 'na'}`,
    `N${b(input.N)}`,
    `P${b(input.P)}`,
    `K${b(input.K)}`,
    `pH${b(input.ph, 1)}`,
    `T${b(input.temperature, 1)}`,
    `H${b(input.humidity)}`,
    `R${b(input.rainfall, 0)}`,
  ].join('|');
}

function cacheGet(key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}


function fallbackExplanation(crop, input, confidencePct) {
  const confText =
    confidencePct != null
      ? `The model confidence for ${crop} is ${confidencePct}%.`
      : `The model selected ${crop} as the best match.`;
  const climate = `Current conditions: ${Number(input.temperature).toFixed(1)}°C, ${Number(
    input.humidity
  ).toFixed(0)}% humidity, ${Number(input.rainfall).toFixed(1)} mm rainfall, pH ${Number(
    input.ph
  ).toFixed(2)}.`;
  const nutrients = `Soil nutrients N:${Number(input.N).toFixed(0)}, P:${Number(input.P).toFixed(
    0
  )}, K:${Number(input.K).toFixed(0)} are within the model's supported ranges.`;
  return `${crop.charAt(0).toUpperCase() + crop.slice(1)} suits the supplied soil and weather profile. ${confText} ${climate} ${nutrients}`;
}

function buildPrompt(crop, input, confidencePct, topCrops) {
  const top = Array.isArray(topCrops)
    ? topCrops
        .slice(0, 5)
        .map((t) => `${t.crop} (${Math.round((t.probability || 0) * 100)}%)`)
        .join(', ')
    : '';
  return [
    `Recommended crop: ${crop}`,
    confidencePct != null ? `Model confidence: ${confidencePct}%` : null,
    top ? `Top candidates: ${top}` : null,
    'Soil & weather inputs:',
    `- Nitrogen (N): ${input.N}`,
    `- Phosphorus (P): ${input.P}`,
    `- Potassium (K): ${input.K}`,
    `- Soil pH: ${input.ph}`,
    `- Temperature: ${input.temperature} °C`,
    `- Humidity: ${input.humidity} %`,
    `- Rainfall: ${input.rainfall} mm`,
    '',
    'Write 3 to 4 sentences explaining WHY this crop is the right pick for these specific values.',
    'Reference the actual numbers (e.g. say if pH is acidic/neutral/alkaline, if rainfall is low/moderate/high, etc.).',
    'Mention one practical agronomic tip relevant to the conditions.',
    'Plain prose, no bullet points, no markdown, no headings.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateExplanation({ crop, input, topCrops }) {
  const top = Array.isArray(topCrops) && topCrops.length > 0 ? topCrops[0] : null;
  const confidencePct = top ? Math.round(top.probability * 100) : null;

  const key = cacheKey(crop, input, confidencePct);
  const cached = cacheGet(key);
  if (cached) return { text: cached, source: 'cache' };

  const client = getClient();
  if (!client) {
    return { text: fallbackExplanation(crop, input, confidencePct), source: 'fallback' };
  }

  const model = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim() || 'llama-3.3-70b-versatile';
  const prompt = buildPrompt(crop, input, confidencePct, topCrops);

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'You are an agronomy assistant. Explain crop recommendations in clear, friendly English suited for a farmer. Be specific to the numbers given. Never invent facts you cannot infer from the inputs.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { text: fallbackExplanation(crop, input, confidencePct), source: 'fallback' };
    }
    cacheSet(key, text);
    return { text, source: 'groq' };
  } catch (err) {
    console.error('Groq explanation failed:', err.message || err);
    return { text: fallbackExplanation(crop, input, confidencePct), source: 'fallback' };
  }
}

function isConfigured() {
  return Boolean((process.env.GROQ_API_KEY || '').trim());
}

module.exports = { generateExplanation, isConfigured };
