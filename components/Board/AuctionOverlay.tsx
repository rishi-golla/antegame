'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';

const GROUP_COLORS: Record<string, string> = {
  brown: '#8B4513',
  'light-blue': '#87CEEB',
  pink: '#FF69B4',
  orange: '#FF8C00',
  red: '#DC143C',
  yellow: '#FFD700',
  green: '#228B22',
  'dark-blue': '#1a1acd',
};

export default function AuctionOverlay() {
  const { state, dispatch } = useGame();
  const [bidAmount, setBidAmount] = useState('');

  if (state.phase !== 'auction' || !state.auctionState) return null;

  const auction = state.auctionState;
  const tile = state.tiles[auction.tileIndex];
  const activeBidder = auction.biddingOrder[auction.activeIndex];
  const currentPlayer = state.players[activeBidder];
  const isMyTurn = activeBidder === state.currentPlayerIndex;
  const minBid = auction.currentBid + 1;
  const highBidder = auction.currentBidder !== null
    ? state.players[auction.currentBidder]
    : null;

  const groupColor = tile.type === 'property' ? GROUP_COLORS[tile.colorGroup] : null;
  const price = 'price' in tile ? tile.price : 0;

  const handleBid = (amount: number) => {
    dispatch({ type: 'BID', amount });
    setBidAmount('');
  };

  return (
    <div className="auctionOverlay">
      <div className="auctionCard">
        {/* Property preview */}
        <div className="auctionPropertyCard">
          {groupColor && <div className="auctionPropStrip" style={{ background: groupColor }} />}
          <div className="auctionPropBody">
            <span className="auctionPropName">{tile.name}</span>
            <span className="auctionPropPrice">${price}</span>
          </div>
        </div>

        {/* Current bid display */}
        <div className="auctionBidDisplay">
          <span className="auctionBidLabel">Current Bid</span>
          <span className="auctionBidAmount">
            {auction.currentBid > 0 ? `$${auction.currentBid}` : '--'}
          </span>
          {highBidder && (
            <span className="auctionBidLeader" style={{ color: highBidder.color }}>
              {highBidder.name}
            </span>
          )}
        </div>

        {/* Bidder avatars */}
        <div className="auctionPlayers">
          {auction.biddingOrder.map((id) => {
            const p = state.players[id];
            const passed = auction.passedPlayers.includes(id);
            const active = id === activeBidder;
            const leading = id === auction.currentBidder;
            return (
              <div
                key={id}
                className={`auctionPlayer ${active ? 'auctionPlayerActive' : ''} ${passed ? 'auctionPlayerPassed' : ''} ${leading ? 'auctionPlayerLeading' : ''}`}
              >
                <div className="auctionPlayerAvatar" style={{ background: p.color }}>
                  {p.name[0]}
                </div>
                <span className="auctionPlayerName">{p.name}</span>
                {passed && <span className="auctionPlayerStatus">Out</span>}
                {active && !passed && <span className="auctionPlayerStatus active">Bidding</span>}
              </div>
            );
          })}
        </div>

        {/* Controls */}
        {isMyTurn ? (
          <div className="auctionActions">
            <div className="auctionBidRow">
              <button className="auctionBidQuick" onClick={() => handleBid(minBid)}>
                ${minBid}
              </button>
              {minBid + 9 <= currentPlayer.money && (
                <button className="auctionBidQuick" onClick={() => handleBid(auction.currentBid + 10)}>
                  +$10
                </button>
              )}
              {auction.currentBid + 50 <= currentPlayer.money && (
                <button className="auctionBidQuick" onClick={() => handleBid(auction.currentBid + 50)}>
                  +$50
                </button>
              )}
            </div>
            <div className="auctionCustomRow">
              <input
                type="number"
                placeholder={`$${minBid}+`}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={minBid}
                max={currentPlayer.money}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const amount = parseInt(bidAmount);
                    if (amount >= minBid && amount <= currentPlayer.money) handleBid(amount);
                  }
                }}
              />
              <button
                className="auctionBidSubmit"
                onClick={() => {
                  const amount = parseInt(bidAmount);
                  if (amount >= minBid && amount <= currentPlayer.money) handleBid(amount);
                }}
                disabled={!bidAmount || parseInt(bidAmount) < minBid}
              >
                Bid
              </button>
            </div>
            <button className="auctionPass" onClick={() => dispatch({ type: 'PASS_AUCTION' })}>
              Pass
            </button>
            <span className="auctionYourMoney">Your money: ${currentPlayer.money}</span>
          </div>
        ) : (
          <p className="auctionWaitText">
            Waiting for <span style={{ color: currentPlayer?.color, fontWeight: 700 }}>{currentPlayer?.name}</span>...
          </p>
        )}
      </div>
    </div>
  );
}
