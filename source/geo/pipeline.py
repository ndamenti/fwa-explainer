"""Parametrised test-bed pipeline: grid (DEM+NLCD) -> county -> vectors (housing, roads, places) -> ITM radial model -> packed geodata JSON.
Usage: python3 /abs/path/pipeline.py <testbed_id>      (all paths below are absolute)"""
import sys, os, json, math, time, glob
import numpy as np, rasterio, shapefile
from rasterio.merge import merge
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from rasterio.features import rasterize
from shapely.geometry import shape, Point
from shapely import transform as shtransform
from pyproj import Transformer
from multiprocessing import Pool
from scipy.ndimage import map_coordinates
from PIL import Image
import base64, io

ROOT = '/tmp/claude-0/-home-claude/5f9e1685-3874-54e7-b417-7732806d161a/scratchpad/geo'
sys.path.insert(0, ROOT)
from itm import itm_loss

TESTBEDS = {
  'ma': dict(
    id='ma', name='Worcester County, Massachusetts', short='Worcester County, MA', state='MA', county_geoid='25027', utm_epsg=32619, lon0=-69.0,
    bbox=dict(lon0=-72.58, lon1=-71.22, lat0=41.93, lat1=42.86),
    dem_tiles=[f'{ROOT}/ma/raw/USGS_1_{t}.tif' for t in ['n43w072','n43w073','n42w072','n42w073']],
    nlcd=f'{ROOT}/ma/raw/nlcd2021_ma.tif', county_shp=f'{ROOT}/raw/county/cb_2023_us_county_500k.shp',
    blocks=[f'{ROOT}/ma/raw/blocks/tl_2023_25_tabblock20.shp'], block_counties=['027','017','021','013','015','011'],
    roads=glob.glob(f'{ROOT}/ma/raw/roads/*.shp'), places=[f'{ROOT}/ma/raw/places/tl_2023_25_place.shp'],
    out=f'{ROOT}/ma', radials=360, rmax=25000,
    sites=[
      dict(id='PX', name='Paxton — Asnebumskit Hill', asr='A1367278', lat=42.3052, lon=-71.8970, tower_m=101.5, ht=60.0, owner='Pinnacle Towers LLC'),
      dict(id='NB', name='New Braintree — Circle Dr', asr='A0187486', lat=42.3117, lon=-72.1353, tower_m=76.2, ht=60.0, owner='Massachusetts State Police'),
      dict(id='NO', name='Northbridge — Purgatory Rd', asr='A1273204', lat=42.1288, lon=-71.6992, tower_m=60.7, ht=50.0, owner='SBA Properties, LLC'),
    ]),
}
FREQS=[2600,3600,6000]; HRX=[2.0,6.0,10.0]; RES=90
CLUT={11:0,21:3,22:8,23:10,24:15,31:0,41:20,42:22,43:21,52:3,71:0.5,81:0.5,82:1,90:18,95:1,0:0}
FOL={41,42,43,90,52}
clut_lut=np.zeros(256,dtype=np.float32); fol_lut=np.zeros(256,dtype=np.float32)
for k,v in CLUT.items(): clut_lut[k]=v
for k in FOL: fol_lut[k]=1
RE=8.5e6

