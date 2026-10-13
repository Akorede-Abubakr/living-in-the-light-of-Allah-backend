const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../dist/config/db');

test('database startup failures do not log connection strings or raw driver errors', async () => {
  const originalConnect = mongoose.connect;
  const originalError = console.error;
  const originalLog = console.log;
  const logs = [];
  mongoose.connect = async () => { throw new Error('mongodb+srv://user:private-test-password@db.invalid'); };
  console.error = (...args) => logs.push(args);
  console.log = (...args) => logs.push(args);
  try {
    await connectDB();
    assert.ok(logs.length);
    assert.ok(!JSON.stringify(logs).includes('private-test-password'));
    assert.ok(!JSON.stringify(logs).includes('mongodb+srv://'));
  } finally {
    mongoose.connect = originalConnect;
    console.error = originalError;
    console.log = originalLog;
  }
});
