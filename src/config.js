const os = require('node:os');
const path = require('node:path');

function integer(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} doit être un entier entre ${min} et ${max} (reçu : "${raw}")`);
  }
  return value;
}

function targets(env) {
  return (env.TARGETS || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => {
      let url;
      try {
        url = new URL(t);
      } catch {
        throw new Error(`TARGETS contient une URL invalide : "${t}"`);
      }
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`TARGETS : protocole non supporté "${t}"`);
      return url.toString();
    });
}

/** Lit et valide la configuration depuis les variables d'environnement. */
function loadConfig(env = process.env) {
  return {
    workerName: env.WORKER_NAME || os.hostname(),
    intervalSeconds: integer(env, 'INTERVAL_SECONDS', 30, 5, 3600),
    batchSize: integer(env, 'BATCH_SIZE', 50, 1, 10000),
    checkTimeoutMs: integer(env, 'CHECK_TIMEOUT_MS', 5000, 100, 60000),
    summaryEvery: integer(env, 'SUMMARY_EVERY', 10, 1, 1000),
    targets: targets(env),
    heartbeatFile: env.HEARTBEAT_FILE || path.join(os.tmpdir(), 'pulse-worker-heartbeat.json'),
  };
}

module.exports = { loadConfig };
