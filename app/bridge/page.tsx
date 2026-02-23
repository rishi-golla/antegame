"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  Connection,
} from "@solana/web3.js";
import Link from "next/link";

const TREASURY_WALLET = new PublicKey("E6hWHJc6J3zzAGDgg9xphZtpBveAqZ8eNMwmFDeJ6TK8");
const FEE_PERCENT = 1;
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

type BridgeStatus = "idle" | "awaiting_fee" | "confirming_fee" | "verifying_fee" | "awaiting_bridge" | "confirming_bridge" | "polling" | "complete" | "error";

function getPhantom(): any {
  if (typeof window === "undefined") return null;
  return (window as any).solana ?? (window as any).phantom?.solana ?? null;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

async function pollBridgeStatus(orderId: string): Promise<string> {
  const pollMs = 15_000;
  const maxAttempts = 80;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/bridge/status?orderId=${orderId}`);
    if (res.ok) {
      const data = await res.json();
      const st = data?.status ?? data;
      if (["Fulfilled", "SentUnlock", "ClaimedUnlock"].includes(st)) return st;
      if (["OrderCancelled", "ClaimedOrderCancel", "SentOrderCancel"].includes(st)) {
        throw new Error(`Bridge order cancelled: ${st}`);
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error("Bridge order timed out");
}

export default function BridgePage() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [bridgeOrderId, setBridgeOrderId] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [estimatedEth, setEstimatedEth] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connected = !!publicKey;
  const connection = new Connection(RPC_URL);

  // Check if Phantom already connected
  useEffect(() => {
    const phantom = getPhantom();
    if (phantom?.isConnected && phantom?.publicKey) {
      setPublicKey(new PublicKey(phantom.publicKey.toString()));
    }
  }, []);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey) { setSolBalance(null); return; }
    const fetch_ = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setSolBalance(bal / LAMPORTS_PER_SOL);
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch estimated ETH
  useEffect(() => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) { setEstimatedEth(null); return; }
    const fee = numAmount * (FEE_PERCENT / 100);
    const bridge = numAmount - fee;
    const lamports = Math.floor(bridge * LAMPORTS_PER_SOL);
    if (lamports <= 0) { setEstimatedEth(null); return; }
    setQuoteLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const url = `https://deswap.debridge.finance/v1.0/dln/order/quote?srcChainId=7565164&srcChainTokenIn=11111111111111111111111111111111&srcChainTokenInAmount=${lamports}&dstChainId=8453&dstChainTokenOut=0x0000000000000000000000000000000000000000&prependOperatingExpenses=true`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const out = data?.estimation?.dstChainTokenOut?.amount;
          if (out) setEstimatedEth((Number(out) / 1e18).toFixed(6));
          else setEstimatedEth(null);
        } else setEstimatedEth(null);
      } catch { if (!controller.signal.aborted) setEstimatedEth(null); }
      finally { setQuoteLoading(false); }
    }, 500);
    return () => { clearTimeout(timeout); controller.abort(); setQuoteLoading(false); };
  }, [amount]);

  // Auto-populate EVM destination
  useEffect(() => {
    try {
      const wagmi = require("wagmi");
      // Can't call hooks here, check window ethereum
      const eth = (window as any).ethereum;
      if (eth?.selectedAddress) setDestinationAddress(eth.selectedAddress);
    } catch {}
  }, []);

  const feeAmount = amount ? Number(amount) * (FEE_PERCENT / 100) : 0;
  const bridgeAmount = amount ? Number(amount) - feeAmount : 0;
  const isValidAmount = Number(amount) > 0 && (solBalance === null || Number(amount) <= solBalance);
  const isValidDestination = /^0x[a-fA-F0-9]{40}$/.test(destinationAddress);
  const canBridge = connected && isValidAmount && isValidDestination && status === "idle";

  const handleConnect = async () => {
    const phantom = getPhantom();
    if (!phantom) { window.open("https://phantom.app/", "_blank"); return; }
    setConnecting(true);
    try {
      const resp = await phantom.connect();
      setPublicKey(new PublicKey(resp.publicKey.toString()));
    } catch (e: any) {
      if (!e?.message?.includes("rejected")) console.warn("[Bridge] connect:", e);
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    const phantom = getPhantom();
    if (phantom) await phantom.disconnect();
    setPublicKey(null);
  };

  const handleBridge = useCallback(async () => {
    const phantom = getPhantom();
    if (!publicKey || !phantom) return;
    setErrorMsg(""); setBridgeOrderId(null);

    try {
      // Step 1: Fee tx
      setStatus("awaiting_fee");
      setStatusMsg("Sign the fee transaction in your wallet...");
      const feeLamports = Math.floor(feeAmount * LAMPORTS_PER_SOL);
      const feeTx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: TREASURY_WALLET, lamports: feeLamports })
      );
      feeTx.feePayer = publicKey;
      feeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signedFee = await phantom.signAndSendTransaction(feeTx);
      const feeSig = signedFee.signature;

      setStatus("confirming_fee");
      setStatusMsg(`Fee tx sent (${feeSig.slice(0, 8)}...). Confirming...`);
      await connection.confirmTransaction(feeSig, "confirmed");

      // Step 2: Get bridge tx from API
      setStatus("verifying_fee");
      setStatusMsg("Fee confirmed. Building bridge transaction...");
      const bridgeLamports = Math.floor(bridgeAmount * LAMPORTS_PER_SOL);
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeTxSignature: feeSig,
          feeExpectedLamports: feeLamports,
          srcChainTokenInAmount: String(bridgeLamports),
          dstChainTokenOutRecipient: destinationAddress,
          srcChainOrderAuthorityAddress: publicKey.toBase58(),
          dstChainOrderAuthorityAddress: destinationAddress,
        }),
      });
      if (!res.ok) throw new Error(`Bridge API failed: ${await res.text()}`);
      const data = await res.json();
      const orderId = data.orderId;
      setBridgeOrderId(orderId);
      if (!data.tx?.data) throw new Error("deBridge returned no transaction data");

      // Step 3: Sign and send bridge tx
      setStatus("awaiting_bridge");
      setStatusMsg("Sign the bridge transaction in your wallet...");
      const txBytes = hexToBytes(data.tx.data);
      const vtx = VersionedTransaction.deserialize(txBytes);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      vtx.message.recentBlockhash = blockhash;
      const signed = await phantom.signTransaction(vtx);

      setStatus("confirming_bridge");
      setStatusMsg("Bridge tx sent. Confirming on Solana...");
      const bridgeSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 5 });
      await connection.confirmTransaction({ signature: bridgeSig, blockhash, lastValidBlockHeight }, "confirmed");

      // Step 4: Poll
      setStatus("polling");
      setStatusMsg("Bridge submitted! Waiting for ETH to arrive on Base...");
      await pollBridgeStatus(orderId);
      setStatus("complete");
      setStatusMsg(`Bridge complete! ${bridgeAmount.toFixed(4)} SOL sent as ETH to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)} on Base.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bridge failed";
      if (msg.includes("User rejected") || msg.includes("user rejected")) { reset(); return; }
      console.error("[Bridge] Error:", err);
      setStatus("error");
      setErrorMsg(msg);
      setStatusMsg("");
    }
  }, [publicKey, amount, destinationAddress, feeAmount, bridgeAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setStatus("idle"); setStatusMsg(""); setErrorMsg(""); setBridgeOrderId(null); };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>BRIDGE TO BASE</h1>
        <p style={s.subtitle}>Bridge SOL to ETH and jump into a game</p>

        <div style={s.walletRow}>
          {connected && publicKey ? (
            <button onClick={handleDisconnect} style={s.connectedBtn}>
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)} ✓
            </button>
          ) : (
            <button onClick={handleConnect} disabled={connecting} style={{ ...s.connectBtn, opacity: connecting ? 0.6 : 1 }}>
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        <div style={s.section}>
          <div style={s.labelRow}>
            <span style={s.label}>You send (SOL)</span>
            {solBalance !== null && (
              <button style={s.balBtn} onClick={() => setAmount(Math.max(0, solBalance - 0.01).toFixed(4))}>
                Balance: {solBalance.toFixed(4)} SOL
              </button>
            )}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            style={s.input} placeholder="0.0" min="0.01" step="0.1" disabled={status !== "idle"} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
          <div style={s.arrow}>↓</div>
        </div>

        <div style={s.section}>
          <span style={s.label}>Destination (Base address)</span>
          <input type="text" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)}
            style={s.inputMono} placeholder="0x..." disabled={status !== "idle"} />
          {destinationAddress && !isValidDestination && <p style={s.validErr}>Enter a valid Base (EVM) address</p>}
        </div>

        {Number(amount) > 0 && (
          <div style={s.feeBox}>
            <div style={s.feeRow}><span>Bridge amount</span><span>{bridgeAmount.toFixed(4)} SOL</span></div>
            <div style={s.feeRow}><span>Fee ({FEE_PERCENT}%)</span><span>{feeAmount.toFixed(4)} SOL</span></div>
            <div style={s.feeDivider} />
            <div style={s.feeRowBold}><span>You receive (est.)</span><span>{quoteLoading ? "..." : estimatedEth ? `${estimatedEth} ETH` : "--"}</span></div>
            <p style={s.feeNote}>Fee is non-refundable once signed. You will sign two transactions: fee, then bridge.</p>
          </div>
        )}

        {status === "idle" && (
          <button onClick={canBridge ? handleBridge : undefined}
            style={{ ...s.btn, ...(canBridge ? {} : s.btnDisabled) }} disabled={!canBridge}>
            {!connected ? "CONNECT WALLET" : "BRIDGE TO BASE"}
          </button>
        )}

        {statusMsg && (
          <div style={s.statusRow}>
            {!["complete", "error"].includes(status) && <div style={s.spinner} />}
            {status === "complete" && <span style={{ color: "#4ade80" }}>✓</span>}
            <span style={{ fontSize: 12 }}>{statusMsg}</span>
          </div>
        )}

        {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

        {(status === "complete" || status === "error") && (
          <button onClick={reset} style={s.btnSecondary}>
            {status === "error" ? "Try Again" : "Bridge Again"}
          </button>
        )}

        {status === "complete" && (
          <div style={{ textAlign: "center" as const, marginTop: 16 }}>
            <Link href="/" style={s.homeLink}>← Play Now</Link>
          </div>
        )}

        {bridgeOrderId && <p style={s.orderId}>Order: {bridgeOrderId.slice(0, 16)}...</p>}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: 16 } as React.CSSProperties,
  card: { background: "#1a1a2e", border: "2px solid #d4a843", borderRadius: 16, padding: 32, maxWidth: 460, width: "100%" } as React.CSSProperties,
  title: { fontFamily: "'Press Start 2P', monospace", color: "#d4a843", fontSize: 18, textAlign: "center" as const, margin: 0, marginBottom: 8 } as React.CSSProperties,
  subtitle: { color: "#aaa", fontSize: 12, textAlign: "center" as const, marginBottom: 24, fontFamily: "'Press Start 2P', monospace" } as React.CSSProperties,
  walletRow: { display: "flex", justifyContent: "center", marginBottom: 20 } as React.CSSProperties,
  connectBtn: { background: "linear-gradient(135deg, #9945FF, #7B3FE4)", border: "none", borderRadius: 8, padding: "12px 24px", color: "#fff", fontFamily: "'Press Start 2P', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 } as React.CSSProperties,
  connectedBtn: { background: "#111", border: "1px solid #d4a843", borderRadius: 8, padding: "10px 20px", color: "#d4a843", fontFamily: "'Press Start 2P', monospace", fontSize: 11, cursor: "pointer" } as React.CSSProperties,
  section: { marginBottom: 16 } as React.CSSProperties,
  labelRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } as React.CSSProperties,
  label: { color: "#888", fontSize: 11, marginBottom: 6, display: "block" } as React.CSSProperties,
  input: { width: "100%", background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
  inputMono: { width: "100%", background: "#111", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
  arrow: { width: 32, height: 32, borderRadius: "50%", background: "#111", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", color: "#d4a843", fontSize: 16 } as React.CSSProperties,
  feeBox: { background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 12, marginBottom: 8 } as React.CSSProperties,
  feeRow: { display: "flex", justifyContent: "space-between", color: "#888", fontSize: 11, marginBottom: 4 } as React.CSSProperties,
  feeDivider: { borderTop: "1px solid #333", margin: "6px 0" } as React.CSSProperties,
  feeRowBold: { display: "flex", justifyContent: "space-between", color: "#eee", fontSize: 12, fontWeight: 600 } as React.CSSProperties,
  feeNote: { color: "#555", fontSize: 9, marginTop: 6 } as React.CSSProperties,
  btn: { width: "100%", padding: "14px 0", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #d4a843, #b8942e)", color: "#000", fontSize: 14, fontWeight: 700, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", marginTop: 20 } as React.CSSProperties,
  btnDisabled: { opacity: 0.35, cursor: "not-allowed" } as React.CSSProperties,
  btnSecondary: { width: "100%", padding: "12px 0", border: "1px solid #333", borderRadius: 10, background: "#111", color: "#fff", fontSize: 13, cursor: "pointer", marginTop: 10 } as React.CSSProperties,
  statusRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 16, color: "#ccc", fontSize: 13 } as React.CSSProperties,
  spinner: { width: 14, height: 14, border: "2px solid #555", borderTop: "2px solid #d4a843", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 } as React.CSSProperties,
  errorBox: { background: "rgba(127,29,29,0.5)", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, color: "#fca5a5", fontSize: 12, marginTop: 12, wordBreak: "break-word" as const } as React.CSSProperties,
  balBtn: { background: "none", border: "none", color: "#888", fontSize: 10, cursor: "pointer", padding: 0 } as React.CSSProperties,
  validErr: { color: "#ff4444", fontSize: 10, marginTop: 4 } as React.CSSProperties,
  homeLink: { display: "inline-block", padding: "12px 24px", background: "linear-gradient(135deg, #d4a843, #b8942e)", color: "#000", borderRadius: 10, textDecoration: "none", fontFamily: "'Press Start 2P', monospace", fontSize: 11, fontWeight: 700 } as React.CSSProperties,
  orderId: { fontSize: 9, color: "#555", textAlign: "center" as const, fontFamily: "monospace", marginTop: 12 } as React.CSSProperties,
};
