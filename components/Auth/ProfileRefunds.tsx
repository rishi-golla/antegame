'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { createPublicClient, http, formatEther, keccak256, encodePacked } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getChainEnv, getRpcUrl, getAddresses } from '@/lib/contracts/addresses';
import { MONOPOLY_GAME_ABI } from '@/lib/contracts/abi/MonopolyGame';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/context/EVMWalletContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getGameAccountRaw, type OnChainGameData } from '@/lib/solana-program/queries';
import {
  cancelGameOnSolana,
  claimRefundOnSolana,
  emergencyCancelOnSolana,
  lamportsToSol,
} from '@/lib/solana-program/instructions';
import type { AnchorWallet } from '@solana/wallet-adapter-react';

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

interface UnclaimedSettlement {
  gameId: `0x${string}`;
  roomCode: string;
  nonce: `0x${string}`;
  signature: `0x${string}`;
  buyIn: bigint;
}

// --- Solana-specific types ---

interface SolanaRefundableGame {
  roomCode: string;
  gameId: string;
  buyInLamports: number;
  state: GameState;
  canCancel: boolean;
  hoursUntilCancel?: number;
  nonce?: string;
  signature?: string;
}

/**
 * Compute gameId from roomCode (must match server's roomCodeToGameId).
 */
function roomCodeToGameId(roomCode: string): `0x${string}` {
  return keccak256(encodePacked(['string'], [roomCode]));
}

/**
 * Map Solana on-chain state enum to GameState.
 */
function mapSolanaState(state: OnChainGameData['state']): GameState | 'SETTLED' {
  if ('waiting' in state) return 'WAITING';
  if ('active' in state) return 'ACTIVE';
  if ('cancelled' in state) return 'CANCELLED';
  return 'SETTLED';
}

/**
 * Find all games where this player deposited but can get money back.
 * Uses Alchemy transfer scan + server DB + pending-refunds to find gameIds.
 * Covers: CANCELLED (claimRefund), ACTIVE (emergencyCancel->claimRefund), WAITING (cancelGame->claimRefund)
 */
async function findRefundableGames(playerAddress: `0x${string}`): Promise<{ games: RefundableGame[]; activeGameIds: `0x${string}`[] }> {
  const client = getClient();
  const rpcUrl = getRpcUrl();
  const addresses = getAddresses();
  const contractAddr = addresses.monopolyGame;

  const gameIdSet = new Set<`0x${string}`>();

  // Source 1: Alchemy on-chain transfer scan (finds actual deposits)
  try {
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

    // Batch getTransaction calls (5 at a time to stay under rate limits)
    const BATCH_SIZE = 5;
    for (let i = 0; i < transfers.length; i += BATCH_SIZE) {
      const batch = transfers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((t: any) => client.getTransaction({ hash: t.hash as `0x${string}` }))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.input.length >= 74) {
          const gameId = ('0x' + r.value.input.slice(10, 74)) as `0x${string}`;
          gameIdSet.add(gameId);
        }
      }
    }
  } catch (err) {
    console.error('Transfer scan failed:', err);
  }

  // Source 2: Server game history DB
  try {
    const profileResp = await fetch('/api/stats/me');
    if (profileResp.ok) {
      const profileData = await profileResp.json();
      for (const h of (profileData.history ?? [])) {
        if (h.room_code && h.chain !== 'solana') gameIdSet.add(roomCodeToGameId(h.room_code));
      }
    }
  } catch { /* no stats available */ }

  // Source 3: Pending refunds (server-side file)
  try {
    const refundsResp = await fetch(`/api/refunds/${playerAddress}`);
    if (refundsResp.ok) {
      const refundsData = await refundsResp.json();
      for (const r of (refundsData.refunds ?? [])) {
        if (r.type !== 'settlement' && r.gameId && r.chain !== 'solana') {
          gameIdSet.add(r.gameId as `0x${string}`);
        }
      }
    }
  } catch { /* no refunds available */ }

  if (gameIdSet.size === 0) return { games: [], activeGameIds: [] };

  const refundable: RefundableGame[] = [];
  const activeGameIds: `0x${string}`[] = [];
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
        if (stateNum === 1) activeGameIds.push(gameId);
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
      } catch { /* game doesn't exist on-chain, skip */ }
    })
  );

  return { games: refundable, activeGameIds };
}

