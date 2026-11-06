// Контракт відповіді GET /orders/stats (варіант 11)
export const statsSchema = {
  type: 'object',
  properties: {
    count: { type: 'integer', minimum: 0 },
    totalSum: { type: 'number', minimum: 0 },
  },
  required: ['count', 'totalSum'],
  additionalProperties: false,
};
