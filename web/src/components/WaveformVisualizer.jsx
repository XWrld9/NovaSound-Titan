/**
 * WaveformVisualizer — NovaSound TITAN LUX v6000
 * REWRITE : aucune injection de @keyframes dynamiques.
 * L'ancienne version injectait N @keyframes via <style> à chaque render,
 * corrompant le rendu et faisant planter l'audio + les boutons.
 * Solution : un seul @keyframes global "novaWave" + CSS custom properties par barre.
 */
import React, { useMemo, useEffect } from 'react';

// Inject the keyframe ONCE globally — pas dans le render
if (typeof document !== 'undefined' && !document.getElementById('nova-wave-style')) {
  const s = document.createElemen'style';
  s.id = 'nova-wave-style';
  s.textContent = '@keyframes novaWave { from { height: var(--bar-min,20%) } to { height: var(--bar-max,80%) } }';
  document.head.appendChild(s);
}

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
      const minH = 15 + Math.round(seed * 0.3);
      const maxH = 50 + Math.round(seed * 0.5);
      const dur  = (0.5 + (i % 5) * 0.18).toFixed(2);
      const del  = ((i * 37) % 500 / 1000).toFixed(3);
      return { minH, maxH, dur, del };
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
            opacity: isPlaying ? 0.85 : 0.28,
            height: `${bar.minH}%`,
            '--bar-min': `${bar.minH}%`,
            '--bar-max': `${bar.maxH}%`,
            transition: isPlaying ? 'opacity 0.3s' : 'height 0.5s ease-out, opacity 0.3s',
            animation: isPlaying
              ? `novaWave ${bar.dur}s ease-in-out ${bar.del}s infinite alternate`
              : 'none',
          }}
        />
      ))}
    </div>
  );
};

export default WaveformVisualizer;
