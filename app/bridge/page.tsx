"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import Link from "next/link";

// Try to get EVM address from wagmi if available
let useAccountHook: (() => { address?: string; isConnected?: boolean }) | null = null;
try {
  const wagmi = require("wagmi");
  useAccountHook = wagmi.useAccount;
} catch {}

const TREASURY_WALLET = new PublicKey("E6hWHJc6J3zzAGDgg9xphZtpBveAqZ8eNMwmFDeJ6TK8");
const FEE_PERCENT = 1;

type BridgeStatus = "idle" | "awaiting_fee" | "confirming_fee" | "verifying_fee" | "awaiting_bridge" | "confirming_bridge" | "polling" | "complete" | "error";

function SolanaConnectButton() {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button
        onClick={disconnect}
        style={{
          background: '#111', border: '1px solid #d4a843', borderRadius: 8, padding: '10px 20px',
          color: '#d4a843', fontFamily: "'Press Start 2P', monospace", fontSize: 11, cursor: 'pointer',
        }}
      >
        {addr.slice(0, 4)}...{addr.slice(-4)} ✓
      </button>
    );
  }

  const handleConnect = () => {
    // Open the wallet modal — Wallet Standard auto-detects installed wallets
    setVisible(true);
  };

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      style={{
        background: 'linear-gradient(135deg, #9945FF, #7B3FE4)', border: 'none', borderRadius: 8,
        padding: '12px 24px', color: '#fff', fontFamily: "'Press Start 2P', monospace",
        fontSize: 12, cursor: connecting ? 'wait' : 'pointer', fontWeight: 700,
        opacity: connecting ? 0.6 : 1,
      }}
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
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
      const status = data?.status ?? data;
      if (["Fulfilled", "SentUnlock", "ClaimedUnlock"].includes(status)) return status;
      if (["OrderCancelled", "ClaimedOrderCancel", "SentOrderCancel"].includes(status)) {
        throw new Error(`Bridge order cancelled: ${status}`);
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Bridge order timed out after ${Math.round((maxAttempts * pollMs) / 60000)} minutes`);
}

// Styles
const s = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: 16,
  } as React.CSSProperties,
  card: {
    background: "#1a1a2e",
    border: "2px solid #d4a843",
    borderRadius: 16,
    padding: 32,
    maxWidth: 460,
    width: "100%",
  } as React.CSSProperties,
  title: {
    fontFamily: "'Press Start 2P', monospace",
    color: "#d4a843",
    fontSize: 18,
    textAlign: "center" as const,
    margin: 0,
    marginBottom: 8,
  } as React.CSSProperties,
  subtitle: {
    color: "#aaa",
    fontSize: 12,
    textAlign: "center" as const,
    marginBottom: 24,
    fontFamily: "'Press Start 2P', monospace",
  } as React.CSSProperties,
  walletRow: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    color: "#888",
    fontSize: 11,
    marginBottom: 6,
    display: "block",
  } as React.CSSProperties,
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  } as React.CSSProperties,
  input: {
    width: "100%",
    background: "#111",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  inputSmall: {
    width: "100%",
    background: "#111",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
    fontFamily: "monospace",
    outline: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  arrow: {
    display: "flex",
    justifyContent: "center",
    margin: "12px 0",
  } as React.CSSProperties,
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#111",
    border: "1px solid #333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#d4a843",
    fontSize: 16,
  } as React.CSSProperties,
  feePill: {
    background: "rgba(17,17,17,0.7)",
    borderRadius: 10,
    padding: "12px 14px",
    marginTop: 16,
  } as React.CSSProperties,
  feeRow: {
    display: "flex",
    justifyContent: "space-between",
    color: "#888",
    fontSize: 11,
    marginBottom: 4,
  } as React.CSSProperties,
  feeDivider: {
    borderTop: "1px solid #333",
    margin: "6px 0",
  } as React.CSSProperties,
  feeTotal: {
    display: "flex",
    justifyContent: "space-between",
    color: "#eee",
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  feeNote: {
    color: "#555",
    fontSize: 9,
    marginTop: 6,
  } as React.CSSProperties,
  btn: {
    width: "100%",
    padding: "14px 0",
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(135deg, #d4a843, #b8942e)",
    color: "#000",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Press Start 2P', monospace",
    cursor: "pointer",
    marginTop: 20,
  } as React.CSSProperties,
  btnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  } as React.CSSProperties,
  btnSecondary: {
    width: "100%",
    padding: "12px 0",
    border: "1px solid #333",
    borderRadius: 10,
    background: "#111",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 10,
  } as React.CSSProperties,
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    color: "#ccc",
    fontSize: 12,
  } as React.CSSProperties,
  errorBox: {
    background: "rgba(180,40,40,0.15)",
    border: "1px solid #661a1a",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    color: "#ff6b6b",
    fontSize: 12,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  successBox: {
    textAlign: "center" as const,
    marginTop: 16,
  } as React.CSSProperties,
  successText: {
    color: "#d4a843",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 14,
    marginBottom: 12,
  } as React.CSSProperties,
  orderId: {
    fontSize: 9,
    color: "#555",
    textAlign: "center" as const,
    fontFamily: "monospace",
    marginTop: 12,
  } as React.CSSProperties,
  balBtn: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 10,
    cursor: "pointer",
    padding: 0,
  } as React.CSSProperties,
  section: { marginBottom: 16 } as React.CSSProperties,
  validationErr: { color: "#ff4444", fontSize: 10, marginTop: 4 } as React.CSSProperties,
  homeLink: {
    display: "inline-block",
    marginTop: 16,
    padding: "12px 24px",
    background: "linear-gradient(135deg, #d4a843, #b8942e)",
    color: "#000",
    borderRadius: 10,
    textDecoration: "none",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,
};

export default function BridgePage() {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [bridgeOrderId, setBridgeOrderId] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [estimatedEth, setEstimatedEth] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Auto-populate destination from EVM wallet
  useEffect(() => {
    if (useAccountHook) {
      // We can't call hooks conditionally, so we set it once on mount via a workaround
    }
  }, []);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey || !connected) { setSolBalance(null); return; }
    const fetchBalance = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setSolBalance(bal / LAMPORTS_PER_SOL);
      } catch {}
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 10000);
    return () => clearInterval(id);
  }, [publicKey, connected, connection]);

  // Quote estimation
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
          const outAmount = data?.estimation?.dstChainTokenOut?.amount;
          if (outAmount) {
            setEstimatedEth((Number(outAmount) / 1e18).toFixed(6));
          } else { setEstimatedEth(null); }
        } else { setEstimatedEth(null); }
      } catch {
        if (!controller.signal.aborted) setEstimatedEth(null);
      } finally { setQuoteLoading(false); }
    }, 500);
    return () => { clearTimeout(timeout); controller.abort(); setQuoteLoading(false); };
  }, [amount]);

  const feeAmount = amount ? Number(amount) * (FEE_PERCENT / 100) : 0;
  const bridgeAmount = amount ? Number(amount) - feeAmount : 0;
  const isValidAmount = Number(amount) > 0 && (solBalance === null || Number(amount) <= solBalance);
  const isValidDestination = /^0x[a-fA-F0-9]{40}$/.test(destinationAddress);
  const canBridge = connected && isValidAmount && isValidDestination && status === "idle";

  const handleBridge = useCallback(async () => {
    if (!publicKey || !connected || !signTransaction) return;
    setErrorMsg("");
    setBridgeOrderId(null);

    try {
      setStatus("awaiting_fee");
      setStatusMsg("Sign the fee transaction in your wallet...");

      const feeLamports = Math.floor(feeAmount * LAMPORTS_PER_SOL);
      const feeTx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: TREASURY_WALLET, lamports: feeLamports })
      );
      const feeSig = await sendTransaction(feeTx, connection);
      setStatus("confirming_fee");
      setStatusMsg(`Fee tx sent (${feeSig.slice(0, 8)}...). Confirming...`);
      await connection.confirmTransaction(feeSig, "confirmed");

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

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Bridge API failed: ${err}`);
      }

      const data = await res.json();
      const orderId = data.orderId;
      setBridgeOrderId(orderId);

      if (!data.tx?.data) throw new Error("deBridge returned no transaction data");

      setStatus("awaiting_bridge");
      setStatusMsg("Sign the bridge transaction in your wallet...");

      const txBytes = hexToBytes(data.tx.data);
      const vtx = VersionedTransaction.deserialize(txBytes);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      vtx.message.recentBlockhash = blockhash;
      const signed = await signTransaction(vtx);

      setStatus("confirming_bridge");
      setStatusMsg("Bridge tx sent. Confirming on Solana...");

      const bridgeSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 5 });
      await connection.confirmTransaction({ signature: bridgeSig, blockhash, lastValidBlockHeight }, "confirmed");

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
  }, [publicKey, connected, signTransaction, sendTransaction, connection, amount, destinationAddress, feeAmount, bridgeAmount]);

  const reset = () => { setStatus("idle"); setStatusMsg(""); setErrorMsg(""); setBridgeOrderId(null); };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>BRIDGE TO BASE</h1>
        <p style={s.subtitle}>Bridge SOL to ETH and jump into a game</p>

        <div style={s.walletRow}>
          <SolanaConnectButton />
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
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={s.input}
            placeholder="0.0"
            min="0.01"
            step="0.1"
            disabled={status !== "idle"}
          />
        </div>

        <div style={s.arrow}><div style={s.arrowCircle}>↓</div></div>

        <div style={s.section}>
          <span style={s.label}>Destination (Base address)</span>
          <DestinationInput value={destinationAddress} onChange={setDestinationAddress} disabled={status !== "idle"} />
          {destinationAddress && !isValidDestination && (
            <p style={s.validationErr}>Enter a valid Base (EVM) address</p>
          )}
        </div>

        {Number(amount) > 0 && (
          <div style={s.feePill}>
            <div style={s.feeRow}><span>Bridge amount</span><span>{bridgeAmount.toFixed(4)} SOL</span></div>
            <div style={s.feeRow}><span>Fee ({FEE_PERCENT}%)</span><span style={{ color: "#d4a843" }}>{feeAmount.toFixed(4)} SOL</span></div>
            <div style={s.feeDivider} />
            <div style={s.feeTotal}>
              <span>You receive (est.)</span>
              <span>{quoteLoading ? "..." : estimatedEth ? `${estimatedEth} ETH` : "--"}</span>
            </div>
            <p style={s.feeNote}>Fee is non-refundable once signed. You will sign two transactions: fee, then bridge.</p>
          </div>
        )}

        {status === "idle" && (
          <button
            onClick={handleBridge}
            disabled={!canBridge}
            style={{ ...s.btn, ...(!canBridge ? s.btnDisabled : {}) }}
          >
            {!connected ? "CONNECT WALLET" : "BRIDGE TO BASE"}
          </button>
        )}

        {statusMsg && (
          <div style={s.statusRow}>
            {!["complete", "error"].includes(status) && (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #d4a843", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            )}
            {status === "complete" && <span style={{ color: "#d4a843" }}>✦</span>}
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

        {status === "complete" && (
          <div style={s.successBox}>
            <p style={s.successText}>Your ETH is ready!</p>
            <Link href="/" style={s.homeLink}>GO TO QUICK PLAY</Link>
          </div>
        )}

        {(status === "complete" || status === "error") && (
          <button onClick={reset} style={s.btnSecondary}>
            {status === "error" ? "Try Again" : "Bridge Again"}
          </button>
        )}

        {bridgeOrderId && (
          <p style={s.orderId}>Order: {bridgeOrderId.slice(0, 16)}...</p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Separate component so we can use wagmi hook at top level */
function DestinationInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  // Auto-populate from EVM wallet on mount
  const [autoFilled, setAutoFilled] = useState(false);
  useEffect(() => {
    if (autoFilled || value) return;
    // Try to read from wagmi global store if available
    try {
      const wagmi = require("wagmi");
      // Can't call hooks here, but we can try the store approach
    } catch {}
  }, [autoFilled, value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={s.inputSmall}
      placeholder="0x..."
      disabled={disabled}
    />
  );
}
