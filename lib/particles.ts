/**
 * Canvas-based particle system for cinematic effects
 * Singleton that renders particles on a fixed overlay canvas
 */

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
  fadeRate: number;
  type: ParticleType;
  rotation: number;
  rotationSpeed: number;
}

type ParticleType = 'spark' | 'coin' | 'ember' | 'starburst' | 'shatter' | 'gold-rain' | 'ash';

type ParticleEffect = 
  | 'win-explosion'    // Gold sparks radiating outward
  | 'loss-embers'      // Ash/ember particles falling
  | 'purchase-burst'   // Starburst from center
  | 'bankruptcy-shatter' // Glass shatter effect
  | 'coin-pour'        // Physical coin animation
  | 'gold-rain';       // Falling gold particles

class ParticleSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private isInitialized = false;

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    // Create full-screen canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    this.canvas.style.background = 'transparent';
    
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    
    this.updateCanvasSize();
    window.addEventListener('resize', this.updateCanvasSize.bind(this));
    
    this.isInitialized = true;
    this.startLoop();
  }

  private updateCanvasSize() {
    if (!this.canvas || !this.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
  }

  private startLoop() {
    if (this.animationId) return;
    
    const loop = () => {
      this.update();
      this.render();
      
      if (this.particles.length > 0) {
        this.animationId = requestAnimationFrame(loop);
      } else {
        this.animationId = null;
      }
    };
    
    this.animationId = requestAnimationFrame(loop);
  }

  private update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update physics
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.rotation += particle.rotationSpeed;
      
      // Update life
      particle.life -= 1;
      particle.alpha = Math.max(0, particle.life / particle.maxLife);
      
      // Apply fade rate
      particle.alpha *= (1 - particle.fadeRate);
      
      // Remove dead particles
      if (particle.life <= 0 || particle.alpha <= 0.01) {
        this.particles.splice(i, 1);
      }
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas with transparent background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (const particle of this.particles) {
      this.renderParticle(particle);
    }
  }

  private renderParticle(particle: Particle) {
    if (!this.ctx) return;
    
    this.ctx.save();
    this.ctx.globalAlpha = particle.alpha;
    this.ctx.translate(particle.x, particle.y);
    this.ctx.rotate(particle.rotation);
    
    switch (particle.type) {
      case 'spark':
        this.renderSpark(particle);
        break;
      case 'coin':
        this.renderCoin(particle);
        break;
      case 'ember':
        this.renderEmber(particle);
        break;
      case 'starburst':
        this.renderStarburst(particle);
        break;
      case 'shatter':
        this.renderShatter(particle);
        break;
      case 'gold-rain':
        this.renderGoldRain(particle);
        break;
      case 'ash':
        this.renderAsh(particle);
        break;
    }
    
    this.ctx.restore();
  }

  private renderSpark(particle: Particle) {
    if (!this.ctx) return;
    
    // Gold spark with glow
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
    
    // Add white hot center
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fillRect(-particle.size/4, -particle.size/4, particle.size/2, particle.size/2);
  }

  private renderCoin(particle: Particle) {
    if (!this.ctx) return;
    
    // 3D coin effect with perspective based on rotation
    const perspective = Math.abs(Math.cos(particle.rotation));
    const width = particle.size * perspective;
    const height = particle.size;
    
    // Coin gradient (gold)
    const gradient = this.ctx.createLinearGradient(-width/2, 0, width/2, 0);
    gradient.addColorStop(0, '#B8860B');
    gradient.addColorStop(0.3, '#FFD700');
    gradient.addColorStop(0.7, '#FFA500');
    gradient.addColorStop(1, '#B8860B');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, width/2, height/2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(-width/4, -height/4, width/6, height/6, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderEmber(particle: Particle) {
    if (!this.ctx) return;
    
    // Glowing ember
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
    gradient.addColorStop(0, '#FF4500');
    gradient.addColorStop(0.7, '#FF6600');
    gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderStarburst(particle: Particle) {
    if (!this.ctx) return;
    
    // Star shape
    this.ctx.fillStyle = particle.color;
    this.ctx.beginPath();
    
    const spikes = 5;
    const outerRadius = particle.size;
    const innerRadius = particle.size * 0.4;
    
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.closePath();
    this.ctx.fill();
    
    // Glow
    this.ctx.shadowColor = particle.color;
    this.ctx.shadowBlur = particle.size;
    this.ctx.fill();
  }

  private renderShatter(particle: Particle) {
    if (!this.ctx) return;
    
    // Glass shard
    this.ctx.fillStyle = 'rgba(200, 200, 255, 0.7)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.lineWidth = 1;
    
    // Irregular triangle
    this.ctx.beginPath();
    this.ctx.moveTo(0, -particle.size);
    this.ctx.lineTo(-particle.size * 0.7, particle.size * 0.5);
    this.ctx.lineTo(particle.size * 0.8, particle.size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private renderGoldRain(particle: Particle) {
    if (!this.ctx) return;
    
    // Small gold droplet
    const gradient = this.ctx.createLinearGradient(0, -particle.size, 0, particle.size);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, '#FFA500');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, particle.size * 0.3, particle.size, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderAsh(particle: Particle) {
    if (!this.ctx) return;
    
    // Gray ash particle
    const gray = Math.floor(100 + particle.life * 0.5);
    this.ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${particle.alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Public API methods
  createEffect(effect: ParticleEffect, x: number, y: number, intensity = 1) {
    if (!this.isInitialized) this.init();
    
    switch (effect) {
      case 'win-explosion':
        this.createWinExplosion(x, y, intensity);
        break;
      case 'loss-embers':
        this.createLossEmbers(x, y, intensity);
        break;
      case 'purchase-burst':
        this.createPurchaseBurst(x, y, intensity);
        break;
      case 'bankruptcy-shatter':
        this.createBankruptcyShatter(x, y, intensity);
        break;
      case 'coin-pour':
        this.createCoinPour(x, y, intensity);
        break;
      case 'gold-rain':
        this.createGoldRain(x, y, intensity);
        break;
    }
    
    if (!this.animationId) {
      this.startLoop();
    }
  }

  private createWinExplosion(x: number, y: number, intensity: number) {
    const count = Math.floor(30 * intensity);
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 5;
      
      this.particles.push({
        id: `spark-${Date.now()}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60 + Math.random() * 60,
        maxLife: 120,
        size: 3 + Math.random() * 4,
        color: '#FFD700',
        alpha: 1,
        gravity: 0.1,
        fadeRate: 0.02,
        type: 'spark',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  private createLossEmbers(x: number, y: number, intensity: number) {
    const count = Math.floor(15 * intensity);
    
    for (let i = 0; i < count; i++) {
      this.particles.push({
        id: `ember-${Date.now()}-${i}`,
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        life: 90 + Math.random() * 60,
        maxLife: 150,
        size: 2 + Math.random() * 3,
        color: '#FF4500',
        alpha: 1,
        gravity: 0.05,
        fadeRate: 0.015,
        type: 'ember',
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  private createPurchaseBurst(x: number, y: number, intensity: number) {
    const count = Math.floor(12 * intensity);
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;
      
      this.particles.push({
        id: `starburst-${Date.now()}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 45,
        maxLife: 45,
        size: 6 + Math.random() * 4,
        color: '#00E676',
        alpha: 1,
        gravity: 0,
        fadeRate: 0.03,
        type: 'starburst',
        rotation: angle,
        rotationSpeed: 0.1
      });
    }
  }

  private createBankruptcyShatter(x: number, y: number, intensity: number) {
    const count = Math.floor(20 * intensity);
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      
      this.particles.push({
        id: `shatter-${Date.now()}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 90,
        maxLife: 90,
        size: 3 + Math.random() * 5,
        color: '#FFFFFF',
        alpha: 1,
        gravity: 0.2,
        fadeRate: 0.02,
        type: 'shatter',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3
      });
    }
  }

  private createCoinPour(x: number, y: number, intensity: number) {
    const count = Math.floor(8 * intensity);
    
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.particles.push({
          id: `coin-${Date.now()}-${i}`,
          x: x + (Math.random() - 0.5) * 30,
          y: y - Math.random() * 20,
          vx: (Math.random() - 0.5) * 4,
          vy: -(Math.random() * 3 + 2),
          life: 120,
          maxLife: 120,
          size: 12 + Math.random() * 4,
          color: '#FFD700',
          alpha: 1,
          gravity: 0.3,
          fadeRate: 0.005,
          type: 'coin',
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.4
        });
      }, i * 100);
    }
  }

  private createGoldRain(x: number, y: number, intensity: number) {
    const count = Math.floor(50 * intensity);
    
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.particles.push({
          id: `gold-rain-${Date.now()}-${i}`,
          x: x + (Math.random() - 0.5) * 200,
          y: y - Math.random() * 100,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 2 + 2,
          life: 150,
          maxLife: 150,
          size: 3 + Math.random() * 2,
          color: '#FFD700',
          alpha: 1,
          gravity: 0.1,
          fadeRate: 0.01,
          type: 'gold-rain',
          rotation: 0,
          rotationSpeed: 0
        });
      }, i * 20);
    }
  }

  // Cleanup method
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.isInitialized = false;
  }
}

// Singleton instance
export const particles = new ParticleSystem();