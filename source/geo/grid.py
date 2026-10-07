import rasterio, numpy as np, json
from rasterio.merge import merge
from rasterio.warp import reproject, Resampling, calculate_default_transform
from rasterio.transform import from_origin
from pyproj import Transformer
import shapefile  # pyshp
CRS="EPSG:32617"; RES=90
t=Transformer.from_crs("EPSG:4326",CRS,always_xy=True)
# bbox in lon/lat
lon0,lon1,lat0,lat1=-79.98,-78.92,33.12,33.93
xs=[];ys=[]
for lon in (lon0,lon1):
    for lat in (lat0,lat1):
        x,y=t.transform(lon,lat); xs.append(x); ys.append(y)
x0=np.floor(min(xs)/RES)*RES; x1=np.ceil(max(xs)/RES)*RES; y0=np.floor(min(ys)/RES)*RES; y1=np.ceil(max(ys)/RES)*RES
W=int((x1-x0)/RES); H=int((y1-y0)/RES)
tr=from_origin(x0,y1,RES,RES)
print("grid",W,H,x0,y0,x1,y1)
# DEM merge
srcs=[rasterio.open(f) for f in ["raw/USGS_1_n34w080.tif","raw/USGS_1_n34w079.tif"]]
mos,mtr=merge(srcs)
dem=np.full((H,W),np.nan,dtype=np.float32)
reproject(mos[0],dem,src_transform=mtr,src_crs=srcs[0].crs,dst_transform=tr,dst_crs=CRS,resampling=Resampling.bilinear,src_nodata=srcs[0].nodata,dst_nodata=np.nan)
dem=np.where(np.isnan(dem),0,dem); dem=np.maximum(dem,0)
# NLCD
n=rasterio.open("raw/nlcd2021.tif"); nl=np.zeros((H,W),dtype=np.uint8)
reproject(n.read(1),nl,src_transform=n.transform,src_crs=n.crs,dst_transform=tr,dst_crs=CRS,resampling=Resampling.nearest)
prof=dict(driver="GTiff",height=H,width=W,count=1,crs=CRS,transform=tr,compress="deflate")
with rasterio.open("dem90.tif","w",dtype="float32",**prof) as d: d.write(dem,1)
with rasterio.open("nlcd90.tif","w",dtype="uint8",**prof) as d: d.write(nl,1)
json.dump(dict(crs=CRS,res=RES,x0=x0,y0=y0,x1=x1,y1=y1,W=W,H=H),open("grid.json","w"))
print("dem range",np.nanmin(dem),np.nanmax(dem))
