'use client';

import { useState, useEffect } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';

interface LeaderboardEntry {
  referrer_wallet: string;
  display_name: string | null;
  referral_count: number;
  total_volume: number;
}

interface CampaignData {
  active: boolean;
  phase: 'upcoming' | 'boost' | 'normal' | 'ended' | 'none';
  campaignStartUtc?: string;
  campaignEndUtc?: string;
  boostEndsUtc?: string;
  timeRemainingMs?: number;
  boostTimeRemainingMs?: number;
  referralRatePercent?: number;
  leaderboard: LeaderboardEntry[];
}

export default function CampaignLeaderboardScreen({ onBack }: { onBack: () => void }) {
  const { user, activeChain } = useMultiChain();
  const chain = activeChain ?? user?.chain;
  const currencyLabel = chain === 'solana' ? 'SOL' : 'ETH';
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!chain) return;
    setLoading(true);
    fetch(`/api/auth/referrals/campaign?chain=${chain}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chain]);

  useEffect(() => {
    if (!data || data.phase === 'none' || data.phase === 'ended') return;
    const targetUtc = data.phase === 'boost'
      ? data.boostEndsUtc
      : data.phase === 'upcoming'
        ? data.campaignStartUtc
        : data.campaignEndUtc;
    if (!targetUtc) return;
    const target = new Date(targetUtc).getTime();

    function tick() {
      const diff = Math.max(0, target - Date.now());
      if (diff <= 0) { setCountdown('00:00:00'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data]);

  const medalColors = ['var(--gold-bright, #d4af37)', '#c0c0c0', '#cd7f32'];

  return (
    <div className="setupScreen">
      <div className="setupCard leaderboardCard">
        <h1 className="setupTitle marqueeTitle">Referral Campaign</h1>

        {loading ? (
          <p className="connectTagline">Loading...</p>
        ) : !data || data.phase === 'none' ? (
          <p className="connectTagline">No active campaign</p>
        ) : (
          <>
            {/* Phase banner */}
            {data.phase === 'boost' && (
              <div className="campaignBoostBanner">
                REFERRAL BOOST ACTIVE -- 50% of house fees
              </div>
            )}

            {/* Status bar */}
            <div className="campaignStatusBar">
              <div>
                <span className="campaignStatusLabel">
                  {data.phase === 'boost' ? 'Boost ends in'
                    : data.phase === 'normal' ? 'Campaign ends in'
                    : data.phase === 'upcoming' ? 'Starts in'
                    : 'Campaign ended'}
                </span>
                {data.phase !== 'ended' && (
                  <span className="campaignCountdown">{countdown}</span>
                )}
              </div>
              <div>
                <span className="campaignStatusLabel">Current Rate</span>
                <span className="campaignRateValue">{data.referralRatePercent ?? 10}%</span>
              </div>
            </div>

            {/* Prize info */}
            <div className="campaignPrizeInfo">
              Top 3 referrers by game volume earn 1% lifetime revenue share
            </div>

            {/* Leaderboard */}
            {data.leaderboard.length > 0 ? (
              <div className="campaignLeaderboard">
                <div className="campaignLbHeader">
                  <span className="campaignLbRank">#</span>
                  <span className="campaignLbPlayer">Referrer</span>
                  <span className="campaignLbRefs">Refs</span>
                  <span className="campaignLbVol">Volume</span>
                </div>
                {data.leaderboard.map((entry, i) => {
                  const isMe = entry.referrer_wallet === user?.walletAddress;
                  const truncWallet = `${entry.referrer_wallet.slice(0, 6)}...${entry.referrer_wallet.slice(-4)}`;
                  return (
                    <div
                      key={entry.referrer_wallet}
                      className={`campaignLbRow ${isMe ? 'campaignLbRowMe' : ''} ${i < 3 ? 'campaignLbTop3' : ''}`}
                    >
                      <span
                        className="campaignLbRank"
                        style={i < 3 ? { color: medalColors[i], textShadow: `0 0 6px ${medalColors[i]}` } : undefined}
                      >
                        {i + 1}
                      </span>
                      <span className="campaignLbPlayer">
                        {entry.display_name || truncWallet}
                        {isMe && <span className="campaignLbYou"> (you)</span>}
                      </span>
                      <span className="campaignLbRefs">{entry.referral_count}</span>
                      <span className="campaignLbVol">{(entry.total_volume / 1e9).toFixed(4)} {currencyLabel}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="campaignEmptyState">
                No referral activity yet. Share your link to climb the leaderboard!
              </div>
            )}

            {/* How it works */}
            <div className="campaignHowItWorks">
              <h3>How it works</h3>
              <ul>
                <li>Share your referral link (tap "Refer" in the top right)</li>
                <li>When your referrals play games, their game volume counts toward your rank</li>
                <li>First 24 hours: earn 50% of house fees from referred games</li>
                <li>After 24 hours: earn 10% of house fees</li>
                <li>Top 3 by volume after 7 days win 1% lifetime revenue each</li>
              </ul>
            </div>
          </>
        )}

        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
