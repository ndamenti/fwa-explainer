import shapefile, json, numpy as np, rasterio
from rasterio.features import rasterize
from shapely.geometry import shape, mapping
from shapely import transform as shtransform
from pyproj import Transformer
g=json.load(open("grid.json")); 
t=Transformer.from_crs("EPSG:4326","EPSG:32617",always_xy=True)
def to_utm(geom): return shtransform(geom, lambda c: np.column_stack(t.transform(c[:,0],c[:,1])))
# --- blocks: housing units raster (units per 90 m cell), limited to counties 043 (Georgetown), 051 Horry, 089 Williamsburg, 041 Florence? 045? Charleston 019, Berkeley 015
sf=shapefile.Reader("raw/blocks/tl_2023_45_tabblock20.shp"); fields=[f[0] for f in sf.fields[1:]]
shapes=[]; tot=0; cty={}
for sr in sf.iterShapeRecords():
    rec=dict(zip(fields,sr.record))
    if rec['COUNTYFP20'] not in ('043','051','089','015','019','041','067'): continue
    hu=rec['HOUSING20']
    if hu<=0: continue
    geom=to_utm(shape(sr.shape.__geo_interface__))
    if geom.is_empty: continue
    b=geom.bounds
    if b[2]<g['x0'] or b[0]>g['x1'] or b[3]<g['y0'] or b[1]>g['y1']: continue
    shapes.append((geom,hu)); cty[rec['COUNTYFP20']]=cty.get(rec['COUNTYFP20'],0)+hu
print("blocks",len(shapes),cty)
tr=rasterio.transform.from_origin(g['x0'],g['y1'],g['res'],g['res'])
H,W=g['H'],g['W']
# distribute each block's units evenly across its cells: rasterize block index, then divide
idx=rasterize([(geom,i+1) for i,(geom,hu) in enumerate(shapes)],out_shape=(H,W),transform=tr,fill=0,dtype='int32',all_touched=False)
hu_arr=np.zeros((H,W),dtype=np.float32)
counts=np.bincount(idx.ravel(),minlength=len(shapes)+1)
hu_per=np.zeros(len(shapes)+1,dtype=np.float32)
for i,(geom,hu) in enumerate(shapes):
    if counts[i+1]>0: hu_per[i+1]=hu/counts[i+1]
hu_arr=hu_per[idx]
# blocks too small to hit a cell center: add to nearest cell via centroid
missed=0
for i,(geom,hu) in enumerate(shapes):
    if counts[i+1]==0:
        c=geom.centroid; col=int((c.x-g['x0'])/g['res']); row=int((g['y1']-c.y)/g['res'])
        if 0<=row<H and 0<=col<W: hu_arr[row,col]+=hu; missed+=hu
print("units in grid",hu_arr.sum(),"missed-added",missed)
with rasterio.open("housing90.tif","w",driver="GTiff",height=H,width=W,count=1,dtype="float32",crs="EPSG:32617",transform=tr,compress="deflate") as d: d.write(hu_arr,1)
# --- roads: primary (S1100) and secondary (S1200) as polylines in grid pixel coords
roads=[]
for f in ["raw/roads/tl_2023_45043_roads.shp","raw/roads/tl_2023_45051_roads.shp","raw/roads/tl_2023_45089_roads.shp"]:
    s=shapefile.Reader(f); fl=[x[0] for x in s.fields[1:]]
    for sr in s.iterShapeRecords():
        rec=dict(zip(fl,sr.record))
        if rec['MTFCC'] not in ('S1100','S1200'): continue
        geom=to_utm(shape(sr.shape.__geo_interface__))
        geoms=[geom] if geom.geom_type=='LineString' else list(geom.geoms)
        for ge in geoms:
            c=np.array(ge.coords); px=(c[:,0]-g['x0'])/g['res']; py=(g['y1']-c[:,1])/g['res']
            # simplify: keep every point but round to 0.1 px
            roads.append(dict(cls=rec['MTFCC'],name=rec['FULLNAME'],pts=[[round(float(a),1),round(float(b),1)] for a,b in zip(px,py)]))
print("roads",len(roads))
# --- places (towns) centroids
s=shapefile.Reader("raw/places/tl_2023_45_place.shp"); fl=[x[0] for x in s.fields[1:]]
places=[]
for sr in s.iterShapeRecords():
    rec=dict(zip(fl,sr.record)); geom=to_utm(shape(sr.shape.__geo_interface__)); c=geom.centroid
    if g['x0']<c.x<g['x1'] and g['y0']<c.y<g['y1']:
        places.append(dict(name=rec['NAME'],px=round((c.x-g['x0'])/g['res'],1),py=round((g['y1']-c.y)/g['res'],1),area_km2=round(geom.area/1e6,1)))
print([p['name'] for p in places])
# county outline in px
cg=shape(json.load(open("county_utm.json")))
polys=[cg] if cg.geom_type=='Polygon' else list(cg.geoms)
outline=[]
for p in polys:
    ext=p.simplify(45).exterior.coords
    outline.append([[round((x-g['x0'])/g['res'],1),round((g['y1']-y)/g['res'],1)] for x,y in ext])
json.dump(dict(roads=roads,places=places,county=outline),open("vectors.json","w"))
import os; print(os.path.getsize("vectors.json"))
