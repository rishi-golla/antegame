'use client';

import { useState } from 'react';
import { useWalletClient } from 'wagmi';
import { cancelGame, claimRefund } from '@/lib/contracts/monopolyGame';
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
      // Step 1: Cancel the game on-chain
      setStatus('Cancelling game on-chain...');
      const cancelHash = await cancelGame(walletClient, refund.roomCode, refund.nonce, refund.signature);
      await waitForTransactionReceipt(wagmiConfig, { hash: cancelHash as `0x${string}` });

      // Step 2: Claim refund
      setStatus('Claiming refund...');
      const refundHash = await claimRefund(walletClient, refund.roomCode);
      await waitForTransactionReceipt(wagmiConfig, { hash: refundHash as `0x${string}` });

      setStatus('Refund complete!');
      setDone(true);
      setTimeout(onDone, 2000);
    } catch (err: any) {
      // If cancel reverts (already cancelled), try just claiming refund
      if (err.message?.includes('revert') || err.message?.includes('already')) {
        try {
          setStatus('Game already cancelled. Claiming refund...');
          const refundHash = await claimRefund(walletClient!, refund.roomCode);
          await waitForTransactionReceipt(wagmiConfig, { hash: refundHash as `0x${string}` });
          setStatus('Refund complete!');
          setDone(true);
          setTimeout(onDone, 2000);
          return;
        } catch (innerErr: any) {
          setError(innerErr.shortMessage ?? innerErr.message ?? 'Refund failed');
        }
      } else if (err.message?.includes('User rejected') || err.message?.includes('denied')) {
        setError('Transaction cancelled');
      } else {
        setError(err.shortMessage ?? err.message ?? 'Refund failed');
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
          <>
            <button className="setupStartBtn" onClick={handleRefund} disabled={loading}>
              {loading ? status || 'Processing...' : 'Claim Refund'}
            </button>
            <button className="lobbyBackBtn" onClick={onDone} disabled={loading} style={{ marginTop: 8 }}>
              Skip (claim later)
            </button>
          </>
        )}
        {done && (
          <p style={{ textAlign: 'center', color: '#4caf50', fontWeight: 700 }}>✅ Refund sent to your wallet</p>
        )}
      </div>
    </div>
  );
}
