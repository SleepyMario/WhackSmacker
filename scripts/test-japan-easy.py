import os,pty,subprocess,select,time,re,tempfile,json,fcntl,termios,struct
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
data=tempfile.mkdtemp(prefix='wsm-easy-test-')
def start():
 m,s=pty.openpty();fcntl.ioctl(s,termios.TIOCSWINSZ,struct.pack('HHHH',45,120,0,0))
 env=dict(os.environ,TERM='xterm-kitty',KITTY_WINDOW_ID='test',XDG_DATA_HOME=data)
 p=subprocess.Popen(['node','-e',"Math.random=()=>0.999999999; process.argv=['node','dist/main.js','geography','japan-prefectures-easy']; require('./dist/main.js');"],cwd=root,env=env,stdin=s,stdout=s,stderr=s);os.close(s)
 return p,m
def read_until(m,needle):
 end=time.time()+15;b=b''
 while time.time()<end:
  if select.select([m],[],[],.2)[0]:
   try:b+=os.read(m,65536)
   except OSError:break
   if needle in b:return b
 raise AssertionError(('missing',needle,b[-1000:]))

cards=json.load(open(root+'/packages/geography/data/japan-hard/prefectures.json'))
p,m=start()
try:
 for card in cards:
  b=read_until(m,b'Press 1');choices=re.findall(rb'([1-4])\. ([A-Za-z ]+)\r?\n',b)
  assert len(choices)==4 and len(set(v for k,v in choices))==4
  os.write(m,next(k for k,v in choices if v.decode()==card['answer']))
  read_until(m,b'Correct!');os.write(m,b' ')
 for i,card in enumerate(cards,1):
  b=read_until(m,b'Enter the map number');assert ('Which number marks '+card['answer']+'?').encode() in b
  os.write(m,(str(i)+'\r').encode());read_until(m,b'Correct!');os.write(m,b' ')
 read_until(m,b'Press Enter or Space to return.');os.write(m,b' ');p.wait(timeout=5);assert p.returncode==0
finally:
 if p.poll() is None:p.kill()
 os.close(m)
store=json.load(open(data+'/whacksmacker/progress/wandering-the-world/review-progress.json'))
assert len(store['events'])==94
assert all(e['packageId']=='com.sleepymario.geography.japan-prefectures-easy' for e in store['events'])
print('Japan Easy: all 94 questions, 47 unique choice answers, map-number entry 1–47, reveals, and isolated progress passed.')
