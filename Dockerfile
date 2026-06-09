# ==============================================================================
# Multi-stage Dockerfile for cidyt-web-app
# Stage 1: Build the Vite app
# Stage 2: Lightweight image with only the static assets (for CI artifact extraction)
# ==============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build

# --- Stage 2: Production assets ---
FROM alpine:3.19 AS production

WORKDIR /app/dist

# Copy only the built assets
COPY --from=builder /app/dist ./

# This image is used to extract the dist/ folder in CI
# No runtime server needed — assets are deployed to Firebase Hosting
CMD ["echo", "Build artifacts ready in /app/dist"]
