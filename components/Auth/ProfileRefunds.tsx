'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { createPublicClient, http, formatEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getChainEnv, getRpcUrl, getAddresses } from '@/lib/contracts/addresses';
import { MONOPOLY_GAME_ABI } from '@/lib/contracts/abi/MonopolyGame';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/context/EVMWalletContext';

function getChain() {
  return getChainEnv() === 'base-mainnet' ? base : baseSepolia;
}

function getClient() {
  return createPublicClient({ chain: getChain(), transport: http(getRpcUrl()) });
}

type GameState = 'WAITING' | 'ACTIVE' | 'CANCELLED';

interface RefundableGame {
  gameId: `0x${string}`;
  buyIn: bigint;
  state: GameState;
  playerCount: number;
  canCancel: boolean; // false if ACTIVE but < 24h old
  hoursUntilCancel?: number;
}

/**
 * Find all games where this player deposited but can get money back.
 * Covers: CANCELLED (claimRefund), ACTIVE (emergencyCancel→claimRefund), WAITING (cancelGame→claimRefund)
 */
async function findRefundableGames(playerAddress: `0x${string}`): Promise<RefundableGame[]> {
  const client = getClient();
  const rpcUrl = getRpcUrl();
  const addresses = getAddresses();
  const contractAddr = addresses.monopolyGame;

  // Use Alchemy's getAssetTransfers to find all ETH this player sent to the contract
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromAddress: playerAddress,
        toAddress: contractAddr,
        category: ['external'],
        maxCount: '0x3e8',
      }],
      id: 1,
    }),
  });

  const data = await resp.json();
  const transfers = data?.result?.transfers || [];
  if (transfers.length === 0) return [];

  // Extract gameIds from tx input data
  const gameIdSet = new Set<`0x${string}`>();
  for (const t of transfers) {
    try {
      const tx = await client.getTransaction({ hash: t.hash as `0x${string}` });
      if (tx.input.length >= 74) {
        const gameId = ('0x' + tx.input.slice(10, 74)) as `0x${string}`;
        gameIdSet.add(gameId);
      }
    } catch { /* skip */ }
  }

  if (gameIdSet.size === 0) return [];

  const refundable: RefundableGame[] = [];
  const stateNames: Record<number, GameState> = { 0: 'WAITING', 1: 'ACTIVE', 3: 'CANCELLED' };

  await Promise.all(
    [...gameIdSet].map(async (gameId) => {
      try {
        const game = await client.readContract({
          address: contractAddr,
          abi: MONOPOLY_GAME_ABI,
          functionName: 'getGame',
          args: [gameId],
        }) as unknown as [bigint, bigint, bigint, bigint, number, readonly `0x${string}`[], `0x${string}`];

        const stateNum = Number(game[4]);
        const buyIn = game[0];
        const players = game[5];

        // SETTLED (2) = nothing to do
        if (stateNum === 2) return;

        // For CANCELLED: check if already claimed via simulation
        if (stateNum === 3) {
          try {
            await client.simulateContract({
              address: contractAddr,
              abi: MONOPOLY_GAME_ABI,
              functionName: 'claimRefund',
              args: [gameId],
              account: playerAddress,
            });
            refundable.push({ gameId, buyIn, state: 'CANCELLED', playerCount: players.length, canCancel: true });
          } catch {
            // Already claimed
          }
          return;
        }

        // ACTIVE (1) or WAITING (0): these need cancellation first
        if (stateNum === 0 || stateNum === 1) {
          // Verify player actually deposited
          const deposited = await client.readContract({
            address: contractAddr,
            abi: MONOPOLY_GAME_ABI,
            functionName: 'deposited',
            args: [gameId, playerAddress],
          });
          if (!deposited) return;

          // For ACTIVE: check if 24h emergency timeout has passed
          const startedAt = Number(game[3]);
          const now = Math.floor(Date.now() / 1000);
          const EMERGENCY_TIMEOUT = 24 * 60 * 60;
          const canCancel = stateNum === 0 ? true : (now - startedAt >= EMERGENCY_TIMEOUT);
          const hoursLeft = stateNum === 1 && !canCancel
            ? Math.ceil((EMERGENCY_TIMEOUT - (now - startedAt)) / 3600)
            : undefined;

          refundable.push({
            gameId,
            buyIn,
            state: stateNames[stateNum],
            playerCount: players.length,
            canCancel,
            hoursUntilCancel: hoursLeft,
          });
        }
      } catch { /* skip */ }
    })
  );

  return refundable;
}

