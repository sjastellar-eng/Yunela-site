"""Build source/selected/quality-alternative responsive detail proof for Task 14."""
import io
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASE = '3e87ade2d073332c6e181fae8d755f5d40a4780d'
dest = ROOT / 'docs/catalog-background-final' / sys.argv[1]
report = json.loads((dest/'RESULTS.json').read_text())
rows = [(r,e) for r in report['records'] if r['status']=='UPDATED' for e in r['exports'][1:]]
sheet = Image.new('RGB',(1000,len(rows)*195),'#eeefec')
draw = ImageDraw.Draw(sheet)
for row,(record,export) in enumerate(rows):
    sku = record['sourceSku']; width = export['size'][0]
    source = Image.open(io.BytesIO(subprocess.check_output(['git','show',BASE+':public'+export['path']],cwd=ROOT))).convert('RGB')
    selected = Image.open(ROOT/'public'/export['path'].lstrip('/')).convert('RGB')
    q = 98 if sku.startswith('PHOTO-') else 95
    alternative = Image.open(ROOT.parent/'catalog-final-candidates'/sku/f'{Path(export["path"]).stem}-q{q}.webp').convert('RGB')
    for col,(label,im) in enumerate([('SOURCE',source),(f'SELECTED q{export["selectedQuality"]}',selected),(f'q{q}',alternative)]):
        draw.text((col*330+4,row*195+5),f'{sku} {width}px {label}',fill='black')
        x=int(width*.59);y=int(width*.4)
        sheet.paste(im.crop((x,y,min(width,x+210),min(width,y+150))),(col*330+4,row*195+30))
sheet.save(dest/'RESPONSIVE_DETAILS.jpg',quality=95,subsampling=0)
