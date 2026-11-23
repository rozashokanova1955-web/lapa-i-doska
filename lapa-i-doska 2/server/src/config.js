const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Не задана переменная окружения ${name} (см. server/.env.example)`);
  return v;
};

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32 || jwtSecret.startsWith('замените')) throw new Error('JWT_SECRET должен быть случайным и не короче 32 символов (см. .env.example)');

export const config = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  isProd: process.env.NODE_ENV === 'production',
};
