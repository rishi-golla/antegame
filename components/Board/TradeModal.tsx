'use client';

import { useState, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { CHARACTERS } from '@/lib/assetMap';
import { TILES } from '@/lib/gameData';
import type { TradeOffer, GameState } from '@/types/game';

interface TradeModalProps {
  targetPlayer: number;
  onClose: () => void;
  myPlayerIndex?: number | null;
}

/* ── helpers ── */

function getPropertyValue(state: GameState, tileIndex: number): number {
  const tile = state.tiles[tileIndex];
  if (tile.type === 'property') return tile.price ?? 0;
  if (tile.type === 'railroad') return 200;
  if (tile.type === 'utility') return 150;
  return 0;
}

function getTileColor(tileIndex: number): string {
  const tile = TILES[tileIndex];
  if (tile.type === 'property') {
    const colors: Record<string, string> = {
      brown: '#8B4513', lightBlue: '#87CEEB', pink: '#D81B60',
      orange: '#FF8F00', red: '#D32F2F', yellow: '#FDD835',
      green: '#388E3C', darkBlue: '#1565C0',
    };
    return colors[tile.colorGroup ?? ''] ?? '#666';
  }
  if (tile.type === 'railroad') return '#555';
  if (tile.type === 'utility') return '#7B1FA2';
  return '#666';
}

/* ── mini property card for trade ── */

function TradePropCard({
  tileIndex,
  state,
  selected,
  onToggle,
  isMortgaged,
}: {
  tileIndex: number;
  state: GameState;
  selected: boolean;
  onToggle: () => void;
  isMortgaged: boolean;
}) {
  const tile = state.tiles[tileIndex];
  const houses = state.players.find(p => p.properties.includes(tileIndex))?.houses[tileIndex] ?? 0;
  const color = getTileColor(tileIndex);
  const value = getPropertyValue(state, tileIndex);

  return (
    <div
      className={`tradePropCard ${selected ? 'tradePropCardSelected' : ''} ${isMortgaged ? 'tradePropCardMortgaged' : ''}`}
      onClick={onToggle}
    >
      <div className="tradePropCardBar" style={{ background: color }} />
      <div className="tradePropCardBody">
        <span className="tradePropCardName">{tile.name}</span>
        <span className="tradePropCardPrice">${value}</span>
        {houses > 0 && (
          <span className="tradePropCardHouses">
            {houses === 5 ? '★' : '▪'.repeat(houses)}
          </span>
        )}
        {isMortgaged && <span className="tradePropCardMortgage">MORTGAGED</span>}
      </div>
      <div className="tradePropCardCheck">{selected ? '✓' : ''}</div>
    </div>
  );
}

/* ── main trade modal ── */

export default function TradeModal({ targetPlayer, onClose, myPlayerIndex }: TradeModalProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  // Use the actual player index of the proposer, not currentPlayerIndex
  const meIndex = myPlayerIndex != null && myPlayerIndex >= 0 ? myPlayerIndex : state.currentPlayerIndex;
  const me = state.players[meIndex];
  const them = state.players[targetPlayer];
  const meChar = CHARACTERS.find(c => c.color === me.color) ?? CHARACTERS[0];
  const themChar = CHARACTERS.find(c => c.color === them.color) ?? CHARACTERS[1];

  const [offerProps, setOfferProps] = useState<number[]>([]);
  const [requestProps, setRequestProps] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestMoney, setRequestMoney] = useState(0);

  const toggleProp = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);
  };

  // Calculate net values
  const offerValue = useMemo(() => {
    return offerProps.reduce((sum, idx) => sum + getPropertyValue(state, idx), 0) + offerMoney;
  }, [offerProps, offerMoney, state]);

  const requestValue = useMemo(() => {
    return requestProps.reduce((sum, idx) => sum + getPropertyValue(state, idx), 0) + requestMoney;
  }, [requestProps, requestMoney, state]);

  const handlePropose = () => {
    const offer: TradeOffer = {
      fromPlayer: meIndex,
      toPlayer: targetPlayer,
      offerMoney,
      requestMoney,
      offerProperties: offerProps,
      requestProperties: requestProps,
    };
    play('sfx/trade-offer');
    dispatch({ type: 'PROPOSE_TRADE', offer });
    onClose();
  };

  const hasContent = offerProps.length > 0 || requestProps.length > 0 || offerMoney > 0 || requestMoney > 0;

  return (
    <div className="tradeOverlay casinoBackdrop" onClick={onClose}>
      <div className="tradeCard pokerFelt tradeCardRevamp" onClick={(e) => e.stopPropagation()}>
        <h2 className="tradeTitle">Propose Trade</h2>

        <div className="tradeColumns">
          {/* LEFT: Your offer */}
          <div className="tradeColumn">
            <div className="tradeColumnHeader">
              <img src={meChar.sprite} alt={me.name} className="tradePlayerSprite" />
              <h3>{me.name} Offers</h3>
            </div>
            <div className="tradePropsGrid">
              {me.properties.length === 0 && <p className="tradeEmpty">No properties</p>}
              {me.properties.map((idx) => (
                <TradePropCard
                  key={idx}
                  tileIndex={idx}
                  state={state}
                  selected={offerProps.includes(idx)}
                  onToggle={() => toggleProp(offerProps, setOfferProps, idx)}
                  isMortgaged={me.mortgaged.includes(idx)}
                />
              ))}
            </div>
            <div className="tradeMoneyRow">
              <span className="tradeMoneyLabel">Cash</span>
              <input
                type="range"
                min={0}
                max={me.money}
                step={10}
                value={offerMoney}
                onChange={(e) => setOfferMoney(parseInt(e.target.value))}
                className="tradeMoneySlider"
              />
              <span className="tradeMoneyAmount">${offerMoney}</span>
            </div>
          </div>

          {/* CENTER divider */}
          <div className="tradeDivider">
            <span className="tradeDividerIcon">⇄</span>
          </div>

          {/* RIGHT: Your request */}
          <div className="tradeColumn">
            <div className="tradeColumnHeader">
              <img src={themChar.sprite} alt={them.name} className="tradePlayerSprite" />
              <h3>{them.name} Offers</h3>
            </div>
            <div className="tradePropsGrid">
              {them.properties.length === 0 && <p className="tradeEmpty">No properties</p>}
              {them.properties.map((idx) => (
                <TradePropCard
                  key={idx}
                  tileIndex={idx}
                  state={state}
                  selected={requestProps.includes(idx)}
                  onToggle={() => toggleProp(requestProps, setRequestProps, idx)}
                  isMortgaged={them.mortgaged.includes(idx)}
                />
              ))}
            </div>
            <div className="tradeMoneyRow">
              <span className="tradeMoneyLabel">Cash</span>
              <input
                type="range"
                min={0}
                max={them.money}
                step={10}
                value={requestMoney}
                onChange={(e) => setRequestMoney(parseInt(e.target.value))}
                className="tradeMoneySlider"
              />
              <span className="tradeMoneyAmount">${requestMoney}</span>
            </div>
          </div>
        </div>

        {/* Net value summary */}
        <div className="tradeValueSummary">
          <span style={{ color: me.color }}>You give: ~${offerValue}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ color: them.color }}>You get: ~${requestValue}</span>
        </div>

        <div className="tradeActions">
          <button className="tradePropose" onClick={handlePropose} disabled={!hasContent}>
            Propose Trade
          </button>
          <button className="tradeCancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Counter-Offer Modal ── */

