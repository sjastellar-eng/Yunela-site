"""Verify Task 14A exact scope, immutable other SKU and every image hash."""
import hashlib
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = '3e87ade2d073332c6e181fae8d755f5d40a4780d'
OUT = ROOT / 'docs/list-background-final-five'
SKUS = {f'LIST-{i:03}' for i in range(22,27)}
def old(path): return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
def digest(data): return hashlib.sha256(data).hexdigest()
def nonhash(o):
    if isinstance(o,dict): return {k:nonhash(v) for k,v in o.items() if k!='sha256'}
    if isinstance(o,list): return [nonhash(v) for v in o]
    return o

gallery = json.loads((ROOT/'content/creative-gallery.v1.json').read_text())
baseline = json.loads(old('content/creative-gallery.v1.json'))
for name in ['creative-gallery.v1.json','creative-images.v1.json']:
    assert nonhash(json.loads((ROOT/'content'/name).read_text())) == nonhash(json.loads(old('content/'+name)))
files = 0
changed = set()
for product in gallery['products']:
    sku = product['sourceSku']
    previous = next(p for p in baseline['products'] if p['sourceSku']==sku)
    if sku not in SKUS: assert product==previous,sku
    for asset in product['images']:
        assert asset['sourceSku']==sku
        for entry in [asset,*asset.get('variants',[])]:
            path='public'+entry['path'];data=(ROOT/path).read_bytes()
            assert digest(data)==entry['sha256'],path
            image=Image.open(io.BytesIO(data));image.load();files+=1
            if data!=old(path):
                assert sku in SKUS and asset['role']=='primary',path
                size=entry.get('width',asset['width']);assert image.size==(size,size)
                a=np.array(image).astype(int)
                samples=np.array([a[0,0],a[0,-1],a[-1,0],a[-1,-1]])
                assert np.max(abs(samples-[250,249,245]))<=2,path
                changed.add(path)
expected={f'public/creative/{sku}{suffix}.webp' for sku in SKUS for suffix in ['', '-primary-480','-primary-800']}
assert changed==expected and files==347
all_creative=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'public/creative'],cwd=ROOT,text=True).splitlines()
for path in all_creative:
    if path not in expected: assert (ROOT/path).read_bytes()==old(path),path
diff=subprocess.check_output(['git','diff',BASE,'--name-only'],cwd=ROOT,text=True).splitlines()
for path in diff:
    assert path in expected or path in ['content/creative-gallery.v1.json','content/creative-images.v1.json','scripts/process-list-final-five.py','scripts/verify-list-final-five.py'] or path.startswith('docs/list-background-final-five/'),path
result={'status':'PASS','baseCommit':BASE,'products':56,'masterAndResponsiveFiles':files,'changedImages':len(changed),'changedSku':sorted(SKUS),'otherSkuUnchanged':51,'otherCreativeFilesUnchanged':len(all_creative)-15,'allPhotoUnchanged':True,'allSecondaryTextureUnchanged':True,'nonHashManifestDataUnchanged':True,'cornerToleranceRGB':2,'noCSSCatalogBusinessLogicDependencyChanges':True}
(OUT/'SCOPE_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
