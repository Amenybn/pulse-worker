/**
 * Vérifie qu'un service interne répond (ex. http://toolbox-service:3000/health).
 * Le worker appelle les autres ; personne ne l'appelle, lui.
 */
async function checkTarget(url, timeoutMs) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer();
    return { url, ok: res.ok, status: res.status, latencyMs: Date.now() - started };
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `timeout ${timeoutMs} ms` : (err.cause?.code ?? err.message);
    return { url, ok: false, status: null, latencyMs: Date.now() - started, error: reason };
  }
}

module.exports = { checkTarget };
