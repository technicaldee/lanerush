import { decodeEventLog, type TransactionReceipt } from "viem";
import { laneShiftGameAbi } from "@/lib/abi/laneShiftGame";

export function parseStakeIdFromReceipt(receipt: TransactionReceipt): bigint | null {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: laneShiftGameAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Staked") {
        return decoded.args.stakeId as bigint;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
