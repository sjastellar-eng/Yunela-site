"""Process only LIST-022..026 with approved unchanged background correction; compare q92/q95."""
import hashlib,importlib.util,io,json,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,features
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];BASE='3e87ade2d073332c6e181fae8d755f5d40a4780d'
OUT=ROOT/'docs/list-background-final-five';SKUS=[f'LIST-{i:03}' for i in range(22,27)]
SELECTED_QUALITY={sku:92 for sku in SKUS}
def module(name):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/name);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
pilot=module('background-pilot-six.py');metrics=module('optimize-pilot-six.py')
def old(p):return subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,b):
 t=p.with_suffix('.tmp');t.write_bytes(b);t.replace(p);assert p.read_bytes()==b

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 # Reuse already verified outputs instead of accumulating WebP loss.
 if (OUT/'PROCESSING.json').exists():
  report=json.loads((OUT/'PROCESSING.json').read_text())
  exports=[e for r in report['records'] for e in r['exports']]
  if len(exports)==15 and all(sha((ROOT/'public'/e['path'].lstrip('/')).read_bytes())==e['sha256'] for e in exports):
   print('All15 verified outputs already present; no re-encoding');return
 assert 'LIST-014' not in SKUS and 'LIST-016' not in SKUS
 for sku in ['LIST-014','LIST-016']:
  for path in (ROOT/'public/creative').glob(sku+'*.webp'):
   assert path.read_bytes()==old(path.relative_to(ROOT).as_posix())
 gallery=json.loads(old('content/creative-gallery.v1.json'));primary=json.loads(old('content/creative-images.v1.json'))
 records=[];sheet=Image.new('RGB',(1800,len(SKUS)*400),'#eeefec');draw=ImageDraw.Draw(sheet)
 for row,sku in enumerate(SKUS):
  product=next(x for x in gallery['products'] if x['sourceSku']==sku);asset=product['images'][0];assert asset['role']=='primary'
  source=old('public'+asset['path']);before=Image.open(io.BytesIO(source)).convert('RGB');corrected,stats=pilot.recolour(before,False)
  a,b=np.asarray(before),np.asarray(corrected);dark=a.max(axis=2)<180;assert np.array_equal(a[dark],b[dark])
  q=SELECTED_QUALITY[sku];exports=[];candidate_images={}
  for entry in [asset,*asset['variants']]:
   im=corrected if entry is asset else corrected.resize((entry['width'],round(corrected.height*entry['width']/corrected.width)),Image.Resampling.LANCZOS)
   candidates=[]
   for quality in [92,95]:
    buf=io.BytesIO();im.save(buf,format='WEBP',quality=quality,method=6,lossless=False);encoded=buf.getvalue()
    candidate=Image.open(io.BytesIO(encoded)).convert('RGB');_,fg=metrics.ssim(np.asarray(im).astype(float),np.asarray(candidate).astype(float))
    candidates.append(dict(quality=quality,bytes=len(encoded),sha256=sha(encoded),foregroundSSIM=fg))
    if entry is asset:candidate_images[quality]=candidate.copy()
    if quality==q:data=encoded
   write(ROOT/'public'/entry['path'].lstrip('/'),data)
   dec=Image.open(io.BytesIO(data)).convert('RGB');assert dec.size==im.size
   _,ssim=metrics.ssim(np.asarray(im).astype(float),np.asarray(dec).astype(float));assert ssim>.99
   corners=[list(dec.getpixel(c)) for c in [(0,0),(dec.width-1,0),(0,dec.height-1),(dec.width-1,dec.height-1)]]
   assert all(max(abs(x-y) for x,y in zip(c,[250,249,245]))<=2 for c in corners)
   entry['sha256']=sha(data);exports.append(dict(path=entry['path'],width=dec.width,height=dec.height,bytes=len(data),sha256=sha(data),quality=q,method=6,foregroundSSIM=ssim,cornerRGB=corners,sourceSha256=sha(old('public'+entry['path'])),sourceBytes=len(old('public'+entry['path'])),candidates=candidates))
  next(x for x in primary['images'] if x['sourceSku']==sku)['sha256']=asset['sha256']
  after=Image.open(ROOT/'public'/asset['path'].lstrip('/')).convert('RGB')
  details=Image.new('RGB',(1200,830),'#eeefec');dd=ImageDraw.Draw(details)
  for col,(label,im) in enumerate([('SOURCE',before),('LOSSLESS',corrected),('q92',candidate_images[92]),('q95',candidate_images[95])]):
   dd.text((col*300+5,8),sku+' '+label,fill='black')
   for ri,(cx,cy) in enumerate([(420,290),(650,450),(610,830)]):details.paste(im.crop((cx,cy,cx+295,cy+250)),(col*300,40+ri*260))
  details.save(OUT/(sku+'-details.jpg'),quality=96,subsampling=0)
  for col,im in enumerate([before,after]):
   x=col*300;y=row*400;thumb=im.resize((290,290),Image.Resampling.LANCZOS);sheet.paste(thumb,(x,y+35));draw.text((x+5,y+8),sku+(' BEFORE' if col==0 else f' AFTER q{q}'),fill='black')
   for k,(cx,cy) in enumerate([(420,290),(610,830)]):
    x=600+k*600+col*300;sheet.paste(im.crop((cx,cy,cx+295,cy+300)),(x,y+35));draw.text((x+4,y+8),('LEAF ' if k==0 else 'SHADOW ')+('BEFORE' if col==0 else 'AFTER'),fill='black')
  records.append(dict(sourceSku=sku,**stats,sourceSha256=sha(source),unchangedDarkForegroundPixels=int(dark.sum()),exports=exports));print(sku+' PASS',flush=True)
 for path,obj in [('content/creative-gallery.v1.json',gallery),('content/creative-images.v1.json',primary)]: (ROOT/path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
 sheet.save(OUT/'BEFORE_AFTER.jpg',quality=95,subsampling=0)
 (OUT/'PROCESSING.json').write_text(json.dumps(dict(baseCommit=BASE,method='Unmodified approved pilot recolour(); selected fresh q92/q95 after detail comparison, method6',selectedQualityBySku=SELECTED_QUALITY,pillow=Image.__version__,libwebp=features.version('webp'),targetRGB=[250,249,245],records=records,totalBytes=sum(e['bytes'] for r in records for e in r['exports']),scope='Only five primary masters and ten existing responsive exports'),indent=2)+'\n')
if __name__=='__main__':main()
