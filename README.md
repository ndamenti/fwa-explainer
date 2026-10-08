# Tarana vs 5G Fixed Wireless

Interactive technical explainer comparing Tarana ngFWA (G1/G2) with MNO macro FWA, dedicated 5G NR in CBRS and mmWave 5G FWA, using two real-county physics test beds that the reader can switch between: Georgetown County, South Carolina (flat coastal plain, pine) and Worcester County, Massachusetts (glacial hills, deciduous forest, suburbs). Single self-contained page (`index.html`): every chart, the capability matrix, the link-budget and TCO calculators and the terrain-and-clutter coverage maps are in the one file (2.7 MB, including the packed propagation layers).

Live: deployed on Railway from this repository (static site served by `serve`).

## Release procedure

The page is one file. To ship a new version, replace `index.html` at the repository root (GitHub web UI: open the file, "Upload files", drop the new `index.html`, confirm the replace). Railway redeploys automatically on push. The version string shown in the page header is set at build time (`python build.py v7`).

## Repository layout

```
index.html            the built site (what Railway serves)
package.json          `serve -s .` on $PORT, for Railway/Nixpacks
railway.json          build/deploy settings
source/site/          page sources: head.html, body.html, model.js (physics + link budgets), app1-3.js (charts, maps, calculators), build.py (assembler), test.js (node-side coverage check)
source/geo/           propagation pipeline (Python). pipeline.py is the parametrised version used for Worcester County (stages: grid, vectors, model, pack; config dict at the top); towers.py, grid.py, county.py, vectors.py, itm.py, model.py and pack.py are the original Georgetown County scripts. geodata.json (SC) and ma/geodata.json (MA) are the packed outputs embedded in index.html
```

## Rebuilding the page

`source/site/build.py` concatenates `head.html`, `body.html`, the JS files and both packed test beds (`../geo/geodata.json`, `../geo/ma/geodata.json`) into `index.html` (full document) and `fwa-explainer.html` (artifact body without skeleton):

```
cd source/site && python build.py v7
```

## Re-running the propagation model

The `source/geo` scripts expect to run from that directory with a `raw/` subfolder holding the downloads they fetch: USGS 3DEP 1 arc-second tiles `USGS_1_n34w080.tif` and `USGS_1_n34w079.tif`, the NLCD 2021 land-cover GeoTIFF clipped via the MRLC WCS, the Census cartographic county file `cb_2023_us_county_500k.zip`, TIGER 2023 `tl_2023_45_tabblock20.zip`, roads for FIPS 45043/45051/45089 and `tl_2023_45_place.zip`, and the FCC ASR weekly extract `r_tower.zip`. Order: `towers.py`, `grid.py`, `county.py`, `vectors.py`, `model.py` (about five minutes on two cores), `pack.py`. Python dependencies: `rasterio pyproj shapely pyshp itmlogic numpy scipy pillow`.

Model: ITS Irregular Terrain Model v1.2.2 (via `itmlogic`) point-to-point along 360 radials per tower at 2.6, 3.6 and 6.0 GHz and 2, 6, 10 m CPE heights; ITU-R P.833 foliage with depth from ray geometry against NLCD obstacle heights; ITU-R P.2108-scaled building clutter; 3GPP TR 38.901 O2I. Sources, parameters and limits are documented on the page's "Method & sources" tab.
