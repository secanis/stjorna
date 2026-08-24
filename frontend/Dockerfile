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
FROM docker.io/nginxinc/nginx-unprivileged:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]