import { Router } from 'express';
import axios from 'axios';
import { Search } from '../models/Search.js';

const router = Router();

// Utility: normalize city string (Title Case)
function titleCase(input) {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// GET /api/weather/:city -> proxy to WeatherAPI
router.get('/weather/:city', async (req, res) => {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'Server not configured with WEATHER_API_KEY' });
    const city = req.params.city;
    const { data } = await axios.get('http://api.weatherapi.com/v1/current.json', {
      params: { key: apiKey, q: city, aqi: 'yes' },
      timeout: 15000,
    });
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message || 'Failed to fetch weather';
    res.status(status).json({ message });
  }
});

// GET /api/recent -> last 5 searched cities
router.get('/recent', async (_req, res) => {
  const docs = await Search.find().sort({ updatedAt: -1 }).limit(5).lean();
  res.json({ cities: docs.map((d) => d.city) });
});

// POST /api/search { city } -> upsert and keep max 5 unique
router.post('/search', async (req, res) => {
  try {
    const cityRaw = (req.body?.city || '').trim();
    if (!cityRaw) return res.status(400).json({ message: 'city is required' });

    const city = titleCase(cityRaw);
    const cityLower = city.toLowerCase();

    // Upsert with updatedAt bump
    await Search.findOneAndUpdate(
      { cityLower },
      { city, cityLower, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Enforce top 5: delete older beyond 5
    const extras = await Search.find().sort({ updatedAt: -1 }).skip(5).select('_id');
    if (extras.length) {
      await Search.deleteMany({ _id: { $in: extras.map((e) => e._id) } });
    }

    const recent = await Search.find().sort({ updatedAt: -1 }).limit(5).lean();
    res.json({ cities: recent.map((d) => d.city) });
  } catch (err) {
    const dup = err?.code === 11000;
    if (dup) {
      // If collision, retry update
      const city = titleCase(req.body.city);
      const cityLower = city.toLowerCase();
      await Search.findOneAndUpdate(
        { cityLower },
        { city, cityLower, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      const recent = await Search.find().sort({ updatedAt: -1 }).limit(5).lean();
      return res.json({ cities: recent.map((d) => d.city) });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to store search' });
  }
});

export default router;
