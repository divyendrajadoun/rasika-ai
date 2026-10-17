"""sheet.py <shotsdir> <out.jpg>  — tiles render.py --stills PNGs (8 per row, time-labelled) for one-look review."""
import sys, glob, os
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1]+'/*.png')); ims = [Image.open(f).convert('RGB').resize((270, 480)) for f in fs]
S = Image.new('RGB', (270*8, 480*((len(ims)+7)//8)), 'white')
for i, (im, f) in enumerate(zip(ims, fs)):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 70, 22), fill='black'); d.text((4, 4), os.path.basename(f)[6:12], fill='yellow'); S.paste(im, ((i % 8)*270, (i//8)*480))
S.save(sys.argv[2], quality=82); print('wrote', sys.argv[2], len(fs), 'frames')
