#!/usr/bin/env python3
"""Generate province-contained municipality maps for Dutch province capitals."""
from __future__ import annotations
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as MatplotlibPath
from matplotlib.patches import PathPatch, Polygon as PatchPolygon

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'packages/geography/data/netherlands-province-capitals'
ADM1=ROOT/'packages/geography/data/netherlands-provinces/source-nld-adm1.geojson'
ADM2=DATA/'source-nld-adm2.geojson'
PROVINCE_FILL='#82a8df'; CAPITAL_FILL='#ee8c72'; BORDER='#243a45'; SEA='#f6f2e8'

def rings(feature):
 g=feature['geometry']; c=g['coordinates']
 return [c[0]] if g['type']=='Polygon' else [p[0] for p in c]
def area(r): return abs(sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r)))/2)
def centroid(r):
 a=x=y=0.0
 for i in range(len(r)):
  x1,y1=r[i]; x2,y2=r[(i+1)%len(r)]; q=x1*y2-x2*y1; a+=q; x+=(x1+x2)*q; y+=(y1+y2)*q
 return r[0] if abs(a)<1e-12 else (x/(3*a),y/(3*a))
def inside(p,r):
 x,y=p; result=False
 for i in range(len(r)):
  x1,y1=r[i]; x2,y2=r[(i+1)%len(r)]
  if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: result=not result
 return result
def within(p,f): return any(inside(p,r) for r in rings(f))
def feature_area(f): return sum(area(r) for r in rings(f))
def rep(f): return centroid(max(rings(f),key=area))
def bounds(f):
 pts=[p for r in rings(f) for p in r]; return min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)
def clip(axis,f):
 paths=[]
 for ring in rings(f):
  v=list(ring)
  if v[0]!=v[-1]: v.append(v[0])
  paths.append(MatplotlibPath(v,[MatplotlibPath.MOVETO]+[MatplotlibPath.LINETO]*(len(v)-2)+[MatplotlibPath.CLOSEPOLY]))
 path=paths[0] if len(paths)==1 else MatplotlibPath.make_compound_path(*paths)
 patch=PathPatch(path,transform=axis.transData,facecolor='none',edgecolor='none'); axis.add_patch(patch); return patch
def draw(axis,f,fill,width=.8,z=2,clip_path=None):
 for ring in rings(f):
  p=PatchPolygon(ring,closed=True,facecolor=fill,edgecolor=BORDER,linewidth=width,zorder=z)
  if clip_path is not None: p.set_clip_path(clip_path)
  axis.add_patch(p)

def main():
 rows=json.loads((DATA/'capitals.json').read_text()); adm1=json.loads(ADM1.read_text())['features']; adm2=json.loads(ADM2.read_text())['features']
 out=DATA/'maps'; out.mkdir(parents=True,exist_ok=True)
 for row in rows:
  province=next(f for f in adm1 if f['properties']['shapeName']==row['provinceDutch'])
  subdivisions=[f for f in adm2 if within(rep(f),province)]
  capital=next(f for f in adm2 if f['properties']['shapeName']==row['capitalFeature'])
  for answer in (False,True):
   fig=plt.figure(figsize=(16,10),dpi=100,facecolor=SEA); ax=fig.add_axes([.035,.10,.93,.82],facecolor=SEA)
   draw(ax,province,PROVINCE_FILL,1.05,1); cp=clip(ax,province)
   for sub in subdivisions: draw(ax,sub,'none',.34,2,cp)
   draw(ax,capital,CAPITAL_FILL,.8,3,cp)
   x0,y0,x1,y1=bounds(province); dx=max(x1-x0,.02); dy=max(y1-y0,.02)
   ax.set_xlim(x0-dx*.045,x1+dx*.045); ax.set_ylim(y0-dy*.045,y1+dy*.045); ax.set_aspect('equal'); ax.axis('off')
   title=f"{row['provinceEnglish']} — {row['capitalEnglish']}" if answer else f"{row['provinceEnglish']} — Province Capital Area"
   fig.text(.5,.955,title,ha='center',va='top',fontsize=26,fontweight='bold',color=BORDER)
   fig.text(.5,.052,'provincial capital municipality',ha='center',fontsize=16,color=CAPITAL_FILL,fontweight='bold')
   fig.text(.5,.022,'ADM1 and ADM2 boundaries: geoBoundaries / National Georegister',ha='center',fontsize=9,color='#64737a')
   fig.savefig(out/f"{row['id']}-{'answer' if answer else 'question'}.png",facecolor=SEA); plt.close(fig)
 print(f'Generated {len(rows)*2} Netherlands province-capital images')
if __name__=='__main__': main()
