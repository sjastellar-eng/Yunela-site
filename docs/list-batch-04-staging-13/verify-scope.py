import concurrent.futures, hashlib, io, json, subprocess, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = 'f6ddcb149b7cc9b0b57f1d5a107b52f028f25020'
SOURCE = '3e87ade2d073332c6e181fae8d755f5d40a4780d'
TARGET = {f'LIST-{i:03}' for i in range(17,22)}
PREVIOUS = {f'LIST-{i:03}' for i in range(1,17)} | {'PHOTO-001','PHOTO-008','PHOTO-010'}
def old(p): return subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
def digest(b): return hashlib.sha256(b).hexdigest()
def strip_hash(x):
    if isinstance(x,dict): return {k:strip_hash(v) for k,v in x.items() if k!='sha256'}
    if isinstance(x,list): return [strip_hash(v) for v in x]
    return x

gallery=json.loads((ROOT/'content/creative-gallery.v1.json').read_text())
before=json.loads(old('content/creative-gallery.v1.json'))
assert len(PREVIOUS)==19
for name in ['creative-gallery.v1.json','creative-images.v1.json']:
    assert strip_hash(json.loads(old('content/'+name)))==strip_hash(json.loads((ROOT/'content'/name).read_text()))
for p in gallery['products']:
    if p['sourceSku'] not in TARGET:
        assert p==next(b for b in before['products'] if b['sourceSku']==p['sourceSku'])
changed=subprocess.check_output(['git','diff','--name-only',BASE,SOURCE],cwd=ROOT,text=True).splitlines()
images=[p for p in changed if p.startswith('public/')]
expected={f'public/creative/{sku}{suffix}.webp' for sku in TARGET for suffix in ['', '-primary-480','-primary-800']}
assert set(images)==expected
for p in changed:
    assert p in expected or p in ['content/creative-gallery.v1.json','content/creative-images.v1.json','docs/DEVELOPER_HANDOFF_LATEST.md','scripts/process-list-batch-04.py'] or p.startswith('docs/list-background-batch-04/')
for p in expected:
    im=Image.open(ROOT/p); im.load()
    assert im.size==((480,480) if '-480' in p else (800,800) if '-800' in p else (1200,1200))
files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'public/creative'],cwd=ROOT,text=True).splitlines()
preserved=[]
for p in files:
    if p not in expected:
        assert (ROOT/p).read_bytes()==old(p),p
        preserved.append(p)
mode=sys.argv[1] if len(sys.argv)>1 else 'local'
report={'base':BASE,'source':SOURCE,'scope':'PASS','targetImages':15,'otherSku':51,'previousSku':sorted(PREVIOUS),'nonHashManifestData':'identical','preservedCreativeFiles':len(preserved)}
if mode in ['before','after']:
    selected=[]
    for product in (before if mode=='before' else gallery)['products']:
        if product['sourceSku'] in PREVIOUS or product['sourceSku'] in TARGET:
            for asset in product['images']:
                for a in [asset,*asset.get('variants',[])]:
                    selected.append({'sku':product['sourceSku'],'path':a['path'],'sha256':a['sha256']})
    def check(a):
        req=urllib.request.Request('https://yunela-v92-demo.onrender.com'+a['path'],headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(req,timeout=60) as response:
            data=response.read(); assert response.status==200
        assert digest(data)==a['sha256'],a['path']
        im=Image.open(io.BytesIO(data)); im.load()
        return dict(a,bytes=len(data),size=im.size,status='PASS')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: report['liveAssets']=list(pool.map(check,selected))
    report['liveAssetsCount']=len(selected)
(OUT/f'scope-{mode}.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='liveAssets'},indent=2))
