'use client';

import { useEffect, useRef } from 'react';

interface FeaturePanel {
  id: string;
  title: string;
  text: string;
  images: string[];
  reverse?: boolean;
}

const features: FeaturePanel[] = [
  {
    id: 'features',
    title: 'The Board',
    text: '40 casino-themed properties across 8 color sets. Buy, build, and bankrupt your opponents on a board dripping with neon and velvet.',
    images: [
      '/assets/tiles/prop-red.webp',
      '/assets/tiles/prop-dark-blue.webp',
      '/assets/tiles/prop-orange.webp',
      '/assets/tiles/corner-go.webp',
    ],
  },
  {
    id: 'minigames',
    title: '10 Casino Minigames',
    text: 'Land on Risk or Blind Chest and play blackjack, slots, craps, darts, wheel of fortune, and more. Win big or lose your stake.',
    images: [
      '/assets/minigames/slots/slot-machine.png',
      '/assets/minigames/cards/card-table.png',
      '/assets/minigames/wheel/wheel.png',
      '/assets/minigames/dice/dice-cup.png',
    ],
    reverse: true,
  },
  {
    id: 'onchain',
    title: 'Fully On-Chain',
    text: 'Smart contract escrow on Base. Every game is settled transparently. Your crypto, your keys, your winnings.',
    images: [
      '/assets/misc/casino-crest.webp',
      '/assets/tiles/corner-jail.webp',
    ],
  },
  {
    id: 'multiplayer',
    title: 'Play With Friends',
    text: 'Create private rooms, invite friends, or jump into quick play. Up to 6 players per game with real-time chat.',
    images: [
      '/assets/sprites/mobster.webp',
      '/assets/sprites/card-shark.webp',
      '/assets/sprites/tourist.webp',
      '/assets/sprites/vip.webp',
    ],
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
      <div className="featureImages">
        {feature.images.map((src, i) => (
          <img key={i} src={src} alt="" className="featureImage" loading="lazy" />
        ))}
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
