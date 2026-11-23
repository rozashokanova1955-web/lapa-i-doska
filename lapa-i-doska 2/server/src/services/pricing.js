// Расчёт цены (БП-1, БП-14). Чистые функции без доступа к базе — удобно тестировать.
// Все суммы — целые числа в тенге (БП-4).

export const roundTo100 = (n) => Math.round(n / 100) * 100;

/** Проверка размеров по ограничениям товара (БП-14). Возвращает текст ошибки или null. */
export function validateDims(product, { width, depth, height }) {
  const checks = [
    ['Ширина', width, product.minWidth, product.maxWidth],
    ['Глубина', depth, product.minDepth, product.maxDepth],
    ['Высота', height, product.minHeight, product.maxHeight],
  ];
  for (const [name, v, min, max] of checks) {
    if (!Number.isInteger(v)) return `${name} должна быть целым числом сантиметров`;
    if (v < min || v > max) return `${name} должна быть от ${min} до ${max} см`;
  }
  return null;
}

/**
 * Цена за одну штуку:
 *   доплата = max(0, объём_см3 − базовый_объём_л × 1000) × цена_за_литр / 1000
 *   цена    = (basePrice + доплата) × коэффициент_материала / 100 + сумма(опции), округление до 100 ₸
 */
export function calcUnitPrice({ product, dims, material, options }) {
  const volumeCm3 = dims.width * dims.depth * dims.height;
  const extraCm3 = Math.max(0, volumeCm3 - product.baseVolumeL * 1000);
  const sizeSurcharge = Math.round((extraCm3 * product.pricePerLiter) / 1000);
  const base = product.basePrice + sizeSurcharge;
  const withMaterial = Math.round((base * material.coefficientPercent) / 100);
  const optionsSum = options.reduce((s, o) => s + o.extraPrice, 0);
  const unitPrice = roundTo100(withMaterial + optionsSum);
  return { unitPrice, breakdown: { base: product.basePrice, sizeSurcharge, withMaterial, optionsSum } };
}

/** Предоплата 50 % от подтверждённой цены. */
export const prepaymentAmount = (finalPrice) => Math.ceil(finalPrice / 2);

/** Статус оплаты по внесённой сумме (БП-9). */
export function derivePaymentStatus(finalPrice, paidAmount) {
  if (finalPrice == null) throw new Error('finalPrice не задана');
  if (paidAmount >= finalPrice) return 'PAID';
  if (paidAmount >= prepaymentAmount(finalPrice)) return 'PREPAID';
  return 'UNPAID';
}
