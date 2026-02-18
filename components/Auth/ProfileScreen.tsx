'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  entry_fee_lamports: number;
  winner_payout_lamports: number;
}

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, updateProfile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [editChar, setEditChar] = useState(user?.characterId ?? '');

  useEffect(() => {
    fetch('/api/stats/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
        if (data?.history) setHistory(data.history);
      })
      .catch(() => {});
  }, []);

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
              <div className="statLabel">ETH Won</div>
            </div>
            <div className="statBox">
              <div className="statValue">{(stats.total_lost_lamports / 1e9).toFixed(2)}</div>
              <div className="statLabel">ETH Lost</div>
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
            <h3 className="profileHistoryTitle">Recent Games</h3>
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="profileHistoryRow">
                <span>{new Date(h.finished_at * 1000).toLocaleDateString()}</span>
                <span>{h.player_count}P</span>
                <span className="profileHistoryWinner">{h.winner_name}</span>
                <span>{(h.entry_fee_lamports / 1e9).toFixed(2)} ETH</span>
              </div>
            ))}
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
          <button className="setupStartBtn" onClick={() => setEditing(true)} style={{ marginTop: 12, fontSize: '0.7rem' }}>
            Edit Profile
          </button>
        )}

        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
