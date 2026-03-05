'use client';

import { useState, useEffect } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import ProfileRefunds from './ProfileRefunds';

interface Stats {
  games_played: number;
  games_won: number;
  total_earned_lamports: number;
  total_lost_lamports: number;
  minigames_played: number;
  minigames_won: number;
}

interface HistoryEntry {
  id: number;
  finished_at: number;
  duration_ms: number;
  player_count: number;
  winner_name: string;
  winner_wallet: string;
  entry_fee_lamports: number;
  winner_payout_lamports: number;
  room_code: string;
  players: string; // JSON string
  chain?: string;
}

interface ReferralInfo {
  referredBy: { wallet: string; displayName: string | null } | null;
  referralCode: string;
  count: number;
}

interface CampaignLeaderboardEntry {
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
  leaderboard: CampaignLeaderboardEntry[];
}

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, updateProfile } = useMultiChain();
  // Derive chain from the actual logged-in user, not from activeChain (which can be null/stale)
  const chain = user?.chain;
  const currencyLabel = chain === 'solana' ? 'SOL' : 'ETH';
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [editChar, setEditChar] = useState(user?.characterId ?? '');
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!chain) return; // wait until chain is known
    const chainParam = `?chain=${chain}`;
    fetch(`/api/stats/me${chainParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
        if (data?.history) setHistory(data.history);
      })
      .catch(() => {});
    fetch('/api/auth/referrals', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setReferralInfo({ referredBy: data.referredBy, referralCode: data.referralCode, count: data.count });
      })
      .catch(() => {});
    fetch(`/api/auth/referrals/campaign${chainParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setCampaign(data); })
      .catch(() => {});
  }, [chain]);

  // Countdown timer
  useEffect(() => {
    if (!campaign || campaign.phase === 'none' || campaign.phase === 'ended') return;
    const targetMs = campaign.phase === 'boost'
      ? new Date(campaign.boostEndsUtc!).getTime()
      : new Date(campaign.campaignEndUtc!).getTime();

    function tick() {
      const diff = Math.max(0, targetMs - Date.now());
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
  }, [campaign]);

  const handleSave = async () => {
    await updateProfile(editName, editChar);
    setEditing(false);
  };

  const char = CHARACTERS.find((c) => c.id === user?.characterId);

  return (
    <div className="setupScreen">
      <div className="setupCard profileCard">
        <h1 className="setupTitle marqueeTitle">Profile</h1>

        <div className="profileHeader">
          {char && (
            <img src={char.sprite} alt={char.name} className="profileSprite" />
          )}
          <div>
            <div className="profileName">{user?.displayName ?? 'Anonymous'}</div>
            <div className="profileAddr">{user?.walletAddress ?? ''}</div>
          </div>
        </div>

        {referralInfo && (
          <div className="profileReferralSection">
            <div className="referralStatRow" style={{ marginBottom: 8 }}>
              <span>Referred by</span>
              <span className="referralStatVal">
                {referralInfo.referredBy
                  ? `${referralInfo.referredBy.wallet.slice(0, 6)}...${referralInfo.referredBy.wallet.slice(-4)}`
                  : 'None'}
              </span>
            </div>
            <div className="referralStatRow" style={{ marginBottom: 8 }}>
              <span>Your Referrals</span>
              <span className="referralStatVal">{referralInfo.count}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#bbb', fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginBottom: 6 }}>
              Your Referral Link
            </div>
            <div className="referralLinkRow">
              <input
                className="referralLinkInput"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${referralInfo.referralCode}`}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                className="referralCopyBtn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralInfo.referralCode}`);
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2000);
                  } catch { /* ignore */ }
                }}
              >
                {refCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {campaign && campaign.phase !== 'none' && (
          <div className="profileReferralSection" style={{ marginTop: 16 }}>
            {campaign.phase === 'boost' && (
              <div style={{
                background: 'linear-gradient(90deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)',
                color: '#1a0a00',
                fontWeight: 800,
                textAlign: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '0.9rem',
                marginBottom: 12,
                fontFamily: "'Nunito', sans-serif",
              }}>
                REFERRAL BOOST ACTIVE - 50% fees!
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#d4af37', fontFamily: "'Nunito', sans-serif" }}>
                Referral Campaign
              </span>
              <span style={{ fontSize: '0.8rem', color: '#bbb', fontFamily: "'Nunito', sans-serif" }}>
                {campaign.phase === 'ended'
                  ? 'Campaign ended'
                  : campaign.phase === 'upcoming'
                    ? 'Starting soon'
                    : countdown}
              </span>
            </div>
            {campaign.phase !== 'ended' && (
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
                {campaign.phase === 'boost'
                  ? `Boost ends in ${countdown} -- Rate: 50%`
                  : `Campaign ends in ${countdown} -- Rate: 10%`}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#d4af37', marginBottom: 10, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
              Top 3 earn 1% lifetime revenue
            </div>
            {campaign.leaderboard.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {campaign.leaderboard.slice(0, 10).map((entry, i) => {
                  const isMe = entry.referrer_wallet === user?.walletAddress;
                  const truncWallet = `${entry.referrer_wallet.slice(0, 6)}...${entry.referrer_wallet.slice(-4)}`;
                  const volEth = (entry.total_volume / 1e9).toFixed(4);
                  return (
                    <div key={entry.referrer_wallet} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: isMe ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                      border: isMe ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
                      fontSize: '0.8rem',
                      fontFamily: "'Nunito', sans-serif",
                    }}>
                      <span style={{ color: i < 3 ? '#d4af37' : '#888', fontWeight: i < 3 ? 800 : 600, minWidth: 24 }}>
                        #{i + 1}
                      </span>
                      <span style={{ flex: 1, color: isMe ? '#d4af37' : '#ccc', fontWeight: isMe ? 700 : 400, marginLeft: 8 }}>
                        {entry.display_name || truncWallet}
                        {isMe && ' (you)'}
                      </span>
                      <span style={{ color: '#888', fontSize: '0.7rem', marginRight: 8 }}>
                        {entry.referral_count} refs
                      </span>
                      <span style={{ color: '#d4af37', fontWeight: 700 }}>
                        {volEth} {currencyLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', padding: 12, fontFamily: "'Nunito', sans-serif" }}>
                No referral activity yet. Share your link to get started!
              </div>
            )}
          </div>
        )}

        {stats && (
          <div className="statsGrid">
            <div className="statBox">
              <div className="statValue">{stats.games_played}</div>
              <div className="statLabel">Games</div>
            </div>
            <div className="statBox">
              <div className="statValue">{stats.games_won}</div>
              <div className="statLabel">Wins</div>
            </div>
            <div className="statBox">
              <div className="statValue">{(stats.total_earned_lamports / 1e9).toFixed(2)}</div>
              <div className="statLabel">{currencyLabel} Won</div>
            </div>
            <div className="statBox">
              <div className="statValue">{(stats.total_lost_lamports / 1e9).toFixed(2)}</div>
              <div className="statLabel">{currencyLabel} Lost</div>
            </div>
            <div className="statBox">
              <div className="statValue">{stats.minigames_played}</div>
              <div className="statLabel">Minigames</div>
            </div>
            <div className="statBox">
              <div className="statValue">{stats.minigames_won}</div>
              <div className="statLabel">MG Wins</div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="profileHistory">
            <h3 className="profileHistoryTitle">Game History</h3>
            {history.map((h) => {
              const isWinner = h.winner_wallet === user?.walletAddress;
              const dur = h.duration_ms > 0 ? `${Math.floor(h.duration_ms / 60000)}m` : '';
              return (
                <div key={h.id} className={`profileHistoryRow ${isWinner ? 'historyWin' : 'historyLoss'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(212,175,55,0.5)' }}>
                      {h.room_code ? `#${h.room_code}` : `#${h.id}`}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(212,175,55,0.5)' }}>
                      {new Date(h.finished_at * 1000).toLocaleDateString()} {dur && `· ${dur}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 4 }}>
                    <span>
                      {h.player_count}P · Winner: <strong className="profileHistoryWinner">{h.winner_name}</strong>
                    </span>
                    <span style={{ color: isWinner ? '#22c55e' : '#ff4444', fontWeight: 700 }}>
                      {isWinner ? '+' : '-'}{(h.entry_fee_lamports / 1e9).toFixed(4)} {currencyLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ProfileRefunds />

        {editing ? (
          <div className="profileEditSection">
            <input
              className="setupPlayerInput"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={20}
              placeholder="Display name"
            />
            <div className="characterGrid" style={{ marginTop: 8 }}>
              {CHARACTERS.map((c) => (
                <div
                  key={c.id}
                  className={`characterCard ${editChar === c.id ? 'characterCardSelected' : ''}`}
                  onClick={() => setEditChar(c.id)}
                >
                  <img src={c.sprite} alt={c.name} className="characterCardSprite" draggable={false} />
                  <span className="characterCardName">{c.name}</span>
                </div>
              ))}
            </div>
            <button className="setupStartBtn" onClick={handleSave} style={{ marginTop: 12 }}>Save</button>
            <button className="lobbyBackBtn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <button className="setupStartBtn" onClick={() => setEditing(true)} style={{ marginTop: 12 }}>
            Edit Profile
          </button>
        )}

        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