/**
 * Fetch unclaimed settlement entries from the server and verify they're still claimable on-chain.
 * Also attempts retroactive settlement for ACTIVE on-chain games where the user may be the winner.
 */
async function findUnclaimedSettlements(
  playerAddress: `0x${string}`,
  activeGameIds: `0x${string}`[],
): Promise<UnclaimedSettlement[]> {
  const client = getClient();
  const addresses = getAddresses();
  const contractAddr = addresses.monopolyGame;

  // 1. Check pending-refunds for already-persisted settlements
  const results: UnclaimedSettlement[] = [];
  const knownGameIds = new Set<string>();

  const resp = await fetch(`/api/refunds/${playerAddress}`);
  if (resp.ok) {
    const data = await resp.json();
    const settlements = (data.refunds ?? []).filter((r: any) => r.type === 'settlement');

    await Promise.all(
      settlements.map(async (s: any) => {
        try {
          const game = await client.readContract({
            address: contractAddr,
            abi: MONOPOLY_GAME_ABI,
            functionName: 'getGame',
            args: [s.gameId as `0x${string}`],
          }) as unknown as [bigint, bigint, bigint, bigint, number, readonly `0x${string}`[], `0x${string}`];

          const stateNum = Number(game[4]);
          // Only ACTIVE (1) games can have claimWinnings called -- SETTLED (2) means already claimed
          if (stateNum !== 1) return;

          knownGameIds.add(s.gameId);
          results.push({
            gameId: s.gameId as `0x${string}`,
            roomCode: s.roomCode,
            nonce: s.nonce as `0x${string}`,
            signature: s.signature as `0x${string}`,
            buyIn: game[0],
          });
        } catch { /* skip */ }
      })
    );
  }

  // 2. For ACTIVE on-chain games not already covered, try retroactive settlement
  const uncoveredActiveGames = activeGameIds.filter((id) => !knownGameIds.has(id));
  await Promise.all(
    uncoveredActiveGames.map(async (gameId) => {
      try {
        const sigResp = await fetch('/api/contracts/retroactive-settlement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        });
        if (!sigResp.ok) return; // not the winner or other error
        const { nonce, signature } = await sigResp.json();

        const game = await client.readContract({
          address: contractAddr,
          abi: MONOPOLY_GAME_ABI,
          functionName: 'getGame',
          args: [gameId],
        }) as unknown as [bigint, bigint, bigint, bigint, number, readonly `0x${string}`[], `0x${string}`];

        results.push({
          gameId,
          roomCode: '', // not needed -- we have the gameId directly
          nonce: nonce as `0x${string}`,
          signature: signature as `0x${string}`,
          buyIn: game[0],
        });
      } catch { /* skip */ }
    })
  );

  return results;
}

// --- Solana refund discovery ---

async function findRefundableSolanaGames(solAddress: string): Promise<SolanaRefundableGame[]> {
  const roomCodeSet = new Set<string>();
  // Map roomCode -> persisted refund data (nonce/signature)
  const persistedRefunds = new Map<string, { nonce: string; signature: string }>();

  // Source 1: Persisted refunds -- include chain === 'solana' or missing chain (legacy entries)
  try {
    const resp = await fetch(`/api/refunds/${solAddress}`);
    if (resp.ok) {
      const data = await resp.json();
      for (const r of (data.refunds ?? [])) {
        if (r.roomCode && r.chain !== 'base') {
          roomCodeSet.add(r.roomCode);
          if (r.nonce && r.signature && r.type !== 'settlement') {
            persistedRefunds.set(r.roomCode, { nonce: r.nonce, signature: r.signature });
          }
        }
      }
    }
  } catch { /* no refunds */ }

  // Source 2: Game history DB filtered by chain === 'solana'
  try {
    const resp = await fetch('/api/stats/me');
    if (resp.ok) {
      const data = await resp.json();
      for (const h of (data.history ?? [])) {
        if (h.chain === 'solana' && h.room_code) {
          roomCodeSet.add(h.room_code);
        }
      }
    }
  } catch { /* no stats */ }

  if (roomCodeSet.size === 0) return [];

  const playerPubkey = new PublicKey(solAddress);
  const refundable: SolanaRefundableGame[] = [];

  await Promise.all(
    [...roomCodeSet].map(async (roomCode) => {
      try {
        const game = await getGameAccountRaw(roomCode);
        if (!game) return;

        const state = mapSolanaState(game.state);
        if (state === 'SETTLED') return;

        // Find player index
        const playerIdx = game.players.findIndex(
          (p) => p.toBase58() === playerPubkey.toBase58()
        );
        if (playerIdx === -1) return;

        // Check if already refunded
        if (game.refunded[playerIdx]) return;

        // Check if actually deposited
        if (!game.deposited[playerIdx]) return;

        // For ACTIVE: check 24h emergency timeout
        const now = Math.floor(Date.now() / 1000);
        const EMERGENCY_TIMEOUT = 24 * 60 * 60;
        let canCancel = true;
        let hoursUntilCancel: number | undefined;

        if (state === 'ACTIVE') {
          canCancel = game.startedAt > 0 && (now - game.startedAt >= EMERGENCY_TIMEOUT);
          if (!canCancel) {
            hoursUntilCancel = Math.ceil((EMERGENCY_TIMEOUT - (now - game.startedAt)) / 3600);
          }
        }

        const persisted = persistedRefunds.get(roomCode);
        refundable.push({
          roomCode,
          gameId: roomCode, // use roomCode as display ID
          buyInLamports: game.buyIn,
          state: state as GameState,
          canCancel,
          hoursUntilCancel,
          nonce: persisted?.nonce,
          signature: persisted?.signature,
        });
      } catch { /* skip */ }
    })
  );

  return refundable;
}

export default function ProfileRefunds() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { activeChain } = useMultiChain();
  const solWallet = useWallet();

  const [games, setGames] = useState<RefundableGame[]>([]);
  const [solanaGames, setSolanaGames] = useState<SolanaRefundableGame[]>([]);
  const [settlements, setSettlements] = useState<UnclaimedSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [claimAllLoading, setClaimAllLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  const isSolana = activeChain === 'solana';

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isSolana) {
        const solAddress = solWallet.publicKey?.toBase58();
        if (!solAddress) return;
        const solResults = await findRefundableSolanaGames(solAddress);
        setSolanaGames(solResults);
        setGames([]);
        setSettlements([]);
      } else {
        if (!address) return;
        const { games: refundResults, activeGameIds } = await findRefundableGames(address as `0x${string}`);
        const settlementResults = await findUnclaimedSettlements(address as `0x${string}`, activeGameIds);
        // Remove ACTIVE games from refunds if they turned out to be settlements
        const settlementGameIds = new Set(settlementResults.map((s) => s.gameId));
        const filteredRefunds = refundResults.filter((g) => !settlementGameIds.has(g.gameId));
        setGames(filteredRefunds);
        setSettlements(settlementResults);
        setSolanaGames([]);
      }
    } catch (err) {
      console.error('Failed to scan:', err);
      setGames([]);
      setSettlements([]);
      setSolanaGames([]);
    } finally {
      setLoading(false);
    }
  }, [address, isSolana, solWallet.publicKey]);

  useEffect(() => {
    if (expanded && games.length === 0 && settlements.length === 0 && solanaGames.length === 0 && !loading) fetchGames();
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Base refund processing (unchanged) ---

  const processRefund = async (game: RefundableGame): Promise<boolean> => {
    if (!walletClient || !address) return false;
    const [account] = await walletClient.getAddresses();
    const contractAddr = getAddresses().monopolyGame;
    const chain = getChain();

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

    setStatusMsg('Claiming refund...');
    const refundHash = await walletClient.writeContract({
      account, address: contractAddr, abi: MONOPOLY_GAME_ABI, chain,
      functionName: 'claimRefund',
      args: [game.gameId],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: refundHash });
    return true;
  };

  // --- Solana refund processing ---

  const buildAnchorWallet = (): AnchorWallet | null => {
    if (!solWallet.publicKey || !solWallet.signTransaction || !solWallet.signAllTransactions) return null;
    return {
      publicKey: solWallet.publicKey,
      signTransaction: solWallet.signTransaction,
      signAllTransactions: solWallet.signAllTransactions,
    };
  };

  const processSolanaRefund = async (game: SolanaRefundableGame): Promise<boolean> => {
    const wallet = buildAnchorWallet();
    if (!wallet) throw new Error('Solana wallet not connected');

    const signerPubkey = process.env.NEXT_PUBLIC_SOLANA_GAME_SIGNER;
    if (!signerPubkey) throw new Error('Game signer not configured');

    if (game.state === 'ACTIVE') {
      // Emergency cancel (24h+ timeout)
      setStatusMsg('Emergency cancelling...');
      await emergencyCancelOnSolana(wallet, game.roomCode);
      setStatusMsg('Claiming refund...');
      await claimRefundOnSolana(wallet, game.roomCode);
    } else if (game.state === 'WAITING') {
      // Always request fresh signature from server (persisted ones may be stale)
      setStatusMsg('Getting cancel signature...');
      let nonce: string | undefined;
      let signature: string | undefined;
      try {
        const sigResp = await fetch('/api/contracts/solana/cancellation-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: game.roomCode }),
        });
        if (sigResp.ok) {
          const sigData = await sigResp.json();
          nonce = sigData.nonce;
          signature = sigData.signature;
        }
      } catch { /* fall back to persisted */ }

      // Fall back to persisted if server unavailable
      if (!nonce || !signature) {
        nonce = game.nonce;
        signature = game.signature;
      }
      if (!nonce || !signature) {
        throw new Error('No cancellation signature available');
      }

      setStatusMsg('Cancelling game...');
      await cancelGameOnSolana(wallet, game.roomCode, nonce, signature, signerPubkey);
      setStatusMsg('Claiming refund...');
      await claimRefundOnSolana(wallet, game.roomCode);
    } else if (game.state === 'CANCELLED') {
      setStatusMsg('Claiming refund...');
      await claimRefundOnSolana(wallet, game.roomCode);
    }

    return true;
  };

  // --- Handlers ---

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

  const handleSolanaClaim = async (game: SolanaRefundableGame) => {
    setProcessingId(game.roomCode);
    setError('');
    setStatusMsg('');
    try {
      await processSolanaRefund(game);
      setSuccessCount((prev) => prev + 1);
      setSolanaGames((prev) => prev.filter((g) => g.roomCode !== game.roomCode));
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || '';
      if (msg.includes('User rejected') || msg.includes('denied') || msg.includes('Reject')) {
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
    if (isSolana) {
      if (solanaGames.length === 0) return;
      setClaimAllLoading(true);
      setError('');
      let claimed = 0;

      const claimable = solanaGames.filter((g) => g.state === 'CANCELLED');
      const skipped = solanaGames.length - claimable.length;

      for (const game of claimable) {
        setProcessingId(game.roomCode);
        try {
          await processSolanaRefund(game);
          claimed++;
          setSolanaGames((prev) => prev.filter((g) => g.roomCode !== game.roomCode));
        } catch (err: any) {
          const msg = err?.shortMessage || err?.message || '';
          if (msg.includes('User rejected') || msg.includes('denied') || msg.includes('Reject')) {
            setError(`Rejected after claiming ${claimed} refund(s)`);
            break;
          }
        }
      }

      if (skipped > 0 && !error) {
        setError(`${skipped} stuck game(s) skipped -- claim those individually`);
      }

      setSuccessCount((prev) => prev + claimed);
      setClaimAllLoading(false);
      setProcessingId(null);
      setStatusMsg('');
    } else {
      if (!walletClient || games.length === 0) return;
      setClaimAllLoading(true);
      setError('');
      let claimed = 0;

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
        }
      }

      if (skipped > 0 && !error) {
        setError(`${skipped} stuck game(s) skipped -- claim those individually`);
      }

      setSuccessCount((prev) => prev + claimed);
      setClaimAllLoading(false);
      setProcessingId(null);
      setStatusMsg('');
    }
  };

  const handleClaimWinnings = async (settlement: UnclaimedSettlement) => {
    if (!walletClient || !address) return;
    setProcessingId(settlement.gameId);
    setError('');
    setStatusMsg('Claiming winnings...');
    try {
      const [account] = await walletClient.getAddresses();
      const contractAddr = getAddresses().monopolyGame;
      const chain = getChain();

      const hash = await walletClient.writeContract({
        account,
        address: contractAddr,
        abi: MONOPOLY_GAME_ABI,
        chain,
        functionName: 'claimWinnings',
        args: [settlement.gameId, settlement.nonce, settlement.signature],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setSuccessCount((prev) => prev + 1);
      setSettlements((prev) => prev.filter((s) => s.gameId !== settlement.gameId));
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || '';
      if (msg.includes('User rejected') || msg.includes('denied')) {
        setError('Transaction rejected');
      } else {
        setError(msg || 'Claim failed');
      }
    } finally {
      setProcessingId(null);
      setStatusMsg('');
    }
  };

  // --- Computed values ---

  const totalItems = isSolana
    ? solanaGames.length
    : games.length + settlements.length;

  const cancelledCount = isSolana
    ? solanaGames.filter((g) => g.state === 'CANCELLED').length
    : games.filter((g) => g.state === 'CANCELLED').length;

  const totalDisplay = isSolana
    ? `${lamportsToSol(solanaGames.reduce((sum, g) => sum + g.buyInLamports, 0)).toFixed(4)} SOL`
    : `${formatEther(games.reduce((sum, g) => sum + g.buyIn, BigInt(0)) + settlements.reduce((sum, s) => sum + s.buyIn, BigInt(0)))} ETH`;

  const stateLabel = (s: GameState) => {
    switch (s) {
      case 'CANCELLED': return 'Cancelled';
      case 'ACTIVE': return 'Stuck (active)';
      case 'WAITING': return 'Stuck (waiting)';
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
        <span>$ Refunds{totalItems > 0 ? ` (${totalItems})` : ''}</span>
        <span className="profileRefundsArrow">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="profileRefundsContent">
          {loading && <p className="profileRefundsStatus">Scanning on-chain deposits...</p>}

          {!loading && totalItems === 0 && (
            <p className="profileRefundsStatus">No unclaimed refunds</p>
          )}

          {error && <p className="lobbyError" style={{ fontSize: '0.45rem' }}>{error}</p>}
          {statusMsg && <p style={{ color: '#d4a843', fontSize: '0.4rem', textAlign: 'center' }}>{statusMsg}</p>}
          {successCount > 0 && <p style={{ color: '#4caf50', fontSize: '0.45rem', textAlign: 'center' }}>{successCount} refund(s) claimed!</p>}

          {totalItems > 0 && (
            <div className="profileRefundsSummary">
              <span>Total: <strong>{totalDisplay}</strong></span>
              <button
                className="profileRefundClaimAllBtn"
                onClick={handleClaimAll}
                disabled={claimAllLoading || !!processingId}
              >
                {claimAllLoading ? 'Claiming...' : `Claim All (${cancelledCount})`}
              </button>
            </div>
          )}

          {/* Base settlements */}
          {!isSolana && settlements.map((s) => (
            <div key={`settlement-${s.gameId}`} className="profileRefundRow">
              <div className="profileRefundInfo">
                <span className="profileRefundRoom" title={s.gameId}>
                  {s.gameId.slice(0, 10)}...
                </span>
                <span className="profileRefundAmount">{formatEther(s.buyIn)} ETH</span>
                <span className="profileRefundState" style={{ color: '#4caf50' }}>Winner</span>
              </div>
              <button
                className="profileRefundClaimBtn"
                onClick={() => handleClaimWinnings(s)}
                disabled={processingId === s.gameId || claimAllLoading}
                style={{ background: '#4caf50' }}
              >
                {processingId === s.gameId ? '...' : 'Claim Winnings'}
              </button>
            </div>
          ))}

          {/* Base refundable games */}
          {!isSolana && [...games].sort((a, b) => {
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
                  {g.hoursUntilCancel}h
                </span>
              )}
            </div>
          ))}

          {/* Solana refundable games */}
          {isSolana && [...solanaGames].sort((a, b) => {
            const order: Record<GameState, number> = { CANCELLED: 0, WAITING: 1, ACTIVE: 2 };
            return order[a.state] - order[b.state];
          }).map((g) => (
            <div key={g.roomCode} className="profileRefundRow">
              <div className="profileRefundInfo">
                <span className="profileRefundRoom" title={g.roomCode}>
                  {g.roomCode}
                </span>
                <span className="profileRefundAmount">{lamportsToSol(g.buyInLamports).toFixed(4)} SOL</span>
                <span className="profileRefundState">{stateLabel(g.state)}</span>
              </div>
              {g.canCancel !== false ? (
                <button
                  className="profileRefundClaimBtn"
                  onClick={() => handleSolanaClaim(g)}
                  disabled={processingId === g.roomCode || claimAllLoading}
                >
                  {processingId === g.roomCode ? '...' : stateAction(g.state)}
                </button>
              ) : (
                <span className="profileRefundLocked">
                  {g.hoursUntilCancel}h
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
              Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
}
