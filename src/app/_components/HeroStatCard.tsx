"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: string;
}

interface HeroStatCardProps {
  stats: StatItem[];
}

function useCountUp(target: number, decimals = 0, durationMs = 1200) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, decimals, durationMs]);

  return current;
}

function AnimatedStat({ stat }: { stat: StatItem }) {
  const value = useCountUp(stat.value, stat.decimals ?? 0);
  const formatted =
    stat.decimals && stat.decimals > 0
      ? value.toFixed(stat.decimals)
      : new Intl.NumberFormat('en-IN').format(value);

  return (
    <div>
      <div
        className='font-mono text-2xl font-semibold tabular-nums leading-none'
        style={{ color: stat.color ?? 'var(--rm-ink)' }}
      >
        {stat.prefix ?? ''}
        {formatted}
        {stat.suffix ?? ''}
      </div>
      <div
        className='text-xs mt-1.5 font-sans'
        style={{ color: 'var(--rm-ink-muted)' }}
      >
        {stat.label}
      </div>
    </div>
  );
}

export default function HeroStatCard({ stats }: HeroStatCardProps) {
  return (
    <div
      className='rounded-[6px] border p-6 grid grid-cols-2 gap-6'
      style={{
        backgroundColor: 'var(--rm-surface)',
        borderColor: 'var(--rm-border)',
      }}
    >
      <div
        className='col-span-2 pb-4 border-b text-xs font-sans font-medium'
        style={{
          borderColor: 'var(--rm-border)',
          color: 'var(--rm-ink-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Live · Command Center
      </div>
      {stats.map((s) => (
        <AnimatedStat key={s.label} stat={s} />
      ))}
    </div>
  );
}
