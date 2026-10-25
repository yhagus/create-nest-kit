# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* bun.lock* ./

# Installs with whichever package manager produced the lockfile. The later stages copy
# node_modules, so Yarn Berry with Plug'n'Play (which writes no node_modules) is not supported.
FROM base AS deps
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f bun.lock ]; then npx --yes bun@1.4.0 install --frozen-lockfile; \
    else npm ci; fi

FROM base AS prod-deps
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile --production; \
    elif [ -f bun.lock ]; then npx --yes bun@1.4.0 install --frozen-lockfile --production; \
    else npm ci --omit=dev; fi

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