def stage_grid(tb):
    CRS=f"EPSG:{tb['utm_epsg']}"; t=Transformer.from_crs("EPSG:4326",CRS,always_xy=True); b=tb['bbox']
    xs=[];ys=[]
    for lon in (b['lon0'],b['lon1']):
        for lat in (b['lat0'],b['lat1']): x,y=t.transform(lon,lat); xs.append(x); ys.append(y)
    x0=np.floor(min(xs)/RES)*RES; x1=np.ceil(max(xs)/RES)*RES; y0=np.floor(min(ys)/RES)*RES; y1=np.ceil(max(ys)/RES)*RES
    W=int((x1-x0)/RES); H=int((y1-y0)/RES); tr=from_origin(x0,y1,RES,RES)
    srcs=[rasterio.open(f) for f in tb['dem_tiles']]; mos,mtr=merge(srcs)
    dem=np.full((H,W),np.nan,dtype=np.float32)
    reproject(mos[0],dem,src_transform=mtr,src_crs=srcs[0].crs,dst_transform=tr,dst_crs=CRS,resampling=Resampling.bilinear,src_nodata=srcs[0].nodata,dst_nodata=np.nan)
    dem=np.where(np.isnan(dem),0,dem); dem=np.maximum(dem,0)
    n=rasterio.open(tb['nlcd']); nl=np.zeros((H,W),dtype=np.uint8)
    reproject(n.read(1),nl,src_transform=n.transform,src_crs=n.crs,dst_transform=tr,dst_crs=CRS,resampling=Resampling.nearest)
    prof=dict(driver="GTiff",height=H,width=W,count=1,crs=CRS,transform=tr,compress="deflate")
    with rasterio.open(f"{tb['out']}/dem90.tif","w",dtype="float32",**prof) as d: d.write(dem,1)
    with rasterio.open(f"{tb['out']}/nlcd90.tif","w",dtype="uint8",**prof) as d: d.write(nl,1)
    json.dump(dict(crs=CRS,res=RES,x0=x0,y0=y0,x1=x1,y1=y1,W=W,H=H),open(f"{tb['out']}/grid.json","w"))
    print("grid",W,H,"dem range",float(dem.min()),float(dem.max()),flush=True)

def stage_vectors(tb):
    G=json.load(open(f"{tb['out']}/grid.json")); CRS=G['crs']; t=Transformer.from_crs("EPSG:4326",CRS,always_xy=True)
    to_utm=lambda geom: shtransform(geom, lambda c: np.column_stack(t.transform(c[:,0],c[:,1])))
    sf=shapefile.Reader(tb['county_shp']); fields=[f[0] for f in sf.fields[1:]]
    for sr in sf.shapeRecords():
        rec=dict(zip(fields,sr.record))
        if rec['GEOID']==tb['county_geoid']: geom=shape(sr.shape.__geo_interface__); land_sqmi=rec['ALAND']/2.59e6; break
    cg=to_utm(geom); json.dump(cg.__geo_interface__,open(f"{tb['out']}/county_utm.json","w"))
    tr=from_origin(G['x0'],G['y1'],RES,RES); H,W=G['H'],G['W']
    shapes=[]
    for f in tb['blocks']:
        s=shapefile.Reader(f); fl=[x[0] for x in s.fields[1:]]
        for sr in s.iterShapeRecords():
            rec=dict(zip(fl,sr.record))
            if rec['COUNTYFP20'] not in tb['block_counties'] or rec['HOUSING20']<=0: continue
            g=to_utm(shape(sr.shape.__geo_interface__)); bb=g.bounds
            if bb[2]<G['x0'] or bb[0]>G['x1'] or bb[3]<G['y0'] or bb[1]>G['y1']: continue
            shapes.append((g,rec['HOUSING20']))
    idx=rasterize([(g,i+1) for i,(g,hu) in enumerate(shapes)],out_shape=(H,W),transform=tr,fill=0,dtype='int32')
    counts=np.bincount(idx.ravel(),minlength=len(shapes)+1); hu_per=np.zeros(len(shapes)+1,dtype=np.float32)
    for i,(g,hu) in enumerate(shapes):
        if counts[i+1]>0: hu_per[i+1]=hu/counts[i+1]
    hu_arr=hu_per[idx]
    for i,(g,hu) in enumerate(shapes):
        if counts[i+1]==0:
            c=g.centroid; col=int((c.x-G['x0'])/RES); row=int((G['y1']-c.y)/RES)
            if 0<=row<H and 0<=col<W: hu_arr[row,col]+=hu
    with rasterio.open(f"{tb['out']}/housing90.tif","w",driver="GTiff",height=H,width=W,count=1,dtype="float32",crs=CRS,transform=tr,compress="deflate") as d: d.write(hu_arr,1)
    roads=[]
    for f in tb['roads']:
        s=shapefile.Reader(f); fl=[x[0] for x in s.fields[1:]]
        for sr in s.iterShapeRecords():
            rec=dict(zip(fl,sr.record))
            if rec['MTFCC'] not in ('S1100','S1200'): continue
            g=to_utm(shape(sr.shape.__geo_interface__)); geoms=[g] if g.geom_type=='LineString' else list(g.geoms)
            for ge in geoms:
                c=np.array(ge.coords); px=(c[:,0]-G['x0'])/RES; py=(G['y1']-c[:,1])/RES
                roads.append(dict(cls=rec['MTFCC'],name=rec['FULLNAME'],pts=[[round(float(a),1),round(float(b),1)] for a,b in zip(px,py)]))
    places=[]
    for f in tb['places']:
        s=shapefile.Reader(f); fl=[x[0] for x in s.fields[1:]]
        for sr in s.iterShapeRecords():
            rec=dict(zip(fl,sr.record)); g=to_utm(shape(sr.shape.__geo_interface__)); c=g.centroid
            if G['x0']<c.x<G['x1'] and G['y0']<c.y<G['y1']: places.append(dict(name=rec['NAME'],px=round((c.x-G['x0'])/RES,1),py=round((G['y1']-c.y)/RES,1),area_km2=round(g.area/1e6,1)))
    polys=[cg] if cg.geom_type=='Polygon' else list(cg.geoms); outline=[]
    for p in polys:
        outline.append([[round((x-G['x0'])/RES,1),round((G['y1']-y)/RES,1)] for x,y in p.simplify(45).exterior.coords])
    json.dump(dict(roads=roads,places=places,county=outline,land_sqmi=land_sqmi),open(f"{tb['out']}/vectors.json","w"))
    print("vectors: blocks",len(shapes),"units",float(hu_arr.sum()),"roads",len(roads),"places",len(places),flush=True)

