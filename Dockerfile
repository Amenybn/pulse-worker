# Worker de fond : AUCUN port exposé, aucune URL. Il travaille en boucle et écrit ses logs sur stdout.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Aucune dépendance npm : seulement le code
COPY package.json ./
COPY src ./src

# Utilisateur non-root NUMÉRIQUE (compatible runAsNonRoot Kubernetes).
# Seule écriture : le heartbeat dans /tmp (compatible système de fichiers en lecture seule).
USER 1000:1000

# Sonde de vie sans HTTP : vérifie que le worker a "battu" récemment
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "src/healthcheck.js"]

CMD ["node", "src/index.js"]
