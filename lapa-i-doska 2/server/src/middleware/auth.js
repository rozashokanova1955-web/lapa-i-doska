import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { forbidden, unauthorized } from '../errors.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/** Проверка токена. Пользователь и роль берутся из базы при каждом запросе (блокировка действует сразу). */
export async function authenticate(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw unauthorized('Сессия истекла, войдите снова'); }
  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw unauthorized('Учётная запись недоступна');
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};