_CTX={}
def _radial(args):
    sx,sy,ht,az=args; DEM=_CTX['DEM']; NL=_CTX['NL']; G=_CTX['G']; K=_CTX['K']; H,W=DEM.shape
    ks=np.arange(0,K+1); d=ks*RES
    x=sx+d*math.sin(math.radians(az)); y=sy+d*math.cos(math.radians(az))
    col=(x-G['x0'])/RES-0.5; row=(G['y1']-y)/RES-0.5
    z=map_coordinates(DEM,[row,col],order=1,mode='nearest')
    cls=NL[np.clip(np.round(row).astype(int),0,H-1),np.clip(np.round(col).astype(int),0,W-1)]
    C=clut_lut[cls]; F=fol_lut[cls]
    out_itm=np.zeros((len(FREQS),len(HRX),K+1),dtype=np.float32); depth=np.zeros((len(HRX),K+1),dtype=np.float32); los=np.zeros((len(HRX),K+1),dtype=np.uint8)
    for j in range(1,K+1):
        dist=j*RES
        for fi,f in enumerate(FREQS):
            fspl=20*math.log10(4*math.pi*dist*f*1e6/2.998e8)
            for hi,hr in enumerate(HRX):
                if dist<1000: L=fspl
                else:
                    try:
                        L,kwx=itm_loss(z[:j+1],RES,f,ht,hr)
                        if not np.isfinite(L) or L<fspl-1: L=fspl
                    except Exception: L=fspl
                out_itm[fi,hi,j]=L
    i=np.arange(K+1)[:,None]; j=np.arange(K+1)[None,:]; Ht=z[0]+ht
    for hi,hr in enumerate(HRX):
        Hr=z+hr
        with np.errstate(divide='ignore',invalid='ignore'): ray=Ht+(Hr[None,:]-Ht)*(i/np.where(j==0,1,j))
        bulge=(i*(j-i))*(RES*RES)/(2*RE); obst=(z+C)[:,None]+bulge
        blocked=(ray<obst)&(i<j)&(i>0); clear=~blocked
        M=np.where(clear&(i<j),i,-1); M[0,:]=0; last_clear=M.max(axis=0)
        cf=np.concatenate([[0],np.cumsum(F*RES)]); dep=cf[np.maximum(j[0]-1,0)+1]-cf[np.minimum(last_clear+1,K+1)]; dep=np.maximum(dep,0)
        inrx=(C>hr)&(F>0); dep=dep+np.where(inrx,RES*0.5,0); anyblk=blocked.any(axis=0)|(C>hr)
        depth[hi]=dep; los[hi]=(~anyblk).astype(np.uint8)
    return az,out_itm,depth,los

