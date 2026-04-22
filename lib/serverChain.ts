import { createPublicClient, fallback, http } from "viem";
import { appChain } from "@/lib/chains";

export function getServerPublicClient() {
  const url =
    appChain.id === 42220
      ? process.env.CELO_RPC_URL
      : process.env.CELO_SEPOLIA_RPC_URL;
  const fallbackUrls = (process.env.CELO_RPC_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const urls = [url, ...fallbackUrls].filter(Boolean) as string[];
  if (urls.length < 1) {
    throw new Error("Set CELO_RPC_URL or CELO_SEPOLIA_RPC_URL for your chain");
  }
  return createPublicClient({
    chain: appChain,
    transport: fallback(urls.map((u) => http(u))),
  });
}
