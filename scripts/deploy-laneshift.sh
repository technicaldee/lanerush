#!/usr/bin/env bash
# Deploy LaneShiftGame with Foundry (install: curl -L https://foundry.paradigm.xyz | bash)
set -euo pipefail
: "${CELO_SEPOLIA_RPC_URL:?}"
: "${DEPLOYER_PRIVATE_KEY:?}"
: "${NEXT_PUBLIC_CUSD_TOKEN_ADDRESS:?}"
: "${NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS:?}"

forge build
forge create contracts/LaneShiftGame.sol:LaneShiftGame \
  --rpc-url "$CELO_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$NEXT_PUBLIC_CUSD_TOKEN_ADDRESS" "$NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS"

echo "Set NEXT_PUBLIC_GAME_CONTRACT_ADDRESS to the deployed address."
echo "Send cUSD and CELO to the contract so it can pay winners in both currencies; sweep losses with sweepToPlatform()."
