FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1

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
