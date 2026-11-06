"""Recolour existing studio backdrops, without generating or rescaling subjects.

Reads immutable source bytes from the audited git commit, so repeated runs do
not accumulate WebP loss. Requires Pillow, numpy and scipy for offline authoring
only; no browser/runtime dependency. Dark subject pixels are kept exactly.
"""
import hashlib
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '3d514d24ab8b9249b8d4e6960591026d3699118d'
# Existing LIST studio backdrop in src/catalog/gallery.css.
TARGET = np.array([250, 249, 245], dtype=float)

def original(path):
    return subprocess.check_output(['git', 'show', f'{SOURCE}:public{path}'], cwd=ROOT)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def recolour(image, protect_wrapper):
    pixels = np.asarray(image.convert('RGB')).astype(float)
    h, w = pixels.shape[:2]
    # A smooth spatial backdrop estimate uses only the outer studio margin.
    yy, xx = np.mgrid[:h, :w]
    xx, yy = xx / (w - 1), yy / (h - 1)
    border = (xx < .035) | (xx > .965) | (yy < .035) | (yy > .965)
    samples = pixels[border]
    median = np.median(samples, axis=0)
    clean = border & (np.max(np.abs(pixels - median), axis=2) < 16)
    basis = np.stack([np.ones_like(xx), xx, yy, xx*yy, xx*xx, yy*yy], axis=-1)
    coef = np.linalg.lstsq(basis[clean][::4], pixels[clean][::4], rcond=None)[0]
    backdrop = np.clip(basis @ coef, median - 12, median + 12)
    distance = np.max(np.abs(pixels - backdrop), axis=2)
    # Exact paper beyond the subject; smooth colour decontamination at edges.
    strength = np.clip((52 - distance) / 32, 0, 1)
    if protect_wrapper:
        # Printed wrappers contain white paper: protect the enclosed silhouette,
        # including its light interior. Keep original contact shadows as well.
        silhouette = ndimage.binary_closing(distance > 32, iterations=3)
        silhouette = ndimage.binary_fill_holes(silhouette)
        labels, count = ndimage.label(silhouette)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        silhouette = sizes[labels] > h*w*.002
        core = ndimage.binary_erosion(silhouette, iterations=2)
        strength[core] = 0
    # Retain local shadow luminance; replace only the estimated backdrop colour.
    corrected = pixels + (TARGET - backdrop) * strength[..., None]
    # Keep the source shadow residual continuously: a hard brightness cutoff
    # would leave posterised islands around fine leaves. Only the empty outer
    # studio margin is feathered to exact paper; foreground is never included.
    edge_distance = np.minimum.reduce([xx, 1-xx, yy, 1-yy])
    edge_weight = np.clip(edge_distance / .025, 0, 1)
    edge_weight = edge_weight*edge_weight*(3-2*edge_weight)
    empty_margin = (distance < 20) & (edge_distance < .025)
    corrected[empty_margin] = TARGET + (corrected[empty_margin]-TARGET)*edge_weight[empty_margin,None]
    corrected = np.rint(np.clip(corrected, 0, 255)).astype('uint8')
    assert np.array_equal(corrected[distance >= 52], pixels[distance >= 52].astype('uint8'))
    return Image.fromarray(corrected), {
        'sourceBackgroundRGB': median.astype(int).tolist(),
        'protectedSubjectPixels': int(np.count_nonzero(distance >= 52)),
        'unchangedProtectedPixels': True,
    }

SKUS = ('LIST-006', 'LIST-014', 'LIST-016', 'PHOTO-001', 'PHOTO-008', 'PHOTO-010')

def main():
    from PIL import ImageDraw
    gallery = json.loads(subprocess.check_output(['git','show',SOURCE+':content/creative-gallery.v1.json'], cwd=ROOT))
    primary = json.loads(subprocess.check_output(['git','show',SOURCE+':content/creative-images.v1.json'], cwd=ROOT))
    lookup = {r['sourceSku']:r for r in primary['images']}
    report = []
    dest = ROOT/'docs/background-pilot-six'
    dest.mkdir(exist_ok=True)
    sheet = Image.new('RGB', (1500, 1200), '#eeefec')
    draw = ImageDraw.Draw(sheet)
    for index, sku in enumerate(SKUS):
        product = next(p for p in gallery['products'] if p['sourceSku']==sku)
        asset = next(a for a in product['images'] if a['role']=='primary')
        data = original(asset['path'])
        before = Image.open(io.BytesIO(data)).convert('RGB')
        after, stats = recolour(before, sku.startswith('PHOTO-'))
        a, b = np.asarray(before), np.asarray(after)
        # Protected dark foreground is unchanged by construction; no global grade.
        assert np.array_equal(a[a.max(axis=2)<180], b[a.max(axis=2)<180])
        # Source wrapper centre is protected, including its white paper and print.
        if sku.startswith('PHOTO-'):
            h,w = a.shape[:2]
            assert np.array_equal(a[h//3:2*h//3,w//3:2*w//3], b[h//3:2*h//3,w//3:2*w//3])
        stats['changedPixelFraction'] = round(float(np.any(a!=b,axis=2).mean()),6)
        exports = []
        for variant in [asset,*asset['variants']]:
            out = after if variant is asset else after.resize((variant['width'],round(after.height*variant['width']/after.width)),Image.Resampling.LANCZOS)
            stream = io.BytesIO();out.save(stream,format='WEBP',lossless=True,method=6)
            encoded=stream.getvalue();assert len(encoded)<=2*1024*1024
            path=ROOT/'public'/variant['path'].lstrip('/');path.write_bytes(encoded)
            decoded=np.asarray(Image.open(path));assert np.array_equal(decoded,np.asarray(out))
            corners=np.array([decoded[0,0],decoded[0,-1],decoded[-1,0],decoded[-1,-1]])
            assert np.max(np.abs(corners.astype(int)-TARGET))==0
            variant['sha256']=sha(encoded)
            exports.append({'path':variant['path'],'width':out.width,'height':out.height,'sha256':sha(encoded),'bytes':len(encoded),'cornerRGB':corners.tolist()})
        lookup[sku]['sha256']=asset['sha256']
        # Existing provenance remains unchanged; this report records local processing.
        for column,image in enumerate([before,after]):
            thumb=image.copy();thumb.thumbnail((240,240),Image.Resampling.LANCZOS)
            x=(index%3)*500+column*250;y=(index//3)*600
            sheet.paste(thumb,(x,y+40))
            draw.text((x+8,y+12),sku+(' BEFORE' if column==0 else ' AFTER'),fill='#111111')
            # Equal source-coordinate enlargement of right wrapper/leaf contours.
            w,h=image.size
            crop=image.crop((int(w*.67),int(h*.3),int(w*.95),int(h*.58))).resize((240,240),Image.Resampling.LANCZOS)
            sheet.paste(crop,(x,y+320))
        report.append({'sourceSku':sku,'sourceSha256':sha(data),**stats,'exports':exports})
        print(sku+' PASS',flush=True)
    sheet.save(dest/'BEFORE_AFTER.png')
    for name,obj in [('creative-gallery.v1.json',gallery),('creative-images.v1.json',primary)]:
        (ROOT/'content'/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    (dest/'PROCESSING.json').write_text(json.dumps({'sourceCommit':SOURCE,'targetHex':'#FAF9F5','targetRGB':[250,249,245],'scope':'Six primary images and their 12 adaptive variants only','method':'Spatial backdrop correction, enclosed wrapper protection, retained source shadows, no generative model, lossless WebP','records':report},ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    main()
