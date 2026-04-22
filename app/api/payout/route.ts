import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { appChain } from "@/lib/chains";
import { laneShiftGameAbi } from "@/lib/abi/laneShiftGame";

/**
 * Owner key sends on-chain payout. Verifies stake belongs to claimed player and is unpaid.
 * Game outcome is client-trusted; a production deployment should gate this with signed
 * server sessions or an on-chain game oracle.
 */
export async function POST(request: Request) {
  const key = process.env.DEPLOYER_PRIVATE_KEY?.replace(/^0x/, "");
  const contract = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
  const rpc =
    appChain.id === 42220 ? process.env.CELO_RPC_URL : process.env.CELO_SEPOLIA_RPC_URL;

  if (!key || !contract || !rpc) {
    return NextResponse.json({ error: "Server not configured for payout" }, { status: 503 });
  }

  let body: { stakeId?: string; playerAddress?: `0x${string}` };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stakeId = body.stakeId;
  if (stakeId === undefined || stakeId === "") {
    return NextResponse.json({ error: "stakeId required" }, { status: 400 });
  }
  if (!body.playerAddress) {
    return NextResponse.json({ error: "playerAddress required" }, { status: 400 });
  }

  let id: bigint;
  try {
    id = BigInt(stakeId);
  } catch {
    return NextResponse.json({ error: "invalid stakeId" }, { status: 400 });
  }

  const publicClient = createPublicClient({
    chain: appChain,
    transport: http(rpc),
  });

  try {
    const staker = await publicClient.readContract({
      address: contract,
      abi: laneShiftGameAbi,
      functionName: "stakePlayer",
      args: [id],
    });
    if (staker.toLowerCase() !== body.playerAddress.toLowerCase()) {
      return NextResponse.json({ error: "stake does not belong to player" }, { status: 403 });
    }

    const paid = await publicClient.readContract({
      address: contract,
      abi: laneShiftGameAbi,
      functionName: "paidOut",
      args: [id],
    });
    if (paid) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const account = privateKeyToAccount(`0x${key}` as `0x${string}`);
    const wallet = createWalletClient({
      account,
      chain: appChain,
      transport: http(rpc),
    });

    const hash = await wallet.writeContract({
      address: contract,
      abi: laneShiftGameAbi,
      functionName: "payoutWinner",
      args: [id],
    });

    return NextResponse.json({ ok: true, hash });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "payout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
