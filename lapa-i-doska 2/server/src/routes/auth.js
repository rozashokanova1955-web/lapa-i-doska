import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { conflict, unauthorized } from '../errors.js';
import { loginSchema, registerSchema } from '../schemas.js';

const publicUser = (u) => ({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role });

// Не больше 10 попыток входа за 15 минут с одного IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Слишком много регистраций с этого адреса. Попробуйте позже' },
});

// Для несуществующего email сравнение всё равно выполняется, чтобы не выдавать наличие аккаунта по времени ответа
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const router = Router();

router.post('/register', registerLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw conflict('Пользователь с таким email уже зарегистрирован');
  }
  // Роль при саморегистрации всегда CLIENT
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName, email: data.email, phone: data.phone || null,
      passwordHash: await bcrypt.hash(data.password, 10), role: 'CLIENT',
    },
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Неверный email или пароль');
  if (!user.isActive) throw unauthorized('Учётная запись заблокирована');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
