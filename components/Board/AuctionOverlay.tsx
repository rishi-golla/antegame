'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';

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
  const currentBidderPlayer = auction.currentBidder !== null
    ? state.players[auction.currentBidder]
    : null;

  const handleBid = (amount: number) => {
    dispatch({ type: 'BID', amount });
    setBidAmount('');
  };

  const quickBids = [
    auction.currentBid + 10,
    auction.currentBid + 50,
    auction.currentBid + 100,
  ].filter((b) => b <= currentPlayer?.money);

  return (
    <div className="auctionOverlay">
      <div className="auctionCard">
        <h2 className="auctionTitle">Auction</h2>
        <p className="auctionProperty">{tile.name}</p>
        {'price' in tile && <p className="auctionListPrice">List price: ${tile.price}</p>}

        <div className="auctionBidInfo">
          {currentBidderPlayer ? (
            <p>
              Current bid: <strong>${auction.currentBid}</strong> by{' '}
              <span style={{ color: currentBidderPlayer.color }}>{currentBidderPlayer.name}</span>
            </p>
          ) : (
            <p>No bids yet</p>
          )}
        </div>

        <div className="auctionBidders">
          {auction.biddingOrder.map((id) => {
            const p = state.players[id];
            const passed = auction.passedPlayers.includes(id);
            const active = id === activeBidder;
            return (
              <div
                key={id}
                className={`auctionBidder ${active ? 'active' : ''} ${passed ? 'passed' : ''}`}
              >
                <div className="auctionBidderDot" style={{ background: p.color }} />
                <span>{p.name}</span>
                {passed && <span className="auctionPassedLabel">Passed</span>}
                {active && !passed && <span className="auctionActiveLabel">Bidding...</span>}
              </div>
            );
          })}
        </div>

        {isMyTurn && (
          <div className="auctionControls">
            <div className="auctionQuickBids">
              {quickBids.map((amount) => (
                <button
                  key={amount}
                  className="auctionQuickBid"
                  onClick={() => handleBid(amount)}
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div className="auctionCustomBid">
              <input
                type="number"
                placeholder={`Min $${minBid}`}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={minBid}
                max={currentPlayer.money}
              />
              <button
                className="auctionBidBtn"
                onClick={() => {
                  const amount = parseInt(bidAmount);
                  if (amount >= minBid && amount <= currentPlayer.money) {
                    handleBid(amount);
                  }
                }}
                disabled={!bidAmount || parseInt(bidAmount) < minBid}
              >
                Bid
              </button>
            </div>
            <button
              className="auctionPassBtn"
              onClick={() => dispatch({ type: 'PASS_AUCTION' })}
            >
              Pass
            </button>
          </div>
        )}

        {!isMyTurn && (
          <p className="auctionWaiting">Waiting for {currentPlayer?.name} to bid...</p>
        )}
      </div>
    </div>
  );
}
