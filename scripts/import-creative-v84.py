"""Import approved Creative bytes; private QA/reference files are never published."""
import argparse,hashlib,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--public',required=True);p.add_argument('--full',required=True);p.add_argument('--ceo-supplier-permission',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(args.public) as pub,zipfile.ZipFile(args.full) as full:
 prefix='YUNELA_CREATIVE_V8_4_FINAL/'
 masters=json.loads(full.read(prefix+'MANIFEST/image_manifest.json'))['images'];orders=json.loads(full.read(prefix+'MANIFEST/gallery_order.json'))['products'];byhash={m['sha256']:m for m in masters}
 manifest=json.loads(pub.read('content/creative-images.v1.json'));registry={m['sourceSku']:m for m in manifest['images']};galleries={sku:[] for sku in registry};files={}
 def copy(path,data,sha):
  assert hashlib.sha256(data).hexdigest()==sha and data[:4]==b'RIFF' and data[8:12]==b'WEBP' and len(data)<=2097152
  files[path]=data
 def add(sku,path,m,read,supplier=False):
  primary=m['imageRole']=='primary';variants=[];copy(path,read(m['filePath']),m['sha256'])
  for v in m['adaptiveVersions']:
   vp=path[:-5]+('-primary' if primary else '')+f"-{v['width']}.webp";copy(vp,read(v['filePath']),v['sha256']);variants.append({'path':vp,'width':v['width'],'sha256':v['sha256']})
  a={'sourceSku':sku,'path':path,'role':m['imageRole'],'kind':'SUPPLIER_PRODUCT_PHOTO' if supplier else 'ILLUSTRATIVE','rightsStatus':'COMMERCIAL_USE_APPROVED','assignmentStatus':'APPROVED_FOR_SKU','publicationAllowed':True,'alt':registry[sku]['alt'] if primary else f'AI-ілюстрація чаю {sku}: додатковий ракурс; не фото партії.','sha256':m['sha256'],'width':m['width'],'height':m['height'],'variants':variants,'documentary':supplier,'matchConfidence':m['matchConfidence']}
  if supplier:a.update(supplierAuthorized=True,rightsEvidenceId='CEO_SUPPLIER_PERMISSION_2026_10_23',rightsEvidenceLevel='REPORTED_BY_CEO')
  galleries[sku].append(a)
  if primary:registry[sku].update({k:v for k,v in a.items() if k not in ['role','variants','width','height','documentary','matchConfidence']})
 for r in json.loads(pub.read('handoff/generated-gallery-files.json'))['images']:
  m=byhash[r['sha256']];assert m['sourceSku']==r['sourceSku'] and m['publicationAllowed'] and not m['documentary'] and r['publicLabel']=='AI ILLUSTRATION'
  if r['imageRole']=='primary':assert registry[r['sourceSku']]['sha256']==r['sha256']
  def read(original,m=m,r=r):
   if original==m['filePath']:return pub.read('public'+r['filePath'])
   v=next(v for v in m['adaptiveVersions'] if v['filePath']==original);return pub.read('public'+r['filePath'][:-5]+('-primary' if r['imageRole']=='primary' else '')+f"-{v['width']}.webp")
  add(r['sourceSku'],r['filePath'],m,read)
 for m in masters:
  if m['sourceSku'].startswith('PHOTO-') and m['imageRole']=='primary' and args.ceo_supplier_permission and m.get('underlyingOrigin')=='SUPPLIER PHOTO' and m['wrappedProduct']:
   sku=m['sourceSku'];registry[sku]['alt']=f"Оригінальне фото заводської упаковки: {next(p['name'] for p in orders if p['sourceSku']==sku)}. Не підтверджує поточну партію."
   add(sku,f'/creative/{sku}.webp',m,lambda path:full.read(prefix+path),True)
 products=[]
 for g in orders:
  sku=g['sourceSku'];order={path:i for i,path in enumerate(g['galleryOrder'])};roles={m['imageRole']:m['filePath'] for m in masters if m['sourceSku']==sku};images=sorted(galleries[sku],key=lambda a:order.get(roles[a['role']],999));primary=next((a for a in images if a['role']=='primary'),None)
  products.append({'sourceSku':sku,'primary':primary['path'] if primary else None,'images':images if primary else []})
 used={x['path'] for p in products for a in p['images'] for x in [a,*a['variants']]}
 for path in used:
  target=root/'public'/path[1:];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(files[path])
 (root/'content/creative-images.v1.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(root/'content/creative-gallery.v1.json').write_text(json.dumps({'schemaVersion':'creative-gallery-v1','products':products},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'sku':len(products),'primary':sum(bool(p['primary']) for p in products),'masters':sum(len(p['images']) for p in products),'files':len(used),'blocked':[p['sourceSku'] for p in products if not p['primary']]}))
