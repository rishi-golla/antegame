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
      'win': 0,
      'close-win': 0.5,
      'close-loss': 1.5,
      'loss': 2,
      'catastrophic': 5
    };

    const multiplier = multipliers[tier];
    const amount = Math.floor(baseAmount * multiplier);

    const messages: Record<MinigameTier, { title: string; description: string }> = {
      'win': {
        title: '🎉 JACKPOT! 🎉',
        description: context === 'buying' ? 'You got the property for FREE!' : 'You pay NO RENT!'
      },
      'close-win': {
        title: '✨ Close Win! ✨',
        description: context === 'buying' ? `Property at 50% price: $${amount}` : `Only 50% rent: $${amount}`
      },
      'close-loss': {
        title: '⚠️ Close Call ⚠️',
        description: `You pay 150% penalty: $${amount}`
      },
      'loss': {
        title: '💸 You Lost 💸',
        description: `You pay 200% penalty: $${amount}`
      },
      'catastrophic': {
        title: '💀 DISASTER! 💀',
        description: `CATASTROPHIC penalty: $${amount}!!!`
      }
    };

    return { ...messages[tier], amount };
  };

  const info = getTierInfo();

  return (
    <div className={`minigameResult tier-${tier}`}>
      <div className="minigameResultCard">
        <h2 className="minigameResultTitle">{info.title}</h2>
        <p className="minigameResultDesc">{info.description}</p>
        {tier !== 'win' && info.amount > 0 && (
          <div className="minigameResultAmount">
            <span className="minigameResultAmountLabel">Amount:</span>
            <span className="minigameResultAmountValue">${info.amount}</span>
          </div>
        )}
        <button 
          className="minigameResultBtn" 
          onClick={onDismiss}
        >
          Continue
        </button>
      </div>
    </div>
  );
}