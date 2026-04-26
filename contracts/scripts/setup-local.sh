#!/bin/bash
# Setup local Stellar sandbox and fund deployer account
# Requires: stellar CLI v22.0.1+

set -e

NETWORK="local"
DEPLOYER_SECRET="${DEPLOYER_SECRET:-}" # Set this in your environment or pass as env var

if [ -z "$DEPLOYER_SECRET" ]; then
  echo "DEPLOYER_SECRET environment variable not set."
  exit 1
fi

# Start Stellar sandbox (if not running)
if ! pgrep -f "stellar serve" > /dev/null; then
  echo "Starting Stellar sandbox..."
  stellar serve --network $NETWORK &
  sleep 2
fi

# Fund deployer account
stellar keys fund --network $NETWORK --source $DEPLOYER_SECRET || true

echo "Local Stellar sandbox setup complete."
