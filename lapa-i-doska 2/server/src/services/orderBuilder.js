import { badRequest, notFound } from '../errors.js';
import { calcUnitPrice, validateDims } from './pricing.js';

/**
 * Собирает позицию заказа из ввода клиента. Всё берётся из базы, цена считается здесь (БП-1),
 * в позицию попадает снимок названий и цены (БП-2). `db` — prisma или транзакция.
 */
export async function buildItem(db, input) {
  const product = await db.product.findFirst({ where: { id: input.productId, isArchived: false } });
  if (!product) throw notFound('Изделие не найдено');

  const dimsError = validateDims(product, input);
  if (dimsError) throw badRequest(dimsError);

  const material = await db.material.findFirst({ where: { id: input.materialId, isArchived: false } });
  if (!material) throw notFound('Материал не найден');

  const ids = [...new Set(input.optionIds ?? [])];
  const options = ids.length ? await db.option.findMany({ where: { id: { in: ids }, isArchived: false } }) : [];
  if (options.length !== ids.length) throw notFound('Одна из опций не найдена');

  const dims = { width: input.width, depth: input.depth, height: input.height };
  const { unitPrice, breakdown } = calcUnitPrice({ product, dims, material, options });
  const quantity = input.quantity ?? 1;

  return {
    unitPrice, quantity, total: unitPrice * quantity, breakdown,
    snapshot: {
      productId: product.id,
      productName: product.name,
      ...dims,
      materialName: material.name,
      options: options.map((o) => ({ name: o.name, extraPrice: o.extraPrice })),
      unitPrice,
      quantity,
    },
  };
}
