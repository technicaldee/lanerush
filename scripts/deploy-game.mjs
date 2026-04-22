/**
 * Compile LaneShiftGame.sol with solc and deploy via viem (Celo mainnet / Sepolia from env).
 * Usage: node --env-file=.env scripts/deploy-game.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import solc from "solc";
import { createWalletClient, http, publicActions } from "viem";
import { celo, celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const source = fs.readFileSync(path.join(root, "contracts", "LaneShiftGame.sol"), "utf8");

const input = {
  language: "Solidity",
  sources: {
    "LaneShiftGame.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors?.some((e) => e.severity === "error")) {
  console.error(output.errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}

const compiled = output.contracts["LaneShiftGame.sol"]["LaneShiftGame"];
const abi = compiled.abi;
const bytecode = `0x${compiled.evm.bytecode.object}`;

const pk = process.env.DEPLOYER_PRIVATE_KEY?.replace(/^0x/, "");
const chainId = Number(process.env.NEXT_PUBLIC_CELO_CHAIN_ID || 42220);
const cusd = process.env.NEXT_PUBLIC_CUSD_TOKEN_ADDRESS;
const platform = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS;
const rpc =
  chainId === 42220
    ? process.env.CELO_RPC_URL
    : process.env.CELO_SEPOLIA_RPC_URL;

if (!pk || !cusd || !platform || !rpc) {
  console.error("Missing DEPLOYER_PRIVATE_KEY, token/platform addresses, or RPC for chain.");
  process.exit(1);
}

const chain = chainId === 42220 ? celo : celoSepolia;
const account = privateKeyToAccount(`0x${pk}`);

const wallet = createWalletClient({
  account,
  chain,
  transport: http(rpc),
}).extend(publicActions);

console.log("Deploying from", account.address, "to", chain.name);

const hash = await wallet.deployContract({
  abi,
  bytecode,
  args: [cusd, platform],
});

const receipt = await wallet.waitForTransactionReceipt({ hash });
const address = receipt.contractAddress;

if (!address) {
  console.error("No contract address in receipt", receipt);
  process.exit(1);
}

console.log("Deployed LaneShiftGame:", address);
console.log("");
console.log("Add to .env:");
console.log(`NEXT_PUBLIC_GAME_CONTRACT_ADDRESS=${address}`);
console.log("");
console.log("Fund this contract with cUSD so it can pay 0.02 cUSD winners.");
console.log("Sweep stakes to platform with sweepToPlatform() when needed.");
