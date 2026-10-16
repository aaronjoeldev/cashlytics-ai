# Stage 1: Dependencies
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:24-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time,
# so they must be passed as build args (they have no effect at runtime).
ARG NEXT_PUBLIC_DEFAULT_LOCALE=de
ARG NEXT_PUBLIC_DEFAULT_CURRENCY=EUR
ENV NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE
ENV NEXT_PUBLIC_DEFAULT_CURRENCY=$NEXT_PUBLIC_DEFAULT_CURRENCY

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Migration dependencies (separate stage to keep runner lean)
FROM node:24-alpine AS migrate-deps
WORKDIR /migrate
RUN echo '{"name":"migrate","private":true}' > package.json && \
    npm install --no-package-lock drizzle-kit@0.31.11 drizzle-orm@0.45.4 postgres@3.4.9 && \
    npm cache clean --force

# Stage 4: Production
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration tooling and files
COPY --from=migrate-deps /migrate/node_modules /migrate/node_modules
COPY --from=builder /app/drizzle /migrate/drizzle

# Create drizzle config for migrations (DATABASE_URL resolved at runtime)
RUN echo 'module.exports={out:"/migrate/drizzle",dialect:"postgresql",dbCredentials:{url:process.env.DATABASE_URL}}' \
    > /migrate/drizzle.config.js

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the app
CMD ["/entrypoint.sh"]
