FROM ghcr.io/muchobien/pocketbase:latest

RUN apk add --no-cache unzip python3

# Set default port if not provided
ENV PORT=8090

# Copy migrations and hooks into the container
COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks