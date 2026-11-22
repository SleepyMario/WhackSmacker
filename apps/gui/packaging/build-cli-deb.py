#!/usr/bin/env python3
"""Build from the prepared Docker runtime tree on VM101."""
from pathlib import Path
import shutil,subprocess,sys,tempfile
source,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='wsm-cli-deb-') as d:
 root=Path(d);app=root/'usr/share/wsm-cli';app.mkdir(parents=True)
 for name in ('dist','migrations','node_modules','package.json','package-lock.json','COPYING'):
  s=source/name
  if s.is_dir():shutil.copytree(s,app/name)
  else:shutil.copy2(s,app/name)
 (root/'usr/bin').mkdir(parents=True)
 exe=root/'usr/bin/wsm';exe.write_text('#!/bin/sh\nexec node /usr/share/wsm-cli/dist/main.js "$@"\n');exe.chmod(0o755)
 (root/'usr/bin/whacksmacker').symlink_to('wsm')
 (root/'usr/share/applications').mkdir(parents=True)
 (root/'usr/share/applications/wsm-cli.desktop').write_text('[Desktop Entry]\nType=Application\nName=WhackSmacker CLI\nExec=kitty --class WhackSmacker wsm\nTerminal=false\nCategories=Education;\n')
 (root/'DEBIAN').mkdir()
 (root/'DEBIAN/control').write_text('Package: wsm-cli\nVersion: 0.1.0~alpha.5-1\nArchitecture: all\nMaintainer: Mushroom <admin@sleepymario.com>\nSection: education\nPriority: optional\nDepends: nodejs (>= 22), kitty\nDescription: WhackSmacker terminal learning application\n Language and Geography study workflows. Existing user progress is retained.\n')
 subprocess.run(['dpkg-deb','--root-owner-group','--build',str(root),str(out/'wsm-cli_0.1.0~alpha.5-1_all.deb')],check=True)
