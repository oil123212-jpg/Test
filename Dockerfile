FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/index.html web/tsconfig.json web/vite.config.ts ./
COPY web/src ./src
COPY web/public ./public
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node web/scripts/serve.mjs web/scripts/realtime-gateway.mjs ./scripts/
COPY --chown=node:node web/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
