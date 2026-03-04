FROM ghcr.io/muchobien/pocketbase:latest

# Set default port if not provided
ENV PORT=8090

# Copy migrations and hooks into the container
COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks