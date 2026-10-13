const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createCorsOptions } = require('../dist/config/cors');

test('production approves only exact frontend/admin origins', () => {
  const options = createCorsOptions('production', 'https://app.example.com', 'https://admin.example.com');
  for (const origin of ['https://app.example.com', 'https://admin.example.com', undefined]) {
    options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  for (const origin of ['https://evil.example', 'https://app.example.com.evil.test', 'http://localhost:5173', 'null']) {
    options.origin(origin, error => assert.equal(error.statusCode, 403));
  }
});

test('invalid production origins fail closed', () => {
  for (const origin of ['*', 'http://localhost:5173', 'https://app.example.com/', 'https://app.example.com/path']) {
    assert.throws(() => createCorsOptions('production', origin, 'https://admin.example.com'));
  }
});

test('development allows known local apps, not arbitrary origins', () => {
  const options = createCorsOptions('development', 'http://localhost:5173', 'http://localhost:5174');
  options.origin('http://127.0.0.1:5174', (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  options.origin('https://evil.example', error => assert.equal(error.statusCode, 403));
});
