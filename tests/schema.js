import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from 'vitest';

// allErrors: валідатор повертає всі порушення, а не лише перше
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export function expectSchema(data, schema) {
  const validate = ajv.compile(schema);
  validate(data);
  expect(validate.errors ?? []).toEqual([]);
}
