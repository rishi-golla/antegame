'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface CrapsProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

const DICE_IMAGES = [
  '/assets/minigames/dice/dice-1.png',
  '/assets/minigames/dice/dice-2.png',
  '/assets/minigames/dice/dice-3.png',
  '/assets/minigames/dice/dice-4.png',
  '/assets/minigames/dice/dice-5.png',
  '/assets/minigames/dice/dice-6.png',
];

export default function Craps({ onResult, baseAmount, context }: CrapsProps) {
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const selectTarget = (num: number) => { if (!gameStarted) setTargetNumber(num); };

  const rollDice = () => {
    if (!targetNumber || rolling) return;
    setGameStarted(true);
    setRolling(true);

    let rollCount = 0;
    const maxRolls = 20;
    const rollInterval = setInterval(() => {
      setDice1(Math.ceil(Math.random() * 6));
      setDice2(Math.ceil(Math.random() * 6));
      rollCount++;
      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const f1 = Math.ceil(Math.random() * 6);
        const f2 = Math.ceil(Math.random() * 6);
        const total = f1 + f2;
        setDice1(f1);
        setDice2(f2);
        setResult(total);
        setRolling(false);
        setTimeout(() => calculateResult(total), 1000);
      }
    }, 100);
  };

  const calculateResult = (total: number) => {
    if (!targetNumber) return;
    const difference = Math.abs(total - targetNumber);
    if ((total === 2 && targetNumber === 12) || (total === 12 && targetNumber === 2)) { onResult('catastrophic'); return; }
    if (difference === 0) onResult('win');
    else if (difference === 1) onResult('close-win');
    else if (difference === 2) onResult('close-loss');
    else onResult('loss');
  };

  return (
    <div className="craps pixelMinigame">
      <div className="crapsHeader">
        <h2 className="crapsTitle">CRAPS</h2>
        {targetNumber && <div className="crapsTarget">TARGET: {targetNumber}</div>}
      </div>

      {!gameStarted && (
        <div className="crapsTargetSelection">
          <div className="targetLabel">CHOOSE YOUR TARGET:</div>
          <div className="targetNumbers">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
              <button key={num} className={`targetBtn pixelBtn ${targetNumber === num ? 'selected' : ''}`} onClick={() => selectTarget(num)}>{num}</button>
            ))}
          </div>
        </div>
      )}

      <div className="crapsDiceArea">
        <div className="crapsDiceCup">
          <img src="/assets/minigames/dice/dice-cup.png" alt="cup" className="diceCupImg" />
        </div>
        <div className="crapsDice">
          <div className={`crapsDieImg ${rolling ? 'diceRolling' : ''}`}>
            <img src={DICE_IMAGES[dice1 - 1]} alt={`${dice1}`} className="dieImg" />
          </div>
          <div className={`crapsDieImg ${rolling ? 'diceRolling' : ''}`}>
            <img src={DICE_IMAGES[dice2 - 1]} alt={`${dice2}`} className="dieImg" />
          </div>
        </div>

        <div className="crapsInstructions">
          {!targetNumber ? 'SELECT A TARGET (2-12)' : !gameStarted ? 'CLICK ROLL DICE!' : rolling ? 'ROLLING...' : `YOU ROLLED ${dice1 + dice2}!`}
        </div>

        {targetNumber && !rolling && !result && (
          <button className="crapsRollBtn pixelBtn" onClick={rollDice}>ROLL DICE</button>
        )}

        {result && targetNumber && (
          <div className="crapsResult">
            <div className="crapsResultText">TARGET: {targetNumber} | ROLLED: {result}</div>
            <div className="crapsResultDiff">DIFFERENCE: {Math.abs(result - targetNumber)}</div>
          </div>
        )}
      </div>

      <div className="crapsPaytable">
        <div className="paytableRow">EXACT = WIN</div>
        <div className="paytableRow">OFF BY 1 = CLOSE WIN</div>
        <div className="paytableRow">OFF BY 2 = CLOSE LOSS</div>
        <div className="paytableRow">OFF BY 3+ = LOSS</div>
      </div>
    </div>
  );
}
