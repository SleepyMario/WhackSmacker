#!/usr/bin/env python3
"""Run on Linux builder101 after the native Tauri build."""
from pathlib import Path
import shutil,subprocess,sys,tempfile
binary,icon,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='wsm-gui-deb-') as d:
 root=Path(d);app=root/'usr/lib/wsm-gui';app.mkdir(parents=True)
 shutil.copy2(binary,app/'wsm-gui');subprocess.run(['strip',str(app/'wsm-gui')],check=True)
 (root/'usr/share/icons/hicolor/128x128/apps').mkdir(parents=True)
 shutil.copy2(icon,root/'usr/share/icons/hicolor/128x128/apps/wsm-gui.png')
 (root/'usr/share/applications').mkdir(parents=True)
 (root/'usr/share/applications/wsm-gui.desktop').write_text('[Desktop Entry]\nType=Application\nName=WSM GUI Proof\nExec=/usr/lib/wsm-gui/wsm-gui\nIcon=wsm-gui\nTerminal=false\nCategories=Education;\n')
 (root/'DEBIAN').mkdir()
 (root/'DEBIAN/control').write_text('Package: wsm-gui\nVersion: 0.1.0~alpha.5-1\nArchitecture: amd64\nMaintainer: Mushroom <admin@sleepymario.com>\nSection: education\nPriority: optional\nDepends: libc6 (>= 2.43), libgtk-3-0t64, libwebkit2gtk-4.1-0, libayatana-appindicator3-1\nDescription: WhackSmacker experimental graphical proof\n One offline Geography exercise using the shared WSM review scheduler.\n Independent demo profile; does not read or modify existing WSM progress.\n')
 subprocess.run(['dpkg-deb','--root-owner-group','--build',str(root),str(out/'wsm-gui_0.1.0~alpha.5-1_amd64.deb')],check=True)
