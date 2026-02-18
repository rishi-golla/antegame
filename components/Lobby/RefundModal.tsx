'use client';

import { useState } from 'react';
import { useWalletClient } from 'wagmi';
import { cancelGame, claimRefund, getOnChainGameState, OnChainGameState } from '@/lib/contracts/monopolyGame';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/context/EVMWalletContext';

interface RefundModalProps {
  refund: { nonce: string; signature: string; gameId: string; roomCode: string };
  onDone: () => void;
}

export default function RefundModal({ refund, onDone }: RefundModalProps) {
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRefund = async () => {
    if (!walletClient) {
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
          // Otherwise assume cancelled, continue
        }
      }

      // Brief delay after cancel to ensure state is indexed
      if (gameState !== OnChainGameState.CANCELLED) {
        await new Promise(r => setTimeout(r, 2000));
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

      setStatus('Refund complete!');
      setDone(true);
      setTimeout(onDone, 2000);
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
          Room <strong>{refund.roomCode}</strong> was cancelled. Your deposit is available for refund.
        </p>

        {error && <p className="lobbyError">{error}</p>}
        {status && <p style={{ textAlign: 'center', color: '#d4a843', fontSize: '0.85rem', marginBottom: 12 }}>{status}</p>}

        {!done && (
          <button className="setupStartBtn" onClick={handleRefund} disabled={loading}>
            {loading ? status || 'Processing...' : 'Claim Refund'}
          </button>
        )}
        {done && (
          <p style={{ textAlign: 'center', color: '#4caf50', fontWeight: 700 }}>✅ Refund sent to your wallet</p>
        )}
      </div>
    </div>
  );
}
