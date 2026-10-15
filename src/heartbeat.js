const fs = require('node:fs');

/** Écrit le "battement de cœur" du worker (dans /tmp : compatible système de fichiers en lecture seule). */
function writeHeartbeat(file, data) {
  fs.writeFileSync(file, JSON.stringify({ time: new Date().toISOString(), ...data }));
}

/** Le worker est vivant si son dernier battement date de moins de maxAgeMs. */
function isHealthy(file, maxAgeMs, now = Date.now()) {
  try {
    const { time } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return now - new Date(time).getTime() <= maxAgeMs;
  } catch {
    return false;
  }
}

module.exports = { writeHeartbeat, isHealthy };
