import { createConfig, fallback, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { appChain } from "@/lib/chains";

const rpcUrls = (
  process.env.NEXT_PUBLIC_CELO_RPC_URLS ??
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  appChain.rpcUrls.default.http[0]
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const isBrowser = typeof window !== "undefined";

/** Injected covers MiniPay / MetaMask; WalletConnect when project id is set */
const connectors = [
  injected({ shimDisconnect: true }),
  ...(isBrowser && wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors,
  transports: {
    [appChain.id]: fallback(rpcUrls.map((url) => http(url))),
  },
  ssr: false,
});
