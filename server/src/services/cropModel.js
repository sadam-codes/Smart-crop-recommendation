const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');
const { parse } = require('csv-parse/sync');

const FEATURE_COLS = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'];

// Data folder ka path return karta hai
function dataDir() {
  return path.join(__dirname, '../../data');
}

// CSV ke column names clean karta hai 
function normalizeRecordKeys(r) {
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    out[k.trim()] = v;
  }
  return out;
}

// CSV file ko read + clean + usable format mein convert karta hai
function loadRows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return records
    .map((r) => {
      const n = normalizeRecordKeys(r);
      const row = {};
      for (const c of FEATURE_COLS) {
        const v = n[c];
        row[c] = typeof v === 'number' ? v : parseFloat(String(v).trim(), 10);
      }
      row.label = String(n.label != null ? n.label : '').trim();
      return row;
    })
    .filter((r) => FEATURE_COLS.every((c) => Number.isFinite(r[c])) && r.label);
}

// Data ko normalize karne ke liye mean & std calculate karta hai

function fitStandardScaler(matrix) {
  if (!matrix || matrix.length === 0 || !matrix[0]) {
    throw new Error('Cannot fit scaler: no training samples (empty CSV or all rows invalid?).');
  }
  const n = matrix.length;
  const d = matrix[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  for (let j = 0; j < d; j += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += matrix[i][j];
    means[j] = s / n;
  }
  for (let j = 0; j < d; j += 1) {
    let v = 0;
    for (let i = 0; i < n; i += 1) {
      const t = matrix[i][j] - means[j];
      v += t * t;
    }
    const std = Math.sqrt(v / n) || 1;
    stds[j] = std;
  }
  return {
    means,
    stds,
    transform1d(vec) {
      return vec.map((x, j) => (x - means[j]) / stds[j]);
    },
  };
}

function trainTestSplit(X, y, testSize, seed) {
  const rng = mulberry32(seed);
  const idx = X.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const split = Math.floor(X.length * (1 - testSize));
  const trainIdx = idx.slice(0, split);
  const testIdx = idx.slice(split);
  const Xtrain = trainIdx.map((i) => X[i]);
  const ytrain = trainIdx.map((i) => y[i]);
  const Xtest = testIdx.map((i) => X[i]);
  const ytest = testIdx.map((i) => y[i]);
  return { Xtrain, ytrain, Xtest, ytest };
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ready = false;
let training = false;
let loadError = null;
let model = null;
let scaler = null;
let labels = [];
let testAccuracy = null;

async function trainFromCsv(csvPath) {
  await tf.setBackend('cpu');
  await tf.ready();

  const rows = loadRows(csvPath);
  if (rows.length < 2) {
    throw new Error(
      `Need at least 2 valid rows in ${csvPath}; got ${rows.length}. Check CSV columns: ${FEATURE_COLS.join(', ')}, label.`
    );
  }
  const yStr = rows.map((r) => r.label);
  labels = [...new Set(yStr)].sort();
  const labelToIndex = Object.fromEntries(labels.map((l, i) => [l, i]));
  const y = yStr.map((l) => labelToIndex[l]);

  const X = rows.map((r) => FEATURE_COLS.map((c) => r[c]));
  const { Xtrain, ytrain, Xtest, ytest } = trainTestSplit(X, y, 0.2, 42);
  const fitSc = fitStandardScaler(Xtrain);
  const XtrainS = Xtrain.map((row) => fitSc.transform1d(row));
  const XtestS = Xtest.map((row) => fitSc.transform1d(row));

  const numClasses = labels.length;
  const xs = tf.cast(tf.tensor2d(XtrainS), 'float32');
  const yIdx = tf.tensor1d(ytrain, 'int32');
  const ys = tf.oneHot(yIdx, numClasses);
  yIdx.dispose();

  if (model) {
    model.dispose();
    model = null;
  }

  model = tf.sequential();
  model.add(
    tf.layers.dense({ inputShape: [FEATURE_COLS.length], units: 32, activation: 'relu' })
  );
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  await model.fit(xs, ys, {
    epochs: 25,
    batchSize: 32,
    validationSplit: 0,
    shuffle: true,
    verbose: 0,
  });

  xs.dispose();
  ys.dispose();

  const xTestT = tf.cast(tf.tensor2d(XtestS), 'float32');
  const pred = model.predict(xTestT);
  const predArr = await pred.argMax(-1).data();
  pred.dispose();
  xTestT.dispose();

  let correct = 0;
  for (let i = 0; i < ytest.length; i += 1) {
    if (predArr[i] === ytest[i]) correct += 1;
  }
  testAccuracy = ytest.length ? correct / ytest.length : null;

  scaler = fitSc;

  return { rows: rows.length, classes: numClasses, testAccuracy };
}

async function initModel() {
  if (ready || training) return;
  training = true;
  loadError = null;
  try {
    const csvPath = path.join(dataDir(), 'Crop_recommendation.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Dataset not found: ${csvPath}`);
    }
    await trainFromCsv(csvPath);
    ready = true;
  } catch (e) {
    loadError = e;
    ready = false;
  } finally {
    training = false;
  }
}

function getStatus() {
  return {
    ready,
    training,
    labels: ready ? labels : [],
    testAccuracy,
    error: loadError ? String(loadError.message || loadError) : null,
    features: FEATURE_COLS,
  };
}

async function predictCropDetails(input, topK = 5) {
  if (!ready || !model || !scaler) {
    throw new Error('Model is not ready yet.');
  }
  const vec = FEATURE_COLS.map((c) => input[c]);
  if (vec.some((v) => !Number.isFinite(v))) {
    throw new Error('Invalid input: all feature values must be numbers.');
  }
  const scaled = scaler.transform1d(vec);
  const t = tf.cast(tf.tensor2d([scaled]), 'float32');
  const out = model.predict(t);
  const probsArr = Array.from(await out.data());
  out.dispose();
  t.dispose();
  const pairs = labels.map((crop, i) => ({
    crop,
    probability: probsArr[i],
  }));
  pairs.sort((a, b) => b.probability - a.probability);
  const k = Math.min(Math.max(1, topK), pairs.length);
  return {
    recommendedCrop: pairs[0].crop,
    topCrops: pairs.slice(0, k).map(({ crop, probability }) => ({
      crop,
      probability: Math.round(probability * 10000) / 10000,
    })),
  };
}

async function predictCrop(input) {
  const { recommendedCrop } = await predictCropDetails(input, 1);
  return recommendedCrop;
}

module.exports = {
  initModel,
  getStatus,
  predictCrop,
  predictCropDetails,
  FEATURE_COLS,
};
