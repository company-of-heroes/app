FROM ghcr.io/muchobien/pocketbase:latest

# python3 runs lib/fetch-insecure.py for the Relic proxy (relic-proxy.pb.js).
RUN apk add --no-cache python3

# Set default port if not provided
ENV PORT=8090

# Copy migrations and hooks into the container
COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks