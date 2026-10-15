// Logs sur la sortie standard : c'est la seule "interface" d'un worker (kubectl logs / docker logs).
const FORMAT = (process.env.LOG_FORMAT || 'text').toLowerCase();

function format(value) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function log(level, message, fields = {}) {
  const time = new Date().toISOString();
  if (FORMAT === 'json') {
    process.stdout.write(JSON.stringify({ time, level, message, ...fields }) + '\n');
    return;
  }
  const extra = Object.entries(fields)
    .map(([k, v]) => `${k}=${format(v)}`)
    .join(' ');
  process.stdout.write(`${time} ${level.toUpperCase().padEnd(5)} ${message}${extra ? '  ' + extra : ''}\n`);
}

module.exports = {
  info: (message, fields) => log('info', message, fields),
  warn: (message, fields) => log('warn', message, fields),
  error: (message, fields) => log('error', message, fields),
};
