'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import DicePips from '@/components/Board/DicePips';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface CrapsProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

export default function Craps({ onResult, baseAmount, context, spectator = false }: CrapsProps) {
  const { play } = useAudio();
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState<'idle' | 'charge' | 'throw' | 'impact' | 'result'>('idle');
  const [gameStarted, setGameStarted] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const pendingRollRef = useRef<{ d1: number; d2: number } | null>(null);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'select-target') {
      setTargetNumber(data.num);
    } else if (data.type === 'roll') {
      pendingRollRef.current = { d1: data.d1, d2: data.d2 };
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const calculateResult = (total: number) => {
    if (!targetNumber) return;
    const difference = Math.abs(total - targetNumber);
    if ((total === 2 && targetNumber === 12) || (total === 12 && targetNumber === 2)) { onResult('catastrophic'); return; }
    if (difference === 0) onResult('win');
    else if (difference === 1) onResult('close-win');
    else if (difference === 2) onResult('close-loss');
    else onResult('loss');
  };

  const animateRoll = (finalD1: number, finalD2: number) => {
    const total = finalD1 + finalD2;
    setGameStarted(true);
    setRolling(true);
    play('minigames/dice-tumble');

    setRollPhase('charge');

    let rollCount = 0;
    const totalRolls = 20;

    setTimeout(() => {
      setRollPhase('throw');

      const doRoll = () => {
        if (rollCount >= totalRolls) {
          setDice1(finalD1);
          setDice2(finalD2);
          setRollPhase('impact');
          setTimeout(() => {
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

  // Spectator: react when pending roll arrives
  useEffect(() => {
    if (spectator && pendingRollRef.current && targetNumber && !rolling) {
      const { d1, d2 } = pendingRollRef.current;
      pendingRollRef.current = null;
      animateRoll(d1, d2);
    }
  }, [spectator, targetNumber, rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTarget = (num: number) => {
    if (!gameStarted && !spectator) {
      setTargetNumber(num);
      emitAction({ type: 'select-target', num });
    }
  };

  const rollDice = () => {
    if (!targetNumber || rolling || spectator) return;
    const finalD1 = Math.ceil(Math.random() * 6);
    const finalD2 = Math.ceil(Math.random() * 6);
    emitAction({ type: 'roll', d1: finalD1, d2: finalD2 });
    animateRoll(finalD1, finalD2);
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
              <button key={num} className={`targetBtn pixelBtn ${targetNumber === num ? 'selected' : ''}`} onClick={() => selectTarget(num)} disabled={spectator}>{num}</button>
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
          <button className="crapsRollBtn pixelBtn" onClick={rollDice} disabled={spectator}>ROLL DICE</button>
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
