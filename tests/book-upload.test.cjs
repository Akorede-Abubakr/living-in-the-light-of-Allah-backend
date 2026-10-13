const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const { User } = require('../dist/models/User');
const indexService = require('../dist/services/book-index.service');
const { createBookAiRouter } = require('../dist/routes/book-ai.routes');

const originalFind = User.findById;
const originalIndex = indexService.indexBook;
const bookId = '000000000000000000000001';
const bytes = Buffer.from('multipart regression fixture');
before(() => {
  User.findById = async id => ({ _id: id, role: 'admin', status: 'active' });
  // Exercise the real authentication, routing and upload parser. Persistence
  // and document extraction are deliberately outside this transport regression.
  indexService.indexBook = async (id, file) => {
    assert.equal(id, bookId);
    assert.equal(file.originalname, 'manuscript.docx');
    assert.deepEqual(file.buffer, bytes);
    return { received: true };
  };
});
after(() => {
  User.findById = originalFind;
  indexService.indexBook = originalIndex;
});

async function setup(t) {
  const app = express();
  app.use('/books', createBookAiRouter(config.ai));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const token = jwt.sign({ id: bookId }, config.jwtSecret, { expiresIn: '1m' });
  return body => fetch(`http://127.0.0.1:${server.address().port}/books/${bookId}/index`, {
    method: 'POST', body, headers: { Authorization: `Bearer ${token}` },
  });
}

function documentForm() {
  const form = new FormData();
  form.append('document', new Blob([bytes]), 'manuscript.docx');
  return form;
}

test('accepts exactly one manuscript multipart file', async t => {
  const send = await setup(t);
  const response = await send(documentForm());
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
});

test('rejects extra fields and duplicate files and releases upload admission', async t => {
  const send = await setup(t);
  const extraField = documentForm();
  extraField.append('unexpected', 'value');
  assert.equal((await send(extraField)).status, 400);
  const extraFile = documentForm();
  extraFile.append('document', new Blob([bytes]), 'second.docx');
  assert.equal((await send(extraFile)).status, 400);
  assert.equal((await send(documentForm())).status, 200);
});
