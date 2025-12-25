# Development Stage
FROM node:22-alpine3.21 AS dev

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add a work directory
WORKDIR /app

# Cache and Install dependencies
COPY package.json .
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .

RUN pnpm install --frozen-lockfile

# Copy app files
COPY . .

# Expose port
EXPOSE 5173

# Start the dev server
CMD [ "pnpm", "dev", "--host" ]

# Build Stage
FROM node:22-alpine3.21 AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add a work directory
WORKDIR /app

# Cache and Install dependencies
COPY package.json .
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .

RUN pnpm install --frozen-lockfile

# Copy app files
COPY . .

ARG VITE_LOGIN_PAGE_URL=${VITE_LOGIN_PAGE_URL}
ARG VITE_COOKIE_DOMAIN=${VITE_COOKIE_DOMAIN}
ARG VITE_AUTH_BASE_URL=${VITE_AUTH_BASE_URL}
ARG VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ARG VITE_DEV_MODE=${VITE_DEV_MODE}
ARG VITE_BASE_DOMAIN=${VITE_BASE_DOMAIN}

ENV VITE_LOGIN_PAGE_URL=${VITE_LOGIN_PAGE_URL}
ENV VITE_COOKIE_DOMAIN=${VITE_COOKIE_DOMAIN}
ENV VITE_AUTH_BASE_URL=${VITE_AUTH_BASE_URL}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_DEV_MODE=${VITE_DEV_MODE}
ENV VITE_BASE_DOMAIN=${VITE_BASE_DOMAIN}

# RUN pnpm generate:client # Enable with Orval

RUN pnpm build

# Deployment Stage
FROM nginxinc/nginx-unprivileged:alpine AS deploy
COPY --from=build /app/dist/ /usr/share/nginx/html
COPY --from=build /app/deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080