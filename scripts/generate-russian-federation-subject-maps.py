#!/usr/bin/env python3
"""Generate the validated 89-subject Russian Federation geography decks."""

import colorsys, importlib.util, json, shutil
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle

repo=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('maps',repo/'scripts/generate-country-division-maps.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
config=m.CONFIGS['russian-federation']
source=json.load(open(repo/'packages/geography/data/russian-federation-divisions/source-RUS-claimed-ADM1.geojson'))

groups={
'Central': {'Belgorod Oblast','Bryansk Oblast','Vladimir Oblast','Voronezh Oblast','Ivanovo Oblast','Kaluga Oblast','Kostroma Oblast','Kursk Oblast','Lipetsk Oblast','Moscow Oblast','Oryol Oblast','Ryazan Oblast','Smolensk Oblast','Tambov Oblast','Tver Oblast','Tula Oblast','Yaroslavl Oblast','Moscow'},
'Northwestern': {'Republic of Karelia','Komi Republic','Arkhangelsk Oblast','Nenets Autonomous Okrug','Vologda Oblast','Kaliningrad','Leningrad oblast','Murmansk Oblast','Novgorod Oblast','Pskov Oblast','Saint Petersburg'},
'Southern': {'Adygea','Kalmykia','Republic of Crimea','Krasnodar Krai','Astrakhan Oblast','Volgograd Oblast','Rostov Oblast','Sevastopol',"Donetsk People's Republic","Luhansk People's Republic",'Zaporozhye Oblast','Kherson Oblast'},
'North Caucasian': {'Dagestan','Ingushetia','Kabardino-Balkaria','Karachay-Cherkessia','North Ossetia–Alania','Chechnya','Stavropol Krai'},
'Volga': {'Bashkortostan','Mari El','Republic of Mordovia','Tatarstan','Udmurtia','Chuvashia','Perm Krai','Kirov Oblast','Nizhny Novgorod Oblast','Orenburg Oblast','Penza Oblast','Samara Oblast','Saratov Oblast','Ulyanovsk Oblast'},
'Ural': {'Kurgan Oblast','Sverdlovsk Oblast','Tyumen Oblast','Chelyabinsk Oblast','Khanty-Mansiysk Autonomous Okrug – Ugra','Yamalo-Nenets Autonomous Okrug'},
'Siberian': {'Altai Republic','Tuva','Khakassia','Altai Krai','Krasnoyarsk Krai','Irkutsk Oblast','Kemerovo Oblast','Novosibirsk Oblast','Omsk Oblast','Tomsk Oblast'},
'Far Eastern': {'Buryatia','Sakha Republic','Zabaykalsky Krai','Kamchatka Krai','Primorsky Krai','Khabarovsk Krai','Amur Oblast','Magadan Oblast','Sakhalin Oblast','Jewish Autonomous Oblast','Chukotka Autonomous Okrug'},
}
order=list(groups)
name_to_group={name:group for group,names in groups.items() for name in names}
features=[]
for f in source['features']:
    f['answer']=f['properties']['shapeName']; f['group']=name_to_group[f['answer']]
    m.transform_geometry(f,'russian-federation',config); f['center']=m.label_point(f); features.append(f)
features.sort(key=lambda f:(order.index(f['group']),f['answer']))
for i,f in enumerate(features,1): f['number']=i
assert len(features)==89
colors={f['answer']:colorsys.hsv_to_rgb((i*.61803398875)%1,.34,.86) for i,f in enumerate(features,1)}

def points(fs): return [p for f in fs for ring in m.rings(f['geometry']) for p in ring]
def bounds(fs):
    p=points(fs); return min(x for x,y in p),max(x for x,y in p),min(y for x,y in p),max(y for x,y in p)
def draw_shapes(ax,fs,highlight=None,neutral=False):
    for f in sorted(fs,key=m.feature_area,reverse=True):
        rr=m.rings(f['geometry']); largest=max(m.polygon_area(r) for r in rr)
        for ring in rr:
            if m.polygon_area(ring)<largest*.00001: continue
            fill='#e98255' if f['answer']==highlight else ('#dce1df' if neutral else colors[f['answer']])
            ax.add_patch(Polygon(m.display_ring(ring),closed=True,facecolor=fill,edgecolor='#304247',linewidth=.42))

def draw_panel(ax,shape_fs,label_fs,fixed=None,highlight=None,neutral=False):
    fixed=fixed or {}
    draw_shapes(ax,shape_fs,highlight,neutral)
    minx,maxx,miny,maxy=bounds(shape_fs); width=maxx-minx; height=maxy-miny
    tiny=[]
    for f in label_fs:
        if f['number'] in fixed: continue
        p=points([f]); fw=max(x for x,y in p)-min(x for x,y in p); fh=max(y for x,y in p)-min(y for x,y in p)
        if fw<width*.032 or fh<height*.040 or m.feature_area(f)<width*height*.00075: tiny.append(f)
    regular=[f for f in label_fs if f not in tiny and f['number'] not in fixed]
    for f in regular:
        x,y=f['center']; ax.text(x,y,str(f['number']),ha='center',va='center',fontsize=15,fontweight='bold',color='#142429',zorder=20)
    left=sorted([f for f in tiny if f['center'][0]<(minx+maxx)/2],key=lambda f:f['center'][1],reverse=True)
    right=sorted([f for f in tiny if f not in left],key=lambda f:f['center'][1],reverse=True)
    for side,items in [('left',left),('right',right)]:
        if not items: continue
        top=maxy-height*.02; bottom=miny+height*.02
        ys=[top-i*(top-bottom)/max(len(items)-1,1) for i in range(len(items))]
        tx=minx-width*.055 if side=='left' else maxx+width*.055
        for f,ty in zip(items,ys):
            x,y=f['center']; ax.annotate(str(f['number']),xy=(x,y),xytext=(tx,ty),ha='center',va='center',fontsize=15,fontweight='bold',color='#142429',arrowprops=dict(arrowstyle='-',color='#142429',linewidth=.8,shrinkA=4,shrinkB=1),zorder=20)
    for f in label_fs:
        if f['number'] not in fixed: continue
        x,y=f['center']; tx,ty=fixed[f['number']]
        ax.annotate(str(f['number']),xy=(x,y),xytext=(tx,ty),ha='center',va='center',fontsize=15,fontweight='bold',color='#142429',arrowprops=dict(arrowstyle='-',color='#142429',linewidth=.8,shrinkA=4,shrinkB=1),zorder=20)
    ax.set_xlim(minx-width*.075,maxx+width*.075); ax.set_ylim(miny-height*.08,maxy+height*.08)
    ax.set_aspect('equal',adjustable='datalim'); ax.axis('off')

by_group={g:[f for f in features if f['group']==g] for g in groups}
main_labels=by_group['Siberian']+by_group['Far Eastern']
central=by_group['Central']
nw=by_group['Northwestern']
south=by_group['Southern']+by_group['North Caucasian']
volga_ural=by_group['Volga']+by_group['Ural']

panel_callouts = [
    # Moscow city: move the city number just clear of the equally centred
    # surrounding Moscow Oblast label.
    {8:(36.65,56.15),9:(38.25,55.20)},
    # The detached Kaliningrad and city-sized Saint Petersburg labels use
    # short local leaders into nearby open water/canvas.
    {20:(21.35,53.75),28:(23.80,61.20)},
    # Sevastopol, Adygea, and the compact North Caucasian republics need
    # full-sized external numbers.  Their endpoints form an orderly row below
    # the land while each origin remains inside its own subject.
    {30:(39.75,42.15),39:(32.55,44.35),46:(39.80,40.65),45:(42.00,40.65),47:(44.20,40.65),44:(46.40,40.65),42:(48.60,40.65)},
    # The smallest Volga republics move into open canvas on the west/south
    # edges rather than covering their recognizable outlines.
    {52:(43.10,60.30),50:(39.75,58.10),53:(39.75,55.55),57:(39.75,53.00),55:(39.75,50.45),62:(47.65,48.25)},
]
panel_names = ['Central', 'Northwestern', 'Southern and North Caucasian', 'Volga and Ural']

data=repo/'packages/geography/data/russian-federation-divisions'
split=data/'split'

def render(out, *, labels=False, highlight=None, neutral=False):
    fig=plt.figure(figsize=(24,13),dpi=180,facecolor='#f5f1e8')
    main=fig.add_axes([.018,.585,.964,.345])
    axes=[fig.add_axes([.018,.055,.205,.455]),fig.add_axes([.238,.055,.265,.455]),fig.add_axes([.518,.055,.215,.455]),fig.add_axes([.748,.055,.234,.455])]
    draw_panel(main,features,main_labels if labels else [],{72:(92.0,59.5),73:(92.0,48.5),82:(137.0,46.0)} if labels else {},highlight,neutral)
    for ax,fs,fixed,panel_name in zip(axes,[central,nw,south,volga_ural],panel_callouts,panel_names):
        draw_panel(ax,fs,fs if labels else [],fixed if labels else {},highlight,neutral)
        ax.add_patch(Rectangle((0,0),1,1,transform=ax.transAxes,fill=False,edgecolor='#8d9696',linewidth=1.0,linestyle=(0,(5,4)),clip_on=False,zorder=100))
        ax.text(.5,.025,panel_name,transform=ax.transAxes,ha='center',va='bottom',fontsize=18,fontweight='bold',color='#142429',zorder=110)
    fig.suptitle('Russian Federation',fontsize=25,fontweight='bold',y=.975)
    fig.savefig(out,facecolor='#f5f1e8'); plt.close(fig)

split.mkdir(parents=True,exist_ok=True)
numbered=data/'divisions-numbered.png'
render(numbered,labels=True)
shutil.copyfile(numbered,data/'divisions-named.png')
shutil.copyfile(numbered,split/'reference.png')
metadata=[]
for feature in features:
    stem=m.slug(feature['answer'])
    metadata.append({'id':f'{stem}-highlight','answer':feature['answer'],'kind':'Federal Subject','sourceCode':feature['properties'].get('shapeISO','')})
    question=split/f'{stem}-question.png'
    answer=split/f'{stem}-answer.png'
    render(question,highlight=feature['answer'],neutral=True)
    shutil.copyfile(question,answer)
(data/'divisions.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(features)} Russian federal-subject cards in {data}')
