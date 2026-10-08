#!/usr/bin/env python3
"""Render the approved six-place North America map and split quiz artwork."""
import colorsys,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'packages/geography/data/north-america-countries'
SOURCE=DATA/'source-natural-earth-map-units.geojson'
ORDER=['Canada','United States','Mexico','Greenland (Denmark)','Bermuda (United Kingdom)','Saint Pierre and Miquelon (France)']
FONT='/usr/share/fonts/dejavu/DejaVuSans.ttf'; BOLD='/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
W=H=3600; PAPER=(246,242,233); SEA=(224,237,239); INK=(37,54,59); EDGE=(55,72,77); ORANGE=(235,128,73); GREY=(218,224,223)

def project(lon,lat):
 if lon>0: lon-=360
 phi=math.radians(lat); lam=math.radians(lon); phi1,phi2=math.radians(35),math.radians(70); phi0,lam0=math.radians(38),math.radians(-100)
 n=math.log(math.cos(phi1)/math.cos(phi2))/math.log(math.tan(math.pi/4+phi2/2)/math.tan(math.pi/4+phi1/2))
 f=math.cos(phi1)*math.tan(math.pi/4+phi1/2)**n/n; rho=f/math.tan(math.pi/4+phi/2)**n; rho0=f/math.tan(math.pi/4+phi0/2)**n
 delta=(lam-lam0+math.pi)%(2*math.pi)-math.pi
 return rho*math.sin(n*delta),rho0-rho*math.cos(n*delta)

def polygons(feature):
 g=feature['geometry']; return [g['coordinates']] if g['type']=='Polygon' else g['coordinates']

def prepare():
 source=json.loads(SOURCE.read_text()); by={f['properties']['shapeName']:f for f in source['features']}
 prepared=[]; hawaii=[]; allpts=[]
 for number,name in enumerate(ORDER,1):
  feature=by[name]; kept=[]
  for poly in polygons(feature):
   raw=[p for ring in poly for p in ring]; lons=[p[0]-360 if p[0]>0 else p[0] for p in raw]
   us=name=='United States'; pacific=us and max(p[1] for p in raw)<30 and max(lons)<-150
   is_hawaii=pacific and min(lons)>=-161.5 and max(lons)<=-154 and min(p[1] for p in raw)>=18
   wrapped=us and max(lons)<-180
   rings=[[project(p[0],p[1]) for p in ring] for ring in poly]
   if is_hawaii: hawaii.append((number,rings)); continue
   if pacific or wrapped: continue
   kept.append(rings); allpts.extend(p for ring in rings for p in ring)
  prepared.append((number,name,kept))
 return prepared,hawaii,allpts

def palette(number): return tuple(round(c*255) for c in colorsys.hsv_to_rgb((number*.61803398875)%1,.34,.83))

