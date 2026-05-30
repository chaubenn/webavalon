#!/usr/bin/env bash
# Usage: ./scripts/download-hf-asset.sh <url> <output.webp>
set -euo pipefail
url="$1"
out="$2"
tmp="$(mktemp /tmp/hf-asset.XXXXXX.png)"
curl -fsSL "$url" -o "$tmp"
python3 -c "
from PIL import Image
img = Image.open('$tmp').convert('RGB')
img.save('$out', 'WEBP', quality=90, method=6)
print('wrote', '$out', img.size)
"
rm -f "$tmp"
