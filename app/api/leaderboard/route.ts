import { NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { getServerPublicClient } from "@/lib/serverChain";
import { laneShiftGameAbi } from "@/lib/abi/laneShiftGame";

type Period = "day" | "week";

function periodSeconds(p: Period): number {
  return p === "day" ? 86400 : 86400 * 7;
}

/** Approximate Celo block time ~5s */
function blocksForSeconds(seconds: number): bigint {
  return BigInt(Math.ceil(seconds / 5));
}

export async function GET(request: Request) {
  const contract = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
  if (!contract) {
    return NextResponse.json({ error: "NEXT_PUBLIC_GAME_CONTRACT_ADDRESS not set", rows: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") as Period) || "week";
  if (period !== "day" && period !== "week") {
    return NextResponse.json({ error: "period must be day or week" }, { status: 400 });
  }

  try {
    const client = getServerPublicClient();
    const latest = await client.getBlockNumber();
    const fromBlock = latest > blocksForSeconds(periodSeconds(period)) ? latest - blocksForSeconds(periodSeconds(period)) : 0n;

    const logs = await client.getLogs({
      address: contract,
      fromBlock,
      toBlock: latest,
    });

    const totals = new Map<string, bigint>();
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: laneShiftGameAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== "WinnerPaid") {
          continue;
        }
        const player = decoded.args.player as `0x${string}`;
        const amount = decoded.args.amount as bigint;
        totals.set(player, (totals.get(player) ?? 0n) + amount);
      } catch {
        /* not our event */
      }
    }

    const rows = [...totals.entries()]
      .map(([address, wei]) => ({
        address,
        earningsWei: wei.toString(),
        earningsCusd: Number(wei) / 1e18,
      }))
      .sort((a, b) => b.earningsCusd - a.earningsCusd)
      .slice(0, 50);

    return NextResponse.json({ period, rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to read chain", rows: [] }, { status: 500 });
  }
}
