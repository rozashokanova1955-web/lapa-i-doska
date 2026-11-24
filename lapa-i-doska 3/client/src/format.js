export const money = (n) => (n == null ? '—' : `${Number(n).toLocaleString('ru-RU')} ₸`);
export const dateTime = (d) => new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export const STATUS = {
  NEW: 'Новый', AWAITING_APPROVAL: 'На согласовании', IN_PRODUCTION: 'В производстве',
  READY: 'Готов', DELIVERED: 'Выдан', CANCELLED: 'Отменён',
};
export const PAYMENT = { UNPAID: 'Не оплачен', PREPAID: 'Предоплата 50 %', PAID: 'Оплачен' };
export const STAGE = {
  DRAWING: 'Чертёж', CUTTING: 'Распил', ASSEMBLY: 'Сборка', PAINTING: 'Покраска', PACKING: 'Упаковка',
};
export const STAGE_ORDER = ['DRAWING', 'CUTTING', 'ASSEMBLY', 'PAINTING', 'PACKING'];
export const ROLE = { CLIENT: 'Клиент', MANAGER: 'Менеджер', MASTER: 'Мастер', ADMIN: 'Администратор' };

// Куда вести пользователя после входа и как назвать раздел с заказами
export const HOME_BY_ROLE = { CLIENT: '/cabinet', MANAGER: '/manager', MASTER: '/master', ADMIN: '/admin' };
