import shapefile, json, numpy as np, rasterio
from shapely.geometry import shape, Point
from shapely.ops import transform as stransform
from pyproj import Transformer
sf=shapefile.Reader("raw/county/cb_2023_us_county_500k.shp")
fields=[f[0] for f in sf.fields[1:]]
for sr in sf.shapeRecords():
    rec=dict(zip(fields,sr.record))
    if rec['GEOID']=='45043':
        geom=shape(sr.shape.__geo_interface__); print(rec['NAME'],rec['ALAND']/2.59e6,"sq mi land")
        break
t=Transformer.from_crs("EPSG:4326","EPSG:32617",always_xy=True)
g=stransform(t.transform,geom)
json.dump(json.loads(json.dumps(g.__geo_interface__)),open("county_utm.json","w"))
json.dump(geom.__geo_interface__,open("county_wgs.json","w"))
# NLCD composition near candidate towers
nl=rasterio.open("nlcd90.tif"); a=nl.read(1); tr=nl.transform
names={11:'water',21:'dev-open',22:'dev-low',23:'dev-med',24:'dev-high',31:'barren',41:'decid',42:'evergreen',43:'mixed',52:'shrub',71:'grass',81:'pasture',82:'crop',90:'woody-wet',95:'herb-wet'}
tw=json.load(open("towers_georgetown.json"))
cands=['A1256905','A1366498','A1262812','A1327395','A1095475','A1387721','A1281416','A1308045','A1393901','A1329100','A1312755','A1369104']
H,W=a.shape
yy,xx=np.mgrid[0:H,0:W]
X=tr.c+(xx+0.5)*tr.a; Y=tr.f+(yy+0.5)*tr.e
for c in cands:
    r=[t_ for t_ in tw if t_['reg']==c][0]
    x,y=t.transform(r['lon'],r['lat'])
    m=((X-x)**2+(Y-y)**2)<10000**2
    vals,cnt=np.unique(a[m],return_counts=True); tot=cnt.sum()
    comp={names.get(v,str(v)):round(100*c_/tot,1) for v,c_ in zip(vals,cnt) if c_/tot>0.02}
    print(c,r['h_agl'],r['city'],r['owner'][:22],g.contains(Point(x,y)),comp)
