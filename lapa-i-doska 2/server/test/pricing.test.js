import test from 'node:test';
import assert from 'node:assert/strict';
import { calcUnitPrice, derivePaymentStatus, prepaymentAmount, roundTo100, validateDims } from '../src/services/pricing.js';

const product = {
  basePrice: 45000, baseVolumeL: 250, pricePerLiter: 80,
  minWidth: 50, maxWidth: 120, minDepth: 60, maxDepth: 130, minHeight: 50, maxHeight: 110,
};
const pine = { coefficientPercent: 100 };
const oak = { coefficientPercent: 150 };

test('базовый размер: доплаты за объём нет', () => {
  // 50×60×80 = 240 000 см³ = 240 л ≤ 250 л
  const r = calcUnitPrice({ product, dims: { width: 50, depth: 60, height: 80 }, material: pine, options: [] });
  assert.equal(r.unitPrice, 45000);
  assert.equal(r.breakdown.sizeSurcharge, 0);
});

test('доплата за литры сверх базового объёма', () => {
  // 100×100×100 = 1000 л; сверх 750 л × 80 ₸ = 60 000
  const r = calcUnitPrice({ product, dims: { width: 100, depth: 100, height: 100 }, material: pine, options: [] });
  assert.equal(r.breakdown.sizeSurcharge, 60000);
  assert.equal(r.unitPrice, 105000);
});

test('материал и опции', () => {
  const r = calcUnitPrice({
    product, dims: { width: 50, depth: 60, height: 80 }, material: oak,
    options: [{ extraPrice: 4500 }, { extraPrice: 3500 }],
  });
  // 45000 × 1.5 = 67500 + 8000 = 75500
  assert.equal(r.unitPrice, 75500);
});

test('результат округляется до 100 ₸ и всегда целый', () => {
  assert.equal(roundTo100(12349), 12300);
  assert.equal(roundTo100(12350), 12400);
  const r = calcUnitPrice({ product, dims: { width: 51, depth: 61, height: 99 }, material: { coefficientPercent: 115 }, options: [] });
  assert.ok(Number.isInteger(r.unitPrice) && r.unitPrice % 100 === 0);
});

test('размеры вне диапазона отклоняются (БП-14)', () => {
  assert.match(validateDims(product, { width: 10, depth: 60, height: 60 }), /Ширина/);
  assert.match(validateDims(product, { width: 60, depth: 60, height: 500 }), /Высота/);
  assert.match(validateDims(product, { width: 60.5, depth: 60, height: 60 }), /целым/);
  assert.equal(validateDims(product, { width: 60, depth: 60, height: 60 }), null);
});

test('предоплата 50 % и статус оплаты', () => {
  assert.equal(prepaymentAmount(75500), 37750);
  assert.equal(prepaymentAmount(75501), 37751);
  assert.equal(derivePaymentStatus(100000, 0), 'UNPAID');
  assert.equal(derivePaymentStatus(100000, 49999), 'UNPAID');
  assert.equal(derivePaymentStatus(100000, 50000), 'PREPAID');
  assert.equal(derivePaymentStatus(100000, 100000), 'PAID');
});
