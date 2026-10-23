FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY whacksmacker/package*.json ./
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
COPY whacksmacker/ .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production WHACKSMACKER_DATA_DIR=/data WHACKSMACKER_CORE_CATALOGUE=/core-feed/catalogue.json
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/COPYING ./COPYING
COPY --from=build /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs
COPY core-feed/ /core-feed/
VOLUME ["/data"]
ENTRYPOINT ["node", "/app/scripts/docker-entrypoint.mjs"]
CMD ["--help"]
