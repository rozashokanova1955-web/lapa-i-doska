import { z } from 'zod';

const int = z.number().int();
const posInt = int.positive();

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional().nullable(),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(100),
});

export const itemInputSchema = z.object({
  productId: posInt,
  width: int, depth: int, height: int,
  materialId: posInt,
  optionIds: z.array(posInt).max(20).default([]),
  quantity: int.min(1).max(50).default(1),
});

// Поле price (и любые другие лишние поля) zod отбрасывает — цену считает только сервер (БП-1)
export const createOrderSchema = z.object({
  items: z.array(itemInputSchema).min(1).max(20),
  petNote: z.string().trim().max(300).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
});

export const priceSchema = z.object({ finalPrice: posInt.max(100_000_000) });
export const masterSchema = z.object({ masterId: posInt });
export const paymentSchema = z.object({ paidAmount: int.min(0).max(100_000_000) });
export const transitionSchema = z.object({
  to: z.enum(['AWAITING_APPROVAL', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED']),
  comment: z.string().trim().max(300).optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  category: z.string().trim().min(2).max(60),
  basePrice: posInt, baseVolumeL: posInt, pricePerLiter: int.min(0),
  minWidth: posInt, maxWidth: posInt,
  minDepth: posInt, maxDepth: posInt,
  minHeight: posInt, maxHeight: posInt,
}).refine((p) => p.minWidth <= p.maxWidth && p.minDepth <= p.maxDepth && p.minHeight <= p.maxHeight,
  { message: 'Минимальный размер не может быть больше максимального' });

export const materialSchema = z.object({
  name: z.string().trim().min(2).max(80),
  coefficientPercent: int.min(50).max(500),
});
export const optionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  extraPrice: int.min(0).max(10_000_000),
});
export const archiveSchema = z.object({ isArchived: z.boolean() });
export const userPatchSchema = z.object({
  role: z.enum(['CLIENT', 'MANAGER', 'MASTER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});
