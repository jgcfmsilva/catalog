FROM node:22-alpine
WORKDIR /app
# Pre-create mount points so named volumes inherit node:node ownership.
RUN mkdir -p /app/node_modules /data/covers && chown -R node:node /app /data
COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
