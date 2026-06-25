# Dockerfile for Ancore Indexer Service
FROM rust:1.74-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY services/indexer/Cargo.toml services/indexer/Cargo.lock* ./
COPY services/indexer/src ./src
COPY services/indexer/.cargo ./.cargo

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /app/target/release/ancore-indexer /usr/local/bin/ancore-indexer

# Copy migrations
COPY services/indexer/migrations ./migrations

# Expose ports
# 3000 = API server
# 9090 = Prometheus metrics
EXPOSE 3000 9090

# Run the indexer
CMD ["ancore-indexer"]
