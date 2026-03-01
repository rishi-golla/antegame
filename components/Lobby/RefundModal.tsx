'use client';

import { useState } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { cancelGame, claimRefund, getOnChainGameState, OnChainGameState } from '@/lib/contracts/monopolyGame';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/context/EVMWalletContext';
import { createPublicClient, http, keccak256, encodePacked } from 'viem';
import { getChainEnv, getRpcUrl, getAddresses } from '@/lib/contracts/addresses';
import { base, baseSepolia } from 'viem/chains';
function getChain() { return getChainEnv() === 'base-mainnet' ? base : baseSepolia; }
import { MONOPOLY_GAME_ABI } from '@/lib/contracts/abi/MonopolyGame';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiChain } from '@/context/MultiChainContext';
import { cancelGameOnSolana, claimRefundOnSolana } from '@/lib/solana-program/instructions';

const SOLANA_GAME_SIGNER = process.env.NEXT_PUBLIC_SOLANA_GAME_SIGNER ?? '';

interface RefundModalProps {
  refund: { nonce: string; signature: string; gameId: string; roomCode: string };
  onDone: () => void;
}

/** Check if this wallet has a refund available (game must be cancelled AND simulation must pass) */
async function canClaimRefund(roomCode: string, playerAddress: string): Promise<boolean> {
  try {
    const client = createPublicClient({ chain: getChain(), transport: http(getRpcUrl()) });
    const gameId = keccak256(encodePacked(['string'], [roomCode]));
    await client.simulateContract({
      address: getAddresses().monopolyGame,
      abi: MONOPOLY_GAME_ABI,
      functionName: 'claimRefund',
      args: [gameId],
      account: playerAddress as `0x${string}`,
    });
    return true; // simulation passed, refund available
  } catch {
    return false; // reverts = already claimed or not eligible
  }
}

export default function RefundModal({ refund, onDone }: RefundModalProps) {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { publicKey: solPublicKey, signTransaction: solSignTransaction, signAllTransactions: solSignAllTransactions } = useWallet();
  const { activeChain } = useMultiChain();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isSolana = activeChain === 'solana';

  const handleSolanaRefund = async () => {
    if (!solPublicKey || !solSignTransaction) {
      setError('Solana wallet not connected');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const wallet = {
        publicKey: solPublicKey,
        signTransaction: solSignTransaction,
        signAllTransactions: solSignAllTransactions ?? (async (txs: any[]) => {
          const out = [];
          for (const tx of txs) out.push(await solSignTransaction(tx));
          return out;
        }),
      };

      // Step 1: Cancel game on-chain
      setStatus('Cancelling game on-chain...');
      try {
        await cancelGameOnSolana(
          wallet as any,
          refund.roomCode,
          refund.nonce,
          refund.signature,
          SOLANA_GAME_SIGNER
        );
      } catch (cancelErr: any) {
        const msg = cancelErr?.message || '';
        console.error('[RefundModal] cancelGameOnSolana failed:', msg);
        if (msg.includes('User rejected') || msg.includes('denied')) {
          setError('Transaction rejected');
          setLoading(false);
          return;
        }
        // Only continue if game is already cancelled
        if (!msg.includes('GameAlreadySettled') && !msg.includes('6006')) {
          setError(`Cancel failed: ${msg}`);
          setLoading(false);
          return;
        }
      }

      // Step 2: Claim refund
      setStatus('Claiming refund...');
      await claimRefundOnSolana(wallet as any, refund.roomCode);

      setStatus('');
      setDone(true);
      setTimeout(onDone, 3000);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('User rejected') || msg.includes('denied')) {
        setError('Transaction rejected');
      } else {
        setError(msg || 'Refund failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBaseRefund = async () => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Step 1: Check on-chain state — only cancel if not already cancelled
      setStatus('Checking game state...');
      const gameState = await getOnChainGameState(refund.roomCode);

      if (gameState !== OnChainGameState.CANCELLED) {
        setStatus('Cancelling game on-chain...');
        try {
          const cancelHash = await cancelGame(walletClient, refund.roomCode, refund.nonce, refund.signature);
          await waitForTransactionReceipt(wagmiConfig, { hash: cancelHash as `0x${string}` });
        } catch (cancelErr: any) {
          const msg = cancelErr?.shortMessage || cancelErr?.message || '';
          if (msg.includes('User rejected') || msg.includes('denied') || msg.includes('user rejected')) {
            setError('Transaction rejected');
            setLoading(false);
            return;
          }
        }

        await new Promise(r => setTimeout(r, 2000));

        const recheckState = await getOnChainGameState(refund.roomCode);
        if (recheckState !== OnChainGameState.CANCELLED) {
          setError('Failed to cancel game on-chain. Try again.');
          setLoading(false);
          return;
        }
      }

      setStatus('Checking refund status...');
      const refundAvailable = await canClaimRefund(refund.roomCode, address);
      if (!refundAvailable) {
        setStatus('');
        setDone(true);
        return;
      }

      setStatus('Claiming refund...');
      const refundHash = await claimRefund(walletClient, refund.roomCode);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: refundHash as `0x${string}` });

      if (receipt.status === 'reverted') {
        setError('Refund transaction reverted. May have already been claimed.');
        setLoading(false);
        return;
      }

      setStatus('');
      setDone(true);
      setTimeout(onDone, 3000);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || '';
      if (msg.includes('User rejected') || msg.includes('denied') || msg.includes('user rejected')) {
        setError('Transaction rejected');
      } else {
        setError(msg || 'Refund failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = isSolana ? handleSolanaRefund : handleBaseRefund;
  const walletConnected = isSolana ? !!solPublicKey : !!(walletClient && address);

  return (
    <div className="setupScreen" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="setupCard" style={{ maxWidth: 400 }}>
        <h2 className="setupTitle" style={{ fontSize: '1.4rem' }}>$ Claim Refund</h2>
        <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: 16 }}>
          Room <strong>{refund.roomCode}</strong> was cancelled.
          {!done && ' Your deposit is available for refund.'}
        </p>

        {!walletConnected && <p className="lobbyError">Wallet not connected</p>}
        {error && <p className="lobbyError">{error}</p>}
        {status && <p style={{ textAlign: 'center', color: '#d4a843', fontSize: '0.85rem', marginBottom: 12 }}>{status}</p>}

        {!done && (
          <button className="setupStartBtn" onClick={handleRefund} disabled={loading || !walletConnected}>
            {loading ? status || 'Processing...' : 'Claim Refund'}
          </button>
        )}
        {done && (
          <>
            <p style={{ textAlign: 'center', color: '#4caf50', fontWeight: 700 }}>Refund complete</p>
            <button className="lobbyBackBtn" onClick={onDone} style={{ marginTop: 12 }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
