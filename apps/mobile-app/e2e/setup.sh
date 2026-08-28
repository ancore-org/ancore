#!/bin/bash
# Setup script for local Maestro e2e testing
# Run this before `maestro test` to ensure dependencies are available

set -e

echo "🔧 Setting up Maestro e2e environment..."

# Check maestro CLI
if ! command -v maestro &> /dev/null; then
    echo "❌ maestro CLI not found. Install from: https://maestro.mobile/"
    exit 1
fi

echo "✓ maestro CLI found ($(maestro version))"

# Check for iOS simulator or Android emulator
if command -v xcrun &> /dev/null; then
    echo "✓ Xcode tools available (iOS simulator support)"
fi

if command -v emulator &> /dev/null; then
    echo "✓ Android emulator found"
fi

# Copy env file if not present
if [ ! -f ".env.local.test" ]; then
    echo "📝 Creating test environment file..."
    cp e2e/common/env.yaml .env.local.test
fi

echo ""
echo "✅ Environment ready"
echo ""
echo "To run flows locally:"
echo "  maestro test e2e/flows/create-wallet.yaml --env-file e2e/common/env.yaml"
echo "  maestro test e2e/flows/lock-unlock.yaml --env-file e2e/common/env.yaml"
echo ""
