# syntax=docker/dockerfile:1.7

# Schedule Board — production image for Fly.io.
#
# Stage 1 (build): install ALL deps and produce dist/ via `npm run build`.
# Stage 2 (runtime): install only production deps (which include tsx +
# better-sqlite3 after the Phase 8A reclassification), copy in the built
# SPA + server, and run the same `npm start` that you run locally.
#
# Base image: node:22-slim. Debian/glibc-based so better-sqlite3 picks up
# its prebuilt binary without needing python3 / make / g++.

ARG NODE_VERSION=22-slim

# --- Stage 1: build the SPA -------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts index.html ./
COPY src ./src

RUN npm run build

# --- Stage 2: runtime -------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/prod.sqlite \
    STATIC_DIR=/app/dist

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

# Volume mount point for the SQLite database. Fly attaches the persistent
# volume here at runtime; the directory exists in the image so the server can
# fall back to a temp DB during a local `docker run` smoke test.
RUN mkdir -p /data

EXPOSE 8787

CMD ["npm", "start"]
