import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

const app = express();
// За обратным прокси (nginx и т. п.) раскомментируйте, чтобы лимит попыток считался по реальному IP:
// app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Единая обработка ошибок
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message || 'Неверные данные', details: err.issues });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Такая запись уже существует или действие уже выполнено' });
  if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

export default app;
