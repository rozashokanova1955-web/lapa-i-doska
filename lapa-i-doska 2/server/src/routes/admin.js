import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { badRequest, conflict, notFound } from '../errors.js';
import {
  archiveSchema, materialSchema, optionSchema, productSchema, userPatchSchema,
} from '../schemas.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

const id = (req) => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Неверный идентификатор');
  return n;
};

// Каталог: товары, материалы, опции. Удаления нет — только архив (БП-2).
const crud = (path, model, schema) => {
  router.get(`/${path}`, async (_req, res) => res.json({ items: await prisma[model].findMany({ orderBy: { id: 'asc' } }) }));
  router.post(`/${path}`, async (req, res) => {
    res.status(201).json({ item: await prisma[model].create({ data: schema.parse(req.body) }) });
  });
  router.put(`/${path}/:id`, async (req, res) => {
    const exists = await prisma[model].findUnique({ where: { id: id(req) } });
    if (!exists) throw notFound();
    res.json({ item: await prisma[model].update({ where: { id: exists.id }, data: schema.parse(req.body) }) });
  });
  router.patch(`/${path}/:id/archive`, async (req, res) => {
    const { isArchived } = archiveSchema.parse(req.body);
    const exists = await prisma[model].findUnique({ where: { id: id(req) } });
    if (!exists) throw notFound();
    res.json({ item: await prisma[model].update({ where: { id: exists.id }, data: { isArchived } }) });
  });
};
crud('products', 'product', productSchema);
crud('materials', 'material', materialSchema);
crud('options', 'option', optionSchema);

// ---------- пользователи ----------
router.get('/users', async (_req, res) => {
  res.json({ items: await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    orderBy: { id: 'asc' },
  }) });
});

router.patch('/users/:id', async (req, res) => {
  const userId = id(req);
  const patch = userPatchSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Пользователь не найден');
    const losesAdmin = user.role === 'ADMIN' && user.isActive
      && ((patch.role && patch.role !== 'ADMIN') || patch.isActive === false);
    if (losesAdmin) {
      // БП-10: нельзя убрать последнего активного администратора
      const others = await tx.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: userId } } });
      if (others === 0) throw conflict('Нельзя понизить или заблокировать последнего администратора');
    }
    await tx.user.update({ where: { id: userId }, data: patch });
  });
  res.json({ ok: true });
});

// ---------- статистика (БП-8) ----------
router.get('/stats', async (_req, res) => {
  const [revenue, byStatus, users] = await Promise.all([
    prisma.order.aggregate({ _sum: { paidAmount: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count(),
  ]);
  res.json({
    revenue: revenue._sum.paidAmount ?? 0,
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    users,
  });
});

export default router;
