/**
 * WaveformVisualizer — NovaSound TITAN LUX v30
 * Visualiseur de waveform animé dans le mini-player et le player expanded.
 * Utilise des barres CSS animées (pas de Web Audio API = zéro overhead).
 */
import React, { useMemo } from 'react';

const WaveformVisualizer = ({
  isPlaying = false,
  barCount = 32,
  color = '#06b6d4',
  height = 24,
  className = '',
}) => {
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const seed = (i * 13 + 7) % 100;
      const minH = 20 + seed * 0.3;
      const maxH = 50 + seed * 0.5;
      const duration = 0.4 + (seed * 0.007);
      const delay = (i * 0.02) % 0.5;
      return { minH, maxH, duration, delay };
    });
  }, [barCount]);

  return (
    <div
      className={`flex items-end gap-px ${className}`}
      style={{ height, overflow: 'hidden' }}
      aria-hidden="true"
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 2,
            backgroundColor: color,
            opacity: isPlaying ? 0.85 : 0.35,
            height: isPlaying ? `${bar.maxH}%` : `${bar.minH}%`,
            transition: isPlaying
              ? `height ${bar.duration}s ease-in-out ${bar.delay}s, opacity 0.3s`
              : 'height 0.4s ease-out, opacity 0.3s',
            animationName: isPlaying ? `waveBar_${i}` : 'none',
            animationDuration: `${bar.duration}s`,
            animationTimingFunction: 'ease-in-out',
            animationDelay: `${bar.delay}s`,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
          }}
        />
      ))}
      <style>{bars.map((bar, i) =>
        `@keyframes waveBar_${i} { 0% { height: ${bar.minH}%; } 100% { height: ${bar.maxH}%; } }`
      ).join('\n')}</style>
    </div>
  );
};

export default WaveformVisualizer;
