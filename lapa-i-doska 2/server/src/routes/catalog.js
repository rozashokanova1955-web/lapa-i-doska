import { Router } from 'express';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { itemInputSchema } from '../schemas.js';
import { buildItem } from '../services/orderBuilder.js';

const router = Router();

router.get('/products', async (_req, res) => {
  res.json({ items: await prisma.product.findMany({ where: { isArchived: false }, orderBy: { id: 'asc' } }) });
});

router.get('/products/:id', async (req, res) => {
  const p = await prisma.product.findFirst({ where: { id: Number(req.params.id), isArchived: false } });
  if (!p) throw notFound('Изделие не найдено');
  res.json({ item: p });
});

router.get('/materials', async (_req, res) => {
  res.json({ items: await prisma.material.findMany({ where: { isArchived: false }, orderBy: { id: 'asc' } }) });
});

router.get('/options', async (_req, res) => {
  res.json({ items: await prisma.option.findMany({ where: { isArchived: false }, orderBy: { id: 'asc' } }) });
});

// Расчёт цены — та же функция, что и при оформлении заказа
router.post('/price/estimate', async (req, res) => {
  const input = itemInputSchema.parse(req.body);
  const { unitPrice, quantity, total, breakdown } = await buildItem(prisma, input);
  res.json({ unitPrice, quantity, total, breakdown });
});

export default router;
