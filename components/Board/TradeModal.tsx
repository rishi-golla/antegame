'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import type { TradeOffer } from '@/types/game';

interface TradeModalProps {
  targetPlayer: number;
  onClose: () => void;
}

export default function TradeModal({ targetPlayer, onClose }: TradeModalProps) {
  const { state, dispatch } = useGame();
  const me = state.players[state.currentPlayerIndex];
  const them = state.players[targetPlayer];

  const [offerProps, setOfferProps] = useState<number[]>([]);
  const [requestProps, setRequestProps] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestMoney, setRequestMoney] = useState(0);

  const toggleProp = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);
  };

  const handlePropose = () => {
    const offer: TradeOffer = {
      fromPlayer: state.currentPlayerIndex,
      toPlayer: targetPlayer,
      offerMoney,
      requestMoney,
      offerProperties: offerProps,
      requestProperties: requestProps,
    };
    dispatch({ type: 'PROPOSE_TRADE', offer });
    onClose();
  };

  const hasContent = offerProps.length > 0 || requestProps.length > 0 || offerMoney > 0 || requestMoney > 0;

  return (
    <div className="tradeOverlay" onClick={onClose}>
      <div className="tradeCard" onClick={(e) => e.stopPropagation()}>
        <h2 className="tradeTitle">Propose Trade</h2>
        <div className="tradeColumns">
          <div className="tradeColumn">
            <h3 style={{ color: me.color }}>You Offer</h3>
            <div className="tradeProps">
              {me.properties.filter((idx) => !me.mortgaged.includes(idx)).map((idx) => (
                <label key={idx} className={`tradePropItem ${offerProps.includes(idx) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={offerProps.includes(idx)}
                    onChange={() => toggleProp(offerProps, setOfferProps, idx)}
                  />
                  {state.tiles[idx].name}
                </label>
              ))}
            </div>
            <div className="tradeMoney">
              <label>Money: $</label>
              <input
                type="number"
                min={0}
                max={me.money}
                value={offerMoney}
                onChange={(e) => setOfferMoney(Math.max(0, Math.min(me.money, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>

          <div className="tradeDivider">
            <span>for</span>
          </div>

          <div className="tradeColumn">
            <h3 style={{ color: them.color }}>You Request</h3>
            <div className="tradeProps">
              {them.properties.filter((idx) => !them.mortgaged.includes(idx)).map((idx) => (
                <label key={idx} className={`tradePropItem ${requestProps.includes(idx) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={requestProps.includes(idx)}
                    onChange={() => toggleProp(requestProps, setRequestProps, idx)}
                  />
                  {state.tiles[idx].name}
                </label>
              ))}
            </div>
            <div className="tradeMoney">
              <label>Money: $</label>
              <input
                type="number"
                min={0}
                max={them.money}
                value={requestMoney}
                onChange={(e) => setRequestMoney(Math.max(0, Math.min(them.money, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
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

export function TradeOfferView() {
  const { state, dispatch } = useGame();

  if (state.phase !== 'trading' || !state.activeTradeOffer) return null;

  const offer = state.activeTradeOffer;
  const from = state.players[offer.fromPlayer];
  const to = state.players[offer.toPlayer];

  return (
    <div className="tradeOverlay">
      <div className="tradeCard tradeOfferCard">
        <h2 className="tradeTitle">Trade Offer</h2>
        <p className="tradeFromTo">
          <span style={{ color: from.color }}>{from.name}</span> offers to{' '}
          <span style={{ color: to.color }}>{to.name}</span>
        </p>

        <div className="tradeColumns">
          <div className="tradeColumn">
            <h4>Offering</h4>
            {offer.offerProperties.map((idx) => (
              <p key={idx} className="tradeOfferItem">{state.tiles[idx].name}</p>
            ))}
            {offer.offerMoney > 0 && <p className="tradeOfferItem">${offer.offerMoney}</p>}
            {offer.offerProperties.length === 0 && offer.offerMoney === 0 && <p className="tradeOfferEmpty">Nothing</p>}
          </div>

          <div className="tradeDivider"><span>for</span></div>

          <div className="tradeColumn">
            <h4>Requesting</h4>
            {offer.requestProperties.map((idx) => (
              <p key={idx} className="tradeOfferItem">{state.tiles[idx].name}</p>
            ))}
            {offer.requestMoney > 0 && <p className="tradeOfferItem">${offer.requestMoney}</p>}
            {offer.requestProperties.length === 0 && offer.requestMoney === 0 && <p className="tradeOfferEmpty">Nothing</p>}
          </div>
        </div>

        <div className="tradeActions">
          <button className="tradeAccept" onClick={() => dispatch({ type: 'ACCEPT_TRADE' })}>
            Accept
          </button>
          <button className="tradeReject" onClick={() => dispatch({ type: 'REJECT_TRADE' })}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
