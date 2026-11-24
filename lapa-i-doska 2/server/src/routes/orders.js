import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { badRequest, conflict, notFound } from '../errors.js';
import {
  createOrderSchema, masterSchema, paymentSchema, priceSchema, transitionSchema,
} from '../schemas.js';
import { buildItem } from '../services/orderBuilder.js';
import { checkTransition, nextStage } from '../services/orderStatus.js';
import { derivePaymentStatus } from '../services/pricing.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const MASTER_VISIBLE = ['IN_PRODUCTION', 'READY', 'DELIVERED'];

const INCLUDE = {
  items: true,
  stages: { orderBy: { doneAt: 'asc' } },
  history: { orderBy: { createdAt: 'asc' } },
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  master: { select: { id: true, fullName: true } },
};

// Кто какие заказы видит (БП-13). Для чужого заказа отвечаем 404, а не 403 — не раскрываем существование.
const canSee = (order, user) => {
  if (user.role === 'ADMIN' || user.role === 'MANAGER') return true;
  if (user.role === 'CLIENT') return order.clientId === user.id;
  if (user.role === 'MASTER') return order.masterId === user.id && MASTER_VISIBLE.includes(order.status);
  return false;
};

// Мастеру контакты клиента не нужны
const present = (order, user) =>
  user.role === 'MASTER' ? { ...order, client: null, address: null, petNote: order.petNote } : order;

const loadOrder = async (id, user, db = prisma) => {
  const order = await db.order.findUnique({ where: { id }, include: INCLUDE });
  if (!order || !canSee(order, user)) throw notFound('Заказ не найден');
  return order;
};

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Неверный номер заказа');
  return id;
};

const addHistory = (db, orderId, from, to, userId, comment) =>
  db.orderStatusHistory.create({ data: { orderId, fromStatus: from, toStatus: to, changedById: userId, comment: comment ?? null } });

// ---------- список и карточка ----------
router.get('/masters', requireRole('MANAGER', 'ADMIN'), async (_req, res) => {
  res.json({ items: await prisma.user.findMany({
    where: { role: 'MASTER', isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' },
  }) });
});

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'CLIENT') where.clientId = req.user.id;
  if (req.user.role === 'MASTER') { where.masterId = req.user.id; where.status = { in: MASTER_VISIBLE }; }
  const status = z.enum(['NEW', 'AWAITING_APPROVAL', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED']).safeParse(req.query.status);
  if (status.success && req.user.role !== 'MASTER') where.status = status.data;
  const orders = await prisma.order.findMany({
    where, orderBy: { id: 'desc' }, take: 200,
    include: { items: true, client: { select: { id: true, fullName: true } }, master: { select: { id: true, fullName: true } } },
  });
  res.json({ items: orders.map((o) => present(o, req.user)) });
});

router.get('/:id', async (req, res) => {
  res.json({ item: present(await loadOrder(idParam(req), req.user), req.user) });
});

// ---------- создание (клиент) ----------
router.post('/', requireRole('CLIENT'), async (req, res) => {
  const data = createOrderSchema.parse(req.body);
  const orderId = await prisma.$transaction(async (tx) => {
    const built = [];
    for (const input of data.items) built.push(await buildItem(tx, input));
    const estimatedPrice = built.reduce((s, b) => s + b.total, 0);
    const order = await tx.order.create({
      data: {
        clientId: req.user.id, estimatedPrice,
        petNote: data.petNote || null, address: data.address || null,
        items: { create: built.map((b) => b.snapshot) },
      },
    });
    await addHistory(tx, order.id, null, 'NEW', req.user.id, 'Заказ оформлен');
    return order.id;
  });
  res.status(201).json({ item: present(await loadOrder(orderId, req.user), req.user) });
});

// ---------- менеджер: цена, мастер, оплата ----------
router.patch('/:id/price', requireRole('MANAGER'), async (req, res) => {
  const id = idParam(req);
  const { finalPrice } = priceSchema.parse(req.body);
  const order = await loadOrder(id, req.user);
  if (!['NEW', 'AWAITING_APPROVAL'].includes(order.status)) throw conflict('Цену можно менять только до запуска в производство');
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        finalPrice,
        clientApproved: false, // после смены цены клиент должен согласовать заново
        paymentStatus: derivePaymentStatus(finalPrice, order.paidAmount),
      },
    });
    await addHistory(tx, id, order.status, order.status, req.user.id, `Цена подтверждена: ${finalPrice} ₸`);
  });
  res.json({ item: await loadOrder(id, req.user) });
});

