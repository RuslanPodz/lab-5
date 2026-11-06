import request from 'supertest';

/**
 * Входить від імені користувача й повертає токен.
 * Код відповіді перевіряється тут: якщо підготовка не вдалася,
 * тест упаде саме в цьому місці зі зрозумілою причиною.
 */
export async function login(app, email) {
  const res = await request(app).post('/auth/login')
    .send({ email, password: 'Secret123' });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.body.accessToken;
}

export function makeOrderPayload(overrides = {}) {
  return { items: [{ sku: 'SKU-A', price: 500, qty: 1 }], ...overrides };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
