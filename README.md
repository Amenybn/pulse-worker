# Pulse Worker

Worker de fond (Node.js 20, **aucune dépendance**) : **pas d'URL, pas de port exposé**.
Il tourne en boucle et communique uniquement par ses **logs** (`kubectl logs` / `docker logs`).

À chaque cycle (toutes les `INTERVAL_SECONDS` secondes), il :
1. **traite un lot de tâches de fond** : validation et signature SHA-256 d'un lot de commandes simulées, avec un rapport agrégé ;
2. **surveille des services internes** (facultatif) en appelant leur URL via le **DNS interne** du namespace,
   par exemple `http://toolbox-service:3000/health` ;
3. écrit un **heartbeat** dans `/tmp`, utilisé par la sonde de vie.

## Démarrage

```bash
docker compose up -d --build
docker logs -f pulse-worker
```

Exemple de logs :

```
2026-10-15T10:00:00.000Z INFO  Démarrage de pulse-worker v1.0.0  worker=pulse-worker intervalSeconds=15 ...
2026-10-15T10:00:00.010Z INFO  Cycle #1 : lot traité  processed=49 rejected=1 totals={"EUR":3120.5,...} durationMs=2
2026-10-15T10:00:00.030Z INFO  Cycle #1 : service joignable  url=http://toolbox-service:3000/health status=200 latencyMs=12
```

## Variables d'environnement (toutes facultatives)

| Variable | Défaut | Rôle |
|---|---|---|
| `INTERVAL_SECONDS` | `30` | Intervalle entre deux cycles (5 à 3600) |
| `BATCH_SIZE` | `50` | Nombre de tâches traitées par cycle |
| `TARGETS` | *(vide)* | URLs internes à surveiller, séparées par des virgules |
| `CHECK_TIMEOUT_MS` | `5000` | Délai maximal d'un appel de surveillance |
| `SUMMARY_EVERY` | `10` | Afficher un résumé tous les N cycles |
| `LOG_FORMAT` | `text` | `text` ou `json` |
| `WORKER_NAME` | nom d'hôte | Nom affiché dans les logs |

## Sécurité et Kubernetes

- Utilisateur non-root numérique (`USER 1000:1000`) : compatible `runAsNonRoot`.
- N'écrit que dans `/tmp` : compatible `readOnlyRootFilesystem`.
- Arrêt propre sur `SIGTERM` : il termine le lot en cours puis affiche un résumé.
- Sonde de vie sans HTTP : `livenessProbe` de type exec avec `node src/healthcheck.js`.

## Tests

```bash
npm test
```