export default function ProfileRefunds() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [games, setGames] = useState<RefundableGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [claimAllLoading, setClaimAllLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchGames = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const results = await findRefundableGames(address as `0x${string}`);
      setGames(results);
    } catch (err) {
      console.error('Failed to scan:', err);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (expanded && games.length === 0 && !loading) fetchGames();
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Cancel + claim a single game. Handles all 3 states.
   */
  const processRefund = async (game: RefundableGame): Promise<boolean> => {
    if (!walletClient || !address) return false;
    const [account] = await walletClient.getAddresses();
    const contractAddr = getAddresses().monopolyGame;
    const chain = getChain();

    // Step 1: Cancel if not already cancelled
    if (game.state === 'ACTIVE') {
      setStatusMsg('Emergency cancelling...');
      const hash = await walletClient.writeContract({
        account, address: contractAddr, abi: MONOPOLY_GAME_ABI, chain,
        functionName: 'emergencyCancel',
        args: [game.gameId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
    } else if (game.state === 'WAITING') {
      setStatusMsg('Getting cancel signature...');
      const sigResp = await fetch('/api/contracts/cancellation-signature-by-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.gameId }),
      });
      if (!sigResp.ok) throw new Error('Failed to get cancel signature from server');
      const { nonce, signature } = await sigResp.json();

      setStatusMsg('Cancelling game...');
      const hash = await walletClient.writeContract({
        account, address: contractAddr, abi: MONOPOLY_GAME_ABI, chain,
        functionName: 'cancelGame',
        args: [game.gameId, nonce as `0x${string}`, signature as `0x${string}`],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
    }

    // Step 2: Claim refund
    setStatusMsg('Claiming refund...');
    const refundHash = await walletClient.writeContract({
      account, address: contractAddr, abi: MONOPOLY_GAME_ABI, chain,
      functionName: 'claimRefund',
      args: [game.gameId],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: refundHash });
    return true;
  };

  const handleClaim = async (game: RefundableGame) => {
    setProcessingId(game.gameId);
    setError('');
    setStatusMsg('');
    try {
      await processRefund(game);
      setSuccessCount((prev) => prev + 1);
      setGames((prev) => prev.filter((g) => g.gameId !== game.gameId));
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || '';
      if (msg.includes('User rejected') || msg.includes('denied')) {
        setError('Transaction rejected');
      } else {
        setError(msg || 'Failed');
      }
    } finally {
      setProcessingId(null);
      setStatusMsg('');
    }
  };

  const handleClaimAll = async () => {
    if (!walletClient || games.length === 0) return;
    setClaimAllLoading(true);
    setError('');
    let claimed = 0;

    // Only auto-claim CANCELLED games in Claim All (stuck ones need manual action)
    const claimable = [...games].filter((g) => g.state === 'CANCELLED');
    const skipped = games.length - claimable.length;

    for (const game of claimable) {
      setProcessingId(game.gameId);
      try {
        await processRefund(game);
        claimed++;
        setGames((prev) => prev.filter((g) => g.gameId !== game.gameId));
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || '';
        if (msg.includes('User rejected') || msg.includes('denied')) {
          setError(`Rejected after claiming ${claimed} refund(s)`);
          break;
        }
        // Skip and continue
      }
    }

    if (skipped > 0 && !error) {
      setError(`${skipped} stuck game(s) skipped — claim those individually`);
    }

    setSuccessCount((prev) => prev + claimed);
    setClaimAllLoading(false);
    setProcessingId(null);
    setStatusMsg('');
  };

  const totalClaimable = games.reduce((sum, g) => sum + g.buyIn, BigInt(0));

  const stateLabel = (s: GameState) => {
    switch (s) {
      case 'CANCELLED': return '🔴 Cancelled';
      case 'ACTIVE': return '🟡 Stuck (active)';
      case 'WAITING': return '🟠 Stuck (waiting)';
    }
  };

  const stateAction = (s: GameState) => {
    switch (s) {
      case 'CANCELLED': return 'Claim';
      case 'ACTIVE': return 'Cancel & Claim';
      case 'WAITING': return 'Cancel & Claim';
    }
  };

  return (
    <div className="profileRefunds">
      <button
        className="profileRefundsToggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span>$ Refunds{games.length > 0 ? ` (${games.length})` : ''}</span>
        <span className="profileRefundsArrow">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="profileRefundsContent">
          {loading && <p className="profileRefundsStatus">Scanning on-chain deposits...</p>}

          {!loading && games.length === 0 && (
            <p className="profileRefundsStatus">No unclaimed refunds</p>
          )}

          {error && <p className="lobbyError" style={{ fontSize: '0.45rem' }}>{error}</p>}
          {statusMsg && <p style={{ color: '#d4a843', fontSize: '0.4rem', textAlign: 'center' }}>{statusMsg}</p>}
          {successCount > 0 && <p style={{ color: '#4caf50', fontSize: '0.45rem', textAlign: 'center' }}>✅ {successCount} refund(s) claimed!</p>}

          {games.length > 0 && (
            <div className="profileRefundsSummary">
              <span>Total: <strong>{formatEther(totalClaimable)} ETH</strong></span>
              <button
                className="profileRefundClaimAllBtn"
                onClick={handleClaimAll}
                disabled={claimAllLoading || !!processingId}
              >
                {claimAllLoading ? 'Claiming...' : `Claim All (${games.filter(g => g.state === 'CANCELLED').length})`}
              </button>
            </div>
          )}

          {[...games].sort((a, b) => {
            const order: Record<GameState, number> = { CANCELLED: 0, WAITING: 1, ACTIVE: 2 };
            return order[a.state] - order[b.state];
          }).map((g) => (
            <div key={g.gameId} className="profileRefundRow">
              <div className="profileRefundInfo">
                <span className="profileRefundRoom" title={g.gameId}>
                  {g.gameId.slice(0, 10)}...
                </span>
                <span className="profileRefundAmount">{formatEther(g.buyIn)} ETH</span>
                <span className="profileRefundState">{stateLabel(g.state)}</span>
              </div>
              {g.canCancel !== false ? (
                <button
                  className="profileRefundClaimBtn"
                  onClick={() => handleClaim(g)}
                  disabled={processingId === g.gameId || claimAllLoading}
                >
                  {processingId === g.gameId ? '...' : stateAction(g.state)}
                </button>
              ) : (
                <span className="profileRefundLocked">
                  ⏳ {g.hoursUntilCancel}h
                </span>
              )}
            </div>
          ))}

          {!loading && (
            <button
              className="profileRefundsRefresh"
              onClick={fetchGames}
              style={{ marginTop: 8 }}
            >
              ↻ Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
}
