import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './lib/db.js';
import apiRouter from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const originEnv = process.env.CORS_ORIGIN;
const defaultOrigins = [
  'https://weather-harsha.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

let allowedOrigins = [...defaultOrigins];
if (originEnv) {
  const customOrigins = originEnv.split(',').map((s) => s.trim()).filter(Boolean);
  allowedOrigins = [...new Set([...defaultOrigins, ...customOrigins])];
}

app.use(cors({ 
  origin: allowedOrigins,
  credentials: true 
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Debug CORS settings
app.get('/debug/cors', (_req, res) => {
  res.json({ 
    allowedOrigins,
    corsOriginEnv: process.env.CORS_ORIGIN || 'not set'
  });
});

// API routes
app.use('/api', apiRouter);

// Start server after DB connects
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
