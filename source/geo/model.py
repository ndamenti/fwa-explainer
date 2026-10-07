import numpy as np, rasterio, json, math, time, sys, os
from multiprocessing import Pool
from scipy.ndimage import map_coordinates
from pyproj import Transformer
from itm import itm_loss

G=json.load(open("grid.json")); RES=G['res']
DEM=rasterio.open("dem90.tif").read(1); NL=rasterio.open("nlcd90.tif").read(1)
H,W=DEM.shape
t=Transformer.from_crs("EPSG:4326","EPSG:32617",always_xy=True)
SITES=[
 dict(id="GT",name="Georgetown — N Congdon St",asr="A1256905",lat=33.3739,lon=-79.2934,tower_m=75.0,ht=60.0,owner="SBA Towers X, LLC"),
 dict(id="PV",name="Plantersville — US 701",asr="A1095475",lat=33.5538,lon=-79.2203,tower_m=146.3,ht=90.0,owner="Byrne Acquisition Group, LLC"),
 dict(id="HW",name="Hemingway — Schoolhouse Dr",asr="A1281416",lat=33.6810,lon=-79.3502,tower_m=98.1,ht=75.0,owner="Tillman Infrastructure, LLC"),
]
FREQS=[2600,3600,6000]; HRX=[2.0,6.0,10.0]
RMAX=25000; K=int(RMAX/RES)  # 277
NAZ=360
CLUT={11:0,21:3,22:8,23:10,24:15,31:0,41:20,42:22,43:21,52:3,71:0.5,81:0.5,82:1,90:18,95:1,0:0}
FOL={41,42,43,90,52}
clut_lut=np.zeros(256,dtype=np.float32); fol_lut=np.zeros(256,dtype=np.float32)
for k,v in CLUT.items(): clut_lut[k]=v
for k in FOL: fol_lut[k]=1
RE=8.5e6

def radial(args):
    sx,sy,ht,az=args
    ks=np.arange(0,K+1)
    d=ks*RES
    x=sx+d*math.sin(math.radians(az)); y=sy+d*math.cos(math.radians(az))
    col=(x-G['x0'])/RES-0.5; row=(G['y1']-y)/RES-0.5
    z=map_coordinates(DEM,[row,col],order=1,mode='nearest')
    cls=NL[np.clip(np.round(row).astype(int),0,H-1),np.clip(np.round(col).astype(int),0,W-1)]
    C=clut_lut[cls]; F=fol_lut[cls]
    out_itm=np.zeros((len(FREQS),len(HRX),K+1),dtype=np.float32)
    depth=np.zeros((len(HRX),K+1),dtype=np.float32); los=np.zeros((len(HRX),K+1),dtype=np.uint8)
    # ITM
    for j in range(1,K+1):
        dist=j*RES
        for fi,f in enumerate(FREQS):
            fspl=20*math.log10(4*math.pi*dist*f*1e6/2.998e8)
            for hi,hr in enumerate(HRX):
                if dist<1000:
                    L=fspl
                else:
                    try:
                        L,kwx=itm_loss(z[:j+1],RES,f,ht,hr)
                        if not np.isfinite(L) or L<fspl-1: L=fspl
                    except Exception:
                        L=fspl
                out_itm[fi,hi,j]=L
    # geometry: foliage depth & LOS
    i=np.arange(K+1)[:,None]; j=np.arange(K+1)[None,:]
    Ht=z[0]+ht
    for hi,hr in enumerate(HRX):
        Hr=z+hr                                   # per j
        with np.errstate(divide='ignore',invalid='ignore'):
            ray=Ht+(Hr[None,:]-Ht)*(i/np.where(j==0,1,j))
        bulge=(i*(j-i))*(RES*RES)/(2*RE)
        obst=(z+C)[:,None]+bulge
        blocked=(ray<obst)&(i<j)&(i>0)
        clear=~blocked
        M=np.where(clear&(i<j),i,-1); M[0,:]=0
        last_clear=M.max(axis=0)                  # per j
        cf=np.concatenate([[0],np.cumsum(F*RES)])   # cf[n]=sum F[0..n-1]*RES
        dep=cf[np.maximum(j[0]-1,0)+1]-cf[np.minimum(last_clear+1,K+1)]  # cells last_clear+1 .. j-1
        dep=np.maximum(dep,0)
        inrx=(C>hr)&(F>0); dep=dep+np.where(inrx,RES*0.5,0)
        anyblk=blocked.any(axis=0)|((C>hr))
        depth[hi]=dep; los[hi]=(~anyblk).astype(np.uint8)
    return az,out_itm,depth,los

