import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY_WALLET = "E6hWHJc6J3zzAGDgg9xphZtpBveAqZ8eNMwmFDeJ6TK8";
const BRIDGE_API = "https://deswap.debridge.finance/v1.0/dln/order/create-tx";

type Direction = "solToBase" | "baseToSol";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const direction: Direction = body.direction === "baseToSol" ? "baseToSol" : "solToBase";

    const {
      feeTxSignature,
      feeExpectedLamports,
      srcChainTokenInAmount,
      dstChainTokenOutRecipient,
      srcChainOrderAuthorityAddress,
      dstChainOrderAuthorityAddress,
    } = body;

    if (!srcChainTokenInAmount || !dstChainTokenOutRecipient || !srcChainOrderAuthorityAddress || !dstChainOrderAuthorityAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fee verification only for SOL -> Base flow
    if (direction === "solToBase") {
      if (!feeTxSignature || !feeExpectedLamports) {
        return NextResponse.json({ error: "Missing fee verification fields" }, { status: 400 });
      }

      const connection = new Connection(RPC_URL);
      const tx = await connection.getTransaction(feeTxSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) return NextResponse.json({ error: "Fee transaction not found" }, { status: 400 });
      if (tx.meta?.err) return NextResponse.json({ error: "Fee transaction failed on-chain" }, { status: 400 });

      const treasuryKey = new PublicKey(TREASURY_WALLET);
      const accountKeys = tx.transaction.message.getAccountKeys();
      let feeVerified = false;

      if (tx.meta?.preBalances && tx.meta?.postBalances) {
        for (let i = 0; i < accountKeys.length; i++) {
          if (accountKeys.get(i)?.equals(treasuryKey)) {
            const received = tx.meta.postBalances[i] - tx.meta.preBalances[i];
            if (received >= Number(feeExpectedLamports)) feeVerified = true;
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
    }

    const params = new URLSearchParams(
      direction === "solToBase"
        ? {
            srcChainId: "7565164", // Solana
            srcChainTokenIn: "11111111111111111111111111111111", // SOL
            srcChainTokenInAmount: String(srcChainTokenInAmount),
            dstChainId: "8453", // Base
            dstChainTokenOut: "0x0000000000000000000000000000000000000000", // ETH
            dstChainTokenOutAmount: "auto",
            dstChainTokenOutRecipient: String(dstChainTokenOutRecipient),
            srcChainOrderAuthorityAddress: String(srcChainOrderAuthorityAddress),
            dstChainOrderAuthorityAddress: String(dstChainOrderAuthorityAddress),
            prependOperatingExpenses: "false",
          }
        : {
            srcChainId: "8453", // Base
            srcChainTokenIn: "0x0000000000000000000000000000000000000000", // ETH
            srcChainTokenInAmount: String(srcChainTokenInAmount),
            dstChainId: "7565164", // Solana
            dstChainTokenOut: "11111111111111111111111111111111", // SOL
            dstChainTokenOutAmount: "auto",
            dstChainTokenOutRecipient: String(dstChainTokenOutRecipient),
            srcChainOrderAuthorityAddress: String(srcChainOrderAuthorityAddress),
            dstChainOrderAuthorityAddress: String(dstChainOrderAuthorityAddress),
            prependOperatingExpenses: "false",
          }
    );

    const providerRes = await fetch(`${BRIDGE_API}?${params.toString()}`);
    if (!providerRes.ok) {
      const err = await providerRes.text();
      return NextResponse.json({ error: `Bridge provider API error: ${err}` }, { status: 502 });
    }

    const data = await providerRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Bridge API] Error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
