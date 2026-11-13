# Stage 1: Build
FROM docker.io/node:24-alpine AS builder

# Optional build args used by scripts/generate-version.mjs to stamp
# public/version.json with the release tag. Defaults are safe for
# local `docker build` (no args → falls back to git describe, which
# also works in this stage because we install git below).
ARG STJORNA_VERSION=dev
ARG STJORNA_COMMIT=local
# git is needed by the version script's `git describe` fallback.
# Install it explicitly so the script doesn't crash on a clean tree
# where the only signal is the build arg.
RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN STJORNA_VERSION=${STJORNA_VERSION} STJORNA_COMMIT=${STJORNA_COMMIT} npm run build

# Stage 2: Serve with nginx-unprivileged (designed to run as non-root on port 8080)
# 1.27 is EOL; 1.31 is the current mainline branch (Alpine 3.24 base).
FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine

# The published image lags the Alpine package index, so an image that is only a
# few weeks old still ships known-vulnerable packages (e.g. brotli, curl,
# openssl). Upgrade the base packages at build time so every release picks up
# the current security patches. Root is required for apk; drop back afterwards.
USER root
RUN apk upgrade --no-cache
USER nginx

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Writes /tmp/stjorna/config.js (served as /config.js) from PB_URL at start.
COPY --chmod=755 docker/40-stjorna-config.sh /docker-entrypoint.d/40-stjorna-config.sh

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]