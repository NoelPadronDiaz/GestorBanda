# syntax=docker/dockerfile:1.7
# Contexto de build: la RAÍZ del monorepo (docker build -f apps/web/Dockerfile .)
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @alcaravan/web...

# ── dev: servidor de Vite; el código fuente entra por bind mount ──
FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /workspace/apps/web
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0"]

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @alcaravan/shared build \
    && pnpm --filter @alcaravan/web build

# ── prod: estáticos + proxy /api hacia el servicio "api" ──
FROM nginx:1.27-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
