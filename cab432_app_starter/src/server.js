import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './routes/auth.js';
import videoRouter from './routes/videos.js';
import healthRouter from './routes/health.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api/auth', authRouter);
app.use('/api/videos', videoRouter);
app.use('/api/health', healthRouter);

// Static client
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple index route
app.get('/api', (req, res) => {
  res.json({ ok: true, message: 'CAB432 API up' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
