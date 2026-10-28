"""Task 14: immutable-source, per-SKU backdrop correction and reviewed exports.

Uses the approved pilot recolour unchanged. PHOTO adds a conservative enclosed
wrapper/stand protection mask; no generation, grading, cropping or repositioning.
Candidate generation and application are separate so visual review precedes writes.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, features
from scipy import ndimage

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
BASE = '3e87ade2d073332c6e181fae8d755f5d40a4780d'
OUT = ROOT / 'docs/catalog-background-final'
CACHE = ROOT.parent / 'catalog-final-candidates'
TARGET = np.array([250, 249, 245])
APPROVED = {f'LIST-{i:03}' for i in range(1, 22)} | {'PHOTO-001', 'PHOTO-008', 'PHOTO-010'}
GROUPS = {'A': [f'LIST-{i:03}' for i in range(22, 27)],
          'B': [f'PHOTO-{i:03}' for i in range(2, 12) if i not in (8, 10)],
          'C': [f'PHOTO-{i:03}' for i in range(12, 21)],
          'D': [f'PHOTO-{i:03}' for i in range(21, 31)]}

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / name)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

pilot = module('background-pilot-six.py')
metrics = module('optimize-pilot-six.py')
def old(path): return subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=ROOT)
def sha(data): return hashlib.sha256(data).hexdigest()
def load_old(path): return json.loads(old(path))
def save_json(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def decode(data): return Image.open(io.BytesIO(data)).convert('RGB')
def corners(im): return [list(im.getpixel(p)) for p in [(0, 0), (im.width-1, 0), (0, im.height-1), (im.width-1, im.height-1)]]
def compliant(im):
    a = np.asarray(im).astype(int)
    # Empty outer strips only, excluding the product; robust to isolated codec noise.
    n = max(2, int(min(im.size) * .012))
    border = np.concatenate([a[:n].reshape(-1,3), a[-n:].reshape(-1,3), a[:, :n].reshape(-1,3), a[:, -n:].reshape(-1,3)])
    return bool(np.max(np.abs(np.array(corners(im))-TARGET)) <= 2 and np.quantile(np.max(np.abs(border-TARGET), axis=1), .99) <= 4)

def audit():
    OUT.mkdir(exist_ok=True)
    gallery = load_old('content/creative-gallery.v1.json')
    primary = load_old('content/creative-images.v1.json')
    keys = {p['sourceSku'] for p in gallery['products']}
    assert len(keys) == len(gallery['products']) == len(primary['images']) == 56
    remaining = set(sum(GROUPS.values(), []))
    assert len(APPROVED) == 24 and len(remaining) == 32 and APPROVED | remaining == keys
    assert not APPROVED & remaining
    rows = []
    for product in gallery['products']:
        sku = product['sourceSku']; asset = product['images'][0]
        assert asset['sourceSku'] == sku and asset['role'] == 'primary'
        assert product['primary'] == asset['path']
        im = decode(old('public'+asset['path']))
        files = []
        for a in [asset, *asset.get('variants', [])]:
            data = old('public'+a['path']); assert sha(data) == a['sha256']
            picture = decode(data)
            files.append({'path':a['path'], 'sha256':sha(data), 'bytes':len(data), 'size':picture.size,
                          'cornerRGB':corners(picture), 'alreadyCompliant':compliant(picture)})
        rows.append({'sourceSku':sku, 'status':'ALREADY APPROVED' if sku in APPROVED else 'PENDING',
                     'sourceFormat':'WEBP', 'sourceSize':im.size, 'primaryFiles':files,
                     'rightsStatus':asset.get('rightsStatus'), 'assignmentStatus':asset.get('assignmentStatus'),
                     'publicationAllowed':asset.get('publicationAllowed'),
                     'rightsEvidenceId':asset.get('rightsEvidenceId'),
                     'rightsEvidenceLevel':asset.get('rightsEvidenceLevel'),
                     'underlyingOrigin':asset.get('underlyingOrigin')})
    save_json(OUT/'INPUT_AUDIT.json', {'base':BASE, 'targetHex':'#FAF9F5', 'groups':GROUPS, 'rows':rows})
    return gallery

def photo_protection(im):
    a = np.asarray(im).astype(float)
    h,w = a.shape[:2]
    border = np.concatenate([a[:20].reshape(-1,3), a[-20:].reshape(-1,3), a[:,:20].reshape(-1,3), a[:,-20:].reshape(-1,3)])
    background = np.median(border,axis=0)
    contrast = np.max(np.abs(a-background),axis=2)
    # Close printed contours, then fill their enclosed white paper. Retain only
    # significant components, preserving the stand as well as the wrapper disk.
    mask = ndimage.binary_closing(contrast > 26, iterations=5)
    mask = ndimage.binary_fill_holes(mask)
    labels,_ = ndimage.label(mask)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    mask = sizes[labels] > h*w*.001
    mask = ndimage.binary_dilation(mask, iterations=2)
    assert mask[h//3:2*h//3,w//3:2*w//3].all(), 'Enclosed pale wrapper protection incomplete'
    yy,xx = np.where(mask)
    assert xx.min()>w*.02 and xx.max()<w*.98 and yy.min()>h*.02 and yy.max()<h*.98, 'Subject touches frame'
    return mask

def generate(group):
    gallery = audit()
    dest = OUT/group; dest.mkdir(exist_ok=True)
    records = []
    for sku in GROUPS[group]:
        product = next(p for p in gallery['products'] if p['sourceSku']==sku)
        asset = product['images'][0]
        if not (asset.get('publicationAllowed') and asset.get('rightsStatus')=='COMMERCIAL_USE_APPROVED' and asset.get('assignmentStatus')=='APPROVED_FOR_SKU'):
            records.append({'sourceSku':sku, 'status':'BLOCKED', 'reason':'Existing rights/assignment gate does not permit this source'}); continue
        if sku=='PHOTO-012' and asset.get('rightsEvidenceId')!='CEO_PHOTO_012_PERMISSION_2026_10_25':
            records.append({'sourceSku':sku, 'status':'BLOCKED', 'reason':'Specific PHOTO-012 permission missing'}); continue
        source = old('public'+asset['path']); before = decode(source)
        entries = [asset, *asset.get('variants', [])]
        if all(compliant(decode(old('public'+a['path']))) for a in entries):
            records.append({'sourceSku':sku, 'status':'UNCHANGED', 'reason':'All three current exports already match backdrop tolerance'}); continue
        try:
            corrected,stats = pilot.recolour(before, sku.startswith('PHOTO-'))
            a = np.asarray(before); b = np.asarray(corrected).copy()
            mask = photo_protection(before) if sku.startswith('PHOTO-') else a.max(axis=2)<180
            if sku.startswith('PHOTO-'):
                # Keep every enclosed pixel and a two-pixel safety contour exact
                # before encoding. Feather only outside the protected silhouette.
                distance = ndimage.distance_transform_edt(~mask)
                weight = np.clip(distance/3,0,1)
                b = np.rint(a + (b.astype(float)-a)*weight[...,None]).astype('uint8')
                b[mask] = a[mask]
            assert np.array_equal(a[mask],b[mask]), 'Protected subject pixels changed before encoding'
            assert np.array_equal(a[a.max(axis=2)<180],b[a.max(axis=2)<180]), 'Dark foreground changed before encoding'
            corrected = Image.fromarray(b)
            assert compliant(corrected), 'Backdrop exceeds corner/outer-strip tolerance'
        except AssertionError as error:
            records.append({'sourceSku':sku,'status':'EXCEPTION','reason':str(error)}); print(sku,'EXCEPTION',str(error),flush=True); continue
        cache = CACHE/sku; cache.mkdir(parents=True,exist_ok=True)
        corrected.save(cache/'corrected.png')
        Image.fromarray(mask.astype('uint8')*255).save(cache/'protected-mask.png')
        exports = []
        for entry in entries:
            ref = corrected if entry is asset else corrected.resize((entry['width'],round(corrected.height*entry['width']/corrected.width)),Image.Resampling.LANCZOS)
            candidate_rows = []
            for quality in [92,95,98] if sku.startswith('PHOTO-') else [92,95]:
                buf=io.BytesIO();ref.save(buf,format='WEBP',quality=quality,method=6,lossless=False)
                data=buf.getvalue(); dec=decode(data)
                _,ssim=metrics.ssim(np.asarray(ref).astype(float),np.asarray(dec).astype(float))
                (cache/f'{Path(entry["path"]).stem}-q{quality}.webp').write_bytes(data)
                candidate_rows.append({'quality':quality,'bytes':len(data),'sha256':sha(data),'foregroundSSIM':ssim,'cornerRGB':corners(dec),'backgroundPass':compliant(dec)})
            exports.append({'path':entry['path'],'size':ref.size,'beforeBytes':len(old('public'+entry['path'])),'sourceSha256':entry['sha256'],'candidates':candidate_rows})
        record={'sourceSku':sku,'status':'CANDIDATES','sourceSha256':sha(source),'protectedPixels':int(mask.sum()),
                'protectedLightPixels':int((mask & (a.min(axis=2)>200)).sum()),'protectedPreEncodeExact':True,
                'sourceBackgroundRGB':stats['sourceBackgroundRGB'],'exports':exports}
        records.append(record)
        make_details(sku,before,corrected,cache,dest)
        print(sku,'candidates',[(x['quality'],round(x['foregroundSSIM'],5)) for x in exports[0]['candidates']],flush=True)
    save_json(dest/'CANDIDATES.json',{'base':BASE,'checkpoint':group,'pillow':Image.__version__,'libwebp':features.version('webp'),'records':records})

def make_details(sku,before,corrected,cache,dest):
    photo=sku.startswith('PHOTO-'); qualities=[92,95,98] if photo else [92,95]
    images=[('SOURCE',before),('CORRECTED',corrected)]+[(f'q{q}',Image.open(cache/f'{sku}-q{q}.webp').convert('RGB')) for q in qualities]
    w,h=before.size
    # Upper print, pale right rim and lower rim/contact shadow; native coordinates.
    positions=[(int(w*.34),int(h*.22)),(int(w*.67),int(h*.39)),(int(w*.42),int(h*.76))] if photo else [(420,290),(650,450),(610,830)]
    sheet=Image.new('RGB',(len(images)*250,820),'#eeefec');d=ImageDraw.Draw(sheet)
    for col,(label,im) in enumerate(images):
        d.text((col*250+4,8),sku+' '+label,fill='black')
        for row,(x,y) in enumerate(positions):
            crop=im.crop((x,y,min(x+245,w),min(y+245,h)))
            sheet.paste(crop,(col*250,40+row*255))
    sheet.save(dest/f'{sku}-details.jpg',quality=95,subsampling=0)
    if photo:
        mask=np.asarray(Image.open(cache/'protected-mask.png'))>0
        overlay=np.asarray(before).copy();overlay[mask]=(overlay[mask]*.65+np.array([0,110,220])*.35).astype('uint8')
        Image.fromarray(overlay).resize((500,500)).save(dest/f'{sku}-mask.jpg',quality=92)

def apply(group,selections):
    dest=OUT/group;report=json.loads((dest/'CANDIDATES.json').read_text());gallery=json.loads((ROOT/'content/creative-gallery.v1.json').read_text());primary=json.loads((ROOT/'content/creative-images.v1.json').read_text())
    chosen=json.loads(Path(selections).read_text())
    sheet=Image.new('RGB',(1200,len(report['records'])*330),'#eeefec');d=ImageDraw.Draw(sheet)
    for row,r in enumerate(report['records']):
        sku=r['sourceSku'];product=next(p for p in gallery['products'] if p['sourceSku']==sku);asset=product['images'][0]
        if r['status']=='CANDIDATES':
            q=chosen[sku];assert q in (92,95,98)
            for entry,export in zip([asset,*asset['variants']],r['exports']):
                expected=next(c for c in export['candidates'] if c['quality']==q)
                data=(CACHE/sku/f'{Path(entry["path"]).stem}-q{q}.webp').read_bytes()
                assert sha(data)==expected['sha256'] and expected['foregroundSSIM']>.99 and expected['backgroundPass']
                (ROOT/'public'/entry['path'].lstrip('/')).write_bytes(data);entry['sha256']=sha(data)
                export.update({'selectedQuality':q,'method':6,'afterBytes':len(data),'sha256':sha(data),'foregroundSSIM':expected['foregroundSSIM']})
            next(a for a in primary['images'] if a['sourceSku']==sku)['sha256']=asset['sha256']
            r['status']='UPDATED';r['selectedQuality']=q
        before=decode(old('public'+asset['path']));after=Image.open(ROOT/'public'/asset['path'].lstrip('/')).convert('RGB')
        for col,im in enumerate([before,after]):
            thumb=im.copy();thumb.thumbnail((295,295));x=col*300;y=row*330
            sheet.paste(thumb,(x,y+30));d.text((x+5,y+7),sku+(' BEFORE' if col==0 else ' AFTER '+r['status']),fill='black')
            w,h=im.size
            for k,(cx,cy) in enumerate([(int(w*.65),int(h*.35)),(int(w*.43),int(h*.76))]):
                crop=im.crop((cx,cy,cx+295,min(cy+295,h)))
                x=600+k*300;half=crop.resize((145,145));sheet.paste(half,(x+col*150,y+45));d.text((x+col*150+2,y+12),('EDGE ' if k==0 else 'SHADOW ')+('BEFORE' if col==0 else 'AFTER'),fill='black')
    save_json(ROOT/'content/creative-gallery.v1.json',gallery);save_json(ROOT/'content/creative-images.v1.json',primary)
    save_json(dest/'RESULTS.json',report);sheet.save(dest/'BEFORE_AFTER.jpg',quality=94,subsampling=0)

def verify():
    gallery=json.loads((ROOT/'content/creative-gallery.v1.json').read_text());baseline=load_old('content/creative-gallery.v1.json')
    primary=json.loads((ROOT/'content/creative-images.v1.json').read_text());base_primary=load_old('content/creative-images.v1.json')
    def nonhash(o):
        if isinstance(o,dict):return {k:nonhash(v) for k,v in o.items() if k!='sha256'}
        if isinstance(o,list):return [nonhash(v) for v in o]
        return o
    assert nonhash(gallery)==nonhash(baseline) and nonhash(primary)==nonhash(base_primary)
    allowed=set(sum(GROUPS.values(),[]));updated=set();rows=[]
    for group in GROUPS:
        path=OUT/group/'RESULTS.json'
        if path.exists():
            for r in json.loads(path.read_text())['records']:
                rows.append(r)
                if r['status']=='UPDATED':updated.add(r['sourceSku'])
    files=0
    for product in gallery['products']:
        sku=product['sourceSku'];base=next(p for p in baseline['products'] if p['sourceSku']==sku)
        if sku not in updated:assert product==base
        for asset in product['images']:
            for a in [asset,*asset.get('variants',[])]:
                data=(ROOT/'public'/a['path'].lstrip('/')).read_bytes();assert sha(data)==a['sha256']
                im=decode(data);im.load();files+=1
                if asset['role']!='primary' or sku not in updated:assert data==old('public'+a['path'])
                else:assert sku in allowed and compliant(im)
    assert files==347
    result={'status':'PASS','base':BASE,'products':56,'files':files,'updated':sorted(updated),'approved24Preserved':True,'allOtherCreativeAssetsPreserved':True,'nonHashManifestDataPreserved':True}
    save_json(OUT/'SCOPE_QA.json',result);print(json.dumps(result))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['audit','generate','apply','verify']);parser.add_argument('--checkpoint',choices=GROUPS);parser.add_argument('--selections')
    args=parser.parse_args()
    if args.action=='audit':audit()
    elif args.action=='generate':generate(args.checkpoint)
    elif args.action=='apply':apply(args.checkpoint,args.selections)
    else:verify()
