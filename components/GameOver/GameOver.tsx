'use client';

import { useGame } from '@/context/GameContext';
import { getNetWorth } from '@/lib/gameEngine';

interface GameOverProps {
  onPlayAgain: () => void;
}

export default function GameOver({ onPlayAgain }: GameOverProps) {
  const { state } = useGame();

  if (state.winner === null) return null;

  const winner = state.players[state.winner];
  const rankings = [...state.players]
    .sort((a, b) => {
      if (a.bankrupt && !b.bankrupt) return 1;
      if (!a.bankrupt && b.bankrupt) return -1;
      return getNetWorth(state, b.id) - getNetWorth(state, a.id);
    });

  return (
    <div className="gameOverOverlay casinoBackdrop jackpotOverlay">
      <div className="gameOverCard jackpotCard">
        <div className="jackpotLights" />
        <div className="gameOverCrown">&#x1F451;</div>
        <div className="jackpotLabel">JACKPOT</div>
        <h1 className="gameOverTitle jackpotWinner">{winner.name} Wins!</h1>
        <p className="gameOverSub">Final Standings</p>

        <div className="gameOverRankings">
          {rankings.map((player, i) => (
            <div key={player.id} className={`gameOverRank ${player.bankrupt ? 'bankrupt' : ''}`}>
              <span className="gameOverPos">#{i + 1}</span>
              <div className="gameOverAvatar" style={{ background: player.color }}>
                {player.name[0]}
              </div>
              <span className="gameOverName">{player.name}</span>
              <span className="gameOverWorth">
                {player.bankrupt ? 'Bankrupt' : `$${getNetWorth(state, player.id).toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>

        <button className="setupStartBtn" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
