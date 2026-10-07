import csv, sys, json
base='raw/tower/'
ra={}
for line in open(base+'RA.dat',encoding='latin-1'):
    f=line.rstrip('\n').split('|')
    if len(f)<35: continue
    if f[26]!='45043': continue
    ra[f[2]]=dict(reg=f[2],usi=f[3],status=f[8],street=f[23],city=f[24],state=f[25],county=f[26],zip=f[27],
                  h_struct=f[28],ground=f[29],h_agl=f[30],h_amsl=f[31],stype=f[32],date=f[33])
co={}
for line in open(base+'CO.dat',encoding='latin-1'):
    f=line.rstrip('\n').split('|')
    if f[2] in ra and f[5]=='T':
        lat=float(f[10])/3600.0; lon=-float(f[15])/3600.0
        co[f[2]]=(lat,lon)
en={}
for line in open(base+'EN.dat',encoding='latin-1'):
    f=line.rstrip('\n').split('|')
    if f[2] in ra and f[5]=='O':
        en[f[2]]=f[9]
rows=[]
for k,v in ra.items():
    if k in co:
        v['lat'],v['lon']=co[k]; v['owner']=en.get(k,'')
        rows.append(v)
print(len(ra),len(rows))
rows.sort(key=lambda r:-float(r['h_agl'] or 0))
for r in rows:
    print(f"{r['reg']} {r['status']} {r['stype']:8s} agl={r['h_agl']:>6} gnd={r['ground']:>5} {r['lat']:.4f},{r['lon']:.4f} {r['city']:14s} {r['owner'][:40]} | {r['street'][:40]}")
json.dump(rows,open('towers_georgetown.json','w'),indent=1)
