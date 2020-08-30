FROM node:alpine

ARG VERSION

LABEL maintainer=support@secanis.ch \
    ch.secanis.tool=stjorna \
    ch.secanis.version=$VERSION

WORKDIR /app
ENV NODE_ENV production

# add api and app stuff
COPY ./server .

RUN npm ci --production \
    && adduser -D myuser \
    && chown myuser:myuser -R ./
USER myuser

HEALTHCHECK --interval=15s --timeout=15s --start-period=5s --retries=3 CMD node /app/healthcheck.js

EXPOSE 3000
VOLUME [ "/app/data" ]

CMD ["node", "server.js"]