function CounterOfferModal({
  originalOffer,
  onClose,
}: {
  originalOffer: TradeOffer;
  onClose: () => void;
}) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();

  // Flip: I'm the recipient, so I'm now the "from" in the counter
  const me = state.players[originalOffer.toPlayer];
  const them = state.players[originalOffer.fromPlayer];
  const meChar = CHARACTERS.find(c => c.color === me.color) ?? CHARACTERS[0];
  const themChar = CHARACTERS.find(c => c.color === them.color) ?? CHARACTERS[1];

  // Pre-fill with the flipped original offer
  const [offerProps, setOfferProps] = useState<number[]>(originalOffer.requestProperties);
  const [requestProps, setRequestProps] = useState<number[]>(originalOffer.offerProperties);
  const [offerMoney, setOfferMoney] = useState(originalOffer.requestMoney);
  const [requestMoney, setRequestMoney] = useState(originalOffer.offerMoney);

  const toggleProp = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);
  };

  const offerValue = useMemo(() => offerProps.reduce((s, i) => s + getPropertyValue(state, i), 0) + offerMoney, [offerProps, offerMoney, state]);
  const requestValue = useMemo(() => requestProps.reduce((s, i) => s + getPropertyValue(state, i), 0) + requestMoney, [requestProps, requestMoney, state]);

  const handleCounter = () => {
    const counter: TradeOffer = {
      fromPlayer: originalOffer.toPlayer,
      toPlayer: originalOffer.fromPlayer,
      offerMoney,
      requestMoney,
      offerProperties: offerProps,
      requestProperties: requestProps,
    };
    play('sfx/trade-offer');
    dispatch({ type: 'COUNTER_TRADE', offer: counter });
    onClose();
  };

  const hasContent = offerProps.length > 0 || requestProps.length > 0 || offerMoney > 0 || requestMoney > 0;

  return (
    <div className="tradeOverlay casinoBackdrop" style={{ zIndex: 210 }} onClick={onClose}>
      <div className="tradeCard pokerFelt tradeCardRevamp" onClick={(e) => e.stopPropagation()}>
        <h2 className="tradeTitle">Counter-Offer #{(originalOffer.counterCount ?? 0) + 1}</h2>

        <div className="tradeColumns">
          <div className="tradeColumn">
            <div className="tradeColumnHeader">
              <img src={meChar.sprite} alt={me.name} className="tradePlayerSprite" />
              <h3>{me.name} Offers</h3>
            </div>
            <div className="tradePropsGrid">
              {me.properties.length === 0 && <p className="tradeEmpty">No properties</p>}
              {me.properties.map((idx) => (
                <TradePropCard key={idx} tileIndex={idx} state={state} selected={offerProps.includes(idx)}
                  onToggle={() => toggleProp(offerProps, setOfferProps, idx)} isMortgaged={me.mortgaged.includes(idx)} />
              ))}
            </div>
            <div className="tradeMoneyRow">
              <span className="tradeMoneyLabel">Cash</span>
              <input type="range" min={0} max={me.money} step={10} value={offerMoney}
                onChange={(e) => setOfferMoney(parseInt(e.target.value))} className="tradeMoneySlider" />
              <span className="tradeMoneyAmount">${offerMoney}</span>
            </div>
          </div>

          <div className="tradeDivider"><span className="tradeDividerIcon">⇄</span></div>

          <div className="tradeColumn">
            <div className="tradeColumnHeader">
              <img src={themChar.sprite} alt={them.name} className="tradePlayerSprite" />
              <h3>{them.name} Offers</h3>
            </div>
            <div className="tradePropsGrid">
              {them.properties.length === 0 && <p className="tradeEmpty">No properties</p>}
              {them.properties.map((idx) => (
                <TradePropCard key={idx} tileIndex={idx} state={state} selected={requestProps.includes(idx)}
                  onToggle={() => toggleProp(requestProps, setRequestProps, idx)} isMortgaged={them.mortgaged.includes(idx)} />
              ))}
            </div>
            <div className="tradeMoneyRow">
              <span className="tradeMoneyLabel">Cash</span>
              <input type="range" min={0} max={them.money} step={10} value={requestMoney}
                onChange={(e) => setRequestMoney(parseInt(e.target.value))} className="tradeMoneySlider" />
              <span className="tradeMoneyAmount">${requestMoney}</span>
            </div>
          </div>
        </div>

        <div className="tradeValueSummary">
          <span style={{ color: me.color }}>You give: ~${offerValue}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ color: them.color }}>You get: ~${requestValue}</span>
        </div>

        <div className="tradeActions">
          <button className="tradePropose" onClick={handleCounter} disabled={!hasContent}>
            Send Counter
          </button>
          <button className="tradeCancel" onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}

