FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && node scripts/build-core-review-feed.mjs /core-feed && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production WHACKSMACKER_DATA_DIR=/data WHACKSMACKER_CORE_CATALOGUE=/core-feed/catalogue.json
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/COPYING ./COPYING
COPY --from=build /app/review-content ./review-content
COPY --from=build /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs
COPY --from=build /core-feed /core-feed
VOLUME ["/data"]
ENTRYPOINT ["node", "/app/scripts/docker-entrypoint.mjs"]
CMD ["--help"]
