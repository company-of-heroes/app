# Pinned: `latest` can pull a new PocketBase on any build, whose system migrations slow the
# next start. Bump this on purpose.
FROM ghcr.io/muchobien/pocketbase:0.40.4

# python3 runs lib/fetch-insecure.py for the Relic proxy (relic-proxy.pb.js).
RUN apk add --no-cache python3

# Set default port if not provided
ENV PORT=8090

# Copy migrations and hooks into the container
COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks