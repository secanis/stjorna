# Stage 1: download + verify the PocketBase binary. wget/unzip only live in
# this stage; the final image never ships them.
FROM docker.io/alpine:3.22 AS download

ARG PB_VERSION=0.40.4
# Set automatically by BuildKit / buildx (amd64, arm64, arm, ...). Defaults
# to amd64 for legacy builders that don't populate it.
ARG TARGETARCH=amd64
ARG TARGETVARIANT=

RUN apk add --no-cache ca-certificates unzip wget

WORKDIR /download

# Map the buildx platform to PocketBase's release naming, then verify the
# archive against the release's checksums.txt (the build fails on a
# mismatch or when the archive is missing from the list).
RUN set -eu; \
    case "${TARGETARCH}${TARGETVARIANT}" in \
        amd64)        PB_ARCH=linux_amd64 ;; \
        arm64*)       PB_ARCH=linux_arm64 ;; \
        armv7|arm)    PB_ARCH=linux_armv7 ;; \
        ppc64le)      PB_ARCH=linux_ppc64le ;; \
        s390x)        PB_ARCH=linux_s390x ;; \
        *) echo "unsupported TARGETARCH=${TARGETARCH}${TARGETVARIANT}" >&2; exit 1 ;; \
    esac; \
    ZIP="pocketbase_${PB_VERSION}_${PB_ARCH}.zip"; \
    BASE="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}"; \
    wget -q "${BASE}/${ZIP}" "${BASE}/checksums.txt"; \
    grep " ${ZIP}\$" checksums.txt > zip.sha256; \
    test -s zip.sha256; \
    sha256sum -c zip.sha256; \
    unzip -q "${ZIP}" pocketbase; \
    chmod 0755 pocketbase

# Stage 2: runtime image.
FROM docker.io/alpine:3.22

# ca-certificates: outbound TLS (S3, SMTP, OIDC). busybox (part of the
# base image) still provides `wget` for the docker-compose healthcheck.
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 1000 -s /bin/sh pocketbase

WORKDIR /app

COPY --from=download /download/pocketbase /app/pocketbase
COPY pb_migrations /app/pb_migrations
COPY pb_hooks /app/pb_hooks
COPY entrypoint.sh /app/entrypoint.sh

# Create pb_data in the image so Docker seeds the VOLUME with the
# pocketbase owner. Without it, Docker Engine creates the anonymous or
# named volume root-owned and PB (uid 1000) exits on first write.
# Podman chowns volumes to USER itself, which is why this only showed
# up on real Docker (e.g. GitHub Actions).
RUN mkdir -p /app/pb_data && \
    chmod +x /app/entrypoint.sh && \
    chown -R pocketbase:pocketbase /app

USER pocketbase

EXPOSE 8090

VOLUME ["/app/pb_data"]

ENTRYPOINT ["/app/entrypoint.sh"]
