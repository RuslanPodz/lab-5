// Варіант 11. GET /orders/stats — кількість і сума замовлень користувача;
// перевірка після створення й видалення.
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { login, makeOrderPayload, bearer } from './helpers.js';
import { expectSchema } from './schema.js';
import { statsSchema } from './schemas/stats.schema.js';

const item = (price, qty = 1) => ({ sku: 'SKU-A', price, qty });

async function createOrder(app, token, items = [item(500)]) {
  const res = await request(app).post('/orders').set(bearer(token)).send({ items });
  if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
  return res.body;
}

const getStats = (app, token) => request(app).get('/orders/stats').set(bearer(token));

describe('GET /orders/stats', () => {
  let app;
  let token;

  beforeEach(async () => {
    app = createApp(); // кожен тест — власний застосунок і власні дані
    token = await login(app, 'bob@example.com'); // рівень basic
  });

  it('без замовлень: 200, JSON, count 0 і totalSum 0', async () => {
    const res = await getStats(app, token);

    expect(res.status).toBe(200); // рівень 1: код
    expectSchema(res.body, statsSchema); // рівень 2: структура за схемою
    expect(res.body).toEqual({ count: 0, totalSum: 0 }); // рівень 3: значення
    expect(res.headers['content-type']).toMatch(/application\/json/); // рівень 4
    expect(res.headers['cache-control']).toBe('no-store'); // рівень 4
  });

  it.each([
    // очікувані суми пораховано вручну; bob — basic, без знижки
    { name: 'одне замовлення 500 грн', orders: [[item(500)]],
      count: 1, totalSum: 560 }, // 500 + 60 доставка
    { name: 'з безкоштовною доставкою', orders: [[item(500)], [item(1000)]],
      count: 2, totalSum: 1560 }, // 560 + 1000
    { name: 'зі знижкою від 2000 грн', orders: [[item(500)], [item(2500)]],
      count: 2, totalSum: 2935 }, // 560 + 2500 × 0.95
    { name: 'з копійками', orders: [[item(0.1, 3)], [item(0.1)]],
      count: 2, totalSum: 120.4 }, // 60.3 + 60.1 (а не 120.39999999999999)
  ])('$name → count $count, totalSum $totalSum', async ({ orders, count, totalSum }) => {
    for (const items of orders) await createOrder(app, token, items);

    const res = await getStats(app, token);

    expect(res.status).toBe(200);
    expectSchema(res.body, statsSchema);
    expect(res.body.count).toBe(count);
    expect(res.body.totalSum).toBe(totalSum);
  });

  it('totalSum дорівнює сумі total зі списку GET /orders', async () => {
    await createOrder(app, token, [item(500)]);
    await createOrder(app, token, [item(120, 3)]);

    const list = await request(app).get('/orders').set(bearer(token));
    const stats = await getStats(app, token);

    expect(stats.body.count).toBe(list.body.length);
    expect(stats.body.totalSum).toBe(420 + 560); // 360 + 60 і 500 + 60
  });

  it('побічний ефект: створення збільшує, видалення зменшує статистику', async () => {
    const a = await createOrder(app, token, [item(500)]); // 560
    await createOrder(app, token, [item(1000)]); // 1000
    expect((await getStats(app, token)).body).toEqual({ count: 2, totalSum: 1560 });

    const del = await request(app).delete(`/orders/${a.id}`).set(bearer(token));
    expect(del.status).toBe(204);
    expect(del.text).toBe(''); // тіло 204 не розбираємо як JSON
    expect((await getStats(app, token)).body).toEqual({ count: 1, totalSum: 1000 });

    // повторне видалення — 404, статистика не змінюється
    const again = await request(app).delete(`/orders/${a.id}`).set(bearer(token));
    expect(again.status).toBe(404);
    expect((await getStats(app, token)).body).toEqual({ count: 1, totalSum: 1000 });
  });

  it('GET /orders/stats не змінює стан: три запити поспіль дають однаковий результат', async () => {
    await createOrder(app, token);
    const results = [];
    for (let i = 0; i < 3; i += 1) results.push((await getStats(app, token)).body);
    expect(results).toEqual([results[0], results[0], results[0]]);
    expect(results[0]).toEqual({ count: 1, totalSum: 560 });
  });

  it.each([
    { name: 'порожній список', code: 'EMPTY_ORDER', items: [] },
    { name: 'без поля items', code: 'EMPTY_ORDER', items: undefined },
    { name: 'від’ємна ціна', code: 'INVALID_PRICE', items: [item(-0.01)] },
    { name: 'ціна-рядок', code: 'INVALID_PRICE', items: [{ sku: 'A', price: '500', qty: 1 }] },
    { name: 'нульова кількість', code: 'INVALID_QTY', items: [item(10, 0)] },
    { name: 'дробова кількість', code: 'INVALID_QTY', items: [item(10, 1.5)] },
  ])('відхилене замовлення ($name → $code) не потрапляє до статистики', async ({ items, code }) => {
    await createOrder(app, token, [item(500)]);

    const res = await request(app).post('/orders').set(bearer(token)).send({ items });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);

    expect((await getStats(app, token)).body).toEqual({ count: 1, totalSum: 560 });
  });
});

describe('GET /orders/stats — доступ', () => {
  let app;
  beforeEach(() => { app = createApp(); });

  it.each([
    { name: 'без токена', header: undefined },
    { name: 'з підробленим токеном', header: 'Bearer invalid-token' },
    { name: 'без префікса Bearer', header: 'some-token' },
  ])('$name → 401 UNAUTHORIZED', async ({ header }) => {
    const req = request(app).get('/orders/stats');
    if (header) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'UNAUTHORIZED' });
  });

  it('чужі замовлення не враховуються', async () => {
    const alice = await login(app, 'alice@example.com'); // gold, знижка 10 %
    const bob = await login(app, 'bob@example.com');
    await createOrder(app, alice, [item(500)]); // 450 + 60 = 510
    await createOrder(app, alice, [item(500)]); // 510
    await createOrder(app, bob, [item(500)]); // 560

    expect((await getStats(app, bob)).body).toEqual({ count: 1, totalSum: 560 });
    expect((await getStats(app, alice)).body).toEqual({ count: 2, totalSum: 1020 });
  });

  it('чуже замовлення не можна видалити: 404, статистика власника не змінюється', async () => {
    const alice = await login(app, 'alice@example.com');
    const bob = await login(app, 'bob@example.com');
    const order = await createOrder(app, alice, [item(500)]);

    const res = await request(app).delete(`/orders/${order.id}`).set(bearer(bob));
    expect(res.status).toBe(404);

    expect((await getStats(app, alice)).body).toEqual({ count: 1, totalSum: 510 });
    expect((await getStats(app, bob)).body).toEqual({ count: 0, totalSum: 0 });
  });
});
