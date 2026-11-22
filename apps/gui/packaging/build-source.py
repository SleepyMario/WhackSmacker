#!/usr/bin/env python3
"""Archive prebuilt frontend + vendored Rust sources, without platform build output."""
from pathlib import Path
import hashlib,json,subprocess,sys,tempfile
source,output=map(lambda value:Path(value).resolve(),sys.argv[1:])
version=json.loads((source/'package.json').read_text())['version']
name=f'wsm-gui-{version}'
output.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='wsm-gui-source-') as temporary:
 stage=Path(temporary)/name
 subprocess.run(['rsync','-a','--exclude=/node_modules','--exclude=/src-tauri/target','--exclude=/src-tauri/gen',str(source)+'/',str(stage)+'/'],check=True)
 if not (stage/'dist/index.html').is_file():raise SystemExit('Build the frontend before creating the archive')
 manifests=list((stage/'vendor').glob('*/.cargo-checksum.json'))
 if not manifests:raise SystemExit('Run cargo vendor before creating the archive')
 count=0
 for manifest in manifests:
  for relative,expected in json.loads(manifest.read_text())['files'].items():
   path=manifest.parent/relative
   if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
    raise SystemExit(f'Vendored source is missing or changed: {path}')
   count+=1
 subprocess.run(['tar','-C',temporary,'-cJf',str(output/f'{name}-source.tar.xz'),name],check=True)
 print(f'Archived {name}; verified {count} vendored files')
