# ── Stage 1: build Vite frontend ─────────────────────────────────────────────
FROM node:20-alpine AS build-frontend

WORKDIR /frontend

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY index.html vite.config.js ./
COPY src/ ./src/

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

CMD ["node", "server.js"]
