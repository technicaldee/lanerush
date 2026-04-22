"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useBalance, useConnect, useReadContract, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { waitForTransactionReceipt } from "wagmi/actions";
import { ArcadeRunnerGame } from "@/components/ArcadeRunnerGame";
import { Leaderboard } from "@/components/Leaderboard";
import { erc20Abi } from "@/lib/erc20";
import { laneShiftGameAbi } from "@/lib/abi/laneShiftGame";
import { useGameStore } from "@/lib/gameStore";
import { wagmiConfig } from "@/lib/wagmi-config";
import { parseStakeIdFromReceipt } from "@/lib/parseStake";
import type { Question } from "@/lib/types";

const CUSD = process.env.NEXT_PUBLIC_CUSD_TOKEN_ADDRESS as `0x${string}` | undefined;
const GAME = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
const STAKE_CUSD = parseUnits("0.01", 18);
const STAKE_CELO = parseUnits("0.11998", 18);

function truncateAddress(address?: string) {
  if (!address) {
    return "Not connected";
  }
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

export function HomePage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const setQuestionBank = useGameStore((state) => state.setQuestionBank);
  const setStakeId = useGameStore((state) => state.setStakeId);
  const startGame = useGameStore((state) => state.startGame);
  const status = useGameStore((state) => state.status);

  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [toast, setToast] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [currency, setCurrency] = useState<"cUSD" | "CELO">("cUSD");
  const [assetsReady, setAssetsReady] = useState(false);

  const preferredConnector = useMemo(
    () => connectors.find((connector) => connector.id === "injected") ?? connectors[0],
    [connectors],
  );
  const { data: balance } = useReadContract({
    address: CUSD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && CUSD ? [address] : undefined,
    query: { enabled: Boolean(address && CUSD) },
  });
  const { data: allowance } = useReadContract({
    address: CUSD,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && CUSD && GAME ? [address, GAME] : undefined,
    query: { enabled: Boolean(address && CUSD && GAME) },
  });
  const { data: celoBalance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    const eth = (
      typeof window !== "undefined"
        ? (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum
        : undefined
    );
    if (eth?.isMiniPay) {
      connect({ connector: injected() });
    }
  }, [connect]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const warmup = async () => {
      try {
        await Promise.all([
          fetch("/run.glb", { cache: "force-cache" }),
          fetch("/logo.png", { cache: "force-cache" }),
        ]);
      } finally {
        if (!cancelled) {
          setAssetsReady(true);
        }
      }
    };
    void warmup();
    return () => {
      cancelled = true;
    };
  }, []);

  const balanceLabel = useMemo(() => {
    if (currency === "cUSD") {
      return typeof balance === "bigint" ? `${Number(formatUnits(balance, 18)).toFixed(4)} cUSD` : "-- cUSD";
    }
    return celoBalance?.value ? `${Number(formatUnits(celoBalance.value, 18)).toFixed(4)} CELO` : "-- CELO";
  }, [balance, celoBalance?.value, currency]);

  const onPrimaryAction = async () => {
    if (isStarting) {
      return;
    }
    if (!isConnected && preferredConnector) {
      connect({ connector: preferredConnector });
      return;
    }
    if (!address || !CUSD || !GAME) {
      setToast({ kind: "error", message: "Missing contract setup." });
      return;
    }
    if (!assetsReady) {
      setToast({ kind: "error", message: "Preparing game assets... tap Start again in a moment." });
      return;
    }

    setIsStarting(true);
    setToast(null);
    try {
      let stakeHash: `0x${string}`;
      if (currency === "cUSD") {
        if (!balance || balance < STAKE_CUSD) {
          throw new Error("Insufficient balance for 0.01 cUSD stake.");
        }
        if (!allowance || allowance < STAKE_CUSD) {
          const approveHash = await writeContractAsync({
            address: CUSD,
            abi: erc20Abi,
            functionName: "approve",
            args: [GAME, maxUint256],
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }
        stakeHash = await writeContractAsync({
          address: GAME,
          abi: laneShiftGameAbi,
          functionName: "stakeAndPlay",
        });
      } else {
        if (!celoBalance?.value || celoBalance.value < STAKE_CELO) {
          throw new Error("Insufficient CELO balance for 0.11998 CELO stake.");
        }
        stakeHash = await writeContractAsync({
          address: GAME,
          abi: laneShiftGameAbi,
          functionName: "stakeAndPlayCELO",
          value: STAKE_CELO,
        });
      }
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: stakeHash });
      const id = parseStakeIdFromReceipt(receipt);
      if (id == null) {
        throw new Error("Stake confirmed, but no round id found.");
      }
      setStakeId(id);

      const response = await fetch("/api/questions");
      const payload = (await response.json()) as { questions?: unknown; error?: string };
      if (!payload.questions || !Array.isArray(payload.questions)) {
        throw new Error(payload.error || "Could not load questions.");
      }
      setQuestionBank(payload.questions as Question[]);

      startGame();
      setToast({ kind: "success", message: "Round started. Good luck." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start round.";
      setToast({ kind: "error", message });
    } finally {
      setIsStarting(false);
    }
  };

  const isGameScreen = status !== "idle";

  return (
    <div className="home-shell">
      {isGameScreen ? (
        <section className="home-game-screen">
          <ArcadeRunnerGame />
        </section>
      ) : (
        <main className="home-first-screen">
          <div className="home-first-screen__top">
            <div className="home-balance-chip">
              <span className="home-balance-chip__label">Balance</span>
              <span className="home-balance-chip__value">{balanceLabel}</span>
            </div>
            <div className="home-wallet-chip" title={address}>
              {truncateAddress(address)}
            </div>
          </div>

          <div className="home-first-screen__actions">
            <button
              type="button"
              className="home-icon-btn"
              onClick={() => setShowLeaderboard(true)}
              aria-label="Open leaderboard"
            >
              <span aria-hidden>🏆</span>
            </button>
            <button type="button" className="home-icon-btn" onClick={() => setShowHelp(true)} aria-label="How to play">
              <span aria-hidden>?</span>
            </button>
          </div>

          <div className="home-hero">
            <Image src="/logo.png" alt="Lane Rush logo" width={180} height={180} className="home-hero__logo" priority />
            <h1 className="home-hero__title">Lane Rush</h1>
            <div className="home-currency-switch" role="tablist" aria-label="Stake currency">
              <button
                type="button"
                role="tab"
                aria-selected={currency === "cUSD"}
                className={`home-currency-switch__tab ${currency === "cUSD" ? "is-active" : ""}`}
                onClick={() => setCurrency("cUSD")}
              >
                cUSD
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currency === "CELO"}
                className={`home-currency-switch__tab ${currency === "CELO" ? "is-active" : ""}`}
                onClick={() => setCurrency("CELO")}
              >
                CELO
              </button>
            </div>
            <button
              type="button"
              className="game-btn-primary home-hero__cta"
              onClick={() => void onPrimaryAction()}
              disabled={isStarting || !assetsReady}
            >
              {!assetsReady ? "Loading..." : !isConnected ? "Connect Wallet" : isStarting ? "Starting..." : "Start"}
            </button>
            <p className="home-hero__stake-note">
              {currency === "cUSD"
                ? "Round costs 0.01 cUSD. Win to double your stake."
                : "Round costs 0.11998 CELO. Win to double your stake."}
            </p>
          </div>
        </main>
      )}

      {showHelp ? (
        <div className="home-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="home-modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>How to play</h3>
            <p>Tap Start to pay 0.01 cUSD and begin.</p>
            <p>Swipe left/right to switch lanes, swipe up to jump.</p>
            <p>Choose the correct gate to survive and win.</p>
            <button type="button" className="game-btn-ghost" onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showLeaderboard ? (
        <div className="home-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="home-modal-card home-modal-card--leaderboard" onClick={(event) => event.stopPropagation()}>
            <Leaderboard />
            <button type="button" className="game-btn-ghost" onClick={() => setShowLeaderboard(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`home-toast home-toast--${toast.kind}`} role="status" aria-live="polite">
          <span className="home-toast__icon" aria-hidden>
            {toast.kind === "error" ? "!" : "★"}
          </span>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