def stage_model(tb):
    G=json.load(open(f"{tb['out']}/grid.json")); DEM=rasterio.open(f"{tb['out']}/dem90.tif").read(1); NL=rasterio.open(f"{tb['out']}/nlcd90.tif").read(1)
    K=int(tb['rmax']/RES); NAZ=tb['radials']; _CTX.update(DEM=DEM,NL=NL,G=G,K=K)
    t=Transformer.from_crs("EPSG:4326",G['crs'],always_xy=True); H,W=DEM.shape; out=[]
    for s in tb['sites']:
        s=dict(s); sx,sy=t.transform(s['lon'],s['lat']); col=int((sx-G['x0'])/RES); row=int((G['y1']-sy)/RES)
        s.update(x=sx,y=sy,ground_m=float(DEM[row,col]),px=col,py=row); t0=time.time()
        with Pool(2) as p: res=p.map(_radial,[(sx,sy,s['ht'],az) for az in range(NAZ)],chunksize=10)
        itm=np.zeros((NAZ,len(FREQS),len(HRX),K+1),dtype=np.float32); dep=np.zeros((NAZ,len(HRX),K+1),dtype=np.float32); los=np.zeros((NAZ,len(HRX),K+1),dtype=np.uint8)
        for az,a,b,c in res: itm[az]=a; dep[az]=b; los[az]=c
        r0=max(row-K,0); r1=min(row+K+1,H); c0=max(col-K,0); c1=min(col+K+1,W); rr,cc=np.mgrid[r0:r1,c0:c1]
        cx=G['x0']+(cc+0.5)*RES; cy=G['y1']-(rr+0.5)*RES; dx=cx-sx; dy=cy-sy; dist=np.hypot(dx,dy); az=(np.degrees(np.arctan2(dx,dy))+360)%360
        kf=dist/RES; inside=kf<=K; az0=np.floor(az).astype(int)%NAZ; az1=(az0+1)%NAZ; wa=az-np.floor(az)
        k0=np.clip(np.floor(kf).astype(int),0,K); k1=np.clip(k0+1,0,K); wk=np.clip(kf-k0,0,1)
        bil=lambda A: A[az0,k0]*(1-wa)*(1-wk)+A[az1,k0]*wa*(1-wk)+A[az0,k1]*(1-wa)*wk+A[az1,k1]*wa*wk
        itm_w=np.stack([np.stack([bil(itm[:,fi,hi,:]) for hi in range(len(HRX))]) for fi in range(len(FREQS))])
        dep_w=np.stack([bil(dep[:,hi,:]) for hi in range(len(HRX))])
        azn=np.round(az).astype(int)%NAZ; kn=np.clip(np.round(kf).astype(int),0,K); los_w=np.stack([los[azn,hi,kn] for hi in range(len(HRX))])
        np.savez_compressed(f"{tb['out']}/site_{s['id']}.npz",itm=itm_w,dep=dep_w,los=los_w,inside=inside,dist=dist)
        s['window']=dict(r0=int(r0),c0=int(c0),h=int(r1-r0),w=int(c1-c0)); out.append(s)
        print(s['id'],"done",round(time.time()-t0),"s",flush=True)
    json.dump(dict(sites=out,freqs=FREQS,hrx=HRX,res=RES,K=K),open(f"{tb['out']}/sites.json","w"),indent=1)

