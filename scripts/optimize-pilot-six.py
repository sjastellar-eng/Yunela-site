"""Compare/re-encode only approved six-SKU primary exports from git lossless.

Offline Pillow/numpy/scipy authoring tool. Baseline remains immutable in git.
No resizing, pixel retouch, CSS change or processing of other product images.
"""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import gaussian_filter

ROOT=Path(__file__).resolve().parents[1]
BASE='f50addfe01a4fcba739bce81d395344f8d5c3d04'
SKUS=('LIST-006','LIST-014','LIST-016','PHOTO-001','PHOTO-008','PHOTO-010')
QUALITIES=(88,92,95,98)
CACHE=ROOT.parent/'optimization-six-candidates'
OUT=ROOT/'docs/image-optimization-six'

def original(path):
    return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)

def digest(data):return hashlib.sha256(data).hexdigest()

def ssim(a,b):
    # Luminance SSIM, Gaussian 11px neighbourhood; foreground-only mean also
    # reported to prevent a large uniform backdrop dominating the score.
    weights=np.array([.2126,.7152,.0722])
    x=a@weights;y=b@weights
    ux=gaussian_filter(x,1.5);uy=gaussian_filter(y,1.5)
    vx=gaussian_filter(x*x,1.5)-ux*ux;vy=gaussian_filter(y*y,1.5)-uy*uy
    cov=gaussian_filter(x*y,1.5)-ux*uy
    score=((2*ux*uy+6.5025)*(2*cov+58.5225))/((ux*ux+uy*uy+6.5025)*(vx+vy+58.5225))
    foreground=np.max(np.abs(a-np.array([250,249,245])),axis=2)>40
    return float(score.mean()),float(score[foreground].mean())

def compare():
    CACHE.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
    gallery=json.loads(original('content/creative-gallery.v1.json'))
    records=[]
    for sku in SKUS:
        p=next(p for p in gallery['products'] if p['sourceSku']==sku)
        asset=p['images'][0];assert asset['role']=='primary'
        for v in [asset,*asset['variants']]:
            path='public'+v['path'];data=original(path)
            ref=CACHE/'lossless'/Path(path).name;ref.parent.mkdir(exist_ok=True);ref.write_bytes(data)
            image=Image.open(io.BytesIO(data)).convert('RGB');a=np.asarray(image).astype(float)
            row={'sourceSku':sku,'path':path,'width':image.width,'height':image.height,'baselineBytes':len(data),'baselineSha256':digest(data),'candidates':[]}
            for quality in QUALITIES:
                folder=CACHE/str(quality);folder.mkdir(exist_ok=True)
                target=folder/Path(path).name
                stream=io.BytesIO();image.save(stream,format='WEBP',quality=quality,method=6,lossless=False)
                encoded=stream.getvalue();temp=target.with_suffix('.tmp');temp.write_bytes(encoded);temp.replace(target)
                assert target.read_bytes()==encoded
                decoded=Image.open(io.BytesIO(encoded)).convert('RGB');assert decoded.size==image.size
                b=np.asarray(decoded).astype(float)
                global_score,subject_score=ssim(a,b)
                mse=float(np.mean((a-b)**2));corners=[b[0,0].astype(int).tolist(),b[0,-1].astype(int).tolist(),b[-1,0].astype(int).tolist(),b[-1,-1].astype(int).tolist()]
                row['candidates'].append({'quality':quality,'bytes':len(encoded),'sha256':digest(encoded),'ssim':round(global_score,6),'foregroundSSIM':round(subject_score,6),'psnrDB':round(float(10*np.log10(255**2/mse)),3),'cornerRGB':corners})
            records.append(row)
        print(sku+' compared',flush=True)
    report={'baselineCommit':BASE,'parameters':{'format':'WebP','method':6,'qualities':list(QUALITIES),'lossless':False,'resizing':False},'records':records}
    (OUT/'COMPRESSION_COMPARISON.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    summary=[]
    for q in QUALITIES:
        entries=[next(c for c in r['candidates'] if c['quality']==q) for r in records]
        total=sum(c['bytes'] for c in entries);before=sum(r['baselineBytes'] for r in records)
        summary.append({'quality':q,'bytes':total,'savingPercent':round(100*(1-total/before),2),'minimumForegroundSSIM':min(c['foregroundSSIM'] for c in entries)})
    print(json.dumps(summary))
    # Exact 1:1 pixel crops, with separate contour and contact-shadow rows.
    sheet=Image.new('RGB',(1200,6*450),'#eeefec');draw=ImageDraw.Draw(sheet)
    for i,sku in enumerate(SKUS):
        name=sku+'.webp';ref=Image.open(CACHE/'lossless'/name).convert('RGB');w,h=ref.size
        positions=[(int(w*.63),int(h*.32)),(int(w*.45),int(h*.78))]
        for col,q in enumerate(['lossless',*QUALITIES]):
            im=Image.open(CACHE/str(q)/name).convert('RGB');x=col*240;y=i*450
            draw.text((x+5,y+8),sku+' '+str(q),fill='#111111')
            for k,(cx,cy) in enumerate(positions):sheet.paste(im.crop((cx,cy,cx+235,cy+200)),(x,y+35+k*205))
    sheet.save(OUT/'CANDIDATE_DETAIL_COMPARISON.png')

def apply(quality):
    report=json.loads((OUT/'COMPRESSION_COMPARISON.json').read_text())
    assert quality in QUALITIES
    gallery=json.loads(original('content/creative-gallery.v1.json'));primary=json.loads(original('content/creative-images.v1.json'))
    records={r['path']:r for r in report['records']}
    for sku in SKUS:
        p=next(p for p in gallery['products'] if p['sourceSku']==sku);asset=p['images'][0]
        for v in [asset,*asset['variants']]:
            path='public'+v['path'];data=(CACHE/str(quality)/Path(path).name).read_bytes()
            candidate=next(c for c in records[path]['candidates'] if c['quality']==quality)
            assert digest(data)==candidate['sha256'];(ROOT/path).write_bytes(data);v['sha256']=digest(data)
        next(r for r in primary['images'] if r['sourceSku']==sku)['sha256']=asset['sha256']
    for name,obj in [('creative-gallery.v1.json',gallery),('creative-images.v1.json',primary)]:
        (ROOT/'content'/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    report['selectedQuality']=quality
    (OUT/'COMPRESSION_COMPARISON.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    sheet=Image.new('RGB',(1500,1200),'#eeefec');draw=ImageDraw.Draw(sheet)
    for i,sku in enumerate(SKUS):
        for col,q in enumerate(['lossless',quality]):
            im=Image.open(CACHE/str(q)/(sku+'.webp')).convert('RGB');w,h=im.size
            x=(i%3)*500+col*250;y=(i//3)*600
            thumb=im.copy();thumb.thumbnail((240,240),Image.Resampling.LANCZOS)
            sheet.paste(thumb,(x,y+40));draw.text((x+6,y+12),sku+(' LOSSLESS' if col==0 else ' OPTIMIZED'),fill='#111111')
            # Enlarged equal-coordinate detail of leaves or factory lettering.
            crop=im.crop((int(w*.53),int(h*.32),int(w*.73),int(h*.52))).resize((240,240),Image.Resampling.LANCZOS)
            sheet.paste(crop,(x,y+320))
    sheet.save(OUT/'LOSSLESS_VS_OPTIMIZED.png')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',type=int);args=parser.parse_args()
    if args.apply:apply(args.apply)
    else:compare()
