"use client";

import { useCallback, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { erc20Abi } from "@/lib/erc20";
import { laneShiftGameAbi } from "@/lib/abi/laneShiftGame";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useGameStore } from "@/lib/gameStore";
import { parseStakeIdFromReceipt } from "@/lib/parseStake";
import type { Question } from "@/lib/types";

const CUSD = process.env.NEXT_PUBLIC_CUSD_TOKEN_ADDRESS as `0x${string}` | undefined;
const GAME = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;

export function StakePanel() {
  const { address, isConnected } = useAccount();
  const setQuestionBank = useGameStore((s) => s.setQuestionBank);
  const setStakeId = useGameStore((s) => s.setStakeId);
  const stakeId = useGameStore((s) => s.stakeId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const need = parseUnits("0.01", 18);

  const { data: allowance } = useReadContract({
    address: CUSD,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && GAME && CUSD ? [address, GAME] : undefined,
    query: { enabled: Boolean(address && CUSD && GAME) },
  });
  const { data: balance } = useReadContract({
    address: CUSD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && CUSD ? [address] : undefined,
    query: { enabled: Boolean(address && CUSD) },
  });

  const { writeContractAsync } = useWriteContract();

  const stake = useCallback(async () => {
    if (!address || !CUSD || !GAME) {
      setErr("Missing contract addresses in environment.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (!balance || balance < need) {
        throw new Error(
          `Insufficient cUSD balance. You need at least 0.01 cUSD, current: ${balance ? Number(formatUnits(balance, 18)).toFixed(4) : "0.0000"} cUSD.`,
        );
      }
      if (!allowance || allowance < need) {
        const approveHash = await writeContractAsync({
          address: CUSD,
          abi: erc20Abi,
          functionName: "approve",
          args: [GAME, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const hash = await writeContractAsync({
        address: GAME,
        abi: laneShiftGameAbi,
        functionName: "stakeAndPlay",
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      const id = parseStakeIdFromReceipt(receipt);
      if (id != null) {
        setStakeId(id);
      }
      const res = await fetch("/api/questions");
      const data = (await res.json()) as { questions?: unknown; error?: string };
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error(data.error || "Could not load questions");
      }
      setQuestionBank(data.questions as Question[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Stake failed");
    } finally {
      setBusy(false);
    }
  }, [address, allowance, balance, writeContractAsync, setQuestionBank, setStakeId, CUSD, GAME, need]);

  if (!isConnected) {
    return <p className="panel-hint">Connect a wallet (MiniPay or WalletConnect) to stake.</p>;
  }
  if (!CUSD || !GAME) {
    return (
      <p className="panel-hint">
        Configure NEXT_PUBLIC_CUSD_TOKEN_ADDRESS and NEXT_PUBLIC_GAME_CONTRACT_ADDRESS.
      </p>
    );
  }

  return (
    <div className="stake-panel">
      <p className="panel-hint">
        Entry fee: 0.01 cUSD
        {typeof balance === "bigint" ? ` · Balance: ${Number(formatUnits(balance, 18)).toFixed(4)} cUSD` : ""}
      </p>
      {stakeId != null ? (
        <p className="stake-ready">Staked — questions loaded. Press Start run in the game view.</p>
      ) : (
        <>
          <button
            type="button"
            className="game-btn-primary"
            onClick={() => void stake()}
            disabled={busy || !balance || balance < need}
          >
            {busy ? "Confirm in wallet…" : "Stake 0.01 cUSD to play"}
          </button>
          {err ? <p className="stake-err">{err}</p> : null}
        </>
      )}
    </div>
  );
}
