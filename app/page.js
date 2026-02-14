'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const players = [
  { id: 1, name: 'Ava', color: '#ff6b6b' },
  { id: 2, name: 'Kai', color: '#5cd6c0' },
  { id: 3, name: 'Maya', color: '#ffd166' },
  { id: 4, name: 'Leo', color: '#8fb8ff' }
];

const chatMessages = [
  { from: 'Ava', color: '#ff6b6b', text: 'I am buying Boardwalk!' },
  { from: 'Kai', color: '#5cd6c0', text: 'Nooo, that is expensive.' },
  { from: 'Maya', color: '#ffd166', text: 'Rent time soon.' },
  { from: 'Leo', color: '#8fb8ff', text: 'Rolling big next turn.' }
];

const gameLog = [
  'Ava rolled a 7 and landed on Boardwalk.',
  'Kai paid $50 luxury tax.',
  'Maya passed GO and collected $200.',
  'Leo traded Oak Blvd for Railroad.'
];

const tileLabels = [
  'GO',
  'Coral St',
  'Chance',
  'Mint Ave',
  'North Rail',
  'Lemon Sq',
  'Tax',
  'Clover Dr',
  'Sunset Blvd',
  'Utility',
  'Jail',
  'Orchid Ln',
  'Lake View',
  'Chance',
  'Rosewood',
  'East Rail',
  'Maple Park',
  'Tax',
  'Cherry Row',
  'Oak Crest',
  'Free Park',
  'Sapphire',
  'Chance',
  'Pearl St',
  'West Rail',
  'Hill Crest',
  'Tax',
  'Luna Ave',
  'Garden St',
  'Utility',
  'Go To Jail',
  'Willow Dr',
  'Plaza Way',
  'Chance',
  'Birch Point',
  'South Rail',
  'River Side',
  'Tax',
  'Golden Rd',
  'Park Lane'
];

function buildBoardTiles11x11() {
  const tiles = [];
  const labels = tileLabels.slice(0, 32);
  let idx = 0;

  const pushTile = (row, col, rowSpan, colSpan, orientation, isCorner = false) => {
    tiles.push({
      index: idx,
      label: labels[idx],
      row,
      col,
      rowSpan,
      colSpan,
      orientation,
      isCorner
    });
    idx += 1;
  };

  pushTile(10, 10, 2, 2, 'corner', true);
  for (let col = 9; col >= 3; col -= 1) pushTile(10, col, 2, 1, 'bottom');
  pushTile(10, 1, 2, 2, 'corner', true);
  for (let row = 9; row >= 3; row -= 1) pushTile(row, 1, 1, 2, 'left');
  pushTile(1, 1, 2, 2, 'corner', true);
  for (let col = 3; col <= 9; col += 1) pushTile(1, col, 2, 1, 'top');
  pushTile(1, 10, 2, 2, 'corner', true);
  for (let row = 3; row <= 9; row += 1) pushTile(row, 10, 1, 2, 'right');

  return tiles;
}

const boardTiles = buildBoardTiles11x11();

