// Таблица разрешённых переходов статусов (БП-3) и порядок этапов мастера (БП-5).

export const STAGES = ['DRAWING', 'CUTTING', 'ASSEMBLY', 'PAINTING', 'PACKING'];

const PAYMENT_RANK = { UNPAID: 0, PREPAID: 1, PAID: 2 };

// roles: кто может выполнить переход; SYSTEM — только автоматически
export const TRANSITIONS = [
  { from: 'NEW', to: 'AWAITING_APPROVAL', roles: ['MANAGER'] },
  { from: 'NEW', to: 'CANCELLED', roles: ['CLIENT', 'MANAGER'] },
  { from: 'AWAITING_APPROVAL', to: 'IN_PRODUCTION', roles: ['MANAGER'] },
  { from: 'AWAITING_APPROVAL', to: 'CANCELLED', roles: ['CLIENT', 'MANAGER'] },
  { from: 'IN_PRODUCTION', to: 'READY', roles: ['SYSTEM'] },
  { from: 'IN_PRODUCTION', to: 'CANCELLED', roles: ['MANAGER'] },
  { from: 'READY', to: 'DELIVERED', roles: ['MANAGER'] },
];

/**
 * Проверка перехода. order: { status, finalPrice, paymentStatus, paidAmount, masterId, clientApproved }.
 * Возвращает { ok: true } или { ok: false, code, error }, code — HTTP-код.
 */
export function checkTransition(order, to, role, { comment } = {}) {
  const rule = TRANSITIONS.find((t) => t.from === order.status && t.to === to);
  if (!rule) return { ok: false, code: 409, error: `Переход «${order.status} → ${to}» запрещён` };
  if (!rule.roles.includes(role)) return { ok: false, code: 403, error: 'Эта роль не может выполнить такой переход' };

  // БП-15: после внесения оплаты клиент сам отменить заказ не может
  if (to === 'CANCELLED' && role === 'CLIENT' && (order.paidAmount ?? 0) > 0) {
    return { ok: false, code: 403, error: 'После предоплаты заказ отменяет только менеджер' };
  }

  if (order.status === 'NEW' && to === 'AWAITING_APPROVAL' && order.finalPrice == null) {
    return { ok: false, code: 409, error: 'Сначала подтвердите итоговую цену' };
  }
  if (to === 'IN_PRODUCTION') {
    if (!order.clientApproved) return { ok: false, code: 409, error: 'Клиент ещё не согласовал цену и чертёж' };
    if (PAYMENT_RANK[order.paymentStatus] < PAYMENT_RANK.PREPAID) return { ok: false, code: 409, error: 'Нужна предоплата 50 %' };
    if (!order.masterId) return { ok: false, code: 409, error: 'Не назначен мастер' };
  }
  if (to === 'DELIVERED' && order.paymentStatus !== 'PAID') {
    return { ok: false, code: 409, error: 'Заказ должен быть оплачен полностью' };
  }
  if (order.status === 'IN_PRODUCTION' && to === 'CANCELLED' && !(comment && comment.trim())) {
    return { ok: false, code: 400, error: 'Укажите причину отмены' };
  }
  return { ok: true };
}

/** Следующий этап по порядку или null, если все выполнены. */
export function nextStage(doneStages) {
  const done = new Set(doneStages);
  return STAGES.find((s) => !done.has(s)) ?? null;
}
