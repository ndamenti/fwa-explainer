import os, sys, re
B = os.path.dirname(os.path.abspath(__file__))
ver = sys.argv[1] if len(sys.argv) > 1 else 'v1'
head = open(f'{B}/head.html').read()
body = open(f'{B}/body.html').read()
import json as _json
_sc = _json.load(open(f'{B}/../geo/geodata.json'))
_sc.update(dict(id='sc', name='Georgetown County, South Carolina', short='Georgetown County, SC', county_geoid='45043', land_sqmi=814, utm_epsg=32617, lon0=-81.0, grid=dict(x0=594270.0, y1=3756420.0, res=90)))
_ma = _json.load(open(f'{B}/../geo/ma/geodata.json'))
geo = _json.dumps(dict(testbeds=[_sc, _ma]), separators=(',', ':')).replace('</', '<\\/')
js = '\n'.join(open(f'{B}/{f}').read() for f in ['model.js', 'app1.js', 'app2.js', 'app3.js'])
js = js.replace("if (typeof module !== 'undefined') module.exports = FWA;", '')
content = head + '\n' + body + f'\n<script id="geodata" type="application/json">{geo}</script>\n<script>document.addEventListener("DOMContentLoaded",function(){{document.body.setAttribute("data-ver","{ver}")}});\n{js}\n</script>\n'
open(f'{B}/fwa-explainer.html', 'w').write(content)
full = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        + head + '</head><body>' + body + f'\n<script id="geodata" type="application/json">{geo}</script>\n<script>document.body.setAttribute("data-ver","{ver}");\n{js}\n</script></body></html>')
open(f'{B}/index.html', 'w').write(full)
print('artifact KB', os.path.getsize(f'{B}/fwa-explainer.html') // 1024, 'index KB', os.path.getsize(f'{B}/index.html') // 1024)
