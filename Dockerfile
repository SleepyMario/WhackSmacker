FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY whacksmacker/package*.json ./
RUN npm ci

COPY whacksmacker/ .
RUN npm run build
RUN npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Bundle the current local package feed for the first Docker image.
# The catalogue currently contains absolute file:// paths, so keep that path
# available inside the container and expose /feed as a stable shortcut.
COPY whacksmacker-packages /home/ashwin/Projects/whacksmacker-modules/whacksmacker-packages
RUN ln -s /home/ashwin/Projects/whacksmacker-modules/whacksmacker-packages /feed

VOLUME ["/data"]

ENTRYPOINT ["node", "/app/dist/main.js"]
CMD ["--help"]
