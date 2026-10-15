// Sonde de vie sans HTTP : "node src/healthcheck.js" renvoie 0 si le worker a battu récemment, 1 sinon.
// Utilisable en HEALTHCHECK Docker ou en livenessProbe Kubernetes de type exec.
const { loadConfig } = require('./config');
const { isHealthy } = require('./heartbeat');

try {
  const config = loadConfig();
  const maxAgeMs = Math.max(config.intervalSeconds * 3, 60) * 1000;
  process.exit(isHealthy(config.heartbeatFile, maxAgeMs) ? 0 : 1);
} catch {
  process.exit(1);
}
