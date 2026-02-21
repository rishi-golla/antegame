'use client';

import { useEffect, useRef, useState } from 'react';

interface ScreenEffect {
  id: string;
  type: ScreenEffectType;
  intensity: number;
  duration: number;
  startTime: number;
}

type ScreenEffectType = 
  | 'shake'           // Camera shake with actual canvas transform
  | 'bloom'           // Radial gradient glow overlay
  | 'chromatic'       // RGB split effect
  | 'speed-lines'     // Dramatic speed lines
  | 'vignette-pulse'  // Breathing vignette
  | 'screen-crack'    // Screen break/shatter effect
  | 'desaturate'      // Color drain wave
  | 'zoom-impact'     // Dramatic scale punch
  | 'red-flash'       // Impact flash
  | 'spotlight';      // Focused light effect

interface ScreenEffectsProps {
  // External trigger system
}

interface ScreenEffectsHandle {
  triggerEffect: (type: ScreenEffectType, intensity?: number, duration?: number) => void;
  clearEffects: () => void;
}

const ScreenEffects: React.FC<ScreenEffectsProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [effects, setEffects] = useState<ScreenEffect[]>([]);
  const animationRef = useRef<number | null>(null);
  const shakeOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // Expose methods globally for other components to use
  useEffect(() => {
    const handle: ScreenEffectsHandle = {
      triggerEffect: (type: ScreenEffectType, intensity = 1, duration = 1000) => {
        const effect: ScreenEffect = {
          id: `${type}-${Date.now()}-${Math.random()}`,
          type,
          intensity,
          duration,
          startTime: Date.now()
        };
        
        setEffects(prev => [...prev, effect]);
        
        // Auto-remove after duration + buffer
        setTimeout(() => {
          setEffects(prev => prev.filter(e => e.id !== effect.id));
        }, duration + 200);
      },
      clearEffects: () => {
        setEffects([]);
        shakeOffsetRef.current = { x: 0, y: 0 };
        zoomRef.current = 1;
      }
    };

    // Attach to window for global access
    (window as any).screenEffects = handle;

    return () => {
      if ((window as any).screenEffects) {
        delete (window as any).screenEffects;
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      let hasActiveEffects = false;
      
      // Reset transforms
      shakeOffsetRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;

      // Process each effect
      effects.forEach(effect => {
        const elapsed = now - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1);
        const intensity = effect.intensity * (1 - progress);

        if (progress < 1) {
          hasActiveEffects = true;
          
          switch (effect.type) {
            case 'shake':
              applyShake(intensity);
              break;
            case 'zoom-impact':
              applyZoomImpact(progress, intensity);
              break;
          }
        }
      });

      // Apply transforms to container
      if (containerRef.current) {
        const transform = `translate(${shakeOffsetRef.current.x}px, ${shakeOffsetRef.current.y}px) scale(${zoomRef.current})`;
        containerRef.current.style.transform = transform;
      }

      // Render canvas effects
      renderCanvasEffects(effects, now);

      if (hasActiveEffects || effects.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (effects.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [effects]);

  const applyShake = (intensity: number) => {
    const maxOffset = 8 * intensity;
    shakeOffsetRef.current.x += (Math.random() - 0.5) * maxOffset;
    shakeOffsetRef.current.y += (Math.random() - 0.5) * maxOffset;
  };

  const applyZoomImpact = (progress: number, intensity: number) => {
    // Overshoot then settle - cubic-bezier approximation
    let scale;
    if (progress < 0.1) {
      // Quick punch in
      scale = 1 + (intensity * 0.1 * (progress / 0.1));
    } else if (progress < 0.3) {
      // Overshoot
      const t = (progress - 0.1) / 0.2;
      scale = 1 + intensity * 0.1 * (1 - t * 0.5);
    } else {
      // Settle back to normal
      const t = (progress - 0.3) / 0.7;
      const easeOut = 1 - Math.pow(1 - t, 3);
      scale = 1 + intensity * 0.05 * (1 - easeOut);
    }
    
    zoomRef.current = scale;
  };

  const renderCanvasEffects = (effects: ScreenEffect[], now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    
    // Update canvas size if needed
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render each effect
    effects.forEach(effect => {
      const elapsed = now - effect.startTime;
      const progress = Math.min(elapsed / effect.duration, 1);
      const intensity = effect.intensity * (1 - progress);

      if (progress >= 1) return;

      switch (effect.type) {
        case 'bloom':
          renderBloom(ctx, canvas.width, canvas.height, intensity);
          break;
        case 'chromatic':
          renderChromaticAberration(ctx, canvas.width, canvas.height, intensity);
          break;
        case 'speed-lines':
          renderSpeedLines(ctx, canvas.width, canvas.height, intensity, progress);
          break;
        case 'vignette-pulse':
          renderVignettePulse(ctx, canvas.width, canvas.height, intensity, progress);
          break;
        case 'screen-crack':
          renderScreenCrack(ctx, canvas.width, canvas.height, intensity, progress);
          break;
        case 'desaturate':
          renderDesaturateWave(ctx, canvas.width, canvas.height, intensity, progress);
          break;
        case 'red-flash':
          renderRedFlash(ctx, canvas.width, canvas.height, intensity);
          break;
        case 'spotlight':
          renderSpotlight(ctx, canvas.width, canvas.height, intensity);
          break;
      }
    });
  };

  const renderBloom = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(width, height) * 0.8;
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${intensity * 0.3})`);
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${intensity * 0.1})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const renderChromaticAberration = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    // RGB split effect - create colored overlay strips
    const offset = intensity * 5;
    
    // Red channel
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.2})`;
    ctx.fillRect(-offset, 0, width, height);
    
    // Blue channel
    ctx.fillStyle = `rgba(0, 0, 255, ${intensity * 0.2})`;
    ctx.fillRect(offset, 0, width, height);
  };

  const renderSpeedLines = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, progress: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const lineCount = Math.floor(20 * intensity);
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.6})`;
    ctx.lineWidth = 2;
    
    for (let i = 0; i < lineCount; i++) {
      const angle = (Math.PI * 2 * i) / lineCount;
      const startRadius = 50 + progress * 200;
      const endRadius = startRadius + 100;
      
      const x1 = centerX + Math.cos(angle) * startRadius;
      const y1 = centerY + Math.sin(angle) * startRadius;
      const x2 = centerX + Math.cos(angle) * endRadius;
      const y2 = centerY + Math.sin(angle) * endRadius;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };

  const renderVignettePulse = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, progress: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.7;
    const pulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
    const radius = maxRadius * pulse;
    
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity * 0.7})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const renderScreenCrack = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, progress: number) => {
    // Animated crack lines spreading from center
    const centerX = width / 2;
    const centerY = height / 2;
    const crackCount = 8;
    
    ctx.strokeStyle = `rgba(200, 200, 255, ${intensity})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 4;
    
    for (let i = 0; i < crackCount; i++) {
      const angle = (Math.PI * 2 * i) / crackCount + Math.sin(progress * Math.PI) * 0.2;
      const length = Math.min(width, height) * 0.4 * progress;
      
      // Main crack
      const endX = centerX + Math.cos(angle) * length;
      const endY = centerY + Math.sin(angle) * length;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Branch cracks
      if (progress > 0.3) {
        const branchLength = length * 0.3;
        const branchAngle1 = angle + 0.5;
        const branchAngle2 = angle - 0.5;
        
        const branchX1 = endX + Math.cos(branchAngle1) * branchLength;
        const branchY1 = endY + Math.sin(branchAngle1) * branchLength;
        const branchX2 = endX + Math.cos(branchAngle2) * branchLength;
        const branchY2 = endY + Math.sin(branchAngle2) * branchLength;
        
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(branchX1, branchY1);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(branchX2, branchY2);
        ctx.stroke();
      }
    }
    
    ctx.shadowBlur = 0;
  };

  const renderDesaturateWave = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, progress: number) => {
    // Desaturation wave spreading outward
    const waveRadius = Math.max(width, height) * progress;
    const centerX = width / 2;
    const centerY = height / 2;
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, waveRadius);
    gradient.addColorStop(0, `rgba(100, 100, 100, ${intensity * 0.6})`);
    gradient.addColorStop(0.8, `rgba(100, 100, 100, ${intensity * 0.3})`);
    gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const renderRedFlash = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.4})`;
    ctx.fillRect(0, 0, width, height);
  };

  const renderSpotlight = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    const centerX = width / 2;
    const centerY = height / 2 - 100;
    const spotRadius = 150;
    
    // Dark vignette everywhere except spotlight
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, spotRadius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity * 0.8})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add outer darkness
    ctx.fillStyle = `rgba(0, 0, 0, ${intensity * 0.5})`;
    ctx.fillRect(0, 0, width, centerY - spotRadius);
    ctx.fillRect(0, centerY + spotRadius, width, height - (centerY + spotRadius));
  };

  return (
    <div 
      ref={containerRef}
      className="screen-effects-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        transformOrigin: 'center center'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default ScreenEffects;