'use client';

import { useEffect, useRef } from 'react';

export default function AboutSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landingAboutVisible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landingAbout" id="about" ref={ref}>
      <div className="landingAboutInner">
        <div className="landingDivider">
          <span className="landingDividerLine" />
          <span className="landingDividerIcon">&#9830;&#9827;</span>
          <span className="landingDividerLine" />
        </div>
        <h2 className="landingAboutTitle">About</h2>
        <p className="landingAboutText">
          Ante is a multiplayer crypto board game on Base. Stake ETH, roll dice,
          land on properties, and play casino minigames to win &mdash; or lose &mdash; it all.
          The pot goes to the last player standing.
        </p>
        <img
          src="/assets/landing/crest-emblem.webp"
          alt=""
          className="landingAboutCrest"
        />
      </div>
    </section>
  );
}