def render(mode='reference',target=None,caption=None):
 prepared,hawaii,allpts=prepare(); minx,maxx=min(x for x,y in allpts),max(x for x,y in allpts); miny,maxy=min(y for x,y in allpts),max(y for x,y in allpts)
 im=Image.new('RGB',(W,H),PAPER); d=ImageDraw.Draw(im)
 d.text((W//2,44),caption or 'North America — Countries and Territories',font=ImageFont.truetype(BOLD,62),fill=INK,anchor='ma')
 frame=(20,145,W-20,H-35); d.rounded_rectangle(frame,radius=24,fill=SEA,outline=(112,128,131),width=4)
 pad_x,pad_y=8,70; l,t,r,b=frame; scale=min((r-l-2*pad_x)/(maxx-minx),(b-t-2*pad_y)/(maxy-miny)); ox=l+(r-l-(maxx-minx)*scale)/2-18; oy=t+pad_y+(b-t-2*pad_y-(maxy-miny)*scale)/2
 xy=lambda p:(ox+(p[0]-minx)*scale,oy+(maxy-p[1])*scale)
 def fill(number,name): return ORANGE if name==target else (GREY if target else palette(number))
 for number,name,parts in prepared:
  for poly in parts:
   for ring_index,ring in enumerate(poly):
    pts=[xy(p) for p in ring]
    if len(pts)>2: d.polygon(pts,fill=fill(number,name) if ring_index==0 else SEA,outline=EDGE,width=2)

 # Hawaii inset remains part of the United States answer.
 box=(115,H-650,760,H-175); d.rounded_rectangle(box,radius=18,fill=(239,246,245),outline=(112,128,131),width=3)
 d.text(((box[0]+box[2])/2,box[1]+24),'Hawaii',font=ImageFont.truetype(BOLD,32),fill=INK,anchor='ma')
 hp=[p for _,ringset in hawaii for ring in ringset for p in ring]; hminx,hmaxx=min(x for x,y in hp),max(x for x,y in hp); hminy,hmaxy=min(y for x,y in hp),max(y for x,y in hp)
 bx0,by0,bx1,by1=box; hs=min((bx1-bx0-72)/(hmaxx-hminx),(by1-by0-117)/(hmaxy-hminy)); hox=bx0+(bx1-bx0-(hmaxx-hminx)*hs)/2; hoy=by0+45+(by1-by0-45-(hmaxy-hminy)*hs)/2
 hxy=lambda p:(hox+(p[0]-hminx)*hs,hoy+(hmaxy-p[1])*hs)
 for number,ringset in hawaii:
  for ring in ringset:
   pts=[hxy(p) for p in ring]
   if len(pts)>2: d.polygon(pts,fill=fill(number,'United States'),outline=EDGE,width=2)

 at=lambda lon,lat:xy(project(lon,lat)); numfont=ImageFont.truetype(BOLD,48); namefont=ImageFont.truetype(BOLD,34)
 def boxtext(pos,text,font=numfont,anchor='mm'):
  bb=d.textbbox(pos,text,font=font,anchor=anchor); d.rounded_rectangle((bb[0]-10,bb[1]-6,bb[2]+10,bb[3]+6),radius=8,fill=(255,253,246)); d.text(pos,text,font=font,fill=INK,anchor=anchor)
 if mode in {'numbered','named'}:
  positions={'Canada':(-105,57),'United States':(-99,38),'Mexico':(-102,23),'Greenland (Denmark)':(-42,72)}
  for number,name,_ in prepared[:4]: boxtext(at(*positions[name]),str(number) if mode=='numbered' else name,numfont if mode=='numbered' else namefont)
  callouts=[(5,'Bermuda (United Kingdom)',(-64.75,32.3),(3100,2150)),(6,'Saint Pierre and Miquelon (France)',(-56.2,46.8),(3000,1510))]
  for number,name,source,label in callouts:
   sx,sy=at(*source); tx,ty=label; d.line((sx,sy,tx-25,ty),fill=INK,width=4); boxtext((tx,ty),str(number) if mode=='numbered' else name,numfont if mode=='numbered' else namefont,'mm')
 if target in {'Bermuda (United Kingdom)','Saint Pierre and Miquelon (France)'}:
  source=(-64.75,32.3) if target.startswith('Bermuda') else (-56.2,46.8); cx,cy=at(*source); d.ellipse((cx-34,cy-34,cx+34,cy+34),outline=ORANGE,width=12)
 d.text((W//2,H-82),'Six countries and territories • north is up • geographic shapes and positions preserved',font=ImageFont.truetype(FONT,25),fill=(78,90,93),anchor='ms')
 return im

def main():
 split=DATA/'split'; split.mkdir(exist_ok=True)
 render('numbered').save(DATA/'divisions-numbered.png',optimize=True)
 render('named').save(DATA/'divisions-named.png',optimize=True)
 render('reference').save(split/'reference.png',optimize=True)
 records=json.loads((DATA/'divisions.json').read_text())
 for record in records:
  stem=record['id'].removesuffix('-highlight'); answer=record['answer']
  render('question',answer,'Which country or territory is highlighted?').save(split/f'{stem}-question.png',optimize=True)
  render('question',answer,answer).save(split/f'{stem}-answer.png',optimize=True)
 print(DATA)
if __name__=='__main__': main()
