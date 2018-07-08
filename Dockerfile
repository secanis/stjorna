FROM node:alpine
LABEL maintainer=matthias.baldi@secanis.ch \
      ch.secanis.tool=stjorna \
      ch.secanis.version=

ARG VERSION

WORKDIR app
ENV NODE_ENV production

# add api and app stuff
ADD stjorna-$VERSION.tar.gz ./

RUN adduser -D myuser \
    && chown myuser:myuser -R ./
USER myuser

# HEALTHCHECK --interval=15s --timeout=15s --start-period=5s --retries=3 CMD node healthcheck.js

EXPOSE 3000

CMD ["node", "server.js"]