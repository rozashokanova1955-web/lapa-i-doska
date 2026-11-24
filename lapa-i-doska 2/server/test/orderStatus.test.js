import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTransition, nextStage, STAGES } from '../src/services/orderStatus.js';

const order = (o) => ({
  status: 'NEW', finalPrice: null, paymentStatus: 'UNPAID', masterId: null, clientApproved: false, ...o,
});

test('NEW → AWAITING_APPROVAL: нужна итоговая цена и роль менеджера', () => {
  assert.equal(checkTransition(order({}), 'AWAITING_APPROVAL', 'MANAGER').ok, false);
  assert.equal(checkTransition(order({ finalPrice: 50000 }), 'AWAITING_APPROVAL', 'CLIENT').code, 403);
  assert.equal(checkTransition(order({ finalPrice: 50000 }), 'AWAITING_APPROVAL', 'MANAGER').ok, true);
});

test('запуск в производство: согласие клиента, предоплата, мастер', () => {
  const base = { status: 'AWAITING_APPROVAL', finalPrice: 50000 };
  assert.equal(checkTransition(order(base), 'IN_PRODUCTION', 'MANAGER').ok, false);
  const a = order({ ...base, clientApproved: true });
  assert.match(checkTransition(a, 'IN_PRODUCTION', 'MANAGER').error, /предоплата/i);
  const b = order({ ...base, clientApproved: true, paymentStatus: 'PREPAID' });
  assert.match(checkTransition(b, 'IN_PRODUCTION', 'MANAGER').error, /мастер/i);
  const c = order({ ...base, clientApproved: true, paymentStatus: 'PREPAID', masterId: 7 });
  assert.equal(checkTransition(c, 'IN_PRODUCTION', 'MANAGER').ok, true);
});

test('назад из «Выдан» в «Новый» нельзя (Л-3)', () => {
  const r = checkTransition(order({ status: 'DELIVERED' }), 'NEW', 'MANAGER');
  assert.equal(r.ok, false);
  assert.equal(r.code, 409);
});

test('из «Отменён» и «Выдан» переходов нет', () => {
  for (const s of ['CANCELLED', 'DELIVERED']) {
    for (const to of ['NEW', 'AWAITING_APPROVAL', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED']) {
      assert.equal(checkTransition(order({ status: s }), to, 'MANAGER').ok, false, `${s} → ${to}`);
    }
  }
});

test('READY ставит только система, выдача — только после полной оплаты', () => {
  assert.equal(checkTransition(order({ status: 'IN_PRODUCTION' }), 'READY', 'MANAGER').code, 403);
  assert.equal(checkTransition(order({ status: 'IN_PRODUCTION' }), 'READY', 'SYSTEM').ok, true);
  assert.equal(checkTransition(order({ status: 'READY', paymentStatus: 'PREPAID' }), 'DELIVERED', 'MANAGER').ok, false);
  assert.equal(checkTransition(order({ status: 'READY', paymentStatus: 'PAID' }), 'DELIVERED', 'MANAGER').ok, true);
});

test('отмена: клиент до производства, в производстве — только менеджер с причиной', () => {
  assert.equal(checkTransition(order({ status: 'NEW' }), 'CANCELLED', 'CLIENT').ok, true);
  assert.equal(checkTransition(order({ status: 'IN_PRODUCTION' }), 'CANCELLED', 'CLIENT').code, 403);
  assert.equal(checkTransition(order({ status: 'IN_PRODUCTION' }), 'CANCELLED', 'MANAGER').code, 400);
  assert.equal(checkTransition(order({ status: 'IN_PRODUCTION' }), 'CANCELLED', 'MANAGER', { comment: 'Клиент передумал' }).ok, true);
});

test('мастер не может менять статус заказа сам', () => {
  assert.equal(checkTransition(order({ status: 'NEW' }), 'CANCELLED', 'MASTER').code, 403);
});

test('этапы идут строго по порядку (БП-5)', () => {
  assert.equal(nextStage([]), 'DRAWING');
  assert.equal(nextStage(['DRAWING']), 'CUTTING');
  assert.equal(nextStage(['DRAWING', 'CUTTING', 'ASSEMBLY', 'PAINTING']), 'PACKING');
  assert.equal(nextStage(STAGES), null);
});