router.patch('/:id/master', requireRole('MANAGER'), async (req, res) => {
  const id = idParam(req);
  const { masterId } = masterSchema.parse(req.body);
  const order = await loadOrder(id, req.user);
  if (['DELIVERED', 'CANCELLED', 'READY'].includes(order.status)) throw conflict('Мастера нельзя менять у завершённого заказа');
  // БП-6: назначить можно только активного мастера
  const master = await prisma.user.findFirst({ where: { id: masterId, role: 'MASTER', isActive: true } });
  if (!master) throw badRequest('Можно назначить только активного мастера');
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { masterId } });
    await addHistory(tx, id, order.status, order.status, req.user.id, `Назначен мастер: ${master.fullName}`);
  });
  res.json({ item: await loadOrder(id, req.user) });
});

router.patch('/:id/payment', requireRole('MANAGER'), async (req, res) => {
  const id = idParam(req);
  const { paidAmount } = paymentSchema.parse(req.body);
  const order = await loadOrder(id, req.user);
  if (order.finalPrice == null) throw conflict('Сначала подтвердите итоговую цену');
  if (order.status === 'CANCELLED') throw conflict('Заказ отменён');
  if (paidAmount > order.finalPrice) throw badRequest('Оплата больше стоимости заказа');
  const paymentStatus = derivePaymentStatus(order.finalPrice, paidAmount);
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { paidAmount, paymentStatus } });
    await addHistory(tx, id, order.status, order.status, req.user.id, `Оплачено: ${paidAmount} ₸ из ${order.finalPrice} ₸`);
  });
  res.json({ item: await loadOrder(id, req.user) });
});

// ---------- клиент: согласие ----------
router.post('/:id/approve', requireRole('CLIENT'), async (req, res) => {
  const id = idParam(req);
  const order = await loadOrder(id, req.user);
  if (order.status !== 'AWAITING_APPROVAL' || order.finalPrice == null) throw conflict('Сейчас согласовывать нечего');
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { clientApproved: true } });
    await addHistory(tx, id, order.status, order.status, req.user.id, 'Клиент согласовал цену и чертёж');
  });
  res.json({ item: await loadOrder(id, req.user) });
});

// ---------- смена статуса по таблице переходов ----------
router.post('/:id/transition', requireRole('MANAGER', 'CLIENT'), async (req, res) => {
  const id = idParam(req);
  const { to, comment } = transitionSchema.parse(req.body);
  const order = await loadOrder(id, req.user);
  const check = checkTransition(order, to, req.user.role, { comment });
  if (!check.ok) {
    const err = new Error(check.error); err.status = check.code; throw err;
  }
  await prisma.$transaction(async (tx) => {
    // updateMany с условием по статусу — защита от одновременных нажатий
    const r = await tx.order.updateMany({
      where: { id, status: order.status },
      data: { status: to, cancelReason: to === 'CANCELLED' ? (comment || null) : undefined },
    });
    if (r.count === 0) throw conflict('Статус заказа уже изменён, обновите страницу');
    await addHistory(tx, id, order.status, to, req.user.id, comment);
  });
  res.json({ item: await loadOrder(id, req.user) });
});

// ---------- мастер: этапы ----------
router.post('/:id/stages', requireRole('MASTER'), async (req, res) => {
  const id = idParam(req);
  const { stage: requested } = z.object({
    stage: z.enum(['DRAWING', 'CUTTING', 'ASSEMBLY', 'PAINTING', 'PACKING']),
  }).parse(req.body);

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { stages: true } });
    if (!order || order.masterId !== req.user.id) throw notFound('Заказ не найден');
    if (order.status !== 'IN_PRODUCTION') throw conflict('Этапы отмечаются только у заказов в производстве');
    const done = order.stages.map((s) => s.stage);
    const stage = nextStage(done);
    if (!stage) throw conflict('Все этапы уже выполнены');
    if (stage !== requested) throw conflict('Этапы выполняются строго по порядку');
    await tx.productionStage.create({ data: { orderId: id, stage, doneById: req.user.id } });
    if (nextStage([...done, stage]) === null) {
      await tx.order.update({ where: { id }, data: { status: 'READY' } });
      await addHistory(tx, id, 'IN_PRODUCTION', 'READY', req.user.id, 'Автоматически: выполнены все этапы');
    }
  });
  res.json({ item: present(await loadOrder(id, req.user), req.user) });
});

export default router;
