#!/usr/bin/env python3
"""Generate WtW prefecture-capital municipality maps from MLIT-derived GeoJSON."""
from __future__ import annotations
import argparse,json,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as PatchPolygon, Rectangle

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_SOURCE=Path('/tmp/japan-topography/data/municipality/geojson/s0010')
OUT=ROOT/'packages/geography/data/japan-prefecture-capitals/maps'
CAPITALS=ROOT/'packages/geography/data/japan-prefecture-capitals/capitals.json'
PREF_FILL='#82a8df'; CAPITAL_FILL='#ee8c72'; BORDER='#243a45'; SEA='#f6f2e8'; INSET='#ded8cc'

def rings(geometry):
 t=geometry['type']; c=geometry['coordinates']
 if t=='Polygon': yield from c
 elif t=='MultiPolygon':
  for poly in c: yield from poly
 else: raise ValueError(t)

def outer_polygons(feature):
 g=feature['geometry']; c=g['coordinates']
 return [c[0]] if g['type']=='Polygon' else [p[0] for p in c]

def bounds(features):
 pts=[p for f in features for ring in outer_polygons(f) for p in ring]
 return min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)

def area(ring):
 return abs(sum(ring[i][0]*ring[(i+1)%len(ring)][1]-ring[(i+1)%len(ring)][0]*ring[i][1] for i in range(len(ring)))/2)

def capital_feature(f, capital_japanese):
 p=f['properties']; return p.get('N03_003')==capital_japanese or p.get('N03_004')==capital_japanese

def split_features(code, features):
 # Preserve distant island territory in an inset while maximizing the inhabited/main prefecture map.
 if code=='13': pred=lambda x,y: x>139.0 and y>35.0
 elif code=='46': pred=lambda x,y: y>30.05
 elif code=='47': pred=lambda x,y: 127.35<x<128.45 and 25.95<y<27.15
 else: return features,[]
 main=[];remote=[]
 for f in features:
  polys=outer_polygons(f); a=max(polys,key=area); x=sum(p[0] for p in a)/len(a); y=sum(p[1] for p in a)/len(a)
  (main if pred(x,y) else remote).append(f)
 return main,remote

def draw_features(ax,features,capital_japanese,answer=False):
 for f in features:
  cap=capital_feature(f,capital_japanese)
  for ring in outer_polygons(f):
   ax.add_patch(PatchPolygon(ring,closed=True,facecolor=CAPITAL_FILL if cap else PREF_FILL,edgecolor=BORDER,linewidth=0.55,zorder=3 if cap else 2))

def fit(ax,features,pad=.045):
 x0,y0,x1,y1=bounds(features); dx=max(x1-x0,.02);dy=max(y1-y0,.02)
 ax.set_xlim(x0-dx*pad,x1+dx*pad);ax.set_ylim(y0-dy*pad,y1+dy*pad);ax.set_aspect('equal');ax.axis('off')

def render(row,code,source):
 path=next(source.glob(f'N03-21_{code}_*.json')); features=json.loads(path.read_text())['features']
 capital=row['capitalJapanese']; matches=[f for f in features if capital_feature(f,capital)]
 if not matches: raise RuntimeError(f'No municipality match for {row["id"]}: {capital}')
 main,remote=split_features(code,features)
 if not any(capital_feature(f,capital) for f in main): raise RuntimeError(f'Capital excluded from main map: {row["id"]}')
 for answer in (False,True):
  fig=plt.figure(figsize=(16,10),dpi=100,facecolor=SEA)
  ax=fig.add_axes([.035,.10,.93,.82],facecolor=SEA)
  draw_features(ax,main,capital,answer);fit(ax,main)
  if remote:
   iax=fig.add_axes([.055,.12,.28,.25],facecolor=SEA)
   iax.add_patch(Rectangle((0,0),1,1,transform=iax.transAxes,fill=False,edgecolor=INSET,linewidth=2,zorder=1))
   draw_features(iax,remote,capital,answer);fit(iax,remote,.08)
   iax.set_title('Outlying islands',fontsize=14,color=BORDER,pad=4)
  title=(f'{row["prefectureEnglish"]} — {row["capitalEnglish"]}' if answer else f'{row["prefectureEnglish"]} — Prefectural Capital Area')
  fig.text(.5,.955,title,ha='center',va='top',fontsize=26,fontweight='bold',color=BORDER)
  fig.text(.5,.052,'capital municipality / administrative seat',ha='center',fontsize=16,color=CAPITAL_FILL,fontweight='bold')
  fig.text(.5,.022,'Municipal boundaries: MLIT National Land Numerical Information (2021)',ha='center',fontsize=9,color='#64737a')
  out=OUT/f'{row["id"]}-{"answer" if answer else "question"}.png';fig.savefig(out,facecolor=SEA);plt.close(fig)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,default=DEFAULT_SOURCE);a=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 rows=json.loads(CAPITALS.read_text());
 for i,row in enumerate(rows,1): render(row,f'{i:02d}',a.source)
 print(f'Generated {len(rows)*2} prefecture-capital map images in {OUT}')
if __name__=='__main__':main()
