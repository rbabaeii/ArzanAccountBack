# ----------------------------------------------------
# Stage 1: Build
# ----------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies needed for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and scripts
COPY . .

# Ensure datasource provider is set to PostgreSQL for Docker
RUN node scripts/switch-db.js postgres

# Generate Prisma Client for PostgreSQL
RUN npx prisma generate

# Build NestJS application
RUN rm -f tsconfig.tsbuildinfo && npm run build

# ----------------------------------------------------
# Stage 2: Runner
# ----------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=4000

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

EXPOSE 4000

# On container boot: auto push Prisma schema to PostgreSQL, then launch server
CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