function SidePanel({ mode, setMode }) {
  const content = useMemo(() => {
    if (mode === 'chat') {
      return (
        <div className="sideContent chatContent">
          <div className="feed chatFeed">
            {chatMessages.map((message, i) => (
              <div key={i} className="bubble" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="bubbleAvatar" style={{ background: message.color }}>
                  {message.from[0]}
                </div>
                <div className="bubbleText">
                  <strong style={{ color: message.color }}>{message.from}</strong>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="inputRow">
            <input placeholder="Drop a message..." />
            <button>Send</button>
          </div>
        </div>
      );
    }

    return (
      <div className="sideContent">
        <div className="feed logFeed">
          {gameLog.map((entry, i) => (
            <div key={i} className="logEntry" style={{ animationDelay: `${i * 70}ms` }}>
              {entry}
            </div>
          ))}
        </div>
      </div>
    );
  }, [mode]);

  return (
    <aside className="rightPanel panel">
      <div className="toggleRow">
        <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}>
          Chat
        </button>
        <button className={mode === 'log' ? 'active' : ''} onClick={() => setMode('log')}>
          Game Log
        </button>
      </div>
      <div className="rightPanelBody">{content}</div>
    </aside>
  );
}

function Tile({ tile, activeTile, tokenPositions }) {
  const tokensOnTile = players
    .map((player, idx) => ({ player, idx }))
    .filter(({ idx }) => tokenPositions[idx] === tile.index);

  return (
    <div
      className={`tile tile-${tile.index % 4} tile-${tile.orientation} ${tile.isCorner ? 'tile-corner' : ''} ${activeTile === tile.index ? 'activeTile' : ''}`}
      style={{
        gridRow: `${tile.row} / span ${tile.rowSpan}`,
        gridColumn: `${tile.col} / span ${tile.colSpan}`
      }}
      title={tile.label}
    >
      <span>{tile.label}</span>
      {tokensOnTile.length > 0 ? (
        <div className="tokenStack">
          {tokensOnTile.map(({ player, idx }) => (
            <div key={idx} className="token" style={{ background: player.color }}>
              {player.name[0]}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DicePips({ value }) {
  const pips = {
    1: ['c'],
    2: ['tl', 'br'],
    3: ['tl', 'c', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'c', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br']
  };

  return (
    <div className="pipGrid">
      {pips[value].map((spot) => (
        <span key={spot} className={`pip ${spot}`} />
      ))}
    </div>
  );
}

function Board() {
  const [isRolling, setIsRolling] = useState(false);
  const [dice, setDice] = useState([4, 3]);
  const [isDiceFocus, setIsDiceFocus] = useState(false);
  const [rollPhase, setRollPhase] = useState('idle');
  const [impactPulse, setImpactPulse] = useState(false);
  const [activeTile, setActiveTile] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [tokenPositions, setTokenPositions] = useState([0, 0, 0, 0]);
  const [boardSize, setBoardSize] = useState(0);
  const tokenPositionsRef = useRef([0, 0, 0, 0]);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!frameRef.current) return;

    const updateSize = () => {
      if (!frameRef.current) return;
      const { clientWidth, clientHeight } = frameRef.current;
      setBoardSize(Math.max(0, Math.floor(Math.min(clientWidth, clientHeight))));
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(frameRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const rollDice = () => {
    if (isRolling) return;

    const first = Math.ceil(Math.random() * 6);
    const second = Math.ceil(Math.random() * 6);
    const steps = first + second;
    const throwStartMs = 140;
    const settleMs = 980;
    const impactAtMs = 520;

    setIsRolling(true);
    setIsDiceFocus(true);
    setRollPhase('charge');

    const jitter = setInterval(() => {
      setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 40);

    setTimeout(() => setRollPhase('throw'), throwStartMs);

    const moveOneStep = (remaining) => {
      if (remaining === 0) {
        const landed = tokenPositionsRef.current[currentPlayer];
        setActiveTile(landed);
        setIsRolling(false);
        setCurrentPlayer((prev) => (prev + 1) % players.length);
        return;
      }

      setTimeout(() => {
        const nextPositions = [...tokenPositionsRef.current];
        nextPositions[currentPlayer] = (nextPositions[currentPlayer] + 1) % boardTiles.length;
        tokenPositionsRef.current = nextPositions;
        setTokenPositions(nextPositions);
        setActiveTile(nextPositions[currentPlayer]);
        moveOneStep(remaining - 1);
      }, 185);
    };

    setTimeout(() => {
      setImpactPulse(true);
      setRollPhase('impact');
      setTimeout(() => setImpactPulse(false), 180);
    }, impactAtMs);

    setTimeout(() => {
      clearInterval(jitter);
      setDice([first, second]);
      setRollPhase('result');
      setTimeout(() => {
        setIsDiceFocus(false);
        setRollPhase('idle');
        moveOneStep(steps);
      }, 300);
    }, settleMs);
  };

  return (
    <section className="boardWrap">
      <div ref={frameRef} className={`boardFrame ${isDiceFocus ? 'focused' : ''}`}>
        <div className="boardGrid" style={boardSize ? { width: `${boardSize}px`, height: `${boardSize}px` } : undefined}>
          {boardTiles.map((tile) => (
            <Tile key={tile.index} tile={tile} activeTile={activeTile} tokenPositions={tokenPositions} />
          ))}

          <div className="boardCenterArt">
            <div className="deck deckCommunity" role="button" aria-label="Community Chest deck">
              <div className="deckCard back" />
              <div className="deckCard mid" />
              <div className="deckCard face">
                <span>Community</span>
                <strong>Chest</strong>
              </div>
            </div>

            <div className="deck deckChance" role="button" aria-label="Chance deck">
              <div className="deckCard back" />
              <div className="deckCard mid" />
              <div className="deckCard face">
                <span>Chance</span>
                <strong>Card</strong>
              </div>
            </div>

            <button className="rollButton" onClick={rollDice} disabled={isRolling}>
              {isRolling ? 'Rolling...' : `${players[currentPlayer].name} Roll`}
            </button>
            <p className="rollHint">{isRolling ? 'Dice In Motion' : 'Press Roll To Throw'}</p>
          </div>
        </div>

        {isDiceFocus ? (
          <div className={`diceFocusLayer phase-${rollPhase} ${impactPulse ? 'impact' : ''}`}>
            <div className="diceFocusBackdrop" />
            <div className="diceFocusOrbit">
              <div className="diceFocusShadow" />
              <div className={`focusDie dieA ${rollPhase === 'result' ? 'result' : ''}`}>
                <DicePips value={dice[0]} />
              </div>
              <div className={`focusDie dieB ${rollPhase === 'result' ? 'result' : ''}`}>
                <DicePips value={dice[1]} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function Home() {
  const [mode, setMode] = useState('chat');

  return (
    <main className="gameScreen">
      <aside className="leftPanel panel">
        <h2>Players</h2>
        <ul>
          {players.map((player, index) => (
            <li key={player.id}>
              <div className="avatar" style={{ background: player.color }}>
                {player.name[0]}
              </div>
              <div>
                <strong>{player.name}</strong>
                <p>Token #{index + 1}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <Board />
      <SidePanel mode={mode} setMode={setMode} />
    </main>
  );
}
