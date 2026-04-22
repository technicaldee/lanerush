"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet-bar">
        <span className="wallet-bar__chain">{chain?.name ?? "Celo"}</span>
        <span className="wallet-bar__addr" title={address}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button type="button" className="wallet-bar__disconnect" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect-group">
      {connectors.map((c) => (
        <button
          key={c.id}
          type="button"
          className="game-btn-primary wallet-connect-group__btn"
          disabled={isPending}
          onClick={() => connect({ connector: c })}
        >
          {isPending ? "…" : c.name}
        </button>
      ))}
    </div>
  );
}
