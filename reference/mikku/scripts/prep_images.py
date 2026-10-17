"""prep_images.py <projdir> <img1> [img2 ...] [--crops crops.json]
Copies user images to projdir/img/i1.jpg, i2.jpg … (order kept), max 1080x1400.
crops.json: {"i2": [left, top, right, bottom], ...} in ORIGINAL pixels — use it to cut out phone-screenshot UI
(back buttons, '…' menus, Lens icons, black letterbox bars, captions under paintings). Prints sizes."""
import sys, json, shutil
from PIL import Image
args = sys.argv[1:]; crops = {}
if '--crops' in args: k = args.index('--crops'); crops = json.load(open(args[k+1])); args = args[:k]+args[k+2:]
P, files = args[0], args[1:]
for i, f in enumerate(files, 1):
    im = Image.open(f).convert('RGB'); key = f'i{i}'
    print(key, 'orig', im.size, '←', f)
    if key in crops: im = im.crop(tuple(crops[key]))
    im.thumbnail((1080, 1400)); im.save(f'{P}/img/{key}.jpg', quality=92); print(key, 'saved', im.size)
