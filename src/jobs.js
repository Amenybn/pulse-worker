const crypto = require('node:crypto');

const CURRENCIES = ['EUR', 'USD', 'TND', 'GBP'];

/** Simule l'arrivée d'un lot de commandes à traiter (ce que fournirait une file de messages). */
function generateBatch(size) {
  return Array.from({ length: size }, () => ({
    id: crypto.randomUUID(),
    amount: Math.random() < 0.03 ? -1 : Math.round(Math.random() * 50000) / 100,
    currency: CURRENCIES[crypto.randomInt(CURRENCIES.length)],
    createdAt: new Date().toISOString(),
  }));
}

/** Traite un élément : validation puis signature (calcul CPU réel). */
function processItem(item) {
  if (!(item.amount > 0)) {
    return { id: item.id, ok: false, reason: 'montant invalide' };
  }
  const signature = crypto.createHash('sha256').update(`${item.id}|${item.amount}|${item.currency}`).digest('hex');
  return { id: item.id, ok: true, amount: item.amount, currency: item.currency, signature };
}

/** Traite un lot complet et renvoie un rapport agrégé. */
function processBatch(items) {
  const started = process.hrtime.bigint();
  const results = items.map(processItem);
  const accepted = results.filter(r => r.ok);
  const totals = {};
  for (const r of accepted) totals[r.currency] = Math.round(((totals[r.currency] ?? 0) + r.amount) * 100) / 100;
  return {
    processed: accepted.length,
    rejected: results.length - accepted.length,
    totals,
    durationMs: Number((process.hrtime.bigint() - started) / 1000000n),
  };
}

module.exports = { generateBatch, processItem, processBatch };
