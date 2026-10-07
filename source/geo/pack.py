import numpy as np, json, rasterio, base64, io, os
from PIL import Image
from rasterio.features import rasterize
from shapely.geometry import shape
S=json.load(open("sites.json")); G=json.load(open("grid.json")); RES=G['res']
NL=rasterio.open("nlcd90.tif").read(1); HU=rasterio.open("housing90.tif").read(1)
H,W=NL.shape
# global crop = union of site windows
r0=min(s['window']['r0'] for s in S['sites']); c0=min(s['window']['c0'] for s in S['sites'])
r1=max(s['window']['r0']+s['window']['h'] for s in S['sites']); c1=max(s['window']['c0']+s['window']['w'] for s in S['sites'])
print("global crop",r0,r1,c0,c1,r1-r0,c1-c0)
tr=rasterio.transform.from_origin(G['x0'],G['y1'],RES,RES)
cg=shape(json.load(open("county_utm.json")))
mask=rasterize([(cg,1)],out_shape=(H,W),transform=tr,fill=0,dtype='uint8')
def png_b64(arr,mode):
    im=Image.fromarray(arr,mode); b=io.BytesIO(); im.save(b,format="PNG",optimize=True); return base64.b64encode(b.getvalue()).decode(), len(b.getvalue())
out=dict(crop=dict(r0=int(r0),c0=int(c0),h=int(r1-r0),w=int(c1-c0)),res=RES,freqs=S['freqs'],hrx=S['hrx'],sites=[],enc=dict(itm="L=70+v/1.5 dB (R=2.6,G=3.6,B=6.0 GHz)",depth="m = v*10, capped 600 (R,G,B = hr 2,6,10 m)",los="255=clutter-free LOS (R,G,B = hr 2,6,10)",housing="units*10 = R*256+G; B=255 inside Georgetown County"))
sizes={}
nl_c=NL[r0:r1,c0:c1]; out['nlcd'],sizes['nlcd']=png_b64(nl_c,"L")
hu=np.clip(np.round(HU[r0:r1,c0:c1]*10),0,65535).astype(np.uint16)
rgb=np.zeros((r1-r0,c1-c0,3),dtype=np.uint8); rgb[...,0]=hu>>8; rgb[...,1]=hu&255; rgb[...,2]=mask[r0:r1,c0:c1]*255
out['housing'],sizes['housing']=png_b64(rgb,"RGB")
print("county housing units:",float(HU[mask==1].sum()),"in crop:",float(HU[r0:r1,c0:c1][mask[r0:r1,c0:c1]==1].sum()))
for s in S['sites']:
    z=np.load(f"site_{s['id']}.npz"); itm=z['itm']; dep=z['dep']; los=z['los']; inside=z['inside']
    w=s['window']; d=dict(id=s['id'],name=s['name'],asr=s['asr'],lat=s['lat'],lon=s['lon'],tower_m=s['tower_m'],ht=s['ht'],ground_m=round(s['ground_m'],1),owner=s['owner'],px=s['px']-c0,py=s['py']-r0,r0=w['r0']-r0,c0=w['c0']-c0,h=w['h'],w=w['w'])
    d['itm']=[]
    for hi in range(3):
        rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
        for fi in range(3):
            v=np.clip(np.round((itm[fi,hi]-70)*1.5),0,255); v=np.where(inside,v,255); rgb[...,fi]=v.astype(np.uint8)
        b,sz=png_b64(rgb,"RGB"); d['itm'].append(b); sizes[f"{s['id']}_itm{hi}"]=sz
    rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
    for hi in range(3): rgb[...,hi]=np.clip(np.round(dep[hi]/10),0,60).astype(np.uint8)
    d['depth'],sizes[f"{s['id']}_depth"]=png_b64(rgb,"RGB")
    rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
    for hi in range(3): rgb[...,hi]=(los[hi]*255).astype(np.uint8)
    d['los'],sizes[f"{s['id']}_los"]=png_b64(rgb,"RGB")
    out['sites'].append(d)
# vectors shifted to crop
V=json.load(open("vectors.json"))
def simp(pts,tol=1.0):
    # Douglas-Peucker
    pts=np.array(pts)
    if len(pts)<3: return pts.tolist()
    def dp(p):
        if len(p)<3: return p
        a,b=p[0],p[-1]; ab=b-a; n=np.hypot(*ab)
        if n==0: dists=np.hypot(*(p-a).T)
        else: q=p-a; dists=np.abs(ab[0]*q[:,1]-ab[1]*q[:,0])/n
        i=int(np.argmax(dists))
        if dists[i]>tol: return np.vstack([dp(p[:i+1])[:-1],dp(p[i:])])
        return np.array([a,b])
    return dp(pts).tolist()
roads=[]
for r in V['roads']:
    p=simp([[x-c0,y-r0] for x,y in r['pts']],1.0)
    roads.append(dict(cls=r['cls'],name=r['name'],pts=[[round(x,1),round(y,1)] for x,y in p]))
out['roads']=roads
out['places']=[dict(name=p['name'],px=round(p['px']-c0,1),py=round(p['py']-r0,1),area=p['area_km2']) for p in V['places']]
out['county']=[[[round(x-c0,1),round(y-r0,1)] for x,y in ring] for ring in V['county']]
json.dump(out,open("geodata.json","w"),separators=(",",":"))
print({k:round(v/1024) for k,v in sizes.items()}); print("total KB",os.path.getsize("geodata.json")//1024, "roads pts",sum(len(r['pts']) for r in roads))
