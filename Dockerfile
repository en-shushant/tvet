FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

# Copy frontend into public/ so Express serves it
COPY index.html ./public/index.html

EXPOSE 4000

CMD ["node", "server.js"]
