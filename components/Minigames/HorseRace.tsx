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
  img: string;
}

const HORSE_DATA = [
  { id: 1, name: 'RED FURY', color: '#ef4444', img: '/assets/minigames/horses/horse-1.png' },
  { id: 2, name: 'BLUE BOLT', color: '#3b82f6', img: '/assets/minigames/horses/horse-2.png' },
  { id: 3, name: 'GREEN WIND', color: '#22c55e', img: '/assets/minigames/horses/horse-3.png' },
];

const TRACK_LENGTH = 100;

export default function HorseRace({ onResult, baseAmount, context }: HorseRaceProps) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [raceResults, setRaceResults] = useState<Horse[]>([]);

  useEffect(() => {
    const initialHorses = HORSE_DATA.map(horse => ({
      ...horse, position: 0, speed: 0.8 + Math.random() * 0.4
    }));
    setHorses(initialHorses);
    const timer = setTimeout(() => { if (!raceFinished) onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const selectHorse = (horseId: number) => { if (!raceStarted) setSelectedHorse(horseId); };

  const startRace = () => {
    if (!selectedHorse || raceStarted) return;
    setRaceStarted(true);

    const raceInterval = setInterval(() => {
      setHorses(currentHorses => {
        const updatedHorses = currentHorses.map(horse => ({
          ...horse,
          position: Math.min(TRACK_LENGTH, horse.position + (horse.speed * (0.8 + Math.random() * 0.4)))
        }));
        const finishedHorses = updatedHorses.filter(h => h.position >= TRACK_LENGTH);
        if (finishedHorses.length > 0 || updatedHorses.every(h => h.position > TRACK_LENGTH * 0.95)) {
          clearInterval(raceInterval);
          setTimeout(() => finishRace(updatedHorses), 500);
        }
        return updatedHorses;
      });
    }, 50);

    setTimeout(() => {
      clearInterval(raceInterval);
      setHorses(currentHorses => { if (!raceFinished) finishRace(currentHorses); return currentHorses; });
    }, 3000);
  };

  const finishRace = (finalHorses: Horse[]) => {
    if (raceFinished) return;
    const sortedHorses = [...finalHorses].sort((a, b) => b.position - a.position);
    setRaceResults(sortedHorses);
    setRaceFinished(true);
    const position = sortedHorses.findIndex(h => h.id === selectedHorse) + 1;

    setTimeout(() => {
      if (position === 1) onResult('win');
      else if (position === 2) onResult('close-win');
      else if (position === 3) onResult('loss');
      else onResult('catastrophic');
    }, 1500);
  };

  return (
    <div className="horseRace pixelMinigame" style={{ backgroundImage: 'url(/assets/minigames/horses/track.png)', backgroundSize: 'cover' }}>
      <div className="hrOverlayBg">
        <div className="raceHeader">
          <h2 className="raceTitle">HORSE RACE</h2>
          {selectedHorse && !raceStarted && (
            <div className="selectedHorse">PICK: {HORSE_DATA.find(h => h.id === selectedHorse)?.name}</div>
          )}
        </div>

        {!raceStarted && (
          <div className="horseSelection">
            <div className="selectionLabel">PICK YOUR HORSE:</div>
            <div className="horseList">
              {HORSE_DATA.map(horse => (
                <button key={horse.id} className={`horseBtn pixelBtn ${selectedHorse === horse.id ? 'selected' : ''}`} onClick={() => selectHorse(horse.id)}>
                  <img src={horse.img} alt={horse.name} className="horseBtnImg" />
                  <span className="horseName" style={{ color: horse.color }}>{horse.name}</span>
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
                <div className="laneTrack">
                  <div className={`horse ${selectedHorse === horse.id ? 'selected' : ''} ${raceStarted ? 'running horseGallop' : ''}`}
                    style={{ left: `${(horse.position / TRACK_LENGTH) * 100}%` }}>
                    <img src={horse.img} alt={horse.name} className="horseSprite" />
                  </div>
                  <div className="trackSurface"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedHorse && !raceStarted && !raceFinished && (
          <button className="raceStartBtn pixelBtn" onClick={startRace}>START RACE!</button>
        )}

        {raceFinished && (
          <div className="raceResults">
            {raceResults.map((horse, index) => (
              <div key={horse.id} className={`resultRow ${selectedHorse === horse.id ? 'yourHorse' : ''}`}>
                <span className="resultPosition">#{index + 1}</span>
                <img src={horse.img} alt="" className="resultHorseImg" />
                <span style={{ color: horse.color }}>{horse.name}</span>
                {selectedHorse === horse.id && <span className="yourPick">← YOU</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
