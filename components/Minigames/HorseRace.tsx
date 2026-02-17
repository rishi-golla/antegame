'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface HorseRaceProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

interface Horse {
  id: number;
  name: string;
  color: string;
  position: number;
  speed: number;
}

const HORSES: Omit<Horse, 'position' | 'speed'>[] = [
  { id: 1, name: 'RED FURY', color: '#ef4444' },
  { id: 2, name: 'BLUE BOLT', color: '#3b82f6' },
  { id: 3, name: 'GREEN WIND', color: '#22c55e' },
  { id: 4, name: 'GOLD RUSH', color: '#f59e0b' }
];

const TRACK_LENGTH = 100;

export default function HorseRace({ onResult, baseAmount, context }: HorseRaceProps) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [raceResults, setRaceResults] = useState<Horse[]>([]);

  useEffect(() => {
    // Initialize horses with random speeds
    const initialHorses = HORSES.map(horse => ({
      ...horse,
      position: 0,
      speed: 0.8 + Math.random() * 0.4 // Random speed between 0.8 and 1.2
    }));
    setHorses(initialHorses);

    // 15-second timeout
    const timer = setTimeout(() => {
      if (!raceFinished) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const selectHorse = (horseId: number) => {
    if (raceStarted) return;
    setSelectedHorse(horseId);
  };

  const startRace = () => {
    if (!selectedHorse || raceStarted) return;

    setRaceStarted(true);
    
    // Race duration: 3 seconds
    const raceInterval = setInterval(() => {
      setHorses(currentHorses => {
        const updatedHorses = currentHorses.map(horse => ({
          ...horse,
          position: Math.min(
            TRACK_LENGTH,
            horse.position + (horse.speed * (0.8 + Math.random() * 0.4))
          )
        }));

        // Check if any horse finished
        const finishedHorses = updatedHorses.filter(h => h.position >= TRACK_LENGTH);
        if (finishedHorses.length > 0 || updatedHorses.every(h => h.position > TRACK_LENGTH * 0.95)) {
          clearInterval(raceInterval);
          setTimeout(() => finishRace(updatedHorses), 500);
        }

        return updatedHorses;
      });
    }, 50);

    // Backup timer to ensure race ends
    setTimeout(() => {
      clearInterval(raceInterval);
      setHorses(currentHorses => {
        if (!raceFinished) {
          finishRace(currentHorses);
        }
        return currentHorses;
      });
    }, 3000);
  };

  const finishRace = (finalHorses: Horse[]) => {
    if (raceFinished) return;

    // Sort horses by position (descending)
    const sortedHorses = [...finalHorses].sort((a, b) => b.position - a.position);
    setRaceResults(sortedHorses);
    setRaceFinished(true);

    // Calculate result based on selected horse's position
    const selectedHorseResult = sortedHorses.find(h => h.id === selectedHorse);
    if (!selectedHorseResult) return;

    const position = sortedHorses.findIndex(h => h.id === selectedHorse) + 1;
    const selectedHorsePosition = selectedHorseResult.position;
    const lastPlace = sortedHorses[sortedHorses.length - 1];
    const isHugeMargin = selectedHorsePosition < lastPlace.position * 0.7; // Huge margin if < 70% of last place

    setTimeout(() => {
      if (position === 1) {
        onResult('win');
      } else if (position === 2) {
        onResult('close-win');
      } else if (position === 3) {
        onResult('close-loss');
      } else if (position === 4 && isHugeMargin) {
        onResult('catastrophic');
      } else {
        onResult('loss');
      }
    }, 1500);
  };

  const getHorseEmoji = (horseId: number) => {
    const emojis = ['🏇', '🐎', '🦄', '🏁'];
    return emojis[horseId - 1] || '🐎';
  };

  return (
    <div className="horseRace">
      <div className="raceHeader">
        <h2 className="raceTitle">HORSE RACE</h2>
        {selectedHorse && !raceStarted && (
          <div className="selectedHorse">
            Selected: {HORSES.find(h => h.id === selectedHorse)?.name}
          </div>
        )}
      </div>

      {!raceStarted && (
        <div className="horseSelection">
          <div className="selectionLabel">Pick your horse:</div>
          <div className="horseList">
            {HORSES.map(horse => (
              <button
                key={horse.id}
                className={`horseBtn ${selectedHorse === horse.id ? 'selected' : ''}`}
                onClick={() => selectHorse(horse.id)}
                style={{ borderColor: horse.color }}
              >
                <span className="horseName" style={{ color: horse.color }}>
                  {getHorseEmoji(horse.id)} {horse.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="raceTrack">
        <div className="trackHeader">
          <div className="startLine">START</div>
          <div className="finishLine">FINISH</div>
        </div>
        
        <div className="trackLanes">
          {horses.map(horse => (
            <div key={horse.id} className="lane">
              <div className="laneNumber">{horse.id}</div>
              <div className="laneTrack">
                <div 
                  className={`horse ${selectedHorse === horse.id ? 'selected' : ''} ${raceStarted ? 'running' : ''}`}
                  style={{ 
                    left: `${(horse.position / TRACK_LENGTH) * 100}%`,
                    transition: 'left 50ms linear'
                  }}
                >
                  <span style={{ color: horse.color }}>
                    {getHorseEmoji(horse.id)}
                  </span>
                </div>
                <div className="trackSurface"></div>
              </div>
              <div className="horseName" style={{ color: horse.color }}>
                {horse.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedHorse && !raceStarted && !raceFinished && (
        <button className="raceStartBtn" onClick={startRace}>
          START RACE!
        </button>
      )}

      {raceFinished && (
        <div className="raceResults">
          <div className="resultsTitle">Final Results:</div>
          {raceResults.map((horse, index) => (
            <div 
              key={horse.id} 
              className={`resultRow ${selectedHorse === horse.id ? 'yourHorse' : ''}`}
            >
              <span className="resultPosition">#{index + 1}</span>
              <span className="resultHorse" style={{ color: horse.color }}>
                {getHorseEmoji(horse.id)} {horse.name}
              </span>
              {selectedHorse === horse.id && (
                <span className="yourPick">← YOUR PICK</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="raceInstructions">
        {!selectedHorse ? (
          'Choose a horse to bet on!'
        ) : !raceStarted ? (
          'Click START RACE to begin!'
        ) : !raceFinished ? (
          'And they\'re off!'
        ) : (
          'Race finished!'
        )}
      </div>

      <div className="racePaytable">
        <div className="paytableRow">1st place = WIN</div>
        <div className="paytableRow">2nd place = CLOSE WIN</div>
        <div className="paytableRow">3rd place = CLOSE LOSS</div>
        <div className="paytableRow">4th place = LOSS</div>
        <div className="paytableRow">Last by huge margin = CATASTROPHIC</div>
      </div>
    </div>
  );
}