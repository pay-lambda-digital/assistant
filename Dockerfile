# syntax=docker/dockerfile:1
#
# node:20-slim (Debian glibc), not -alpine like the other services here — the local
# embedding model (@huggingface/transformers -> onnxruntime-node) ships prebuilt native
# bindings for glibc, not musl.
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json .npmrc ./
RUN --mount=type=secret,id=entities_read_token \
    ls -la /run/secrets/ && (wc -c < /run/secrets/entities_read_token || echo "FILE MISSING") && \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/entities_read_token)" >> .npmrc && \
    npm ci && \
    rm -f .npmrc

COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app

COPY package*.json .npmrc ./
RUN --mount=type=secret,id=entities_read_token \
    ls -la /run/secrets/ && (wc -c < /run/secrets/entities_read_token || echo "FILE MISSING") && \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/entities_read_token)" >> .npmrc && \
    npm ci --omit=dev && \
    rm -f .npmrc

COPY --from=builder /app/dist ./dist
# content/kb/*.md are read from disk at runtime by ingest.ts, not compiled — copy separately.
COPY content/kb ./content/kb

# Pre-warm the local embedding model into the image at build time, so a cold container
# start doesn't depend on reaching Hugging Face's CDN at runtime.
RUN node -e "require('@huggingface/transformers').pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2').then(() => process.exit(0))"

USER node
# Re-ingest content/ on every start, so a redeploy always reflects whatever's in the
# image's content/ at build time (see "Content maintenance" in ASSISTANT_PLAN.md) before
# serving traffic.
CMD ["sh", "-c", "node dist/src/ingest.js && node dist/src/index.js"]
