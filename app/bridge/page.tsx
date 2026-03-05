"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { createWalletClient, custom } from 'viem';
import { base, baseSepolia } from 'wagmi/chains';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { getChainId } from '@/lib/contracts/addresses';
import { wagmiConfig } from '@/context/EVMWalletContext';

const TREASURY_WALLET = 'E6hWHJc6J3zzAGDgg9xphZtpBveAqZ8eNMwmFDeJ6TK8';
const BRIDGE_FEE_SOL = 0.001;
const MIN_BRIDGE_SOL = 0.012;
const MIN_BRIDGE_BASE = 0.002;

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid tx hex length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return out;
}

function toBigIntSafe(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.floor(v));
  if (typeof v === 'string') return v.startsWith('0x') ? BigInt(v) : BigInt(v || '0');
  return BigInt(0);
}

async function waitForSignatureFinality(
  connection: import('@solana/web3.js').Connection,
  signature: string,
  timeoutMs = 120_000,
  pollMs = 2_000
): Promise<'confirmed' | 'seen' | 'timeout'> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const st = value[0];
    if (st?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(st.err)}`);
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return 'confirmed';
    if (st) return 'seen';
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return 'timeout';
}

export default function BridgePage() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const walletClientRef = useRef(walletClient);
  const targetBaseChainId = getChainId();
  const targetBaseChain = targetBaseChainId === base.id ? base : baseSepolia;
  const basePublicClient = usePublicClient({ chainId: targetBaseChainId });
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const [solToBase, setSolToBase] = useState(true);
  const [amount, setAmount] = useState('0.05');
  const [baseRecipient, setBaseRecipient] = useState('');
  const [solRecipient, setSolRecipient] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bridgeTxSig, setBridgeTxSig] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  const sourceAddress = useMemo(() => publicKey?.toBase58() ?? '', [publicKey]);
  const baseSender = evmAddress ?? '';
  const feeLamports = Math.floor(BRIDGE_FEE_SOL * LAMPORTS_PER_SOL);

  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied`);
      setTimeout(() => setCopied(''), 1200);
    } catch {
      setCopied(`Could not copy ${label}`);
      setTimeout(() => setCopied(''), 1200);
    }
  }

  async function resolveBaseWalletClient() {
    let client = walletClientRef.current;
    if (client) return client;

    await new Promise((r) => setTimeout(r, 250));
    client = walletClientRef.current;
    if (client) return client;

    try {
      const fetched = await getWalletClient(wagmiConfig, { chainId: targetBaseChainId });
      if (fetched) {
        walletClientRef.current = fetched as any;
        return fetched as any;
      }
    } catch {
      // noop
    }

    // Fallback: build viem client directly from injected provider (MetaMask/Coinbase)
    try {
      const eth = (globalThis as any)?.ethereum;
      if (eth && baseSender) {
        const injectedClient = createWalletClient({ chain: targetBaseChain, transport: custom(eth) });
        walletClientRef.current = injectedClient as any;
        return injectedClient as any;
      }
    } catch {
      // noop
    }

    return null;
  }

  async function ensureWalletOnTargetBaseChain(): Promise<boolean> {
    const eth = (globalThis as any)?.ethereum;
    if (!eth) return chainId === targetBaseChainId;

    try {
      const currentHex = await eth.request({ method: 'eth_chainId' });
      const currentId = parseInt(String(currentHex), 16);
      if (currentId === targetBaseChainId) return true;
    } catch {
      // continue to switch attempt
    }

    try {
      await switchChainAsync({ chainId: targetBaseChainId });
    } catch {
      // fallback to direct wallet rpc
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetBaseChainId.toString(16)}` }],
        });
      } catch {
        return false;
      }
    }

    try {
      const afterHex = await eth.request({ method: 'eth_chainId' });
      const afterId = parseInt(String(afterHex), 16);
      return afterId === targetBaseChainId;
    } catch {
      return false;
    }
  }

  async function submitBridge() {
    setOrderId(null);
    setBridgeTxSig(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setStatus('Enter a valid amount.');
      return;
    }

    setBusy(true);
    try {
      // SOL -> Base (existing full flow)
      if (solToBase) {
        if (!connected || !publicKey) {
          setStatus('Connect a Solana wallet first.');
          return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(baseRecipient)) {
          setStatus('Enter a valid Base (EVM) recipient address.');
          return;
        }
        if (amt < MIN_BRIDGE_SOL) {
          setStatus(`Amount too low. Use at least ${MIN_BRIDGE_SOL} SOL.`);
          return;
        }

        setStatus('Requesting fee payment signature...');
        const feeTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(TREASURY_WALLET),
            lamports: feeLamports,
          })
        );

        const feeSig = await sendTransaction(feeTx, connection);
        const feeConfirm = await waitForSignatureFinality(connection, feeSig, 90_000, 1_500);
        if (feeConfirm === 'timeout') {
          setStatus(`Fee tx not visible on-chain yet: ${feeSig}. Please retry.`);
          return;
        }

        setStatus('Fee payment confirmed. Creating bridge order...');

        const srcLamports = Math.floor(amt * LAMPORTS_PER_SOL).toString();
        const body = {
          direction: 'solToBase',
          feeTxSignature: feeSig,
          feeExpectedLamports: feeLamports,
          srcChainTokenInAmount: srcLamports,
          dstChainTokenOutRecipient: baseRecipient,
          srcChainOrderAuthorityAddress: sourceAddress,
          dstChainOrderAuthorityAddress: baseRecipient,
        };

        let res = await fetch('/api/bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        let data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Bridge request failed');

        let secondSig = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          setOrderId(data?.estimation?.orderId || data?.tx?.orderId || data?.orderId || null);
          const txHex = data?.tx?.data;
          if (!txHex || typeof txHex !== 'string') throw new Error('Bridge provider did not return tx payload.');

          setStatus(`Order created. Approve bridge transaction in Phantom... (attempt ${attempt}/2)`);
          try {
            const bytes = hexToBytes(txHex);
            const vtx = VersionedTransaction.deserialize(bytes);
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            (vtx.message as any).recentBlockhash = blockhash;

            if (signTransaction) {
              const signed = await signTransaction(vtx);
              secondSig = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: false,
                maxRetries: 8,
                preflightCommitment: 'confirmed',
              });
            } else {
              secondSig = await sendTransaction(vtx, connection, {
                skipPreflight: false,
                maxRetries: 8,
                preflightCommitment: 'confirmed',
              });
            }
            break;
          } catch (err: any) {
            const stale = /blockhash not found|Blockhash not found|simulation failed/i.test(String(err?.message || err || ''));
            if (!stale || attempt === 3) throw err;
            setStatus('Bridge tx used a stale blockhash. Refreshing payload...');
            res = await fetch('/api/bridge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to refresh bridge payload');
          }
        }

        if (!secondSig) throw new Error('Bridge tx was not submitted');
        setBridgeTxSig(secondSig);

        const confirm = await waitForSignatureFinality(connection, secondSig, 180_000, 2_000);
        if (confirm === 'timeout') setStatus(`Bridge tx not found yet: ${secondSig}. Retry bridge step.`);
        else if (confirm === 'seen') setStatus(`Bridge tx submitted: ${secondSig}. Waiting confirmations.`);
        else setStatus('Bridge transaction sent and confirmed.');

        return;
      }

      // Base -> SOL (full flow)
      if (!evmConnected || !baseSender) {
        setStatus('Connect a Base wallet first.');
        openConnectModal?.();
        return;
      }
      try {
        new PublicKey(solRecipient);
      } catch {
        setStatus('Enter a valid Solana recipient address.');
        return;
      }
      if (amt < MIN_BRIDGE_BASE) {
        setStatus(`Amount too low. Use at least ${MIN_BRIDGE_BASE} ETH.`);
        return;
      }

      setStatus('Preparing Base → SOL route...');
      const srcWei = Math.floor(amt * 1e18).toString();

      if (chainId !== targetBaseChainId) {
        setStatus(`Switching wallet to ${targetBaseChain.name}...`);
      }
      const onTargetChain = await ensureWalletOnTargetBaseChain();
      if (!onTargetChain) {
        setStatus(`Please switch your wallet to ${targetBaseChain.name} and retry.`);
        return;
      }

      setStatus('Preparing Base wallet session...');
      const activeWalletClient = await resolveBaseWalletClient();
      if (!activeWalletClient) {
        setStatus('Base wallet session not ready. Tap Connect Base, then retry.');
        openConnectModal?.();
        return;
      }

      let sent = false;
      for (let attempt = 1; attempt <= 2 && !sent; attempt++) {
        const res = await fetch('/api/bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: 'baseToSol',
            srcChainTokenInAmount: srcWei,
            dstChainTokenOutRecipient: solRecipient,
            srcChainOrderAuthorityAddress: baseSender,
            dstChainOrderAuthorityAddress: solRecipient,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Bridge request failed');

        setOrderId(data?.estimation?.orderId || data?.tx?.orderId || data?.orderId || null);

        const tx = data?.tx ?? {};
        const evmTo = (tx.to || tx.tx?.to || tx.evmTx?.to) as `0x${string}` | undefined;
        const evmData = (tx.data || tx.tx?.data || tx.evmTx?.data || '0x') as `0x${string}`;
        const evmValue = toBigIntSafe(tx.value ?? tx.tx?.value ?? tx.evmTx?.value ?? '0');

        if (!evmTo) {
          throw new Error('Route payload missing tx target.');
        }

        try {
          setStatus(`Approve transaction in your Base wallet... (${attempt}/2)`);
          const txAccount = activeWalletClient.account || (baseSender as `0x${string}`);
          const evmHash = await activeWalletClient.sendTransaction({
            account: txAccount,
            to: evmTo,
            data: evmData,
            value: evmValue,
            chain: targetBaseChain,
          });

          setBridgeTxSig(evmHash);
          setStatus('Base tx submitted. Waiting for confirmation...');

          if (basePublicClient) {
            const receipt = await basePublicClient.waitForTransactionReceipt({ hash: evmHash });
            if (receipt.status === 'success') setStatus('Base → SOL bridge tx confirmed. Track order status below.');
            else throw new Error('Base transaction reverted.');
          } else {
            setStatus(`Base tx submitted: ${evmHash}`);
          }
          sent = true;
        } catch (err: any) {
          const msg = String(err?.message || err || '').toLowerCase();
          const isRequoteable = msg.includes('execution reverted') || msg.includes('insufficient') || msg.includes('slippage');
          if (!isRequoteable || attempt === 2) {
            throw new Error('Route failed on-chain. Try a slightly higher amount (e.g. 0.003+ ETH) and retry.');
          }
          setStatus('Route moved. Requoting and retrying...');
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch (e: any) {
      const msg = e?.message || 'Bridge failed';
      setStatus(msg.includes('403') ? 'RPC/provider rejected request. Please retry.' : msg);
    } finally {
      setBusy(false);
    }
  }

  const fromLabel = solToBase ? 'From (Solana)' : 'From (Base)';
  const toLabel = solToBase ? 'To (Base)' : 'To (Solana)';
  const bridgeTxLabel = solToBase ? 'Solana Tx' : 'Base Tx Hash';

  function handleSwapDirection() {
    setSolToBase((v) => !v);
    setStatus('');
    setOrderId(null);
    setBridgeTxSig(null);
  }

  return (
    <div className="landingPage bridgePage">
      <section className="bridgeViewport">
        <motion.div className={`bridgeShell ${busy ? 'bridgeBusy' : ''}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="bridgeHeaderRow">
            <div>
              <div className="bridgeHeaderTitle">{solToBase ? 'SOL → Base' : 'Base → SOL'}</div>
              <div className="bridgeHeaderSub">Fast cross-chain routing</div>
            </div>
            <button className="bridgeConnect" onClick={() => (solToBase ? setVisible(true) : openConnectModal?.())}>
              {solToBase
                ? (connected && sourceAddress ? `Sol: ${short(sourceAddress)}` : 'Connect Solana')
                : (evmConnected && baseSender ? `Base: ${short(baseSender)}` : 'Connect Base')}
            </button>
          </div>

          <motion.div
            layout
            className="bridgePanel sellPanel"
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.55 }}
          >
            <div className="bridgePanelTop">
              <span>{fromLabel}</span>
              <span className="bridgeWalletTag">
                {solToBase ? (sourceAddress ? short(sourceAddress) : 'No wallet') : (baseSender ? short(baseSender) : 'Set sender')}
              </span>
            </div>

            <motion.div layout transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.55 }}>
              {!solToBase ? (
                <div className="bridgeInputRow full" style={{ marginBottom: 8 }}>
                  <input className="bridgeMainInput" value={baseSender} readOnly placeholder="Connect Base wallet" style={{ fontSize: '1rem', fontFamily: 'Nunito, sans-serif' }} />
                </div>
              ) : null}
            </motion.div>

            <div className="bridgeInputRow">
              <input className="bridgeMainInput" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={solToBase ? '0.05' : '0.01'} />
              <button className="bridgeTokenPill" type="button">{solToBase ? 'SOL' : 'ETH'}</button>
            </div>
            <div className="bridgeMeta">
              {solToBase
                ? `Network fee (Solana): ${BRIDGE_FEE_SOL} SOL`
                : `Minimum for Base → SOL: ${MIN_BRIDGE_BASE} ETH`}
            </div>
          </motion.div>

          <motion.button
            className="bridgeDivider"
            type="button"
            animate={{ rotate: solToBase ? 0 : 180 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={handleSwapDirection}
            aria-label="Swap bridge direction"
          >
            <span>⇅</span>
          </motion.button>

          <motion.div
            layout
            className="bridgePanel buyPanel"
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.55 }}
          >
            <div className="bridgePanelTop">
              <span>{toLabel}</span>
              <span className="bridgeWalletTag">{solToBase ? 'Base' : 'Solana'}</span>
            </div>
            <div className="bridgeInputRow full">
              <input
                className="bridgeMainInput"
                value={solToBase ? baseRecipient : solRecipient}
                onChange={(e) => (solToBase ? setBaseRecipient(e.target.value.trim()) : setSolRecipient(e.target.value.trim()))}
                placeholder={solToBase ? '0x recipient address' : 'Solana recipient address'}
                style={!solToBase ? { fontSize: '1rem', fontFamily: 'Nunito, sans-serif' } : undefined}
              />
            </div>
            <div className="bridgeMeta">
              {solToBase
                ? `Minimum for SOL → Base: ${MIN_BRIDGE_SOL} SOL`
                : 'Destination chain: Solana • token: SOL'}
            </div>
          </motion.div>

          <button className="bridgeCta" disabled={busy || (solToBase ? !connected : !evmConnected)} onClick={submitBridge}>
            {busy ? 'Bridging…' : `Create ${solToBase ? 'SOL → Base' : 'Base → SOL'} Order`}
          </button>

          {status ? <p className="bridgeStatus">{status}</p> : null}
          {copied ? <p className="bridgeSuccess">{copied}</p> : null}

          {orderId ? (
            <div className="bridgeInfoRow">
              <p className="bridgeSuccess">Order ID: {orderId}</p>
              <button className="bridgeTinyBtn" onClick={() => copyText('Order ID', orderId)}>Copy</button>
            </div>
          ) : null}

          {bridgeTxSig ? (
            <div className="bridgeInfoRow">
              <p className="bridgeSuccess">{bridgeTxLabel}: {bridgeTxSig}</p>
              <button className="bridgeTinyBtn" onClick={() => copyText(bridgeTxLabel, bridgeTxSig)}>Copy</button>
            </div>
          ) : null}

          <div className="bridgeLinksRow">
            <Link href="/" className="bridgeGhostBtn">Back Home</Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
