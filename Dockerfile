# ---- Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# ---- Production stage 
FROM node:22-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main.js"]   