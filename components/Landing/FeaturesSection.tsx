'use client';

import { useEffect, useRef } from 'react';

interface FeaturePanel {
  id: string;
  title: string;
  text: string;
  image: string;
  reverse?: boolean;
}

const features: FeaturePanel[] = [
  {
    id: 'features',
    title: 'The Board',
    text: '40 casino-themed properties across 8 color sets. Buy, build, and bankrupt your opponents on a board dripping with neon and velvet.',
    image: '/assets/landing/feature-board.webp',
  },
  {
    id: 'minigames',
    title: '10 Casino Minigames',
    text: 'Land on Risk or Blind Chest and play blackjack, slots, craps, darts, wheel of fortune, and more. Win big or lose your stake.',
    image: '/assets/landing/feature-minigames.webp',
    reverse: true,
  },
  {
    id: 'onchain',
    title: 'Fully On-Chain',
    text: 'Smart contract escrow on Base. Every game is settled transparently. Your crypto, your keys, your winnings.',
    image: '/assets/landing/feature-onchain.webp',
  },
  {
    id: 'multiplayer',
    title: 'Play With Friends',
    text: 'Create private rooms, invite friends, or jump into quick play. Up to 6 players per game with real-time chat.',
    image: '/assets/landing/feature-multiplayer.webp',
    reverse: true,
  },
];

function FeatureCard({ feature }: { feature: FeaturePanel }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('featurePanelVisible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={feature.id}
      className={`featurePanel ${feature.reverse ? 'featurePanelReverse' : ''}`}
    >
      <div className="featureImageWrap">
        <img src={feature.image} alt={feature.title} className="featureImage" loading="lazy" />
      </div>
      <div className="featureText">
        <h3 className="featureTitle">{feature.title}</h3>
        <p className="featureDesc">{feature.text}</p>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="landingFeatures">
      {features.map((f) => (
        <FeatureCard key={f.id} feature={f} />
      ))}
    </section>
  );
}
