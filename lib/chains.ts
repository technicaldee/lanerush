import { celo, celoSepolia } from "viem/chains";
import type { Chain } from "viem";

const id = Number(process.env.NEXT_PUBLIC_CELO_CHAIN_ID || celoSepolia.id);

export function getAppChain(): Chain {
  if (id === celo.id) {
    return celo;
  }
  if (id === celoSepolia.id) {
    return celoSepolia;
  }
  return celoSepolia;
}

export const appChain = getAppChain();
