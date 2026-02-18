'use client';

interface CTASectionProps {
  onConnect: () => void;
  onFreePlay?: () => void;
  connecting: boolean;
}

export default function CTASection({ onConnect, onFreePlay, connecting }: CTASectionProps) {
  return (
    <section className="landingCTA">
      <div className="landingCTAInner">
        <h2 className="landingCTATitle">Ready to Ante Up?</h2>
        <p className="landingCTASubtitle">Connect your wallet and join the table.</p>
        <div className="landingCTAButtons">
          <button
            className="landingCTABtn landingCTABtnPrimary"
            onClick={onConnect}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect with Base'}
          </button>
          <button className="landingCTABtn landingCTABtnDisabled" disabled>
            Connect with Solana (Coming Soon)
          </button>
          {onFreePlay && (
            <button className="landingCTABtn landingCTABtnGhost" onClick={onFreePlay}>
              Play for Free
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
