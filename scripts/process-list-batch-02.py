"""Process only LIST-007..011 with approved unchanged background method; compare q92/q95."""
import hashlib,importlib.util,io,json,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,features
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];BASE='cbab997b42bab081f4c6c7f55972c00a21a1ef8d'
OUT=ROOT/'docs/list-background-batch-02';SKUS=[f'LIST-{i:03}' for i in range(7,12)]
def module(name):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/name);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
pilot=module('background-pilot-six.py');metrics=module('optimize-pilot-six.py')
def old(p):return subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,b):
 t=p.with_suffix('.tmp');t.write_bytes(b);t.replace(p);assert p.read_bytes()==b

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 gallery=json.loads(old('content/creative-gallery.v1.json'));primary=json.loads(old('content/creative-images.v1.json'))
 records=[];sheet=Image.new('RGB',(1800,5*400),'#eeefec');draw=ImageDraw.Draw(sheet)
 for row,sku in enumerate(SKUS):
  product=next(x for x in gallery['products'] if x['sourceSku']==sku);asset=product['images'][0];assert asset['role']=='primary'
  source=old('public'+asset['path']);before=Image.open(io.BytesIO(source)).convert('RGB');corrected,stats=pilot.recolour(before,False)
  a,b=np.asarray(before),np.asarray(corrected);dark=a.max(axis=2)<180;assert np.array_equal(a[dark],b[dark])
  q=92;exports=[];candidate_images={}
  for entry in [asset,*asset['variants']]:
   im=corrected if entry is asset else corrected.resize((entry['width'],round(corrected.height*entry['width']/corrected.width)),Image.Resampling.LANCZOS)
   candidates=[]
   for quality in [92,95]:
    buf=io.BytesIO();im.save(buf,format='WEBP',quality=quality,method=6,lossless=False);encoded=buf.getvalue()
    candidate=Image.open(io.BytesIO(encoded)).convert('RGB');_,fg=metrics.ssim(np.asarray(im).astype(float),np.asarray(candidate).astype(float))
    candidates.append(dict(quality=quality,bytes=len(encoded),sha256=sha(encoded),foregroundSSIM=fg))
    if entry is asset:candidate_images[quality]=candidate.copy()
    if quality==92:data=encoded
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
 (OUT/'PROCESSING.json').write_text(json.dumps(dict(baseCommit=BASE,method='Unmodified approved pilot recolour(); fresh q92 chosen after comparing q95, method6',pillow=Image.__version__,libwebp=features.version('webp'),targetRGB=[250,249,245],records=records,totalBytes=sum(e['bytes'] for r in records for e in r['exports']),previousBatch02ReportedBytes=2255900,identityToPrunedLocalCommit='Sizes compared, old per-file hashes not available: identity not claimed'),indent=2)+'\n')
if __name__=='__main__':main()
