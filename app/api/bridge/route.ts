import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY_WALLET = "E6hWHJc6J3zzAGDgg9xphZtpBveAqZ8eNMwmFDeJ6TK8";
const DEBRIDGE_API = "https://deswap.debridge.finance/v1.0/dln/order/create-tx";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      feeTxSignature,
      feeExpectedLamports,
      srcChainTokenInAmount,
      dstChainTokenOutRecipient,
      srcChainOrderAuthorityAddress,
      dstChainOrderAuthorityAddress,
    } = body;

    if (!feeTxSignature || !srcChainTokenInAmount || !dstChainTokenOutRecipient) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify fee tx on-chain
    const connection = new Connection(RPC_URL);
    const tx = await connection.getTransaction(feeTxSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json({ error: "Fee transaction not found" }, { status: 400 });
    }

    if (tx.meta?.err) {
      return NextResponse.json({ error: "Fee transaction failed on-chain" }, { status: 400 });
    }

    // Verify the fee went to treasury with correct amount
    const treasuryKey = new PublicKey(TREASURY_WALLET);
    const accountKeys = tx.transaction.message.getAccountKeys();
    let feeVerified = false;

    if (tx.meta?.preBalances && tx.meta?.postBalances) {
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys.get(i)?.equals(treasuryKey)) {
          const received = tx.meta.postBalances[i] - tx.meta.preBalances[i];
          if (received >= feeExpectedLamports) {
            feeVerified = true;
          }
          break;
        }
      }
    }

    if (!feeVerified) {
      return NextResponse.json(
        { error: "Fee verification failed: treasury did not receive expected amount" },
        { status: 400 }
      );
    }

    // Call deBridge
    const params = new URLSearchParams({
      srcChainId: "7565164",
      srcChainTokenIn: "11111111111111111111111111111111",
      srcChainTokenInAmount,
      dstChainId: "8453",
      dstChainTokenOut: "0x0000000000000000000000000000000000000000",
      dstChainTokenOutAmount: "auto",
      dstChainTokenOutRecipient,
      srcChainOrderAuthorityAddress,
      dstChainOrderAuthorityAddress,
      prependOperatingExpenses: "false",
    });

    const debridgeRes = await fetch(`${DEBRIDGE_API}?${params.toString()}`);
    if (!debridgeRes.ok) {
      const err = await debridgeRes.text();
      return NextResponse.json({ error: `deBridge API error: ${err}` }, { status: 502 });
    }

    const data = await debridgeRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Bridge API] Error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
