FROM docker.io/alpine:3.19

RUN apk add --no-cache \
    ca-certificates \
    unzip \
    wget \
    && adduser -D -u 1000 -s /bin/sh pocketbase

WORKDIR /app

ARG PB_VERSION=0.40.4
ARG PB_ARCH=linux_amd64

RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip && \
    unzip pocketbase_${PB_VERSION}_${PB_ARCH}.zip && \
    rm pocketbase_${PB_VERSION}_${PB_ARCH}.zip

COPY pb_migrations /app/pb_migrations
COPY pb_hooks /app/pb_hooks
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    chown -R pocketbase:pocketbase /app

USER pocketbase

EXPOSE 8090

VOLUME ["/app/pb_data"]

ENTRYPOINT ["/app/entrypoint.sh"]