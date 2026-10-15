const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { generateBatch, processBatch, processItem } = require('../src/jobs');
const { checkTarget } = require('../src/checks');
const { writeHeartbeat, isHealthy } = require('../src/heartbeat');

test('config : valeurs par défaut', () => {
  const c = loadConfig({});
  assert.equal(c.intervalSeconds, 30);
  assert.equal(c.batchSize, 50);
  assert.deepEqual(c.targets, []);
});

test('config : lit les variables et les cibles', () => {
  const c = loadConfig({ INTERVAL_SECONDS: '10', BATCH_SIZE: '5', TARGETS: 'http://toolbox-service:3000/health, http://autre:8080/' });
  assert.equal(c.intervalSeconds, 10);
  assert.equal(c.batchSize, 5);
  assert.deepEqual(c.targets, ['http://toolbox-service:3000/health', 'http://autre:8080/']);
});

test('config : rejette les valeurs invalides', () => {
  assert.throws(() => loadConfig({ INTERVAL_SECONDS: '1' }), /INTERVAL_SECONDS/);
  assert.throws(() => loadConfig({ BATCH_SIZE: 'abc' }), /BATCH_SIZE/);
  assert.throws(() => loadConfig({ TARGETS: 'pas une url' }), /TARGETS/);
});

test('jobs : un lot est entièrement traité', () => {
  const report = processBatch(generateBatch(200));
  assert.equal(report.processed + report.rejected, 200);
  assert.ok(report.processed > 0);
});

test('jobs : un montant invalide est rejeté, un valide est signé', () => {
  assert.equal(processItem({ id: 'a', amount: -1, currency: 'EUR' }).ok, false);
  const ok = processItem({ id: 'b', amount: 12.5, currency: 'EUR' });
  assert.equal(ok.ok, true);
  assert.match(ok.signature, /^[0-9a-f]{64}$/);
});

test('checks : détecte un service UP et un service DOWN', async () => {
  const server = http.createServer((req, res) => res.end('{"status":"UP"}')).listen(0);
  await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/health`;
  const up = await checkTarget(url, 2000);
  assert.equal(up.ok, true);
  assert.equal(up.status, 200);
  server.close();
  const down = await checkTarget('http://127.0.0.1:1/health', 2000);
  assert.equal(down.ok, false);
  assert.ok(down.error);
});

test('heartbeat : sain si récent, malade si ancien ou absent', () => {
  const file = path.join(os.tmpdir(), `hb-test-${process.pid}.json`);
  writeHeartbeat(file, { cycles: 1 });
  assert.equal(isHealthy(file, 60000), true);
  assert.equal(isHealthy(file, 60000, Date.now() + 120000), false);
  fs.unlinkSync(file);
  assert.equal(isHealthy(file, 60000), false);
});
