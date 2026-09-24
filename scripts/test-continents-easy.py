import os,pty,subprocess,select,time,re,tempfile,json,fcntl,termios,struct
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
data=tempfile.mkdtemp(prefix='wsm-easy-test-')
def start():
 m,s=pty.openpty();fcntl.ioctl(s,termios.TIOCSWINSZ,struct.pack('HHHH',45,120,0,0))
 env=dict(os.environ,TERM='xterm-kitty',KITTY_WINDOW_ID='test',XDG_DATA_HOME=data)
 p=subprocess.Popen(['node','-e',"Math.random=()=>0.999999999; process.argv=['node','dist/main.js','geography','continents-easy']; require('./dist/main.js');"],cwd=root,env=env,stdin=s,stdout=s,stderr=s);os.close(s)
 return p,m
def read_until(m,needle):
 end=time.time()+15;b=b''
 while time.time()<end:
  if select.select([m],[],[],.2)[0]:
   try:b+=os.read(m,65536)
   except OSError:break
   if needle in b:return b
 raise AssertionError(('missing',needle,b[-1000:]))
answers=[b'North America',b'South America',b'Africa',b'Europe',b'Asia',b'Oceania',b'Antarctica']
p,m=start()
try:
 for answer in answers:
  b=read_until(m,b'Press 1');choices=re.findall(rb'([1-4])\. ([A-Za-z ]+)\r?\n',b);assert len(choices)==4
  os.write(m,next(k for k,v in choices if v==answer));read_until(m,b'Correct!');os.write(m,b' ')
 for i,answer in enumerate(answers,1):
  b=read_until(m,b'Press the map number');assert b'Which number marks '+answer+b'?' in b
  assert not re.search(rb'[1-4]\. [A-Za-z]',b)
  os.write(m,str(i).encode());b=read_until(m,b'Correct!');assert b'\x1b_Ga=T' in b;os.write(m,b' ')
 read_until(m,b'Press Enter or Space to return.');os.write(m,b' ');p.wait(timeout=5);assert p.returncode==0
finally:
 if p.poll() is None:p.kill()
 os.close(m)
store=json.load(open(data+'/whacksmacker/progress/wandering-the-world/review-progress.json'));assert len(store['events'])==14
print('Easy: all 14 questions, both map modes, immediate feedback, reveal, and saved outcomes passed.')
data=tempfile.mkdtemp(prefix='wsm-japan-test-')
def start():
 m,s=pty.openpty();fcntl.ioctl(s,termios.TIOCSWINSZ,struct.pack('HHHH',45,120,0,0))
 env=dict(os.environ,TERM='xterm-kitty',KITTY_WINDOW_ID='test',XDG_DATA_HOME=data)
 p=subprocess.Popen(['node','-e',"Math.random=()=>0.999999999; process.argv=['node','dist/main.js','geography','japan-prefectures-hard']; require('./dist/main.js');"],cwd=root,env=env,stdin=s,stdout=s,stderr=s);os.close(s)
 return p,m
p,m=start()
try:
 b=read_until(m,b'Type the romanized');assert b'Prefectures - Hard' in b
 os.write(m,'Hokkaidō\r'.encode());read_until(m,b'Correct!');os.write(m,b' ')
 read_until(m,b'Type the romanized');os.write(m,b'wrong\r');read_until(m,b'Wrong. The highlighted prefecture is Aomori');os.write(m,b'\x1b');p.wait(timeout=5);assert p.returncode==0
finally:
 if p.poll() is None:p.kill()
 os.close(m)
store=json.load(open(data+'/whacksmacker/progress/wandering-the-world/review-progress.json'));assert len(store['events'])==2;assert all(e['packageId']=='com.sleepymario.geography.japan-prefectures-hard' for e in store['events'])
assert {e['rating'] for e in store['events']}=={'good','again'}
print('Japan Hard: macron input, correct/wrong answers, answer reveal and separate scheduled progress passed.')
