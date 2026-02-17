const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('No OPENAI_API_KEY'); process.exit(1); }

const BASE = '/Users/shamdoo/monopolygame/public/assets/minigames';
const STYLE = '16-bit retro pixel art style, casino gambling aesthetic, vibrant colors (gold, green felt, burgundy, neon red), transparent background, pixel art';

const assets = [
  // Slots
  ['slots/slot-machine.png', `${STYLE}, slot machine with 3 reels, gold trim, flashing casino lights, front view`],
  ['slots/cherry.png', `${STYLE}, cherry symbol for slot machine, bright red cherries with green stem`],
  ['slots/seven.png', `${STYLE}, lucky number 7 symbol, gold with glowing effect, slot machine symbol`],
  ['slots/bar.png', `${STYLE}, BAR text symbol for slot machine, classic gold bar symbol`],
  ['slots/diamond.png', `${STYLE}, sparkling diamond gemstone symbol, slot machine symbol, brilliant white and blue`],
  // Cards
  ['cards/card-back.png', `${STYLE}, playing card back design, ornate casino pattern, burgundy and gold`],
  ['cards/card-table.png', `${STYLE}, green felt card table seen from above, oval shape, casino table`],
  ['cards/deck.png', `${STYLE}, stack of playing cards, neat pile, slight angle showing thickness`],
  // Dice
  ['dice/dice-1.png', `${STYLE}, single die face showing 1 pip, white die with black dots, slight 3D perspective`],
  ['dice/dice-2.png', `${STYLE}, single die face showing 2 pips, white die with black dots, slight 3D perspective`],
  ['dice/dice-3.png', `${STYLE}, single die face showing 3 pips, white die with black dots, slight 3D perspective`],
  ['dice/dice-4.png', `${STYLE}, single die face showing 4 pips, white die with black dots, slight 3D perspective`],
  ['dice/dice-5.png', `${STYLE}, single die face showing 5 pips, white die with black dots, slight 3D perspective`],
  ['dice/dice-6.png', `${STYLE}, single die face showing 6 pips, white die with black dots, slight 3D perspective`],
  ['dice/dice-cup.png', `${STYLE}, leather dice cup, brown leather with gold trim, casino dice shaker`],
  // Wheel
  ['wheel/wheel.png', `${STYLE}, fortune wheel or roulette wheel, colorful segments red green gold, top-down view`],
  ['wheel/wheel-pointer.png', `${STYLE}, arrow pointer for spinning wheel, gold and red, pointing downward`],
  ['wheel/wheel-stand.png', `${STYLE}, wooden stand base for a fortune wheel, ornate carved wood`],
  // Minesweeper
  ['minesweeper/mine.png', `${STYLE}, round bomb with lit fuse, classic cartoon mine, sparking fuse`],
  ['minesweeper/gem.png', `${STYLE}, green emerald gemstone, sparkling faceted gem, reward icon`],
  ['minesweeper/tile-hidden.png', `${STYLE}, unrevealed minesweeper tile, raised button look, gray stone tile`],
  ['minesweeper/tile-revealed.png', `${STYLE}, revealed pressed minesweeper tile, flat sunken tile, lighter color`],
  // Horses
  ['horses/horse-1.png', `${STYLE}, chibi racing horse galloping, jockey wearing red silks, side view`],
  ['horses/horse-2.png', `${STYLE}, chibi racing horse galloping, jockey wearing blue silks, side view`],
  ['horses/horse-3.png', `${STYLE}, chibi racing horse galloping, jockey wearing green silks, side view`],
  ['horses/track.png', `${STYLE}, horse race track segment, brown dirt track with white rail, top-down`],
  // Darts
  ['darts/dartboard.png', `${STYLE}, dartboard with standard coloring, red green black white segments, front view`],
  ['darts/dart.png', `${STYLE}, single dart projectile, red and silver, side view, sharp point`],
  // Coin
  ['coin/coin-heads.png', `${STYLE}, gold coin heads side, casino chip logo, shiny metallic`],
  ['coin/coin-tails.png', `${STYLE}, gold coin tails side, decorative pattern, shiny metallic`],
  // Safe
  ['safe/safe-closed.png', `${STYLE}, vault safe closed, metal safe with combination dial, heavy steel door`],
  ['safe/safe-open.png', `${STYLE}, vault safe open, gold coins and treasures spilling out, open steel door`],
  ['safe/dial.png', `${STYLE}, combination lock dial, circular numbered dial, chrome metal`],
  // Results
  ['results/win-banner.png', `${STYLE}, "YOU WIN" text banner, confetti and gold coins, celebration, neon lights`],
  ['results/lose-banner.png', `${STYLE}, "YOU LOSE" text banner, dramatic red lighting, dark mood`],
  ['results/jackpot.png', `${STYLE}, "JACKPOT" text, explosion of gold coins, flashing lights, celebration`],
];

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function generate(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, size: '1024x1024', quality: 'standard', n: 1 })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // Check which assets already exist
  const todo = assets.filter(([file]) => !fs.existsSync(path.join(BASE, file)));
  console.log(`${assets.length - todo.length} already exist, ${todo.length} to generate`);

  const BATCH = 3;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    console.log(`\nBatch ${Math.floor(i/BATCH)+1}/${Math.ceil(todo.length/BATCH)}`);
    
    for (const [file, prompt] of batch) {
      const dest = path.join(BASE, file);
      console.log(`  Generating ${file}...`);
      try {
        const url = await generate(prompt);
        await downloadImage(url, dest);
        console.log(`  ✓ ${file}`);
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
      }
    }
    
    if (i + BATCH < todo.length) {
      console.log('  Waiting 15s...');
      await sleep(15000);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
