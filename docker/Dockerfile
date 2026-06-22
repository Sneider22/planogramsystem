# Stage 1: Build
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# Deshabilitar telemetría de Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Copiar archivos de dependencias
COPY package.json ./

# Instalar dependencias
RUN bun install

# Copiar el resto del código y generar cliente Prisma
COPY . .
RUN bun run prisma:generate

# Construir la aplicación Next.js
RUN bun run build

# Stage 2: Runner
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copiar compilación y dependencias necesarias
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Comando para iniciar la aplicación en producción
CMD ["bun", "run", "start"]
