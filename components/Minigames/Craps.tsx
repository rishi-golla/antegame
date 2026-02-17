'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface CrapsProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

export default function Craps({ onResult, baseAmount, context }: CrapsProps) {
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    // 15-second timeout
    const timer = setTimeout(() => {
      onResult('catastrophic');
    }, 15000);

    return () => clearTimeout(timer);
  }, [onResult]);

  const selectTarget = (num: number) => {
    if (gameStarted) return;
    setTargetNumber(num);
  };

  const rollDice = () => {
    if (!targetNumber || rolling) return;

    setGameStarted(true);
    setRolling(true);

    // Animate dice rolling
    let rollCount = 0;
    const maxRolls = 20;

    const rollInterval = setInterval(() => {
      setDice1(Math.ceil(Math.random() * 6));
      setDice2(Math.ceil(Math.random() * 6));
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        
        // Final dice values
        const finalDice1 = Math.ceil(Math.random() * 6);
        const finalDice2 = Math.ceil(Math.random() * 6);
        const total = finalDice1 + finalDice2;
        
        setDice1(finalDice1);
        setDice2(finalDice2);
        setResult(total);
        setRolling(false);

        setTimeout(() => {
          calculateResult(total);
        }, 1000);
      }
    }, 100);
  };

  const calculateResult = (total: number) => {
    if (!targetNumber) return;

    const difference = Math.abs(total - targetNumber);
    
    // Snake eyes (2) when target was 12, or boxcars (12) when target was 2
    if ((total === 2 && targetNumber === 12) || (total === 12 && targetNumber === 2)) {
      onResult('catastrophic');
      return;
    }

    if (difference === 0) {
      onResult('win');
    } else if (difference === 1) {
      onResult('close-win');
    } else if (difference === 2) {
      onResult('close-loss');
    } else {
      onResult('loss');
    }
  };

  const getDipPips = (value: number) => {
    const pipPositions: Record<number, string[]> = {
      1: ['c'],
      2: ['tl', 'br'],
      3: ['tl', 'c', 'br'],
      4: ['tl', 'tr', 'bl', 'br'],
      5: ['tl', 'tr', 'c', 'bl', 'br'],
      6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br']
    };

    return pipPositions[value] || [];
  };

  const renderDie = (value: number, className: string = '') => (
    <div className={`crapsDie ${className} ${rolling ? 'rolling' : ''}`}>
      <div className="diceFace">
        {getDipPips(value).map((position, index) => (
          <div key={index} className={`dicePip ${position}`}></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="craps">
      <div className="crapsHeader">
        <h2 className="crapsTitle">CRAPS</h2>
        {targetNumber && (
          <div className="crapsTarget">Target: {targetNumber}</div>
        )}
      </div>

      {!gameStarted && (
        <div className="crapsTargetSelection">
          <div className="targetLabel">Choose your target number:</div>
          <div className="targetNumbers">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
              <button
                key={num}
                className={`targetBtn ${targetNumber === num ? 'selected' : ''}`}
                onClick={() => selectTarget(num)}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="crapsDiceArea">
        <div className="crapsInstructions">
          {!targetNumber ? (
            'Select a target number (2-12)'
          ) : !gameStarted ? (
            'Click "ROLL DICE" to play!'
          ) : rolling ? (
            'Rolling...'
          ) : (
            `You rolled ${dice1 + dice2}!`
          )}
        </div>

        <div className="crapsDice">
          {renderDie(dice1, 'die1')}
          {renderDie(dice2, 'die2')}
        </div>

        {targetNumber && !rolling && !result && (
          <button className="crapsRollBtn" onClick={rollDice}>
            ROLL DICE
          </button>
        )}

        {result && (
          <div className="crapsResult">
            <div className="crapsResultText">
              Target: {targetNumber} | Rolled: {result}
            </div>
            <div className="crapsResultDiff">
              Difference: {Math.abs(result - targetNumber)}
            </div>
          </div>
        )}
      </div>

      <div className="crapsPaytable">
        <div className="paytableRow">Exact match = WIN</div>
        <div className="paytableRow">Off by 1 = CLOSE WIN</div>
        <div className="paytableRow">Off by 2 = CLOSE LOSS</div>
        <div className="paytableRow">Off by 3+ = LOSS</div>
        <div className="paytableRow">Snake eyes/Boxcars opposite = CATASTROPHIC</div>
      </div>
    </div>
  );
}