/* ── Trade Offer View (recipient sees this) ── */

export function TradeOfferView({ myPlayerIndex }: { myPlayerIndex: number | null }) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const [showCounter, setShowCounter] = useState(false);

  if (!state.activeTradeOffer) return null;

  const offer = state.activeTradeOffer;
  const from = state.players[offer.fromPlayer];
  const to = state.players[offer.toPlayer];
  const fromChar = CHARACTERS.find(c => c.color === from.color) ?? CHARACTERS[0];
  const toChar = CHARACTERS.find(c => c.color === to.color) ?? CHARACTERS[1];
  // In free play (null or -1 index), you control all players so you're always the recipient
  // In multiplayer, only the actual recipient can accept/reject
  const isFreePlay = myPlayerIndex === null || myPlayerIndex < 0;
  const isRecipient = isFreePlay || offer.toPlayer === myPlayerIndex;
  const isProposer = !isFreePlay && offer.fromPlayer === myPlayerIndex;
  const counterNum = offer.counterCount ?? 0;

  return (
    <>
      <div className="tradeOverlay casinoBackdrop">
        <div className="tradeCard pokerFelt tradeOfferCardRevamp" onClick={(e) => e.stopPropagation()}>
          <h2 className="tradeTitle">
            {counterNum > 0 ? `Counter-Offer #${counterNum}` : 'Trade Offer'}
          </h2>
          <p className="tradeFromTo">
            <img src={fromChar.sprite} alt={from.name} className="tradePlayerSpriteSmall" />
            <span style={{ color: from.color, fontWeight: 700 }}>{from.name}</span>
            <span className="tradeArrow">→</span>
            <img src={toChar.sprite} alt={to.name} className="tradePlayerSpriteSmall" />
            <span style={{ color: to.color, fontWeight: 700 }}>{to.name}</span>
          </p>

          <div className="tradeColumns">
            <div className="tradeColumn">
              <h4>Offering</h4>
              <div className="tradePropsGrid">
                {offer.offerProperties.map((idx) => (
                  <TradePropCard key={idx} tileIndex={idx} state={state} selected={false}
                    onToggle={() => {}} isMortgaged={from.mortgaged.includes(idx)} />
                ))}
              </div>
              {offer.offerMoney > 0 && <p className="tradeOfferMoney">${offer.offerMoney}</p>}
              {offer.offerProperties.length === 0 && offer.offerMoney === 0 && <p className="tradeEmpty">Nothing</p>}
            </div>

            <div className="tradeDivider"><span className="tradeDividerIcon">⇄</span></div>

            <div className="tradeColumn">
              <h4>Requesting</h4>
              <div className="tradePropsGrid">
                {offer.requestProperties.map((idx) => (
                  <TradePropCard key={idx} tileIndex={idx} state={state} selected={false}
                    onToggle={() => {}} isMortgaged={to.mortgaged.includes(idx)} />
                ))}
              </div>
              {offer.requestMoney > 0 && <p className="tradeOfferMoney">${offer.requestMoney}</p>}
              {offer.requestProperties.length === 0 && offer.requestMoney === 0 && <p className="tradeEmpty">Nothing</p>}
            </div>
          </div>

          <div className="tradeActions">
            {isRecipient ? (
              <>
                <button className="tradeAccept" onClick={() => { play('sfx/trade-accept'); dispatch({ type: 'ACCEPT_TRADE' }); }}>
                  Accept
                </button>
                {counterNum < 5 && (
                  <button className="tradeCounter" onClick={() => setShowCounter(true)}>
                    Counter
                  </button>
                )}
                <button className="tradeReject" onClick={() => { play('sfx/trade-reject'); dispatch({ type: 'REJECT_TRADE' }); }}>
                  Reject
                </button>
              </>
            ) : isProposer ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                <p className="tradeWaiting">Waiting for <span style={{ color: to.color }}>{to.name}</span> to respond...</p>
                <button className="tradeCancel" onClick={() => dispatch({ type: 'CANCEL_TRADE' })} style={{ fontSize: '0.78rem', padding: '6px 16px' }}>
                  Cancel Offer
                </button>
              </div>
            ) : (
              <p className="tradeWaiting">Trade between {from.name} and {to.name}...</p>
            )}
          </div>
        </div>
      </div>

      {showCounter && (
        <CounterOfferModal
          originalOffer={offer}
          onClose={() => setShowCounter(false)}
        />
      )}
    </>
  );
}
