# syntax=docker/dockerfile:1.7
# Contexto de build: la RAÍZ del monorepo (docker build -f apps/api/Dockerfile .)
ARG NODE_VERSION=22
# Mantener sincronizado con "packageManager" del package.json raíz.
ARG PNPM_VERSION=10.28.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_HOME=/opt/corepack \
    CI=true
# Prisma necesita openssl en la imagen slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Certificado CA adicional, opcional: si tu red intercepta TLS (proxy corporativo, antivirus
# con inspección HTTPS, p. ej. Avast/Kaspersky/ESET) y el build falla con "unable to verify
# the first certificate", exporta su certificado raíz como .crt en docker/certs/ (ignorado
# por git) y repite el build. Sin ningún .crt ahí, estas líneas no cambian nada.
COPY docker/certs/ /usr/local/share/ca-certificates/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
# pnpm se prepara en una ruta común para que el usuario "node" de la imagen final pueda
# ejecutar `pnpm exec prisma migrate deploy` sin red.
RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# ── deps: capa cacheada; solo cambia si cambian manifiestos, lockfile o el esquema Prisma ──
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @alcaravan/api...

# ── dev: usado por docker-compose; el código fuente entra por bind mount ──
FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /workspace/apps/api
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ── build ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @alcaravan/shared build \
    && pnpm --filter @alcaravan/api build

# ── prod ──
# Conserva node_modules completo a propósito: la imagen puede ejecutar también
# `prisma migrate deploy` y el seed (CI/CD). Optimizable con `pnpm deploy` cuando haga falta.
FROM build AS prod
ENV NODE_ENV=production
WORKDIR /workspace/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
