'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const stats = [
  { label: 'Minigames', value: 10, suffix: '' },
  { label: 'Properties', value: 40, suffix: '' },
  { label: 'Max Players', value: 6, suffix: '' },
  { label: 'Fee', value: 0, suffix: '%' },
];

export default function StatsStrip() {
  return (
    <motion.section
      className="statsSection"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.8 }}
    >
      <div className="statsInner">
        {stats.map((s, i) => (
          <div key={i} className="statItem">
            <span className="statValue">
              <AnimatedCounter target={s.value} suffix={s.suffix} />
            </span>
            <span className="statLabel">{s.label}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
