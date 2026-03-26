# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Crear usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# wget no está en alpine por defecto; instalarlo para healthcheck
RUN apk add --no-cache wget

COPY --from=build /app/dist ./dist

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
