'use client';

interface CutsceneSpriteProps {
  color: string;
  state: 'running' | 'landing' | 'idle';
}

export default function CutsceneSprite({ color, state }: CutsceneSpriteProps) {
  return (
    <div className={`cutsceneSprite spriteState-${state}`}>
      {/* Head */}
      <div className="spriteHead" style={{ backgroundColor: color }} />
      {/* Body */}
      <div className="spriteBody" style={{ backgroundColor: color }} />
      {/* Left leg */}
      <div className="spriteLeg spriteLegLeft" style={{ backgroundColor: color }} />
      {/* Right leg */}
      <div className="spriteLeg spriteLegRight" style={{ backgroundColor: color }} />
    </div>
  );
}
