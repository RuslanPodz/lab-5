# qa-api-lab — ЛР 5. Автоматизація тестування REST API

Дисципліна «Автоматизація тестування», варіант 11: `GET /orders/stats` — кількість і сума замовлень користувача.

Стек: Node.js ≥ 20, JavaScript (ES-модулі), Express, Vitest, Supertest, Ajv, Postman, Newman.

## Запуск

```bash
npm install
npm test          # Vitest + Supertest: 32 тести
npm start         # сервер на http://localhost:3000
npm run newman    # у другому вікні терміналу, поки працює сервер
```

Newman зберігає JUnit-звіт у `results/newman.xml`.

## Структура

```
src/app.js                 фабрика createApp() — сервіс замовлень + GET /orders/stats
src/server.js              запуск сервера для Postman / Newman
tests/helpers.js           login(), makeOrderPayload(), bearer()
tests/schema.js            expectSchema() на базі Ajv (allErrors)
tests/schemas/*.schema.js  JSON Schema замовлення і статистики (additionalProperties: false)
tests/orders.test.js       показовий приклад (частина 1)
tests/stats.test.js        варіант 11 (частина 2)
postman/orders.postman_collection.json   колекція Orders API (8 запитів)
```

## Ендпоїнт варіанта 11

`GET /orders/stats` з заголовком `Authorization: Bearer <token>`

| Сценарій | Код | Тіло |
|---|---|---|
| Замовлень немає | 200 | `{ "count": 0, "totalSum": 0 }` |
| Є власні замовлення | 200 | `{ "count": N, "totalSum": сума total }` |
| Без токена / підроблений токен / без `Bearer` | 401 | `{ "code": "UNAUTHORIZED" }` |

Відповідь має заголовок `Cache-Control: no-store`. Замовлення інших користувачів не враховуються.
# lab-5
