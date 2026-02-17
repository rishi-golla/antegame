'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [landed, setLanded] = useState(false);
  const die1Ref = useRef<HTMLDivElement>(null);
  const die2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const selectTarget = (num: number) => { if (!gameStarted) setTargetNumber(num); };

  const rollDice = () => {
    if (!targetNumber || rolling) return;
    setGameStarted(true);
    setRolling(true);
    setLanded(false);

    // Rapid face cycling with decreasing speed
    const finalD1 = Math.ceil(Math.random() * 6);
    const finalD2 = Math.ceil(Math.random() * 6);
    const total = finalD1 + finalD2;

    let rollCount = 0;
    const totalRolls = 24;

    const doRoll = () => {
      if (rollCount >= totalRolls) {
        // Final landing
        setDice1(finalD1);
        setDice2(finalD2);
        setResult(total);
        setRolling(false);
        setLanded(true);

        // Bounce effect on land
        if (die1Ref.current) die1Ref.current.classList.add('diceBounce');
        if (die2Ref.current) die2Ref.current.classList.add('diceBounce');

        setTimeout(() => {
          if (die1Ref.current) die1Ref.current.classList.remove('diceBounce');
          if (die2Ref.current) die2Ref.current.classList.remove('diceBounce');
        }, 400);

        setTimeout(() => calculateResult(total), 1200);
        return;
      }

      // Random face each tick
      setDice1(Math.ceil(Math.random() * 6));
      setDice2(Math.ceil(Math.random() * 6));
      rollCount++;

      // Speed decreases as we approach the end (starts fast, slows down)
      const delay = 50 + Math.pow(rollCount / totalRolls, 2) * 200;
      setTimeout(doRoll, delay);
    };

    doRoll();
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
      <h2 className="crapsTitle">CRAPS</h2>
      {targetNumber && <div className="crapsTarget">TARGET: {targetNumber}</div>}

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
        <div className="crapsDiceTable">
          <div
            ref={die1Ref}
            className={`crapsDie ${rolling ? 'diceRolling' : ''} ${landed ? 'diceLanded' : ''}`}
          >
            <img src={DICE_IMAGES[dice1 - 1]} alt={`${dice1}`} className="dieImg" />
          </div>
          <div
            ref={die2Ref}
            className={`crapsDie ${rolling ? 'diceRolling' : ''} ${landed ? 'diceLanded' : ''}`}
            style={{ animationDelay: '0.05s' }}
          >
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
