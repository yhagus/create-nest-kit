# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* bun.lock* ./

# Installs with whichever package manager produced the lockfile. The later stages copy
# node_modules, so Yarn Berry with Plug'n'Play (which writes no node_modules) is not supported.
# Install scripts are skipped: the project's own postinstall (e.g. `prisma generate`) needs
# sources these stages don't have, and the native packages used here ship prebuilt binaries.
FROM base AS deps
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --ignore-scripts; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile --ignore-scripts; \
    elif [ -f bun.lock ]; then npx --yes bun@1.4.0 install --frozen-lockfile --ignore-scripts; \
    else npm ci --ignore-scripts; fi

FROM base AS prod-deps
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod --ignore-scripts; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile --production --ignore-scripts; \
    elif [ -f bun.lock ]; then npx --yes bun@1.4.0 install --frozen-lockfile --production --ignore-scripts; \
    else npm ci --omit=dev --ignore-scripts; fi

FROM deps AS build
COPY . .
# The postinstall skipped in deps, now that the sources are here.
RUN npm run postinstall --if-present && npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
