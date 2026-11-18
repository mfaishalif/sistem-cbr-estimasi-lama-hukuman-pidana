# syntax=docker/dockerfile:1.7

# Node.js LTS pinned to an exact patch release. The npm lockfile pins
# application dependencies. No native SQLite module is built: the data layer
# uses the built-in node:sqlite module of the pinned runtime.
FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/cbr/package.json packages/cbr/package.json
COPY packages/data/package.json packages/data/package.json
COPY tools/importer/package.json tools/importer/package.json
COPY tools/cli/package.json tools/cli/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY tools ./tools
COPY apps ./apps
RUN npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/cbr/package.json packages/cbr/package.json
COPY packages/data/package.json packages/data/package.json
COPY tools/importer/package.json tools/importer/package.json
COPY tools/cli/package.json tools/cli/package.json
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/app.db \
    WEB_DIST_DIR=/app/apps/web/dist

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

COPY --from=build /app/packages/cbr/package.json ./packages/cbr/package.json
COPY --from=build /app/packages/cbr/dist ./packages/cbr/dist
COPY --from=build /app/packages/data/package.json ./packages/data/package.json
COPY --from=build /app/packages/data/dist ./packages/data/dist
COPY --from=build /app/tools/importer/package.json ./tools/importer/package.json
COPY --from=build /app/tools/importer/dist ./tools/importer/dist
COPY --from=build /app/tools/cli/package.json ./tools/cli/package.json
COPY --from=build /app/tools/cli/dist ./tools/cli/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /data \
    && chown -R node:node /data /app

USER node
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
