#!/usr/bin/env python3
"""Pre-renders the fonts and emoji used by the tournament share cards (src/sharecard.js).

The site runs with no npm packages, so it can't rasterize TrueType fonts at request time.
Instead this script draws every character we need, at every size we need, as anti-aliased
alpha masks, plus the emoji icons as full-color images, and packs them into:
  src/card-assets.json  (metrics)   src/card-assets.bin  (zlib-compressed pixels)
Re-run it (python3 tools/build-card-assets.py) only if you change fonts, sizes or icons.
Fonts: Poppins (SIL Open Font License), Noto Color Emoji (SIL Open Font License).
"""
import json, os, zlib
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = {
    'black': ('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', [9, 11, 13, 15, 18, 21, 24, 28, 34, 40, 46, 52, 60, 68, 78, 90, 104, 120, 140]),
    'medium': ('/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf', [16, 19, 22, 26, 30, 34, 38, 44, 50, 58]),
}
EMOJI_FONT = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
EMOJI = {'ball': '🎱', 'date': '📅', 'pin': '📍', 'money': '💰', 'trophy': '🏆', 'clock': '⏰', 'target': '🎯', 'fire': '🔥'}
CHARS = [chr(c) for c in range(32, 127)] + list('’‘“”–—•…·éèáñ×')

blob = bytearray()
meta = {'fonts': {}, 'emoji': {}}

for name, (path, sizes) in FONTS.items():
    meta['fonts'][name] = {}
    for size in sizes:
        font = ImageFont.truetype(path, size)
        ascent, descent = font.getmetrics()
        glyphs = {}
        for ch in CHARS:
            if ch != ' ' and font.getmask(ch).getbbox() is None:
                continue  # not in this font
            adv = font.getlength(ch)
            box = font.getbbox(ch)  # relative to the drawing origin (top of the line box)
            if box is None or box[2] <= box[0] or box[3] <= box[1]:
                glyphs[ch] = [round(adv, 2), 0, 0, 0, 0, 0]
                continue
            x0, y0, x1, y1 = box
            w, h = x1 - x0, y1 - y0
            img = Image.new('L', (w, h), 0)
            ImageDraw.Draw(img).text((-x0, -y0), ch, font=font, fill=255)
            glyphs[ch] = [round(adv, 2), x0, y0, w, h, len(blob)]
            blob += img.tobytes()
        # kerning for common pairs isn't exposed by Pillow; Poppins spacing is fine without it
        meta['fonts'][name][str(size)] = {'ascent': ascent, 'descent': descent, 'glyphs': glyphs}

efont = ImageFont.truetype(EMOJI_FONT, 109)
for key, ch in EMOJI.items():
    img = Image.new('RGBA', (136, 128), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 0), ch, font=efont, embedded_color=True)
    img = img.crop(img.getbbox())
    meta['emoji'][key] = [img.width, img.height, len(blob)]
    blob += img.tobytes()

with open(os.path.join(ROOT, 'src', 'card-assets.bin'), 'wb') as f:
    f.write(zlib.compress(bytes(blob), 9))
with open(os.path.join(ROOT, 'src', 'card-assets.json'), 'w') as f:
    json.dump(meta, f, separators=(',', ':'))
print('raw', len(blob), 'compressed', os.path.getsize(os.path.join(ROOT, 'src', 'card-assets.bin')),
      'json', os.path.getsize(os.path.join(ROOT, 'src', 'card-assets.json')))
