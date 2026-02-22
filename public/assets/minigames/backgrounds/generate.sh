#!/bin/bash
set -e
API_KEY="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"
DIR="$(cd "$(dirname "$0")" && pwd)"

generate() {
  local name="$1"
  local prompt="$2"
  echo "Generating $name..."
  local resp
  resp=$(curl -s https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"gpt-image-1\",
      \"prompt\": \"$prompt\",
      \"n\": 1,
      \"size\": \"1536x1024\",
      \"quality\": \"low\"
    }")
  
  local b64
  b64=$(echo "$resp" | jq -r '.data[0].b64_json // empty')
  if [ -z "$b64" ]; then
    echo "FAIL: $name — $(echo "$resp" | jq -r '.error.message // "unknown error"')"
    return 1
  fi
  echo "$b64" | base64 -d > "$DIR/$name"
  echo "OK: $name ($(wc -c < "$DIR/$name") bytes)"
}

generate "slots.png" "Neon-lit casino floor at night, rows of vintage slot machines glowing purple and magenta, smoky atmosphere, dark ceiling with scattered lights. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "higher-lower.png" "Intimate high-stakes card room, single overhead lamp casting warm light on green felt table, dark wood paneling. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "craps.png" "Vegas craps table from above at angle, warm amber and red lighting, felt surface, dramatic shadows, crowd silhouettes in background. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces."

generate "wheel.png" "Game show stage with dramatic purple and gold spotlights, dark studio backdrop, velvet curtains, theatrical fog. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "minesweeper.png" "Industrial bank vault interior, heavy steel doors ajar, dim emergency lighting, metal grating floor, cold blue-grey tones. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "card-war.png" "Underground poker den, green felt table, hanging Edison bulbs, exposed brick walls, cigar smoke haze. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "lucky-number.png" "Roulette table close-up at angle, warm amber pub lighting, polished dark wood, brass fixtures. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "blackjack.png" "Elegant high-roller blackjack table, deep emerald green felt, soft overhead dealer light, VIP atmosphere. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "coin-flip.png" "Dark dramatic void with single spotlight from above creating bright circle on polished dark floor, silver metallic tones. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

generate "safe-cracker.png" "Massive ornate vault door slightly ajar, gold light spilling through crack, dark bank interior, marble floor. Dark moody atmospheric environment art, cinematic lighting, rich textures. No text, no UI elements, no game pieces, no people."

echo "Done!"
