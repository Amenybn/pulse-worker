const { checkTarget } = require('./checks');
const { loadConfig } = require('./config');
const { writeHeartbeat } = require('./heartbeat');
const { generateBatch, processBatch } = require('./jobs');
const log = require('./logger');
const pkg = require('../package.json');

let config;
try {
  config = loadConfig();
} catch (err) {
  log.error('Configuration invalide, arrêt du worker', { error: err.message });
  process.exit(1);
}

const state = {
  startedAt: new Date(),
  cycles: 0,
  processed: 0,
  rejected: 0,
  targets: Object.fromEntries(config.targets.map(t => [t, { up: 0, down: 0, last: null }])),
};
let timer = null;
let running = null;
let stopping = false;
let heartbeatWarned = false;

function heartbeat() {
  try {
    writeHeartbeat(config.heartbeatFile, { cycles: state.cycles });
  } catch (err) {
    if (!heartbeatWarned) log.warn('Impossible d\'écrire le heartbeat (la sonde exec échouera)', { file: config.heartbeatFile, error: err.message });
    heartbeatWarned = true;
  }
}

async function cycle() {
  state.cycles++;
  const n = state.cycles;

  // 1. Tâche de fond : traitement d'un lot
  const report = processBatch(generateBatch(config.batchSize));
  state.processed += report.processed;
  state.rejected += report.rejected;
  log.info(`Cycle #${n} : lot traité`, {
    processed: report.processed,
    rejected: report.rejected,
    totals: report.totals,
    durationMs: report.durationMs,
  });

  // 2. Surveillance des services internes (DNS interne du namespace)
  const results = await Promise.all(config.targets.map(t => checkTarget(t, config.checkTimeoutMs)));
  for (const r of results) {
    const t = state.targets[r.url];
    t[r.ok ? 'up' : 'down']++;
    t.last = r.ok ? 'UP' : 'DOWN';
    const fields = { url: r.url, status: r.status ?? '-', latencyMs: r.latencyMs };
    if (r.ok) log.info(`Cycle #${n} : service joignable`, fields);
    else log.warn(`Cycle #${n} : service injoignable`, { ...fields, error: r.error ?? `HTTP ${r.status}` });
  }

  heartbeat();
  if (n % config.summaryEvery === 0) summary();
}

function summary() {
  const uptimeSeconds = Math.round((Date.now() - state.startedAt.getTime()) / 1000);
  const availability = Object.fromEntries(
    Object.entries(state.targets).map(([url, t]) => [url, `${Math.round((t.up / Math.max(1, t.up + t.down)) * 100)}%`]),
  );
  log.info('Résumé', {
    cycles: state.cycles,
    processedTotal: state.processed,
    rejectedTotal: state.rejected,
    uptimeSeconds,
    ...(config.targets.length ? { availability } : {}),
  });
}

function schedule() {
  if (stopping) return;
  timer = setTimeout(async () => {
    running = cycle().catch(err => log.error('Erreur pendant le cycle', { error: err.message }));
    await running;
    running = null;
    schedule();
  }, config.intervalSeconds * 1000);
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} reçu : arrêt propre du worker`);
  clearTimeout(timer);
  if (running) await running; // on termine le lot en cours avant de quitter
  summary();
  log.info('Worker arrêté');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

log.info(`Démarrage de ${pkg.name} v${pkg.version}`, {
  worker: config.workerName,
  intervalSeconds: config.intervalSeconds,
  batchSize: config.batchSize,
  targets: config.targets.length ? config.targets : 'aucune',
  exposedPort: 'aucun (worker interne)',
});
heartbeat();
running = cycle()
  .catch(err => log.error('Erreur pendant le cycle', { error: err.message }))
  .finally(() => {
    running = null;
    schedule();
  });
