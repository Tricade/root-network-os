FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9

LABEL org.opencontainers.image.title="ROOT · Network OS" \
      org.opencontainers.image.description="Local infrastructure simulation with a walkable underground data center" \
      org.opencontainers.image.source="https://github.com/Tricade/root-network-os" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NODE_ENV=production ROOT_HOST=0.0.0.0 ROOT_PORT=18473 ROOT_DATA_DIR=/data

# Only runtime files: no npm installation, personal saves, Git history or build tools.
COPY *.js *.css index.html favicon.svg package.json server.cjs LICENSE NOTICE.md AI-DISCLOSURE.md ./
COPY server/ ./server/
COPY engine/ ./engine/
COPY ui/ ./ui/
COPY room/ ./room/
COPY locales/ ./locales/
COPY vendor/ ./vendor/
COPY asset-pack/assets/ ./asset-pack/assets/
COPY asset-pack/textures/ ./asset-pack/textures/
COPY asset-pack/LICENSE.md ./asset-pack/LICENSE.md
COPY asset-pack/docs/ ./asset-pack/docs/
COPY docker/healthcheck.cjs ./docker/healthcheck.cjs

RUN mkdir /data && chown node:node /data
USER node
EXPOSE 18473
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD ["node", "docker/healthcheck.cjs"]
CMD ["node", "server.cjs"]
