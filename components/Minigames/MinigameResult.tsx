'use client';

import type { MinigameTier, MinigameContext } from '@/types/game';

interface MinigameResultProps {
  tier: MinigameTier;
  baseAmount: number;
  context: MinigameContext;
  onDismiss: () => void;
}

export default function MinigameResult({ tier, baseAmount, context, onDismiss }: MinigameResultProps) {
  const getTierInfo = () => {
    const multipliers: Record<MinigameTier, number> = {
      'win': 0, 'close-win': 0.5, 'close-loss': 1.5, 'loss': 2, 'catastrophic': 5
    };
    const multiplier = multipliers[tier];
    const amount = Math.floor(baseAmount * multiplier);
    const messages: Record<MinigameTier, { title: string; description: string }> = {
      'win': { title: 'JACKPOT!', description: context === 'buying' ? 'FREE PROPERTY!' : 'NO RENT!' },
      'close-win': { title: 'CLOSE WIN!', description: context === 'buying' ? `50% PRICE: $${amount}` : `50% RENT: $${amount}` },
      'close-loss': { title: 'CLOSE CALL', description: `150% PENALTY: $${amount}` },
      'loss': { title: 'YOU LOST', description: `200% PENALTY: $${amount}` },
      'catastrophic': { title: 'DISASTER!', description: `500% PENALTY: $${amount}!!!` },
    };
    return { ...messages[tier], amount };
  };

  const info = getTierInfo();

  const getBannerSrc = () => {
    if (tier === 'win') return '/assets/minigames/results/jackpot.png';
    if (tier === 'close-win') return '/assets/minigames/results/win-banner.png';
    if (tier === 'close-loss' || tier === 'loss' || tier === 'catastrophic') return '/assets/minigames/results/lose-banner.png';
    return '/assets/minigames/results/lose-banner.png';
  };

  return (
    <div className={`minigameResult pixelOverlay tier-${tier} resultEffect-${tier}`}>
      {/* Confetti for win */}
      {tier === 'win' && (
        <div className="pixelConfetti">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="confettiPiece" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
              backgroundColor: ['var(--gold)', 'var(--neon-red)', '#4ade80', '#3b82f6', '#f59e0b'][i % 5],
            }} />
          ))}
        </div>
      )}

      {/* Sparkle for close-win */}
      {tier === 'close-win' && (
        <div className="pixelSparkles">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="sparklePiece" style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 1.5}s`,
            }} />
          ))}
        </div>
      )}

      {/* Skull overlay for catastrophic */}
      {tier === 'catastrophic' && <div className="catastrophicSkull">💀</div>}

      <div className="minigameResultCard">
        <img src={getBannerSrc()} alt="" className="resultBannerImg" />
        <h2 className="minigameResultTitle">{info.title}</h2>
        <p className="minigameResultDesc">{info.description}</p>
        {tier !== 'win' && info.amount > 0 && (
          <div className="minigameResultAmount">
            <span className="minigameResultAmountLabel">AMOUNT:</span>
            <span className="minigameResultAmountValue">${info.amount}</span>
          </div>
        )}
        <button className="minigameResultBtn pixelBtn" onClick={onDismiss}>CONTINUE</button>
      </div>
    </div>
  );
}
