"""固定版 MoBL-ARMS 路徑點的肘與前臂直線弦力臂；包覆面未求解。

執行：python3 tools/forearm_params.py [--check]
"""
import xml.etree.ElementTree as ET, math, json, argparse, urllib.request
from pathlib import Path
SOURCE='https://raw.githubusercontent.com/CEINMS-RT/UpperLimbModel/459e2ebbf47acb72b0ecbc59950a2d0a983d28db/MOBL_ARMS_41.osim'
OUTPUT=Path(__file__).resolve().parent.parent/'src/forearm-arms.js'
with urllib.request.urlopen(SOURCE) as response: R=ET.fromstring(response.read())
M={e.get('name'):e for e in R.iter() if e.findtext('max_isometric_force') is not None}
AXE=(.04940001,.03660001,.99810825); CE=(.0061,-.2904,-.0123)
AXR=(-.01716099,.99266564,-.11966796); CR=(.0004,-.011503,.019999)
def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def mul(a,s):return tuple(x*s for x in a)
def rot(p,a,t):return add(add(mul(p,math.cos(t)),mul(cross(a,p),math.sin(t))),mul(a,dot(a,p)*(1-math.cos(t))))
def xyz(s):return tuple(map(float,s.split()))
def world(p,elb,fore):
 body=p.findtext('socket_parent_frame').split('/')[-1]
 loc=p.findtext('location')
 if loc is None:
  loc=[]
  for c in 'xyz':
   el=p.find(c+'_location/*'); xx=list(map(float,el.findtext('x').split()));yy=list(map(float,el.findtext('y').split()))
   i=next((i for i in range(len(xx)-1) if xx[i]<=fore<=xx[i+1]),0 if fore<xx[0] else len(xx)-2)
   loc.append(yy[i]+(yy[i+1]-yy[i])*(fore-xx[i])/(xx[i+1]-xx[i]))
  loc=tuple(loc)
 else:loc=xyz(loc)
 if body=='radius':loc=add(CR,rot(loc,AXR,fore))
 if body in ('radius','ulna'):loc=add(CE,rot(loc,AXE,elb))
 return loc
def length(name,elb,fore):
 p=[]
 for x in M[name].findall('.//PathPointSet/objects/*'):
  if x.tag=='ConditionalPathPoint':
   a,b=xyz(x.findtext('range')+' 0')[:2]
   coord=x.findtext('socket_coordinate') or ''
   val=fore if 'pro_sup' in coord else elb
   if val<a or val>b:continue
  p.append(world(x,elb,fore))
 return sum(math.dist(x,y) for x,y in zip(p,p[1:]))
def arm(name,el,fr,coord):
 h=1e-4; d=(length(name,el+h,fr)-length(name,el-h,fr))/(2*h) if coord=='el' else (length(name,el,fr+h)-length(name,el,fr-h))/(2*h)
 return -d
ELBOW_DEG=[20,45,70,95,120,130]
FORE_DEG=[-80,-60,-40,-20,0,20,40,60,80]
IDS={'bicLong':'BIClong','bicShort':'BICshort','brachialis':'BRA','brachioradialis':'BRD',
     'pronatorTeres':'PT','pronatorQuadratus':'PQ','supinator':'SUP'}
def make_table():
 out={}
 for key,name in IDS.items():
  muscle=M[name]
  out[key]={'F':round(float(muscle.findtext('max_isometric_force')),4),
            'Lf':round(float(muscle.findtext('optimal_fiber_length')),6),
            'Lt':round(float(muscle.findtext('tendon_slack_length')),6),
            'elb':[[round(arm(name,math.radians(e),math.radians(f),'el'),6) for e in ELBOW_DEG] for f in FORE_DEG],
            'rot':[[round(arm(name,math.radians(e),math.radians(f),'fore'),6) for e in ELBOW_DEG] for f in FORE_DEG]}
 return out
def render(data):
 return ('// 固定版 MoBL-ARMS 路徑點直線弦力臂；由 tools/forearm_params.py 產生。\n'
         '// 表值為 -∂L/∂θ，foreRot 正值為旋前；包覆面近似限制見研究文件。\n'
         'export const FOREARM_SOURCE = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'
         'export const FOREARM_ELBOW_DEG = '+json.dumps(ELBOW_DEG)+';\n'
         'export const FOREARM_ROT_DEG = '+json.dumps(FORE_DEG)+';\n')
if __name__=='__main__':
 args=argparse.ArgumentParser(description=__doc__)
 args.add_argument('--check',action='store_true')
 parsed=args.parse_args()
 expected=render(make_table())
 if parsed.check:
  if OUTPUT.read_text()!=expected: raise SystemExit('src/forearm-arms.js 與來源不一致')
  print('前臂來源表一致')
 else:
  OUTPUT.write_text(expected)
  print(OUTPUT)
