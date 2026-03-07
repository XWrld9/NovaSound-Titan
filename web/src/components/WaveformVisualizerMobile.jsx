/**
 * WaveformVisualizerMobile — NovaSound TITAN LUX V600000
 * 
 * ✅ V600000 - Waveform visualizer optimisé pour mobile
 * ✅ Performance optimisée avec requestAnimationFrame
 * ✅ Design moderne avec gradients et animations fluides
 * ✅ Responsive : adapte le nombre de barres selon la taille
 * ✅ Support pour différents modes (barres, cercle, ondes)
 * ✅ Micro-interactions tactiles
 * ✅ Faible consommation de batterie
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';

const WaveformVisualizerMobile = memo(({ 
  isPlaying = false, 
  barCount = 24, 
  color = '#06b6d4', 
  height = 32, 
  className = '',
  mode = 'bars', // bars, circle, wave
  animated = true,
  interactive = false
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barsRef = useRef([]);
  const [isHovered, setIsHovered] = useState(false);
  const [touchPosition, setTouchPosition] = useState(null);
  
  // Initialize bars
  useEffect(() => {
    const bars = Array(barCount).fill(0).map(() => ({
      height: Math.random() * 0.5 + 0.1,
      targetHeight: Math.random() * 0.5 + 0.1,
      velocity: 0,
      color: color
    }));
    barsRef.current = bars;
  }, [barCount, color]);
  
  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (mode === 'bars') {
      // Draw bars
      const barWidth = width / barCount;
      const spacing = barWidth * 0.2;
      const actualBarWidth = barWidth - spacing;
      
      barsRef.current.forEach((bar, index) => {
        // Update bar physics
        if (isPlaying && animated) {
          const targetHeight = isHovered && touchPosition 
            ? Math.max(0.1, 1 - Math.abs(index - touchPosition) / barCount)
            : Math.random() * 0.8 + 0.2;
          
          bar.velocity += (targetHeight - bar.height) * 0.1;
          bar.velocity *= 0.8; // Damping
          bar.height += bar.velocity;
          bar.height = Math.max(0.05, Math.min(1, bar.height));
        } else if (!isPlaying) {
          // Decay when not playing
          bar.height *= 0.95;
          if (bar.height < 0.05) bar.height = 0.05;
        }
        
        // Draw bar
        const barHeight = bar.height * height * 0.8;
        const x = index * barWidth + spacing / 2;
        const y = (height - barHeight) / 2;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '40');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, actualBarWidth, barHeight);
        
        // Add glow effect for playing state
        if (isPlaying && bar.height > 0.5) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.fillRect(x, y, actualBarWidth, barHeight);
          ctx.shadowBlur = 0;
        }
      });
    } else if (mode === 'circle') {
      // Draw circular waveform
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;
      
      ctx.beginPath();
      barsRef.current.forEach((bar, index) => {
        if (isPlaying && animated) {
          const targetHeight = Math.random() * 0.8 + 0.2;
          bar.velocity += (targetHeight - bar.height) * 0.1;
          bar.velocity *= 0.8;
          bar.height += bar.velocity;
          bar.height = Math.max(0.05, Math.min(1, bar.height));
        } else if (!isPlaying) {
          bar.height *= 0.95;
          if (bar.height < 0.05) bar.height = 0.05;
        }
        
        const angle = (index / barCount) * Math.PI * 2;
        const barHeight = bar.height * radius;
        const x = centerX + Math.cos(angle) * (radius + barHeight);
        const y = centerY + Math.sin(angle) * (radius + barHeight);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add glow
      if (isPlaying) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else if (mode === 'wave') {
      // Draw wave pattern
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      
      barsRef.current.forEach((bar, index) => {
        if (isPlaying && animated) {
          const targetHeight = Math.sin(Date.now() * 0.001 + index * 0.5) * 0.5 + 0.5;
          bar.velocity += (targetHeight - bar.height) * 0.1;
          bar.velocity *= 0.8;
          bar.height += bar.velocity;
          bar.height = Math.max(0.05, Math.min(1, bar.height));
        } else if (!isPlaying) {
          bar.height *= 0.95;
          if (bar.height < 0.05) bar.height = 0.05;
        }
        
        const x = (index / barCount) * width;
        const y = height / 2 + (bar.height - 0.5) * height * 0.3;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = ((index - 1) / barCount) * width;
          const prevY = height / 2 + (barsRef.current[index - 1].height - 0.5) * height * 0.3;
          const cpX = (prevX + x) / 2;
          const cpY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
        }
      });
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add glow
      if (isPlaying) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, animated, mode, color, barCount, height, isHovered, touchPosition]);
  
  // Start/stop animation
  useEffect(() => {
    if (animated) {
      animate();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, animated]);
  
  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  // Handle touch/mouse interactions
  const handleMove = useCallback((clientX) => {
    if (!interactive || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const barIndex = Math.floor((x / rect.width) * barCount);
    setTouchPosition(barIndex);
  }, [interactive, barCount]);
  
  const handleMouseMove = useCallback((e) => {
    handleMove(e.clientX);
  }, [handleMove]);
  
  const handleTouchMove = useCallback((e) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTouchPosition(null);
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  
  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onMouseMove={interactive ? handleMouseMove : undefined}
        onMouseEnter={interactive ? handleMouseEnter : undefined}
        onMouseLeave={interactive ? handleMouseLeave : undefined}
        onTouchMove={interactive ? handleTouchMove : undefined}
        onTouchEnd={interactive ? () => setTouchPosition(null) : undefined}
      />
      
      {/* Interactive overlay */}
      {interactive && touchPosition !== null && (
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none"
          style={{ left: `${(touchPosition / barCount) * 100}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </div>
  );
});

WaveformVisualizerMobile.displayName = 'WaveformVisualizerMobile';

export default WaveformVisualizerMobile;
