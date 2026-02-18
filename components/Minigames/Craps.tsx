'use client';

import { useState, useEffect, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import DicePips from '@/components/Board/DicePips';
import { useAudio } from '@/context/AudioContext';

interface CrapsProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

export default function Craps({ onResult, baseAmount, context }: CrapsProps) {
  const { play } = useAudio();
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState<'idle' | 'charge' | 'throw' | 'impact' | 'result'>('idle');
  const [gameStarted, setGameStarted] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const selectTarget = (num: number) => { if (!gameStarted) setTargetNumber(num); };

  const rollDice = () => {
    if (!targetNumber || rolling) return;
    setGameStarted(true);
    setRolling(true);
    play('minigames/dice-tumble');

    const finalD1 = Math.ceil(Math.random() * 6);
    const finalD2 = Math.ceil(Math.random() * 6);
    const total = finalD1 + finalD2;

    // Phase 1: Charge (dice pull back)
    setRollPhase('charge');

    // Rapid face cycling during throw
    let rollCount = 0;
    const totalRolls = 20;

    setTimeout(() => {
      // Phase 2: Throw
      setRollPhase('throw');

      const doRoll = () => {
        if (rollCount >= totalRolls) {
          setDice1(finalD1);
          setDice2(finalD2);

          // Phase 3: Impact
          setRollPhase('impact');
          setTimeout(() => {
            // Phase 4: Result
            setRollPhase('result');
            setResult(total);
            setRolling(false);
            setTimeout(() => calculateResult(total), 1200);
          }, 200);
          return;
        }

        setDice1(Math.ceil(Math.random() * 6));
        setDice2(Math.ceil(Math.random() * 6));
        rollCount++;
        const delay = 40 + Math.pow(rollCount / totalRolls, 2.5) * 180;
        setTimeout(doRoll, delay);
      };

      doRoll();
    }, 200);
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
        <div className={`crapsDiceTable craps-phase-${rollPhase}`}>
          <div className={`crapsDie crapsDieCSS dieA ${rollPhase === 'result' ? 'craps-result' : ''}`}>
            <DicePips value={dice1} />
          </div>
          <div className={`crapsDie crapsDieCSS dieB ${rollPhase === 'result' ? 'craps-result' : ''}`}>
            <DicePips value={dice2} />
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