def run_site(s):
    sx,sy=t.transform(s['lon'],s['lat']); s['x']=sx; s['y']=sy
    col=int((sx-G['x0'])/RES); row=int((G['y1']-sy)/RES); s['ground_m']=float(DEM[row,col]); s['px']=col; s['py']=row
    t0=time.time()
    with Pool(2) as p:
        res=p.map(radial,[(sx,sy,s['ht'],az) for az in range(NAZ)],chunksize=10)
    itm=np.zeros((NAZ,len(FREQS),len(HRX),K+1),dtype=np.float32); dep=np.zeros((NAZ,len(HRX),K+1),dtype=np.float32); los=np.zeros((NAZ,len(HRX),K+1),dtype=np.uint8)
    for az,a,b,c in res: itm[az]=a; dep[az]=b; los[az]=c
    print(s['id'],"radials done",time.time()-t0,flush=True)
    # rasterize to site window
    r0=max(row-K,0); r1=min(row+K+1,H); c0=max(col-K,0); c1=min(col+K+1,W)
    rr,cc=np.mgrid[r0:r1,c0:c1]
    cx=G['x0']+(cc+0.5)*RES; cy=G['y1']-(rr+0.5)*RES
    dx=cx-sx; dy=cy-sy; dist=np.hypot(dx,dy); az=(np.degrees(np.arctan2(dx,dy))+360)%360
    kf=dist/RES; inside=kf<=K
    az0=np.floor(az).astype(int)%NAZ; az1=(az0+1)%NAZ; wa=az-np.floor(az)
    k0=np.clip(np.floor(kf).astype(int),0,K); k1=np.clip(k0+1,0,K); wk=np.clip(kf-k0,0,1)
    def interp(arr):  # arr[NAZ,...,K+1] -> window
        a=arr[az0,...,k0]*(1-wa)[...,None]*(1-wk)[...,None]+arr[az1,...,k0]*wa[...,None]*(1-wk)[...,None]+arr[az0,...,k1]*(1-wa)[...,None]*wk[...,None]+arr[az1,...,k1]*wa[...,None]*wk[...,None]
        return a
    itm_w=np.stack([np.stack([interp(itm[:,fi,hi,:]).squeeze(-1) if False else (itm[az0,fi,hi,k0]*(1-wa)*(1-wk)+itm[az1,fi,hi,k0]*wa*(1-wk)+itm[az0,fi,hi,k1]*(1-wa)*wk+itm[az1,fi,hi,k1]*wa*wk) for hi in range(len(HRX))]) for fi in range(len(FREQS))])
    dep_w=np.stack([dep[az0,hi,k0]*(1-wa)*(1-wk)+dep[az1,hi,k0]*wa*(1-wk)+dep[az0,hi,k1]*(1-wa)*wk+dep[az1,hi,k1]*wa*wk for hi in range(len(HRX))])
    azn=np.round(az).astype(int)%NAZ; kn=np.clip(np.round(kf).astype(int),0,K)
    los_w=np.stack([los[azn,hi,kn] for hi in range(len(HRX))])
    np.savez_compressed(f"site_{s['id']}.npz",itm=itm_w,dep=dep_w,los=los_w,inside=inside,r0=r0,c0=c0,dist=dist)
    s['window']=dict(r0=int(r0),c0=int(c0),h=int(r1-r0),w=int(c1-c0))
    print(s['id'],"saved",time.time()-t0,flush=True)
    return s

if __name__=="__main__":
    out=[]
    for s in SITES:
        out.append(run_site(s))
    json.dump(dict(sites=out,freqs=FREQS,hrx=HRX,res=RES,K=K,clut=CLUT,fol=sorted(FOL)),open("sites.json","w"),indent=1)
