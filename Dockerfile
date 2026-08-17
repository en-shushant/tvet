# ── Stage 1: build Vite frontend ─────────────────────────────────────────────
FROM node:20-alpine AS build-frontend

WORKDIR /frontend

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY index.html vite.config.js ./
COPY src/ ./src/
# Vite copies public/ into dist/ verbatim at build time — favicon, robots.txt,
# anything meant to be served at a fixed path rather than imported. Omitting
# this COPY silently drops all of it; the build stage never errors, it just
# doesn't have the directory to copy from.
COPY public/ ./public/

RUN npm run build

# ── Stage 2: production backend ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend's public/ folder
COPY --from=build-frontend /frontend/dist ./public/

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "server.js"]