def stage_pack(tb):
    S=json.load(open(f"{tb['out']}/sites.json")); G=json.load(open(f"{tb['out']}/grid.json")); V=json.load(open(f"{tb['out']}/vectors.json"))
    NL=rasterio.open(f"{tb['out']}/nlcd90.tif").read(1); HU=rasterio.open(f"{tb['out']}/housing90.tif").read(1); H,W=NL.shape
    r0=min(s['window']['r0'] for s in S['sites']); c0=min(s['window']['c0'] for s in S['sites'])
    r1=max(s['window']['r0']+s['window']['h'] for s in S['sites']); c1=max(s['window']['c0']+s['window']['w'] for s in S['sites'])
    tr=from_origin(G['x0'],G['y1'],RES,RES); cg=shape(json.load(open(f"{tb['out']}/county_utm.json")))
    mask=rasterize([(cg,1)],out_shape=(H,W),transform=tr,fill=0,dtype='uint8')
    def png_b64(arr,mode):
        im=Image.fromarray(arr,mode); b=io.BytesIO(); im.save(b,format="PNG",optimize=True); return base64.b64encode(b.getvalue()).decode()
    out=dict(id=tb['id'],name=tb['name'],short=tb['short'],county_geoid=tb['county_geoid'],land_sqmi=round(V['land_sqmi']),utm_epsg=tb['utm_epsg'],lon0=tb['lon0'],grid=dict(x0=G['x0'],y1=G['y1'],res=RES),
             crop=dict(r0=int(r0),c0=int(c0),h=int(r1-r0),w=int(c1-c0)),res=RES,freqs=S['freqs'],hrx=S['hrx'],sites=[],
             hu_total=float(HU[mask==1].sum()),dem_max=float(rasterio.open(f"{tb['out']}/dem90.tif").read(1)[mask==1].max()))
    out['nlcd']=png_b64(NL[r0:r1,c0:c1],"L")
    hu=np.clip(np.round(HU[r0:r1,c0:c1]*10),0,65535).astype(np.uint16); rgb=np.zeros((r1-r0,c1-c0,3),dtype=np.uint8); rgb[...,0]=hu>>8; rgb[...,1]=hu&255; rgb[...,2]=mask[r0:r1,c0:c1]*255
    out['housing']=png_b64(rgb,"RGB")
    for s in S['sites']:
        z=np.load(f"{tb['out']}/site_{s['id']}.npz"); itm=z['itm']; dep=z['dep']; los=z['los']; inside=z['inside']; w=s['window']
        d=dict(id=s['id'],name=s['name'],asr=s['asr'],lat=s['lat'],lon=s['lon'],tower_m=s['tower_m'],ht=s['ht'],ground_m=round(s['ground_m'],1),owner=s['owner'],px=s['px']-c0,py=s['py']-r0,r0=w['r0']-r0,c0=w['c0']-c0,h=w['h'],w=w['w'],itm=[])
        for hi in range(3):
            rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
            for fi in range(3): v=np.clip(np.round((itm[fi,hi]-70)*1.5),0,255); rgb[...,fi]=np.where(inside,v,255).astype(np.uint8)
            d['itm'].append(png_b64(rgb,"RGB"))
        rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
        for hi in range(3): rgb[...,hi]=np.clip(np.round(dep[hi]/10),0,60).astype(np.uint8)
        d['depth']=png_b64(rgb,"RGB")
        rgb=np.zeros((w['h'],w['w'],3),dtype=np.uint8)
        for hi in range(3): rgb[...,hi]=(los[hi]*255).astype(np.uint8)
        d['los']=png_b64(rgb,"RGB"); out['sites'].append(d)
    def simp(pts,tol=1.0):
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
        if max(x for x,y in p)<0 or min(x for x,y in p)>(c1-c0) or max(y for x,y in p)<0 or min(y for x,y in p)>(r1-r0): continue
        roads.append(dict(cls=r['cls'],name=r['name'],pts=[[round(x,1),round(y,1)] for x,y in p]))
    out['roads']=roads
    out['places']=[dict(name=p['name'],px=round(p['px']-c0,1),py=round(p['py']-r0,1),area=p['area_km2']) for p in V['places'] if 0<=p['px']-c0<=(c1-c0) and 0<=p['py']-r0<=(r1-r0)]
    out['county']=[[[round(x-c0,1),round(y-r0,1)] for x,y in ring] for ring in V['county']]
    json.dump(out,open(f"{tb['out']}/geodata.json","w"),separators=(",",":"))
    print("packed KB",os.path.getsize(f"{tb['out']}/geodata.json")//1024,"hu",out['hu_total'],"crop",out['crop'],flush=True)

if __name__=="__main__":
    tb=TESTBEDS[sys.argv[1]]; stages=sys.argv[2].split(',') if len(sys.argv)>2 else ['grid','vectors','model','pack']
    for st in stages: globals()['stage_'+st](tb)
