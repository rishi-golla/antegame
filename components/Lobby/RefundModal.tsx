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

interface RefundModalProps {
  refund: { nonce: string; signature: string; gameId: string; roomCode: string };
  onDone: () => void;
}

/** Check if this wallet has already claimed their refund */
async function hasAlreadyClaimed(roomCode: string, playerAddress: string): Promise<boolean> {
  try {
    const client = createPublicClient({ chain: getChain(), transport: http(getRpcUrl()) });
    const gameId = keccak256(encodePacked(['string'], [roomCode]));
    // Simulate claimRefund — if it reverts, already claimed
    await client.simulateContract({
      address: getAddresses().monopolyGame,
      abi: MONOPOLY_GAME_ABI,
      functionName: 'claimRefund',
      args: [gameId],
      account: playerAddress as `0x${string}`,
    });
    return false; // simulation passed, refund still available
  } catch {
    return true; // reverts = already claimed or not eligible
  }
}

export default function RefundModal({ refund, onDone }: RefundModalProps) {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRefund = async () => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Step 0: Check if already claimed
      setStatus('Checking refund status...');
      const alreadyClaimed = await hasAlreadyClaimed(refund.roomCode, address);
      if (alreadyClaimed) {
        setStatus('');
        setDone(true);
        return;
      }

      // Step 1: Check on-chain state — only cancel if not already cancelled
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
          // Otherwise assume already cancelled by another player, continue
        }

        // Wait for state to index after cancel
        await new Promise(r => setTimeout(r, 2000));

        // Re-check: maybe another player's cancel went through
        const recheckState = await getOnChainGameState(refund.roomCode);
        if (recheckState !== OnChainGameState.CANCELLED) {
          setError('Failed to cancel game on-chain. Try again.');
          setLoading(false);
          return;
        }
      }

      // Step 2: Claim refund
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

  return (
    <div className="setupScreen" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="setupCard" style={{ maxWidth: 400 }}>
        <h2 className="setupTitle" style={{ fontSize: '1.4rem' }}>💰 Claim Refund</h2>
        <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: 16 }}>
          Room <strong>{refund.roomCode}</strong> was cancelled.
          {!done && ' Your deposit is available for refund.'}
        </p>

        {error && <p className="lobbyError">{error}</p>}
        {status && <p style={{ textAlign: 'center', color: '#d4a843', fontSize: '0.85rem', marginBottom: 12 }}>{status}</p>}

        {!done && (
          <button className="setupStartBtn" onClick={handleRefund} disabled={loading}>
            {loading ? status || 'Processing...' : 'Claim Refund'}
          </button>
        )}
        {done && (
          <>
            <p style={{ textAlign: 'center', color: '#4caf50', fontWeight: 700 }}>✅ Refund complete</p>
            <button className="lobbyBackBtn" onClick={onDone} style={{ marginTop: 12 }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
