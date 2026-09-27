FROM node:22-alpine
WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R node:node /app
COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
