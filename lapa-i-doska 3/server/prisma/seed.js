// Создаёт администратора, тестовых пользователей и каталог. Запуск: npm run seed (повторный запуск безопасен)
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const gen = () => crypto.randomBytes(9).toString('base64url');

const adminPassword = process.env.ADMIN_PASSWORD || gen();
const seedPassword = process.env.SEED_PASSWORD || gen();
const printed = [];

async function ensureUser(email, fullName, role, password) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return;
  await prisma.user.create({ data: { email, fullName, role, passwordHash: await bcrypt.hash(password, 10) } });
  printed.push(`${role.padEnd(8)} ${email}  пароль: ${password}`);
}

await ensureUser(process.env.ADMIN_EMAIL || 'admin@lapa.kz', 'Администратор', 'ADMIN', adminPassword);
await ensureUser('manager@lapa.kz', 'Алия Менеджер', 'MANAGER', seedPassword);
await ensureUser('master@lapa.kz', 'Ерлан Мастер', 'MASTER', seedPassword);
await ensureUser('client@lapa.kz', 'Камилла Клиент', 'CLIENT', seedPassword);

if ((await prisma.material.count()) === 0) {
  await prisma.material.createMany({ data: [
    { name: 'Сосна', coefficientPercent: 100 },
    { name: 'Берёзовая фанера', coefficientPercent: 115 },
    { name: 'Дуб', coefficientPercent: 150 },
  ] });
}
if ((await prisma.option.count()) === 0) {
  await prisma.option.createMany({ data: [
    { name: 'Мягкая подушка', extraPrice: 4500 },
    { name: 'Когтеточка из джута', extraPrice: 3500 },
    { name: 'Покраска в цвет на выбор', extraPrice: 6000 },
    { name: 'Утепление стен', extraPrice: 9000 },
  ] });
}
if ((await prisma.product.count()) === 0) {
  await prisma.product.createMany({ data: [
    { name: 'Будка для собаки', category: 'Собаки', description: 'Утеплённая будка со съёмной крышей для лёгкой чистки.',
      basePrice: 45000, baseVolumeL: 250, pricePerLiter: 80, minWidth: 50, maxWidth: 120, minDepth: 60, maxDepth: 130, minHeight: 50, maxHeight: 110 },
    { name: 'Лежанка деревянная', category: 'Собаки и кошки', description: 'Приподнятая лежанка на ножках, под любой матрас.',
      basePrice: 18000, baseVolumeL: 60, pricePerLiter: 120, minWidth: 40, maxWidth: 110, minDepth: 40, maxDepth: 90, minHeight: 15, maxHeight: 35 },
    { name: 'Когтеточка-столбик', category: 'Кошки', description: 'Устойчивый столбик с джутовой обмоткой на широкой базе.',
      basePrice: 12000, baseVolumeL: 40, pricePerLiter: 150, minWidth: 30, maxWidth: 60, minDepth: 30, maxDepth: 60, minHeight: 40, maxHeight: 120 },
    { name: 'Домик для кошки', category: 'Кошки', description: 'Домик с круглым входом и площадкой на крыше.',
      basePrice: 26000, baseVolumeL: 70, pricePerLiter: 140, minWidth: 35, maxWidth: 80, minDepth: 35, maxDepth: 80, minHeight: 35, maxHeight: 90 },
  ] });
}

console.log('Готово.');
if (printed.length) {
  console.log('Созданы пользователи (пароли показываются один раз, сохраните их):');
  printed.forEach((l) => console.log('  ' + l));
}
await prisma.$disconnect();
