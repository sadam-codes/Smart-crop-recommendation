const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const cors = require('cors');
const express = require('express');
const cropModel = require('./services/cropModel');
const cropRoutes = require('./routes/crop');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'abdullah-weather-api' });
});

app.use('/api', cropRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image is too large (max 8 MB).' });
  }
  if (err.message && /image files/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  const soilScan = require('./services/soilScan');
  console.log(
    soilScan.isConfigured()
      ? 'Soil scan: GROQ_API_KEY loaded.'
      : 'Soil scan: GROQ_API_KEY missing in server/.env — photo upload disabled.',
  );

  cropModel.initModel().then(() => {
    const s = cropModel.getStatus();
    if (s.ready) {
      console.log(
        `Crop model ready. Classes: ${s.labels.length}. Test accuracy: ${
          s.testAccuracy != null ? (s.testAccuracy * 100).toFixed(2) + '%' : 'n/a'
        }`
      );
    } else {
      console.error('Crop model failed:', s.error);
    }
  });

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();
