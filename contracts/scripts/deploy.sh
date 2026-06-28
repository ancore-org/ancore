#!/bin/bash
# Deploy Soroban contract to testnet and output contract ID
# Requires: stellar CLI v22.0.1+

set -e

WASM_FILE="$1"
NETWORK="testnet"
DEPLOYER_SECRET="${DEPLOYER_SECRET:-}" # Set this in your environment or pass as env var
OUTPUT_FILE="contract-deployment.json"

if [ -z "$DEPLOYER_SECRET" ]; then
  echo "DEPLOYER_SECRET environment variable not set."
  exit 1
fi

# Fund deployer account if needed (Stellar testnet)
stellar keys fund --network $NETWORK --source $DEPLOYER_SECRET || true

# Deploy contract
CONTRACT_ID=$(stellar contract deploy --network $NETWORK --source $DEPLOYER_SECRET --wasm $WASM_FILE | grep 'Contract ID:' | awk '{print $NF}')

if [ -z "$CONTRACT_ID" ]; then
  echo "Contract deployment failed."
  exit 1
fi

# Output contract ID to JSON file
cat <<EOF > $OUTPUT_FILE
{
  "network": "$NETWORK",
  "contract_id": "$CONTRACT_ID"
}
EOF

echo "Contract deployed to $NETWORK with ID: $CONTRACT_ID"
echo "Deployment info written to $OUTPUT_FILE"
