/**
 * MoodController — Singleton for visual mood system
 * Sets CSS custom properties on document.documentElement for real-time visual feedback
 */

export type MoodType = 'winning' | 'losing' | 'danger' | 'neutral' | 'hype';

class MoodController {
  private currentMood: MoodType = 'neutral';

  setMood(mood: MoodType): void {
    if (this.currentMood === mood) return;
    this.currentMood = mood;

    const root = document.documentElement;
    
    switch (mood) {
      case 'winning':
        root.style.setProperty('--mood-glow-color', '#d4af37'); // gold
        root.style.setProperty('--mood-glow-intensity', '0.6');
        root.style.setProperty('--mood-vignette-color', 'rgba(212, 175, 55, 0.15)');
        root.style.setProperty('--mood-vignette-intensity', '0.4');
        root.style.setProperty('--mood-saturation', '1.2');
        root.style.setProperty('--mood-brightness', '1.1');
        break;

      case 'losing':
        root.style.setProperty('--mood-glow-color', '#8b0000'); // dark red
        root.style.setProperty('--mood-glow-intensity', '0.4');
        root.style.setProperty('--mood-vignette-color', 'rgba(139, 0, 0, 0.2)');
        root.style.setProperty('--mood-vignette-intensity', '0.5');
        root.style.setProperty('--mood-saturation', '0.8');
        root.style.setProperty('--mood-brightness', '0.9');
        break;

      case 'danger':
        root.style.setProperty('--mood-glow-color', '#ff4444'); // bright red
        root.style.setProperty('--mood-glow-intensity', '0.8');
        root.style.setProperty('--mood-vignette-color', 'rgba(255, 68, 68, 0.25)');
        root.style.setProperty('--mood-vignette-intensity', '0.7');
        root.style.setProperty('--mood-saturation', '0.6');
        root.style.setProperty('--mood-brightness', '0.85');
        break;

      case 'hype':
        root.style.setProperty('--mood-glow-color', '#00ffff'); // cyan
        root.style.setProperty('--mood-glow-intensity', '0.9');
        root.style.setProperty('--mood-vignette-color', 'rgba(0, 255, 255, 0.2)');
        root.style.setProperty('--mood-vignette-intensity', '0.6');
        root.style.setProperty('--mood-saturation', '1.5');
        root.style.setProperty('--mood-brightness', '1.15');
        break;

      case 'neutral':
      default:
        root.style.setProperty('--mood-glow-color', '#4a90e2'); // blue
        root.style.setProperty('--mood-glow-intensity', '0.2');
        root.style.setProperty('--mood-vignette-color', 'rgba(74, 144, 226, 0.1)');
        root.style.setProperty('--mood-vignette-intensity', '0.2');
        root.style.setProperty('--mood-saturation', '1');
        root.style.setProperty('--mood-brightness', '1');
        break;
    }
  }

  getCurrentMood(): MoodType {
    return this.currentMood;
  }

  /** Reset to neutral mood */
  reset(): void {
    this.setMood('neutral');
  }
}

export const moodController = new MoodController();

// Initialize with neutral mood
if (typeof document !== 'undefined') {
  moodController.setMood('neutral');
}