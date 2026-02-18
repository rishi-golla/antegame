'use client';

import { useState, useRef, useEffect } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';

interface ReferralData {
  referralCode: string;
  count: number;
  earnings: { totalWei: string; unpaidWei: string; paidWei: string };
}

export default function ReferralButton() {
  const { user } = useMultiChain();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const fetchData = async () => {
    if (data) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch('/api/auth/referrals', { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchData();
  };

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?ref=${user.walletAddress}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const formatEth = (wei: string) => {
    const n = Number(wei) / 1e18;
    if (n === 0) return '0';
    return n < 0.0001 ? '<0.0001' : n.toFixed(4);
  };

  return (
    <div className="referralBtnWrap" ref={ref}>
      <button className="referralBtn" onClick={handleOpen}>
        🔗 Refer
      </button>
      {open && (
        <div className="referralPanel">
          <div className="referralPanelTitle">Referral Program</div>
          <p className="referralPanelDesc">
            Earn <strong>10%</strong> of the house fee from every game your referrals play.
          </p>

          <div className="referralLinkRow">
            <input
              className="referralLinkInput"
              value={referralLink}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button className="referralCopyBtn" onClick={handleCopy}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>

          {loading && <div className="referralLoading">Loading...</div>}

          {data && (
            <div className="referralStats">
              <div className="referralStatRow">
                <span>Referrals</span>
                <span className="referralStatVal">{data.count}</span>
              </div>
              <div className="referralStatRow">
                <span>Total Earned</span>
                <span className="referralStatVal">{formatEth(data.earnings.totalWei)} ETH</span>
              </div>
              <div className="referralStatRow">
                <span>Pending Payout</span>
                <span className="referralStatVal">{formatEth(data.earnings.unpaidWei)} ETH</span>
              </div>
            </div>
          )}

          <p className="referralDisclaimer">
            Referral payouts are processed every 48 hours.
          </p>
        </div>
      )}
    </div>
  );
}
