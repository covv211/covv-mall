/* ══════════════════════════════════════════════════════════
   코브 들판 — 홈페이지 첫 화면
   bruno-simon.com(2025) 느낌: 해질녘 살구빛 땅, 금빛 풀, 보랏빛 바위, 등불, 연못과 나무다리

   - 큰 코브(주인공): 땅을 클릭하면 그 자리로 걸어감, 누른 채 끌면 마우스를 따라감(브루노 자동차처럼),
     키보드 방향키/WASD도 됨. 카메라가 코브를 따라다님
   - 작은 코브 4마리가 땅에서 쏙 나와 거품 풍선을 타고 떠오름
   - 거품을 누르면 펑! → 코브가 낙하산을 펴고 살랑살랑 내려와 땅에 닿는 순간 그 코브의 화면(소개/작업물/연락처/오피스)으로 전환
   - 빈 거품이 들판 곳곳에서 떠올라 천장에 닿으면 펑 → 가끔 아이템(별·하트·코인·사탕·보석)을 떨굼, 코브가 지나가면 주움
   - 아주 가끔 히든 컬러 아이템(무지개 물방울) → 먹으면 코브 색이 바뀜 (드물게 무지개 코브)
   - 코브 몰: 들판 한쪽 키링 가게(점원 코브). 가게 앞에 가면 코브 몰 화면으로. 주운 아이템은 가방(mall.js의 covvWallet)에 저장
   - 금화가 9,999개를 넘으면(해킹 환영 ㅋㅋ) 선글라스 쓴 '해커 코브'로 변신
   - 주인공 이름표는 '🐾 코브' → 코브 몰 계정을 만들면 내 닉네임 (mall.js covvWallet.coveName)
   - 발열 대책: 외부 모델 0개(전부 코드로 생성), 풀·꽃은 인스턴싱 한 번에 그림, 후처리 없음,
     움직이지 않는 소품은 합쳐서 그림, 그림자는 한 번만 계산, 픽셀비율·프레임 상한, 다른 화면이 열리면 렌더 정지
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const fieldEl=document.getElementById('field');
const stage=document.getElementById('fieldStage');
const tagsEl=document.getElementById('bubbleTags');
const loading=document.getElementById('fieldLoading');
if(!fieldEl||!stage) return;
if(!window.THREE){ fieldEl.classList.add('no-webgl'); window.covvField=null; return; }   // three.js를 못 불러오면 바로가기 메뉴를 보여줌

const IS_TOUCH=matchMedia('(pointer: coarse)').matches;
const MAX_DPR=IS_TOUCH?1.25:1.5;
const FPS=IS_TOUCH?30:60;
const GRASS_COUNT=IS_TOUCH?15000:36000;
const FLOWER_COUNT=IS_TOUCH?350:800;
const SHADOW_SIZE=IS_TOUCH?1024:2048;

// r134는 재질 색을 선형값으로 받음 → hex를 그대로 넣으면 물빠져 보여서 변환해서 넣음
const C=hex=>new THREE.Color(hex).convertSRGBToLinear();

/* ── 작은 코브 4마리 = 화면 4개 (거품이 떠 있는 자리) ── */
const COVES=[
  {id:'about',   label:'소개',   emoji:'👋', body:'#ffb0cf', tint:'#ffd9ea', home:[-4.4,4.2, 0.6]},
  {id:'work',    label:'작업물', emoji:'💻', body:'#a6d4ff', tint:'#d8edff', home:[-1.5,5.0,-1.6]},
  {id:'contact', label:'연락처', emoji:'☕', body:'#aeeccf', tint:'#dbf8ea', home:[ 1.5,4.6,-1.6]},
  {id:'office',  label:'내 오피스', emoji:'🏠', body:'#d4bfff', tint:'#ece2ff', home:[ 4.4,4.9, 0.6]},
];
const BUBBLE_R=0.95;
const S=0.64, FOOT=0.64;           // 작은 코브 크기, 서 있을 때 몸 중심 높이(발바닥 = 몸 중심 아래 1.0×크기)
const POP_SLOW=2;                  // 거품 터짐 속도 (1=원래 속도, 2=2배 느리게)
const PARA_TIME=1.8;               // 거품이 터진 뒤 낙하산 타고 땅에 닿기까지 걸리는 시간(초) — 클수록 천천히
const CHUTE_L=2.2*S;               // 코브 몸 중심 ~ 낙하산까지 거리 (흔들릴 때 낙하산 쪽을 축으로 매달려 흔들림)

/* ── 빈 거품 + 아이템 ── */
const AMB_MAX=IS_TOUCH?4:6;        // 동시에 떠오르는 빈 거품 최대 수
const CEIL_Y=6.0;                  // 천장 높이 (거품 윗면이 여기 닿으면 펑) — 코브 거품들이 떠 있는 높이 바로 위
const ITEM_CHANCE=0.577;           // 빈 거품이 터질 때 일반 아이템을 떨굴 확률
                                   // (흔한 아이템 금화·하트·별·사탕은 예전 0.15의 4배, 희귀한 보석은 그대로 되게 아래 비율과 함께 맞춤)
const HIDDEN_CHANCE=0.03;          // 히든 컬러 아이템(무지개 물방울)을 떨굴 확률 — 먹으면 코브 색이 바뀜
const POUCH_CHANCE=0.15;           // 금화 주머니(금화 10개)를 떨굴 확률 — 손님이 2~3분 놀면 첫 할인 쿠폰(금화 100개 = 키링 1개 100원)까지 가게
const POUCH_COINS=10;              // 금화 주머니 하나에 든 금화
const HACKER_COINS=9999;           // 금화를 가방 최대(9,999개)까지 채우면 해커 코브 🕶️
const STALL={x:5.4,z:3.4,ry:-0.35}; // 코브 몰 가게 자리 (ry: 앞쪽이 카메라·출발점을 보게 살짝 돌림)
const RAINBOW_CHANCE=0.1;          // 히든 아이템을 먹었을 때 '무지개 코브'가 될 확률
const COVE_COLORS=[                // 히든 아이템으로 바뀔 수 있는 코브 색
  {name:'분홍',hex:'#ff9ccb'},{name:'민트',hex:'#8fe3c4'},{name:'하늘',hex:'#8cc8ff'},{name:'라벤더',hex:'#c3a6ff'},
  {name:'레몬',hex:'#ffe27a'},{name:'복숭아',hex:'#ffb98a'},{name:'코랄',hex:'#ff8f86'},{name:'구름',hex:'#e9edf5'},{name:'초코',hex:'#c49a7c'},
];
const ITEM_MAX=24, ITEM_LIFE=35;   // 바닥에 남아 있는 아이템 최대 수(드롭률을 올려서 14→24), 안 주우면 사라지기까지(초)

/* ── 주인공 코브 ── */
const SPAWN={x:0,z:3.5};
const PLAYER_S=S, PLAYER_R=0.42;   // 크기(거품 속 작은 코브와 같게), 부딪힘 반경
const RUN=5.5;                     // 달리기 속도(초당)
const MAP_Z=-2, WALK_R=30;         // 걸어다닐 수 있는 범위: (0,-2) 중심 반경 30

/* ── 화면 비율별 카메라 (주인공 기준 오프셋) ── */
const CAMS={
  wide:{off:[0,8.5,13],   look:[0,2.2,-1],   fov:42},
  mid: {off:[0,9.6,15],   look:[0,2.6,-1],   fov:46},
  tall:{off:[0,12.5,17.5],look:[0,3.2,-1.5], fov:54},
};

/* ── 고정 시드 난수 (새로고침해도 배치가 같게) ── */
let seed=20260929;
const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
const rr=(a,b)=>a+rnd()*(b-a);
function hash(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function noise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hash(xi,zi), b=hash(xi+1,zi), c=hash(xi,zi+1), d=hash(xi+1,zi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
const fbm=(x,z)=>noise(x,z)*0.6+noise(x*2.1,z*2.1)*0.3+noise(x*4.3,z*4.3)*0.1;
const lerpAngle=(a,b,t)=>{ let d=((b-a+Math.PI)%(Math.PI*2))-Math.PI; if(d<-Math.PI) d+=Math.PI*2; return a+d*t; };

/* ── 지형: 연못 2개 · 길 · 가장자리 언덕 ── */
const PONDS=[{x:-9,z:-6.5,rx:4.8,rz:3.3},{x:14.5,z:9.5,rx:3.8,rz:2.6}];
const WATER_Y=-0.16;
const BRIDGE={x:-9, z0:-2.3, z1:-10.7};   // 첫 번째 연못을 세로로 건너는 다리
const PATHS=[
  [[0.4,22],[0.6,15],[0,9.5],[-0.4,6],[0,3.5],[-1,0.6],[-4.6,-1.4],[-7.6,-2],[-9,-2.2]],
  [[-9,-10.8],[-8,-13.6],[-4.6,-16],[0,-17.6],[5.2,-18.8],[10.5,-17.4]],
  [[0,3.5],[3.2,1.4],[6.8,-0.6],[10.4,-1.4],[14,-0.2],[17.6,2.6]],
  [[14,-0.2],[15.4,3.4],[13.4,6.2]],
  [[-4.6,-1.4],[-9.4,1.6],[-14.2,2.4],[-18.4,0.2],[-21,-4.6]],
  [[0.6,15],[5.4,16],[9.6,14.2]],
  [[10.5,-17.4],[15.6,-12.8],[17.4,-6.4],[14,-0.2]],
];
function pondDi(p,x,z){
  const a=Math.atan2(z-p.z,x-p.x);
  const w=1+0.07*Math.sin(a*3+0.8)+0.05*Math.sin(a*5+2.1);
  return Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)/w;
}
const pondD=(x,z)=>Math.min(pondDi(PONDS[0],x,z),pondDi(PONDS[1],x,z));
function segD(px,pz,a,b){
  const dx=b[0]-a[0], dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(px-a[0]-dx*t, pz-a[1]-dz*t);
}
function pathD(x,z){ let m=1e9; for(const P of PATHS) for(let i=0;i<P.length-1;i++) m=Math.min(m,segD(x,z,P[i],P[i+1])); return m; }
function groundY(x,z){
  const r=Math.hypot(x,(z-MAP_Z)*1.05);
  let y=0;
  if(r>33) y=(r-33)*0.34*(0.55+fbm(x*0.08+3,z*0.08));
  const pd=pondD(x,z);
  if(pd<1.05) y=Math.min(y,-0.5*Math.min(1,(1.05-pd)/0.3));
  return y;
}
const onBridge=(x,z,m=0)=>Math.abs(x-BRIDGE.x)<1.1+m && z<BRIDGE.z0+m && z>BRIDGE.z1-m;
const bridgeK=z=>Math.max(0,Math.min(1,(z-BRIDGE.z0)/(BRIDGE.z1-BRIDGE.z0)));
const bridgeTop=z=>0.12+Math.sin(bridgeK(z)*Math.PI)*0.42+0.05;
const distSpawn=(x,z)=>Math.hypot(x-SPAWN.x,z-SPAWN.z);
const nearHome=(x,z,d)=>COVES.some(c=>Math.hypot(x-c.home[0],z-c.home[2])<d);

/* ── 렌더러 ── */
let renderer;
try{ renderer=new THREE.WebGLRenderer({antialias:true}); }
catch(e){ fieldEl.classList.add('no-webgl'); window.covvField=null; return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,MAX_DPR));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const cvs=renderer.domElement;
cvs.addEventListener('webglcontextrestored',()=>{ renderer.shadowMap.needsUpdate=true; });   // 그래픽 컨텍스트가 복구되면 그림자 다시 그림

const HORIZON='#ec9a7f';
const scene=new THREE.Scene();
scene.background=new THREE.Color(HORIZON);   // 배경색은 셰이더를 안 거쳐서 hex 그대로 출력됨
scene.fog=new THREE.Fog(new THREE.Color(HORIZON),26,64);   // r134는 색 변환 '뒤'에 안개를 섞음 → hex 그대로 넣어야 하늘과 이음새 없이 이어짐

const camera=new THREE.PerspectiveCamera(42,1,.1,320);
let camCfg=CAMS.wide;
const camOff=new THREE.Vector3(), camLookOff=new THREE.Vector3(), follow=new THREE.Vector3(SPAWN.x,0,SPAWN.z), camLook=new THREE.Vector3();

/* 하늘 돔 (위는 보라, 지평선은 살구) */
scene.add(new THREE.Mesh(new THREE.SphereGeometry(180,24,12),new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{top:{value:new THREE.Color('#8f6db8')}, mid:{value:new THREE.Color('#f2a482')}, bot:{value:new THREE.Color(HORIZON)}},
  vertexShader:'varying float vY; void main(){ vY=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:'uniform vec3 top,mid,bot; varying float vY; void main(){ vec3 c=vY>0.0?mix(mid,top,smoothstep(0.0,0.5,vY)):bot; gl_FragColor=vec4(c,1.0); }'
})));

/* ── 조명: 따뜻한 해질녘 햇빛 + 보랏빛 그늘 ── */
scene.add(new THREE.HemisphereLight(C('#c9adff'),C('#7a4a7e'),0.62));
const sun=new THREE.DirectionalLight(C('#ffc08a'),0.95);
sun.position.set(-24,28,13); sun.target.position.set(0,0,MAP_Z);
sun.castShadow=true; sun.shadow.mapSize.set(SHADOW_SIZE,SHADOW_SIZE);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:110});
sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.04;
scene.add(sun,sun.target);

/* ── 공용 텍스처: 동그란 빛 ── */
const GLOW=(()=>{
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(.35,'rgba(255,255,255,.55)'); r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r; g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
})();

/* ── 땅 (정점 색으로 칠함) ── */
(()=>{
  const SEG=IS_TOUCH?120:190;
  const geo=new THREE.PlaneGeometry(150,150,SEG,SEG); geo.rotateX(-Math.PI/2); geo.translate(0,0,MAP_Z);
  const p=geo.attributes.position, col=new Float32Array(p.count*3);
  const cA=C('#e5846a'), cB=C('#f2a585'), cC=C('#d46f5d'), cPath=C('#f6bf9f'), cShore=C('#f7cfb0'), cDeep=C('#9b5a7a'), t=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), z=p.getZ(i);
    p.setY(i,groundY(x,z));
    const n=fbm(x*0.16,z*0.16);
    t.copy(cA).lerp(n>0.52?cB:cC, Math.min(1,Math.abs(n-0.52)*1.8));
    const dp=pathD(x,z); if(dp<1.3) t.lerp(cPath,(1.3-dp)/1.3*0.5);
    const pd=pondD(x,z);
    if(pd<1.25 && pd>0.9) t.lerp(cShore,0.55*(1-Math.abs(pd-1.07)/0.18));
    if(pd<0.95) t.lerp(cDeep,0.7);
    col[i*3]=t.r; col[i*3+1]=t.g; col[i*3+2]=t.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));
  ground.receiveShadow=true; scene.add(ground);
})();

/* ── 연못 물 + 물결 ── */
const WATER_M=new THREE.MeshStandardMaterial({color:C('#4f6ae0'),roughness:.15,metalness:0,emissive:C('#2a3597'),emissiveIntensity:.45});
const ripples=[];
PONDS.forEach(p=>{
  const w=new THREE.Mesh(new THREE.CircleGeometry(1,56),WATER_M);
  w.rotation.x=-Math.PI/2; w.scale.set(p.rx*1.15,p.rz*1.15,1); w.position.set(p.x,WATER_Y,p.z); w.receiveShadow=true; scene.add(w);
  for(let i=0;i<3;i++){
    const m=new THREE.Mesh(new THREE.RingGeometry(.92,1,40),new THREE.MeshBasicMaterial({color:C('#cfdcff'),transparent:true,opacity:0,depthWrite:false}));
    m.rotation.x=-Math.PI/2; scene.add(m);
    ripples.push({m,p,t:i*1.1+rnd()});
  }
});

/* ── 길 (돌판) ── */
(()=>{
  const spots=[];
  for(const P of PATHS) for(let i=0;i<P.length-1;i++){
    const [ax,az]=P[i], [bx,bz]=P[i+1], L=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.round(L/0.95));
    for(let k=0;k<n;k++){
      const x=ax+(bx-ax)*k/n+rr(-.08,.08), z=az+(bz-az)*k/n+rr(-.08,.08);
      if(onBridge(x,z,0.2)||pondD(x,z)<1.1) continue;
      spots.push([x,z,Math.atan2(bx-ax,bz-az)+rr(-.2,.2)]);
    }
  }
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.82,.07,.82),new THREE.MeshLambertMaterial({color:C('#f7c3a4')}),spots.length);
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), s3=new THREE.Vector3(1,1,1), p3=new THREE.Vector3(), c=new THREE.Color();
  spots.forEach(([x,z,a],i)=>{
    e.set(0,a,0); q.setFromEuler(e); p3.set(x,groundY(x,z)+0.02,z);
    m4.compose(p3,q,s3); tiles.setMatrixAt(i,m4);
    tiles.setColorAt(i,c.setRGB(1,1,1).multiplyScalar(rr(.9,1.04)));
  });
  tiles.receiveShadow=true; scene.add(tiles);
})();

/* ── 소품 ── */
const OBST=[];   // 주인공 코브가 부딪히는 동그라미들 {x,z,r}
const mat=(hex,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:C(hex),roughness:.92,metalness:0,flatShading:true},o));
const WOOD=mat('#bb6b50'), WOOD_D=mat('#8e4c40'), TRUNK=mat('#6e4557');
const ROCK=[mat('#6e5aa8'),mat('#5c4a94'),mat('#8472bd')];
const LEAF=[mat('#f2a33f'),mat('#f7c55a'),mat('#ea8350'),mat('#e9b24a')];
function markStatic(o){ o.traverse(m=>{ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; m.userData.static=true; } }); }
// 카메라와 주인공 코브 사이를 가리는 나무·바위는 점점이 비쳐 보이게 (게임에서 흔히 쓰는 방법)
const SEE_PLAYER={value:new THREE.Vector3(SPAWN.x,0,SPAWN.z)};
function seeThrough(m){
  m.onBeforeCompile=sh=>{
    sh.uniforms.uSee=SEE_PLAYER;
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vSeeW;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvSeeW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vSeeW;\nuniform vec3 uSee;')
      .replace('void main() {',`void main() {
        {
          vec3 tgt=uSee+vec3(0.0,0.65,0.0), ab=tgt-cameraPosition;
          float t=dot(vSeeW-cameraPosition,ab)/dot(ab,ab);
          if(t>0.0&&t<0.93){
            float d=distance(vSeeW,cameraPosition+ab*t), R=1.6;
            float n=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
            if(d<R&&n<(1.0-d/R)*1.7) discard;
          }
        }`);
  };
}
[TRUNK,...ROCK,...LEAF].forEach(seeThrough);
function add(o,x,z,y=0){ o.position.set(x,groundY(x,z)+y,z); markStatic(o); scene.add(o); return o; }
// 빈 자리 찾기 (길·연못·출발점·거품 자리·다른 소품을 피해서)
function freeSpot(minR,maxR,clr){
  for(let i=0;i<80;i++){
    const a=rnd()*Math.PI*2, r=minR+Math.sqrt(rnd())*(maxR-minR);
    const x=Math.cos(a)*r, z=MAP_Z+Math.sin(a)*r;
    if(pathD(x,z)<clr.path||pondD(x,z)<clr.pond||distSpawn(x,z)<clr.spawn||nearHome(x,z,clr.home)) continue;
    if(OBST.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+clr.gap)) continue;
    return [x,z];
  }
  return null;
}

/* 나무다리 (첫 번째 연못을 세로로 건넘, 살짝 아치) */
(()=>{
  const g=new THREE.Group(), n=24;
  for(let i=0;i<n;i++){
    const k=i/(n-1), z=BRIDGE.z0+(BRIDGE.z1-BRIDGE.z0)*k, y=0.12+Math.sin(k*Math.PI)*0.42;
    const plank=new THREE.Mesh(new THREE.BoxGeometry(1.9,.1,.33),i%3?WOOD:WOOD_D);
    plank.position.set(rr(-.03,.03),y,z); plank.rotation.x=Math.cos(k*Math.PI)*0.16; plank.rotation.y=rr(-.03,.03); g.add(plank);
    if(i%4===0||i===n-1) for(const sx of [-1,1]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(.14,.8,.14),WOOD_D); post.position.set(sx*.92,y+.35,z); g.add(post);
    }
  }
  for(const sx of [-1,1]) for(let s=0;s<4;s++){          // 난간
    const k0=s/4, k1=(s+1)/4, z0=BRIDGE.z0+(BRIDGE.z1-BRIDGE.z0)*k0, z1=BRIDGE.z0+(BRIDGE.z1-BRIDGE.z0)*k1;
    const y0=0.12+Math.sin(k0*Math.PI)*0.42+.72, y1=0.12+Math.sin(k1*Math.PI)*0.42+.72;
    const L=Math.hypot(z1-z0,y1-y0), rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,L+.1),WOOD);
    rail.position.set(sx*.92,(y0+y1)/2,(z0+z1)/2); rail.rotation.x=Math.atan2(y1-y0,-(z1-z0)); g.add(rail);
  }
  g.position.x=BRIDGE.x; markStatic(g); scene.add(g);
})();

/* 나무 (둥근 가을 잎 뭉치) */
function tree(x,z,s,ti){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.28,2.3,6),TRUNK); trunk.position.y=1.15; g.add(trunk);
  const br=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,1.1,5),TRUNK); br.position.set(.35,1.9,0); br.rotation.z=-.7; g.add(br);
  for(let i=0;i<5;i++){
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(rr(.75,1.2),0),LEAF[(i+ti)%LEAF.length]);
    b.position.set(rr(-.8,.8),2.55+rr(-.25,.95),rr(-.7,.7)); b.rotation.set(rr(0,3),rr(0,3),0); g.add(b);
  }
  g.scale.setScalar(s); g.rotation.y=rr(0,Math.PI*2); add(g,x,z);
  OBST.push({x,z,r:0.32*s});
}
[[-12.8,-2.4,1.4],[-13.6,-9.6,1.5],[-5.4,-11.6,1.3],[5.6,-8.4,1.6],[11,-6.2,1.4],[9.6,4.6,1.3],[-8.4,7.4,1.3]].forEach(([x,z,s],i)=>tree(x,z,s,i));

/* 코브 몰 (키링 노점: 카운터 · 분홍 줄무늬 차양 · 간판 · 걸려 있는 키링) */
const stallLocal=(lx,lz)=>{ const c=Math.cos(STALL.ry), s=Math.sin(STALL.ry); return [STALL.x+lx*c+lz*s, STALL.z-lx*s+lz*c]; };
(()=>{
  const SW=mat('#c7825c'), SWD=mat('#8e5a44'), AWN=[mat('#ff9ccb'),mat('#fff1e6')];
  const RINGS=['#ff9ccb','#a6d4ff','#aeeccf','#d4bfff'].map(h=>mat(h,{roughness:.5}));
  [SW,SWD,...AWN,...RINGS].forEach(seeThrough);   // 가게 뒤로 가도 코브가 보이게
  const g=new THREE.Group();
  const box=(w,h,d,m,x,y,z)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.position.set(x,y,z); g.add(b); return b; };
  box(2.3,.95,.8,SW,0,.475,.25);                 // 카운터
  box(2.45,.08,.95,SWD,0,.99,.27);               // 카운터 윗판
  for(const sx of [-1.1,1.1]){ box(.12,2.6,.12,SWD,sx,1.3,-.75); box(.12,2.3,.12,SWD,sx,1.15,.62); }   // 기둥
  const slope=Math.atan2(.3,1.55);
  for(let i=0;i<6;i++){                          // 차양 (분홍·크림 줄무늬)
    const x=-1.0+i*.4;
    box(.4,.06,1.75,AWN[i%2],x,2.42,-.05).rotation.x=slope;
    box(.4,.2,.05,AWN[(i+1)%2],x,2.16,.8);       // 앞쪽 늘어진 천
  }
  box(2.1,.03,.03,SWD,0,1.95,.6);                // 키링 거는 봉
  RINGS.forEach((m,i)=>{   // 양옆에 두 개씩 (가운데는 점원 코브 얼굴이 보이게 비움)
    const x=[-.98,-.72,.72,.98][i];
    box(.012,.2,.012,SWD,x,1.84,.6);
    const d=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.035,14),m); d.rotation.x=Math.PI/2; d.position.set(x,1.64,.6); g.add(d);
  });
  // 간판 "코브 몰"
  const c=document.createElement('canvas'); c.width=256; c.height=96;
  const x2=c.getContext('2d');
  const draw=()=>{
    x2.fillStyle='#fff1e6'; x2.fillRect(0,0,256,96);
    x2.fillStyle='#ff9ccb'; x2.fillRect(0,0,256,10); x2.fillRect(0,86,256,10);
    x2.fillStyle='#b0306e'; x2.font='700 58px Gaegu, "Apple SD Gothic Neo", sans-serif'; x2.textAlign='center'; x2.textBaseline='middle';
    x2.fillText('코브 몰',128,52);
  };
  draw();
  const tex=new THREE.CanvasTexture(c); tex.encoding=THREE.sRGBEncoding;
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ draw(); tex.needsUpdate=true; });
  const face=new THREE.MeshStandardMaterial({map:tex,roughness:.9});
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,.08),[SWD,SWD,SWD,SWD,face,SWD]); board.position.set(0,2.95,-.72); g.add(board);
  g.rotation.y=STALL.ry; add(g,STALL.x,STALL.z);
  OBST.push({x:STALL.x,z:STALL.z,r:1.3});
})();
for(let i=0;i<22;i++){ const p=freeSpot(8,31,{path:2.2,pond:1.5,spawn:7,home:3.5,gap:3.2}); if(p) tree(p[0],p[1],rr(1.05,1.7),i+7); }

/* 보랏빛 바위 (각진 덩어리) — 연못가에 몇 개, 나머지는 흩어서 */
function rock(x,z,s,i){
  const geo=i%3===0?new THREE.DodecahedronGeometry(1,0):new THREE.BoxGeometry(1.3,1,1.2);
  const r=new THREE.Mesh(geo,ROCK[i%3]);
  r.scale.set(s*rr(.8,1.25),s*rr(.6,1.0),s*rr(.8,1.2)); r.rotation.set(rr(-.15,.15),rr(0,Math.PI),rr(-.15,.15));
  add(r,x,z,s*0.28);
  OBST.push({x,z,r:s*0.72});
}
let ri=0;
PONDS.forEach(p=>{ for(let k=0;k<4;k++){ const a=rr(0,Math.PI*2); const x=p.x+Math.cos(a)*p.rx*1.05, z=p.z+Math.sin(a)*p.rz*1.05; if(!onBridge(x,z,0.8)&&pathD(x,z)>1.2) rock(x,z,rr(.6,1.1),ri++); } });
for(let i=0;i<20;i++){ const p=freeSpot(6,31,{path:1.5,pond:1.3,spawn:5,home:2.5,gap:1.6}); if(p) rock(p[0],p[1],rr(.55,1.3),ri++); }

/* 등불 (빛나는 초롱 + 번짐) — 길을 따라 띄엄띄엄 */
const lanternGlass=new THREE.MeshStandardMaterial({color:C('#ffe3a3'),emissive:C('#ffb84d'),emissiveIntensity:1.7,roughness:.6});
const LANTERN_M=mat('#3d2f5a');
const lanterns=[];
function lantern(x,z){
  const g=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(.14,1.5,.14),LANTERN_M); post.position.y=.75; g.add(post);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.42,.5,.42),lanternGlass); lamp.position.y=1.75; g.add(lamp);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.38,.3,4),LANTERN_M); cap.position.y=2.14; cap.rotation.y=Math.PI/4; g.add(cap);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.5),LANTERN_M); base.position.y=1.48; g.add(base);
  add(g,x,z);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:C('#ffc36b'),transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.set(2.4,2.4,1); glow.position.set(x,groundY(x,z)+1.75,z); scene.add(glow);
  OBST.push({x,z,r:0.28});
  lanterns.push([x,z]);
}
(()=>{
  let side=1;
  for(const P of PATHS){
    let acc=4;
    for(let i=0;i<P.length-1;i++){
      const [ax,az]=P[i], [bx,bz]=P[i+1], L=Math.hypot(bx-ax,bz-az);
      while(acc<L){
        const k=acc/L, x=ax+(bx-ax)*k, z=az+(bz-az)*k, nx=-(bz-az)/L, nz=(bx-ax)/L;
        const lx=x+nx*1.3*side, lz=z+nz*1.3*side; side=-side;
        if(!onBridge(lx,lz,0.6)&&pondD(lx,lz)>1.25&&distSpawn(lx,lz)>2.2&&!nearHome(lx,lz,1.5)&&lanterns.every(([qx,qz])=>Math.hypot(lx-qx,lz-qz)>6)) lantern(lx,lz);
        acc+=9;
      }
      acc-=L;
    }
  }
  // 출발점에서 가까운 등불 3개만 진짜 빛을 냄 (빛 개수가 많으면 무거워짐)
  lanterns.slice().sort((a,b)=>distSpawn(a[0],a[1])-distSpawn(b[0],b[1])).slice(0,3).forEach(([x,z])=>{
    const pl=new THREE.PointLight(C('#ffb95a'),1.3,6.5,2); pl.position.set(x,groundY(x,z)+1.8,z); scene.add(pl);
  });
})();

/* 벤치 */
function bench(x,z,ry){
  const g=new THREE.Group();
  for(let i=0;i<3;i++){ const s=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,.18),WOOD); s.position.set(0,.55,-.2+i*.2); g.add(s); }
  for(let i=0;i<2;i++){ const s=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,.16),WOOD); s.position.set(0,.85+i*.22,-.34); s.rotation.x=-.15; g.add(s); }
  for(const sx of [-.75,.75]) for(const sz of [-.25,.2]){ const l=new THREE.Mesh(new THREE.BoxGeometry(.1,.55,.1),WOOD_D); l.position.set(sx,.27,sz); g.add(l); }
  g.rotation.y=ry; add(g,x,z);
  OBST.push({x,z,r:0.95});
}
bench(7.9,-3.4,-0.9); bench(-12.4,5,0.6); bench(4.2,17.4,2.8);

/* 푯말 "코브's" */
(()=>{
  const c=document.createElement('canvas'); c.width=256; c.height=128;
  const g=c.getContext('2d');
  const draw=()=>{
    g.fillStyle='#c97a5a'; g.fillRect(0,0,256,128);
    g.fillStyle='rgba(0,0,0,.08)'; for(let i=0;i<5;i++) g.fillRect(0,i*26+10,256,3);
    g.fillStyle='#fff6ea'; g.font='700 60px Gaegu, "Apple SD Gothic Neo", sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText("코브's 🐾",128,68);
  };
  draw();
  const tex=new THREE.CanvasTexture(c); tex.encoding=THREE.sRGBEncoding;
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ draw(); tex.needsUpdate=true; });
  const s=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(.16,1.6,.16),WOOD_D); post.position.y=.8; s.add(post);
  const face=new THREE.MeshStandardMaterial({map:tex,roughness:.9});
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.7,.85,.1),[WOOD,WOOD,WOOD,WOOD,face,WOOD]); board.position.set(0,1.45,.1); s.add(board);
  s.rotation.y=.3; add(s,-3.4,6.4);
  OBST.push({x:-3.4,z:6.4,r:0.4});
})();

/* ── 움직이지 않는 소품은 재질별로 한 덩어리로 합침 (그리기 호출 수백 번 → 십여 번) ── */
(()=>{
  scene.updateMatrixWorld(true);
  const groups=new Map();
  scene.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||!o.userData.static||Array.isArray(o.material)) return;
    if(!groups.has(o.material)) groups.set(o.material,[]);
    groups.get(o.material).push(o);
  });
  for(const [m,list] of groups){
    if(list.length<2) continue;
    const geos=list.map(o=>{ const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
    const n=geos.reduce((s,g)=>s+g.attributes.position.count,0);
    const pos=new Float32Array(n*3), nor=new Float32Array(n*3);
    let off=0;
    for(const g of geos){ pos.set(g.attributes.position.array,off*3); nor.set(g.attributes.normal.array,off*3); off+=g.attributes.position.count; g.dispose(); }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    const mesh=new THREE.Mesh(geo,m); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
    for(const o of list){ o.geometry.dispose(); o.parent.remove(o); }
  }
})();
// 그림자도 움직이는 게 없으니 한 번만 그려 둠 (코브들은 발밑 동그란 그림자로 대신)
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;

/* ── 금빛 풀 (삼각형 잎 한 장씩, 인스턴싱으로 한 번에 그림 + 바람에 살랑 + 코브가 지나가면 눕혀짐) ── */
const U={time:{value:0}, player:{value:new THREE.Vector3(SPAWN.x,0,SPAWN.z)}};
function grassOK(x,z){
  if(Math.hypot(x,z-MAP_Z)>34) return false;
  if(pondD(x,z)<1.2||pathD(x,z)<0.8||onBridge(x,z,0.5)) return false;
  if(nearHome(x,z,1.0)||distSpawn(x,z)<1.4) return false;
  return !OBST.some(o=>Math.hypot(x-o.x,z-o.z)<o.r*0.9);
}
(()=>{
  const blade=new THREE.BufferGeometry();
  blade.setAttribute('position',new THREE.Float32BufferAttribute([-0.07,0,0, 0.07,0,0, 0,1,0],3));
  const base=C('#a45f2e'), tip=C('#f6c95f');
  blade.setAttribute('color',new THREE.Float32BufferAttribute([base.r,base.g,base.b, base.r,base.g,base.b, tip.r,tip.g,tip.b],3));
  blade.computeVertexNormals();
  const gm=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  gm.onBeforeCompile=sh=>{
    sh.uniforms.uTime=U.time; sh.uniforms.uPlayer=U.player;
    sh.vertexShader='uniform float uTime;\nuniform vec3 uPlayer;\n'+sh.vertexShader.replace('#include <project_vertex>',`
      vec4 wp=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        wp=instanceMatrix*wp;
      #endif
      float h=position.y;
      float sway=sin(uTime*1.7+wp.x*0.35+wp.z*0.22)*0.6+sin(uTime*2.9+wp.x*0.9+wp.z*0.4)*0.25;
      wp.x+=sway*0.2*h*h;
      wp.z+=cos(uTime*1.3+wp.z*0.4+wp.x*0.1)*0.07*h*h;
      vec2 dp=wp.xz-uPlayer.xz; float dd=length(dp);
      float push=(1.0-smoothstep(0.15,1.15,dd))*h;
      wp.xz+=(dd>0.001?dp/dd:vec2(0.0))*push*0.5;
      wp.y-=push*0.32;
      vec4 mvPosition=modelViewMatrix*wp;
      gl_Position=projectionMatrix*mvPosition;`);
  };
  const grass=new THREE.InstancedMesh(blade,gm,GRASS_COUNT);
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), s3=new THREE.Vector3(), p3=new THREE.Vector3(), c=new THREE.Color();
  const warm=C('#ffd2b0'), white=new THREE.Color(1,1,1);
  let n=0, tries=0;
  while(n<GRASS_COUNT && tries<GRASS_COUNT*14){
    tries++;
    const x=rr(-35,35), z=MAP_Z+rr(-35,35);
    if(!grassOK(x,z)) continue;
    const d=fbm(x*0.23+11,z*0.23);
    if(d<0.47 && rnd()>0.05) continue;   // 풀숲은 뭉쳐서, 사이사이 빈 땅이 보이게
    e.set(rr(-.2,.2),rr(0,Math.PI*2),rr(-.2,.2)); q.setFromEuler(e);
    s3.set(rr(.8,1.5),rr(.45,1.0)*(0.75+d*0.7),1);
    p3.set(x,groundY(x,z),z);
    m4.compose(p3,q,s3); grass.setMatrixAt(n,m4);
    grass.setColorAt(n,c.copy(white).lerp(warm,rnd()*0.8));
    n++;
  }
  grass.count=n;
  scene.add(grass);
})();

/* ── 꽃 (작은 꽃송이, 인스턴싱) ── */
(()=>{
  const fl=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.11,0),new THREE.MeshLambertMaterial(),FLOWER_COUNT);
  const cols=['#ff9ccb','#fff1f6','#c8a8ff','#ffe08a','#ff8f7a'].map(C);
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), s3=new THREE.Vector3(1,1,1), p3=new THREE.Vector3();
  let n=0, tries=0;
  while(n<FLOWER_COUNT && tries<FLOWER_COUNT*30){
    tries++;
    // 몇 송이씩 뭉쳐 피게
    const cx=rr(-32,32), cz=MAP_Z+rr(-32,32);
    if(!grassOK(cx,cz)||fbm(cx*0.3+40,cz*0.3)<0.5) continue;
    const col=cols[Math.floor(rnd()*cols.length)];
    for(let k=0;k<6&&n<FLOWER_COUNT;k++){
      const x=cx+rr(-.7,.7), z=cz+rr(-.7,.7);
      if(!grassOK(x,z)) continue;
      p3.set(x,groundY(x,z)+rr(.25,.6),z); s3.setScalar(rr(.8,1.3));
      m4.compose(p3,q,s3); fl.setMatrixAt(n,m4); fl.setColorAt(n,col); n++;
    }
  }
  fl.count=n; scene.add(fl);
})();

/* ── 반딧불 ── */
const flies=(()=>{
  const N=IS_TOUCH?50:90, pos=new Float32Array(N*3), base=[];
  for(let i=0;i<N;i++){ const a=rnd()*Math.PI*2, r=Math.sqrt(rnd())*30; base.push([Math.cos(a)*r,rr(.4,3),MAP_Z+Math.sin(a)*r,rr(0,6.3)]); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({map:GLOW,color:C('#ffe6a0'),size:.28,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  scene.add(pts);
  return {pts,pos,base,geo};
})();

/* ══════════ 코브 만들기 (주인공 · 작은 코브 공용) ══════════ */
const CG={
  body:new THREE.SphereGeometry(.68,28,22), eye:new THREE.SphereGeometry(.155,16,12), shine:new THREE.SphereGeometry(.05,10,8),
  nose:new THREE.SphereGeometry(.072,12,8), ear1:new THREE.SphereGeometry(.26,14,10), ear2:new THREE.SphereGeometry(.17,12,8),
  paw:new THREE.SphereGeometry(.2,12,10), foot:new THREE.SphereGeometry(.25,14,10),
};
const EYE_M=new THREE.MeshBasicMaterial({color:C('#171220')}), SHINE_M=new THREE.MeshBasicMaterial({color:0xffffff}), NOSE_M=new THREE.MeshBasicMaterial({color:C('#2a1418')});
function makeCove(body){
  const fur=new THREE.MeshStandardMaterial({color:C(body),roughness:.5,metalness:0,emissive:C(body),emissiveIntensity:.22});
  const group=new THREE.Group(), bodyG=new THREE.Group(); group.add(bodyG);
  bodyG.add(new THREE.Mesh(CG.body,fur));
  for(const ex of [-.2,.2]){
    const eye=new THREE.Mesh(CG.eye,EYE_M); eye.scale.set(1,1,.4); eye.position.set(ex,.07,.6); bodyG.add(eye);
    const sh=new THREE.Mesh(CG.shine,SHINE_M); sh.scale.set(1,1,.4); sh.position.set(ex*.72,.15,.655); bodyG.add(sh);
  }
  const nose=new THREE.Mesh(CG.nose,NOSE_M); nose.scale.set(1,.65,.4); nose.position.set(0,-.18,.635); bodyG.add(nose);
  for(const ex of [-.48,.48]){
    const e1=new THREE.Mesh(CG.ear1,fur); e1.position.set(ex,.42,.08); bodyG.add(e1);
    const e2=new THREE.Mesh(CG.ear2,fur); e2.position.set(ex*.97,.42,.17); bodyG.add(e2);
  }
  const limbs=[];
  for(const [x,y,z] of [[-.75,-.27,.3],[.75,-.27,.3]]){ const p=new THREE.Mesh(CG.paw,fur); p.position.set(x,y,z); p.userData.base={x,y,z}; bodyG.add(p); limbs.push(p); }
  for(const [x,y,z,r] of [[-.25,-.85,0,.1],[.25,-.85,0,-.1]]){ const f=new THREE.Mesh(CG.foot,fur); f.scale.set(1.12,.6,1.32); f.rotation.y=r; f.position.set(x,y,z); f.userData.base={x,y,z}; bodyG.add(f); limbs.push(f); }
  return {group,bodyG,limbs,fur};
}
function poseG(g,fn){ g.limbs.forEach((p,i)=>{ const b=p.userData.base, o=fn(i); p.position.set(b.x+(o[0]||0),b.y+(o[1]||0),b.z+(o[2]||0)); }); }
// 발밑 동그란 그림자 (그림자 맵을 매 프레임 다시 그리지 않으려고 가짜 그림자 사용)
const BLOB_GEO=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const BLOB_TEX=(()=>{
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(0,0,0,1)'); r.addColorStop(.55,'rgba(0,0,0,.55)'); r.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=r; g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
})();
function makeBlob(){
  const b=new THREE.Mesh(BLOB_GEO,new THREE.MeshBasicMaterial({map:BLOB_TEX,color:C('#5a2f5c'),transparent:true,opacity:0,depthWrite:false}));
  b.renderOrder=1; b.visible=false; scene.add(b); return b;
}

/* ══════════ 주인공 코브 ══════════ */
const player=(()=>{
  const g=makeCove('#ff9ccb');
  g.group.scale.setScalar(PLAYER_S); g.group.visible=false; scene.add(g.group);
  const tag=document.createElement('div'); tag.className='player-tag'; tag.textContent='🐾 코브'; tagsEl.appendChild(tag);
  return {g,tag,blob:makeBlob(),state:'hidden',t:0,
    pos:new THREE.Vector3(SPAWN.x,0,SPAWN.z),dir:new THREE.Vector2(0,1),speed:0,heading:0,gait:0,dust:0,idle:0,joy:0,dest:null,
    colorName:'분홍',colFrom:new THREE.Color(),colTo:new THREE.Color(),colT:1,rainbow:false,spinT:0};
})();
// 목적지 표시 (땅에 분홍 동그라미)
const marker=new THREE.Mesh(new THREE.RingGeometry(.38,.55,36).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:C('#ff7fb6'),transparent:true,opacity:0,depthWrite:false}));
marker.renderOrder=2; marker.visible=false; scene.add(marker);

function surfaceY(x,z){ return onBridge(x,z,-0.25)?bridgeTop(z):Math.max(0,groundY(x,z)); }
function blockedAt(x,z){
  if(Math.hypot(x,z-MAP_Z)>WALK_R) return true;
  if(pondD(x,z)<1.02 && !(Math.abs(x-BRIDGE.x)<0.75 && z<BRIDGE.z0+0.4 && z>BRIDGE.z1-0.4)) return true;
  return false;
}
function collide(nx,nz,ox,oz){
  if(blockedAt(nx,nz)){ if(!blockedAt(nx,oz)) nz=oz; else if(!blockedAt(ox,nz)) nx=ox; else return [ox,oz]; }
  for(const o of OBST){
    const dx=nx-o.x, dz=nz-o.z, d=Math.hypot(dx,dz), m=o.r+PLAYER_R;
    if(d<m&&d>1e-4){ nx=o.x+dx/d*m; nz=o.z+dz/d*m; }
  }
  return blockedAt(nx,nz)?[ox,oz]:[nx,nz];
}
const keys=new Set();
function updatePlayer(dt,T){
  const P=player, grp=P.g.group;
  if(P.state==='hidden') return;
  P.t+=dt;
  const top=surfaceY(P.pos.x,P.pos.z), baseY=top+PLAYER_S;
  if(P.state==='emerge'){   // 땅에서 쏙
    const k=Math.min(P.t/0.55,1);
    grp.position.set(P.pos.x,baseY-1.1*(1-easeOutBack(k)),P.pos.z);
    grp.rotation.set(0,P.heading,0);
    poseG(P.g,i=>i<2?[0,.15*Math.sin(k*Math.PI),0]:[0,0,0]);
    if(k>=1) P.state='walk';
    updateCoveColor(dt,T);
    updatePlayerExtras(0);
    return;
  }
  
  // 어디로 갈지: 키보드 > 클릭/끌기 목적지
  let want=0, dx=0, dz=0;
  if(keys.size){
    dx=(keys.has('r')?1:0)-(keys.has('l')?1:0); dz=(keys.has('d')?1:0)-(keys.has('u')?1:0);
    const l=Math.hypot(dx,dz); if(l){ dx/=l; dz/=l; want=RUN; }
    P.dest=null;
  } else if(P.dest){
    const ex=P.dest.x-P.pos.x, ez=P.dest.z-P.pos.z, d=Math.hypot(ex,ez);
    if(d<0.18&&!pointerHeld){ P.dest=null; }
    else if(d>0.18){ dx=ex/d; dz=ez/d; want=Math.min(RUN,d*3+0.8); }
  }
  if(want>0) P.dir.set(dx,dz);
  P.speed+=(want-P.speed)*Math.min(1,dt*(want>P.speed?5:9));
  if(P.speed<0.02) P.speed=0;
  const step=P.speed*dt;
  if(step>0){
    const ox=P.pos.x, oz=P.pos.z;
    const [nx,nz]=collide(ox+P.dir.x*step,oz+P.dir.y*step,ox,oz);
    const moved=Math.hypot(nx-ox,nz-oz);
    P.pos.x=nx; P.pos.z=nz;
    if(want>0&&moved<step*0.25&&!pointerHeld&&!keys.size){ P.dest=null; }   // 막혀서 못 가면 멈춤
    if(moved>0.0005) P.heading=lerpAngle(P.heading,Math.atan2(nx-ox,nz-oz),Math.min(1,dt*10));
  }
  const walking=P.speed>0.35, sp=Math.min(1,P.speed/RUN);
  if(walking){ P.gait+=dt*(6+P.speed*2); P.idle=0; } else P.idle+=dt;
  if(!walking&&P.idle>3.5){   // 한참 서 있으면 카메라(나)를 쳐다봄
    P.heading=lerpAngle(P.heading,Math.atan2(camera.position.x-P.pos.x,camera.position.z-P.pos.z),Math.min(1,dt*2));
  }
  const bob=walking?Math.abs(Math.sin(P.gait))*0.1*(0.5+sp*0.5):Math.sin(T*1.6)*0.015;
  const joy=P.joy>0?Math.sin((1-P.joy/0.35)*Math.PI)*0.22:0; P.joy=Math.max(0,P.joy-dt);   // 아이템 주우면 콩
  grp.position.set(P.pos.x,surfaceY(P.pos.x,P.pos.z)+PLAYER_S+bob+joy,P.pos.z);
  const spin=P.spinT>0?easeInOutCubic(1-P.spinT/0.7)*Math.PI*2:0; P.spinT=Math.max(0,P.spinT-dt);   // 색이 바뀔 때 한 바퀴 빙글
  grp.rotation.set(0,P.heading+spin,0);
  P.g.bodyG.rotation.set(walking?0.1*sp:0,0,walking?Math.sin(P.gait)*0.07:Math.sin(T*.8)*0.03);
  poseG(P.g,i=>{
    const ph=(i%2)*Math.PI;
    if(i>=2){ const s=Math.sin(P.gait+ph); return walking?[0,Math.max(0,s)*0.2,s*0.16]:[0,0,0]; }
    const s=Math.sin(P.gait+ph+Math.PI); return walking?[0,Math.abs(s)*0.04,s*0.13]:[0,Math.sin(T*1.3+i)*.02,0];
  });
  // 달릴 때 발밑 흙먼지
  P.dust-=dt;
  if(walking&&P.speed>3&&P.dust<=0){ puff(P.pos.x-P.dir.x*.4,P.pos.z-P.dir.y*.4,0.45); P.dust=0.28; }
  updateCoveColor(dt,T);
  updatePlayerExtras(bob);
}
// 히든 아이템으로 바뀐 색으로 부드럽게 물듦 (무지개 코브는 계속 색이 흐름)
const rainbowCol=new THREE.Color();
function updateCoveColor(dt,T){
  const P=player, fur=P.g.fur;
  if(!P.rainbow&&P.colT>=1) return;
  if(P.colT<1) P.colT=Math.min(1,P.colT+dt/0.6);
  const k=easeInOutCubic(P.colT);
  if(P.rainbow){ rainbowCol.setHSL((T*0.12)%1,0.8,0.74).convertSRGBToLinear(); fur.color.copy(P.colFrom).lerp(rainbowCol,k); }
  else fur.color.copy(P.colFrom).lerp(P.colTo,k);
  paintFur();
}
const RAINBOW={name:'무지개',rainbow:true};
const findLook=name=>name==='무지개'?RAINBOW:COVE_COLORS.find(c=>c.name===name)||null;
function paintFur(){
  const P=player, fur=P.g.fur;
  fur.emissive.copy(fur.color); marker.material.color.copy(fur.color);
  const c=fur.color.clone().convertLinearToSRGB();
  P.tag.style.borderColor=`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},.6)`;
}
function saveLook(pick){ const W=window.covvWallet; if(!W) return; W.state.look=pick.name; if(pick.rainbow) W.state.rainbow=true; }
// 가방에 저장된 색을 바로 입힘 (새로고침해도 코브 색 유지, 사탕으로 고른 색도 여기로)
function applyLook(name){
  const P=player, pick=findLook(name); if(!pick) return false;
  P.rainbow=!!pick.rainbow; P.colorName=pick.name; P.colT=1;
  if(pick.rainbow){ P.colFrom.copy(P.g.fur.color); P.colT=1; }   // 무지개는 매 프레임 색이 흐름 (바로 무지개로)
  else { P.g.fur.color.copy(C(pick.hex)); paintFur(); }
  saveLook(pick);
  return true;
}
function changeCoveColor(force){
  const P=player;
  let pick=force?findLook(force):null;
  if(!pick){
    if(!P.rainbow&&rnd()<RAINBOW_CHANCE) pick=RAINBOW;
    else { const list=COVE_COLORS.filter(c=>c.name!==P.colorName); pick=list[Math.floor(rnd()*list.length)]; }
  }
  saveLook(pick);
  P.colFrom.copy(P.g.fur.color); P.colT=0; P.rainbow=!!pick.rainbow; P.colorName=pick.name;
  if(!pick.rainbow) P.colTo.copy(C(pick.hex));
  P.spinT=0.7; P.joy=0.35;
  const head=sv.set(P.pos.x,P.g.group.position.y+0.3,P.pos.z);
  burst(head,0.7); burst(head,0.45); puff(P.pos.x,P.pos.z,.8);
  sfx.magic();
  popText(sv.set(P.pos.x,P.g.group.position.y+PLAYER_S*1.6,P.pos.z),(pick.rainbow?'🌈 ':'🎨 ')+pick.name+' 코브!','item-text color-text');
  return pick.name;
}
function updatePlayerExtras(){
  const P=player;
  const y=surfaceY(P.pos.x,P.pos.z);
  P.blob.visible=true; P.blob.position.set(P.pos.x,y+0.03,P.pos.z); P.blob.scale.set(1.3,1,1.3); P.blob.material.opacity=0.45;
  U.player.value.set(P.pos.x,y,P.pos.z); SEE_PLAYER.value.set(P.pos.x,y,P.pos.z);
  if(P.dest){
    marker.visible=true; marker.position.set(P.dest.x,surfaceY(P.dest.x,P.dest.z)+0.06,P.dest.z);
    const pulse=1+Math.sin(U.time.value*6)*0.12; marker.scale.set(pulse,1,pulse); marker.material.opacity=0.85;
  } else if(marker.visible){
    marker.material.opacity-=0.08; if(marker.material.opacity<=0) marker.visible=false;
  }
}

/* ══════════ 작은 코브 + 거품 ══════════ */
const BUBBLE_GEO=new THREE.SphereGeometry(1,40,28);
function makeBubbleMat(tint){
  return new THREE.ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{uTime:U.time, uOpacity:{value:1}, uTint:{value:new THREE.Color(tint)}},
    vertexShader:`varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); vY=position.y; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform float uTime; uniform float uOpacity; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying float vY;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
      void main(){
        vec3 N=normalize(vN), V=normalize(vV);
        float f=1.0-clamp(dot(N,V),0.0,1.0);
        float rim=pow(f,2.3);
        vec3 irid=hue(f*1.3+vY*0.25+uTime*0.06);
        vec3 col=mix(uTint,irid,0.45)*(0.8+rim*0.5);
        vec3 L=normalize(vec3(-0.45,0.75,0.5));
        float spec=pow(clamp(dot(reflect(-L,N),V),0.0,1.0),42.0);
        float a=(0.08+rim*0.72)*uOpacity;
        gl_FragColor=vec4(col+spec*1.2,clamp(a+spec*0.9*uOpacity,0.0,1.0));
      }`
  });
}

/* ── 낙하산 (작은 코브마다 하나 — 거품이 터지면 손에서 활짝 펼침) ── */
const CHUTE_GLOW=sh=>{   // 해질녘에 어둡지 않게 살짝 스스로 빛남
  sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*0.3;');
};
const CHUTE_HANDS=[0,.35,.2];   // 낙하산 줄을 잡는 두 손 사이 (코브 몸 기준)
function makeChute(body){
  // 8쪽 돔 — 코브 색과 크림색 줄무늬
  const geo=new THREE.SphereGeometry(1,8,3,0,Math.PI*2,0,Math.PI*.42).toNonIndexed();
  const p=geo.attributes.position, col=new Float32Array(p.count*3), cA=C(body).multiplyScalar(.78), cB=C('#fff4f8');   // 줄무늬가 또렷하게 코브 색은 조금 진하게
  for(let i=0;i<p.count;i+=3){
    const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3, cz=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    const c=Math.floor(((Math.atan2(cz,-cx)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%2?cB:cA;
    for(let j=0;j<3;j++){ col[(i+j)*3]=c.r; col[(i+j)*3+1]=c.g; col[(i+j)*3+2]=c.b; }
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const RIM_Y=1.75, RIM_R=1.65*Math.sin(Math.PI*.42);   // 손 위로 끝단 높이, 끝단 반지름
  geo.scale(1.65,1.05,1.65); geo.translate(0,RIM_Y-1.05*Math.cos(Math.PI*.42),-CHUTE_HANDS[2]);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide,roughness:.75,metalness:0,transparent:true});
  mat.onBeforeCompile=CHUTE_GLOW;
  const canopy=new THREE.Mesh(geo,mat);
  // 줄 6가닥: 왼쪽 끝단 3곳 → 왼손, 오른쪽 3곳 → 오른손
  const lp=[];
  for(const d of [0,45,315,135,180,225]){
    const a=d*Math.PI/180, x=-Math.cos(a)*RIM_R, z=Math.sin(a)*RIM_R-CHUTE_HANDS[2];
    lp.push(x,RIM_Y,z, x<0?-.6:.6,0,0);
  }
  const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
  const lineM=new THREE.LineBasicMaterial({color:C('#6b4a5e'),transparent:true});
  const group=new THREE.Group(); group.add(canopy,new THREE.LineSegments(lg,lineM));
  group.position.fromArray(CHUTE_HANDS); group.visible=false;
  return {group,mat,lineM,fold:-1,owner:null,p0:new THREE.Vector3(),s0:new THREE.Vector3(),q0:new THREE.Quaternion()};
}
function resetChute(ch){
  if(ch.owner&&ch.group.parent!==ch.owner) ch.owner.add(ch.group);   // 접히는 동안 떼어 놨던 낙하산을 다시 코브에 달아 둠
  ch.group.visible=false; ch.fold=-1;
  ch.group.position.fromArray(CHUTE_HANDS); ch.group.rotation.set(0,0,0); ch.group.scale.set(1,1,1);
  ch.mat.opacity=ch.lineM.opacity=1;
}

let hoverCv=null, hoverAmb=null, navCv=null, paused=false;
const coves=COVES.map((c,i)=>{
  const g=makeCove(c.body);
  g.group.scale.setScalar(S); g.group.visible=false; scene.add(g.group);
  const chute=makeChute(c.body); chute.owner=g.group; g.group.add(chute.group);
  const bubble=new THREE.Mesh(BUBBLE_GEO,makeBubbleMat(c.tint)); bubble.visible=false; bubble.renderOrder=5; scene.add(bubble);
  const tag=document.createElement('button');
  tag.type='button'; tag.className='bubble-tag';
  tag.innerHTML=`<span aria-hidden="true">${c.emoji}</span> ${c.label}`;
  tag.setAttribute('aria-label',`${c.label} 거품 터트리기`);
  tagsEl.appendChild(tag);
  const cv={c,i,g,bubble,chute,blob:makeBlob(),tag,state:'idle',t:0,delay:0,phase:i*1.7,
    home:new THREE.Vector3().fromArray(c.home),ground:new THREE.Vector3(c.home[0],0,c.home[2]),pos:new THREE.Vector3(),
    vy:0,fx:0,fy:0,fz:0,faceY:0,chuteAt:0,squash:0,go:null,bScale:0,hover:0,burstT:-1,shown:false};
  tag.addEventListener('click',()=>popCove(cv,true));
  tag.addEventListener('mouseenter',()=>{ hoverCv=cv; });
  tag.addEventListener('mouseleave',()=>{ if(hoverCv===cv) hoverCv=null; });
  return cv;
});
function setState(cv,s){ cv.state=s; cv.t=0; }

/* ── 이징 ── */
function easeOutBack(k){ return 1+2.70158*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2); }
const easeOutElastic=k=>k<=0?0:k>=1?1:Math.pow(2,-10*k)*Math.sin((k*10-0.75)*(2*Math.PI/3))+1;
const easeInOutCubic=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;

/* ── 작은 코브 자세 ── */
function faceCam(cv,dt,speed){
  const g=cv.g.group, want=Math.atan2(camera.position.x-g.position.x,camera.position.z-g.position.z);
  g.rotation.y=lerpAngle(g.rotation.y,want,Math.min(1,dt*speed));
}
function ride(cv,T){   // 거품 속: 발 동동 + 앞발 헤엄
  const g=cv.g;
  g.group.position.set(cv.pos.x,cv.pos.y-0.04,cv.pos.z);
  g.group.rotation.set(0,Math.sin(T*.5+cv.phase)*.55,0);
  g.bodyG.rotation.set(0,0,Math.sin(T*1.4+cv.phase)*.08);
  poseG(g,i=>i<2?[0,Math.sin(T*6+cv.phase+i*Math.PI)*.08,0]:[0,-.04+Math.sin(T*3.2+i)*.04,0]);
}

/* ── 거품 터짐 효과 ── */
const bursts=[], puffs=[];
const RING_GEO=new THREE.RingGeometry(.5,.72,32);
function burst(pos,R){
  const N=18, arr=new Float32Array(N*3), vel=[];
  for(let i=0;i<N;i++){
    const u=rr(-1,1), a=rr(0,Math.PI*2), s=Math.sqrt(1-u*u), dx=s*Math.cos(a), dy=u, dz=s*Math.sin(a);
    arr.set([pos.x+dx*R,pos.y+dy*R,pos.z+dz*R],i*3);
    const sp=rr(2.2,4.2)/POP_SLOW; vel.push([dx*sp,dy*sp+1.4/POP_SLOW,dz*sp]);
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({map:GLOW,size:.2,transparent:true,depthWrite:false,color:0xffffff}));
  scene.add(pts); bursts.push({pts,vel,t:0});
}
function puff(x,z,size=1){
  const m=new THREE.Mesh(RING_GEO,new THREE.MeshBasicMaterial({color:C('#fde3cf'),transparent:true,opacity:.85,depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(x,surfaceY(x,z)+.04,z); scene.add(m); puffs.push({m,t:0,size});
}
function popText(pos,text='펑!',cls=''){
  const s=screenPos(pos), r=stage.getBoundingClientRect(), el=document.createElement('span');
  el.className='pop-text'+(cls?' '+cls:''); el.textContent=text;
  el.style.left=(s.x-r.left)+'px'; el.style.top=(s.y-r.top-20)+'px';
  tagsEl.appendChild(el); el.addEventListener('animationend',()=>el.remove());
}

/* ── 효과음 (파일 없이 WebAudio로 합성, 첫 클릭 전엔 안 남) ── */
const sfx=(()=>{
  let ctx=null, unlocked=false, on=true;
  try{ on=localStorage.getItem('covv-sound')!=='off'; }catch(e){}
  const ac=()=>{
    if(!unlocked) return null;
    if(!ctx){ const A=window.AudioContext||window.webkitAudioContext; if(!A) return null; ctx=new A(); }
    if(ctx.state==='suspended') ctx.resume();
    return ctx;
  };
  function tone(f0,f1,dur,vol,type='sine',delay=0){
    const a=ac(); if(!a||!on) return;
    const t=a.currentTime+delay, o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+0.02);
  }
  function noise(dur,freq,vol,type){
    const a=ac(); if(!a||!on) return;
    const b=a.createBuffer(1,Math.floor(a.sampleRate*dur),a.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const s=a.createBufferSource(), f=a.createBiquadFilter(), g=a.createGain();
    s.buffer=b; f.type=type; f.frequency.value=freq; g.gain.value=vol;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  return {
    unlock(){ unlocked=true; },
    pop(){ tone(900,170,0.11,0.2); noise(0.04,1800,0.12,'highpass'); },
    chute(){ tone(240,420,0.18,0.07,'triangle'); noise(0.16,650,0.08,'bandpass'); },   // 낙하산 펄럭
    land(){ tone(190,90,0.12,0.12); },                                                  // 사뿐 착지
    blip(){ tone(520,860,0.07,0.05,'triangle'); },
    tap(){ tone(700,1000,0.05,0.04,'triangle'); },
    soft(v){ tone(1250,480,0.07,v); },                     // 빈 거품이 저절로 터질 때 (작게)
    tink(){ tone(1500,2100,0.05,0.03,'triangle'); },       // 아이템이 땅에 톡
    chime(){ tone(880,1175,0.09,0.07,'triangle'); tone(1320,1760,0.16,0.06,'triangle',0.08); },   // 아이템 주움
    sparkle(){ tone(1760,2640,0.12,0.03,'triangle'); tone(2350,3520,0.14,0.025,'triangle',0.07); },   // 히든 아이템이 땅에 닿음
    magic(){ [784,988,1175,1568,1976].forEach((f,i)=>tone(f,f*1.01,0.2,0.055,'triangle',i*0.07)); },   // 코브 색이 바뀜
    get on(){ return on; },
    toggle(){ on=!on; try{ localStorage.setItem('covv-sound',on?'on':'off'); }catch(e){} return on; },
  };
})();
const soundBtn=document.getElementById('soundBtn');
if(soundBtn){
  const paint=()=>{ soundBtn.textContent=sfx.on?'🔊':'🔇'; soundBtn.setAttribute('aria-pressed',String(sfx.on)); };
  paint(); soundBtn.addEventListener('click',()=>{ sfx.unlock(); sfx.toggle(); paint(); });
}

/* ── 거품 터트리기 ── */
function popCove(cv,navigate){
  if(cv.state!=='float'&&cv.state!=='rise') return false;
  sfx.unlock(); sfx.pop();
  cv.burstT=0; burst(cv.pos,BUBBLE_R*cv.bScale); popText(cv.pos);
  // 여러 개를 연달아 터트리면 마지막에 누른 코브의 화면으로 감
  if(navigate){ if(navCv&&navCv!==cv) navCv.go=null; navCv=cv; cv.go=cv.c.id; } else cv.go=null;
  const g=cv.g.group;
  cv.vy=0.65; cv.fx=g.position.x; cv.fy=g.position.y; cv.fz=g.position.z; cv.faceY=g.rotation.y;
  cv.chuteAt=g.position.y-FOOT>1.3?0.3:0;   // 높이 있으면 살짝 뚝 떨어졌다가 펼침, 낮으면 바로 펼침
  if(hoverCv===cv) hoverCv=null;
  setState(cv,'fall');
  return true;
}
function respawn(cv){
  const g=cv.g.group;
  cv.ground.set(g.position.x,0,g.position.z);
  g.position.y=FOOT; g.rotation.set(0,g.rotation.y,0); cv.squash=0; resetChute(cv.chute);
  cv.bubble.material.uniforms.uOpacity.value=1; cv.bubble.visible=true; cv.bScale=0; cv.burstT=-1;
  cv.go=null; if(navCv===cv) navCv=null;
  setState(cv,'inflate');
}
function goScreen(cv){   // 떨어진 코브가 땅에 닿는 순간 화면 전환
  const id=cv.go; cv.go=null;
  const sp=screenPos(cv.g.group.position);
  const res=window.covvOpenScreen?window.covvOpenScreen(id,{x:sp.x,y:sp.y}):false;
  Promise.resolve(res).then(ok=>{ if(navCv===cv) navCv=null; if(!ok&&!paused&&cv.state==='landed') respawn(cv); });
}

/* ── 매 프레임: 작은 코브 한 마리 ── */
const hang=new THREE.Vector3(), foldQ=new THREE.Quaternion(), Z_AXIS=new THREE.Vector3(0,0,1);
function updateCove(cv,dt,T){
  const g=cv.g, grp=g.group, R=BUBBLE_R;
  cv.t+=dt;
  switch(cv.state){
    case 'wait':
      cv.delay-=dt;
      if(cv.delay<=0){ setState(cv,'emerge'); grp.visible=true; grp.rotation.set(0,0,0); puff(cv.ground.x,cv.ground.z); sfx.blip(); }
      break;
    case 'emerge':{   // 땅에서 쏙
      const k=Math.min(cv.t/0.5,1);
      grp.position.set(cv.ground.x,FOOT-1.1*(1-easeOutBack(k)),cv.ground.z);
      grp.scale.setScalar(S*(0.35+0.65*Math.min(1,k*1.3)));
      poseG(g,i=>i<2?[0,.12*Math.sin(k*Math.PI),0]:[0,0,0]);
      faceCam(cv,dt,8);
      if(k>=1) setState(cv,'inflate');
      break;
    }
    case 'inflate':{  // 거품이 부풀며 코브를 감쌈
      const k=Math.min(cv.t/0.6,1);
      cv.bScale=easeOutElastic(k);
      cv.pos.set(cv.ground.x,R+0.05,cv.ground.z);
      grp.position.set(cv.ground.x,FOOT+(cv.pos.y-0.04-FOOT)*easeInOutCubic(k),cv.ground.z);
      grp.scale.setScalar(S);
      cv.bubble.visible=true;
      faceCam(cv,dt,4);
      if(k>=1) setState(cv,'rise');
      break;
    }
    case 'rise':{     // 둥실 떠오름
      const k=Math.min(cv.t/2.2,1), e=easeInOutCubic(k);
      cv.pos.set(cv.ground.x+(cv.home.x-cv.ground.x)*e+Math.sin(cv.t*2.2+cv.phase)*0.12*(1-k),
                 R+0.05+(cv.home.y-R-0.05)*e,
                 cv.ground.z+(cv.home.z-cv.ground.z)*e);
      ride(cv,T);
      if(k>=1) setState(cv,'float');
      break;
    }
    case 'float':{    // 제자리에서 두둥실
      const wx=cv.home.x+Math.sin(T*.8+cv.phase)*.12, wy=cv.home.y+Math.sin(T*1.25+cv.phase)*.16, wz=cv.home.z+Math.cos(T*.6+cv.phase)*.08;
      const k=Math.min(1,dt*3); cv.pos.x+=(wx-cv.pos.x)*k; cv.pos.y+=(wy-cv.pos.y)*k; cv.pos.z+=(wz-cv.pos.z)*k;
      ride(cv,T);
      break;
    }
    case 'fall':{     // 거품이 터지면 → 살짝 뚝 → 낙하산 활짝 → 살랑살랑 내려옴
      const ch=cv.chute;
      if(cv.t<cv.chuteAt) cv.vy-=9*dt;
      else {
        if(!ch.group.visible){ resetChute(ch); ch.group.visible=true; sfx.chute(); }
        // 남은 높이 ÷ 남은 시간으로 속도를 맞춰서, 거품이 높든 낮든 PARA_TIME에 딱 착지
        const want=Math.min(4.5,Math.max(1.2,(cv.fy-FOOT)/Math.max(0.2,PARA_TIME-cv.t)));
        cv.vy+=(-want-cv.vy)*Math.min(1,dt*6);   // 낙하산이 공기를 받아 부드럽게
      }
      cv.fy+=cv.vy*dt;
      // 손에서 낙하산이 확 펼쳐짐 (옆으로 넓어지며 위로 솟음) + 내려오는 동안 살짝 숨쉬듯 부풀었다 오므라듦
      const ko=ch.group.visible?Math.min(1,(cv.t-cv.chuteAt)/0.5):0;
      if(ch.group.visible){
        const w=(0.08+0.92*easeOutBack(ko))*(1+Math.sin(T*5+cv.phase)*0.025*ko);
        ch.group.scale.set(w,0.25+0.75*Math.min(1,ko*1.8),w);
      }
      // 낙하산에 매달려 흔들흔들 (땅에 가까워지면 잦아들어 똑바로 착지)
      const ts=cv.t-cv.chuteAt, amp=0.17*ko*Math.min(1,Math.max(0,cv.fy-FOOT)/1.3);
      cv.faceY=lerpAngle(cv.faceY,Math.atan2(camera.position.x-grp.position.x,camera.position.z-grp.position.z),Math.min(1,dt*2));
      grp.rotation.set(Math.sin(ts*1.9+cv.phase)*amp*0.35,cv.faceY,Math.sin(ts*2.6+cv.phase)*amp);
      hang.set(0,CHUTE_L,0).applyEuler(grp.rotation);   // 축 = 낙하산 → 코브가 그 아래에서 흔들림
      grp.position.set(cv.fx-hang.x,cv.fy+CHUTE_L-hang.y,cv.fz-hang.z);
      g.bodyG.rotation.set(0,0,0);
      poseG(g,i=>i<2?[i?-.15:.15,.62,-.1]:[0,-.05+Math.sin(T*4+i*2)*.04,Math.sin(T*3+i*Math.PI)*.06]);   // 두 손으로 줄 잡고 발 동동
      if(grp.position.y<=FOOT){   // 사뿐 착지 → 낙하산은 접히며 사라짐
        grp.position.y=FOOT; cv.vy=0; cv.squash=.55;
        puff(grp.position.x,grp.position.z,.8); sfx.land();
        if(ch.group.visible){   // 낙하산은 코브에서 떼어 제자리에서 접음 (착지 찌그러짐·콩 점프에 끌려 출렁이지 않게)
          ch.fold=0; scene.attach(ch.group);
          ch.p0.copy(ch.group.position); ch.s0.copy(ch.group.scale); ch.q0.copy(ch.group.quaternion);
        }
        setState(cv,'landed');
        if(cv.go) goScreen(cv);   // 땅에 닿는 바로 그 순간 화면 전환 시작
      }
      break;
    }
    case 'landed':{   // 착지 → 똑바로 서서 콩
      grp.rotation.x*=Math.max(0,1-dt*10); grp.rotation.z*=Math.max(0,1-dt*10);
      faceCam(cv,dt,6);
      const hop=cv.t>.3&&cv.t<.62 ? Math.sin((cv.t-.3)/.32*Math.PI)*.35 : 0;
      grp.position.y=FOOT+hop;
      poseG(g,i=>i<2?[0,hop>0?.25:0,.05]:[0,0,0]);
      if(!cv.go&&navCv!==cv&&cv.t>2.2) respawn(cv);   // 그냥 터트려 본 코브는 잠시 뒤 다시 거품 타고 올라감
      break;
    }
  }
  // 착지 후 낙하산이 옆으로 스르르 접히며 사라짐
  const ch=cv.chute;
  if(ch.fold>=0&&ch.group.visible){
    ch.fold+=dt; const k=Math.min(ch.fold/0.7,1), e=easeInOutCubic(k);
    ch.group.scale.set(ch.s0.x*(1+0.25*e),ch.s0.y*(1-0.8*e),ch.s0.z*(1+0.25*e));
    ch.group.quaternion.copy(ch.q0).multiply(foldQ.setFromAxisAngle(Z_AXIS,(cv.i%2?1:-1)*0.9*e));   // 옆으로 스르르 눕듯이
    ch.group.position.set(ch.p0.x,ch.p0.y-0.25*e,ch.p0.z);
    ch.mat.opacity=ch.lineM.opacity=1-k;
    if(k>=1) resetChute(ch);
  }
  // 착지 찌그러짐
  if(cv.squash>0){ cv.squash=Math.max(0,cv.squash-dt*4); const s=cv.squash; grp.scale.set(S*(1+s*.25),S*(1-s*.3),S*(1+s*.25)); }
  else if(cv.state!=='emerge') grp.scale.setScalar(S);
  // 발밑 그림자: 땅 가까이 있을 때만 또렷
  if(grp.visible){
    const x=grp.position.x, z=grp.position.z, h=Math.max(0,grp.position.y-FOOT);
    const sz=1.25+h*0.18;
    cv.blob.visible=true; cv.blob.position.set(x,groundY(x,z)+0.03,z); cv.blob.scale.set(sz,1,sz);
    cv.blob.material.opacity=Math.max(0,0.42-h*0.13);
  }
  // 거품
  const b=cv.bubble;
  if(cv.burstT>=0){
    cv.burstT+=dt; const k=Math.min(cv.burstT/(0.14*POP_SLOW),1);
    b.scale.setScalar(R*cv.bScale*(1+0.35*k)); b.material.uniforms.uOpacity.value=1-k;
    if(k>=1){ b.visible=false; cv.burstT=-1; }
  } else if(b.visible){
    cv.hover+=((hoverCv===cv?1:0)-cv.hover)*Math.min(1,dt*10);
    const w=Math.sin(T*3+cv.phase)*.025, s=R*cv.bScale*(1+cv.hover*.07);
    b.position.copy(cv.pos); b.scale.set(s*(1+w),s*(1-w),s*(1+w));
  }
}

/* ══════════ 빈 거품 + 아이템 ══════════
   들판 곳곳 땅에서 빈 거품이 쏙 나와 둥실 떠오르다 천장(CEIL_Y)에 닿으면 펑 → 가끔 아이템을 떨굼
   (눌러서 먼저 터트려도 됨). 아이템은 바닥에서 빙글빙글 반짝이고, 코브가 지나가면 주워짐 */

// 아이템 모양: 부품마다 색을 정점에 칠해서 한 덩어리로 (아이템 하나 = 그리기 1번)
function colorGeo(parts){
  const list=parts.map(([g,hex])=>{
    const n=g.index?g.toNonIndexed():g, c=C(hex), cnt=n.attributes.position.count, col=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
    return [n,col];
  });
  const total=list.reduce((s,[g])=>s+g.attributes.position.count,0);
  const pos=new Float32Array(total*3), nor=new Float32Array(total*3), col=new Float32Array(total*3);
  let o=0;
  for(const [g,c] of list){ pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); col.set(c,o*3); o+=g.attributes.position.count; }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.computeBoundingSphere();
  return geo;
}
const EXT={depth:.1,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:1,curveSegments:8};
const ITEMS=[
  {id:'star', emoji:'⭐', w:120, glow:'#ffd76a', geo:(()=>{
    const sh=new THREE.Shape();
    for(let i=0;i<10;i++){ const a=Math.PI/2+i*Math.PI/5, r=i%2?.13:.3; i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r); }
    return colorGeo([[new THREE.ExtrudeGeometry(sh,EXT).translate(0,0,-.05),'#ffd24a']]);
  })()},
  {id:'heart', emoji:'💗', w:100, glow:'#ff9cc8', geo:(()=>{
    const sh=new THREE.Shape();
    sh.moveTo(0,-.27);
    sh.bezierCurveTo(-.06,-.2,-.3,-.08,-.3,.06); sh.bezierCurveTo(-.3,.24,-.04,.3,0,.16);
    sh.bezierCurveTo(.04,.3,.3,.24,.3,.06);     sh.bezierCurveTo(.3,-.08,.06,-.2,0,-.27);
    return colorGeo([[new THREE.ExtrudeGeometry(sh,EXT).translate(0,0,-.05),'#ff6fa8']]);
  })()},
  {id:'coin', emoji:'💰', w:312, glow:'#ffc95a', geo:colorGeo([   // 다른 아이템 합과 같게 → 금화 50%
    [new THREE.CylinderGeometry(.25,.25,.08,22).rotateX(Math.PI/2),'#f2a93b'],
    [new THREE.CylinderGeometry(.17,.17,.1,22).rotateX(Math.PI/2),'#ffd66b'],
  ])},
  {id:'candy', emoji:'🍬', w:60, glow:'#ffb0dc', geo:colorGeo([
    [new THREE.SphereGeometry(.17,12,8),'#ff8fc0'],
    [new THREE.ConeGeometry(.13,.17,8).rotateZ(Math.PI/2).translate(.2,0,0),'#fff0f7'],
    [new THREE.ConeGeometry(.13,.17,8).rotateZ(-Math.PI/2).translate(-.2,0,0),'#fff0f7'],
  ])},
  {id:'gem', emoji:'💎', w:8, glow:'#9ff0ff', geo:colorGeo([   // 희귀 — 드롭률 2배에서 뺌
    [new THREE.CylinderGeometry(.15,.25,.12,6).translate(0,.06,0),'#c9f7ff'],
    [new THREE.ConeGeometry(.25,.32,6).rotateX(Math.PI).translate(0,-.16,0),'#5fc8ea'],
  ])},
];
const ITEM_W=ITEMS.reduce((s,it)=>s+it.w,0);
// 히든 컬러 아이템: 무지개빛이 흐르는 물감 방울
const HIDDEN={id:'color', hidden:true, emoji:'🎨', glow:'#ffffff',
  geo:colorGeo([
    [new THREE.SphereGeometry(.21,16,12),'#ffffff'],
    [new THREE.ConeGeometry(.182,.26,16,1,true).translate(0,.235,0),'#ffffff'],
  ]).translate(0,-.06,0),
  mat:new THREE.ShaderMaterial({
    uniforms:{uTime:U.time},
    vertexShader:'varying vec3 vN; varying float vY; void main(){ vN=normalize(normalMatrix*normal); vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform float uTime; varying vec3 vN; varying float vY;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
      void main(){ float rim=pow(1.0-abs(normalize(vN).z),2.0); gl_FragColor=vec4(mix(hue(vY*1.8-uTime*0.35),vec3(1.0),0.25+rim*0.45),1.0); }`,
  })};
// 금화 주머니: 먹으면 금화 10개
const POUCH={id:'pouch', keep:true, emoji:'💰', glow:'#ffcf5a', geo:colorGeo([
  [new THREE.SphereGeometry(.22,12,9).scale(1,.9,1),'#c98b4a'],
  [new THREE.CylinderGeometry(.07,.12,.12,10).translate(0,.24,0),'#b07038'],
  [new THREE.TorusGeometry(.085,.025,6,14).rotateX(Math.PI/2).translate(0,.2,0),'#f2c14e'],
  [new THREE.CylinderGeometry(.09,.09,.03,14).rotateX(Math.PI/2).translate(0,-.02,.215),'#ffd66b'],
])};
HIDDEN.keep=true;
[...ITEMS,HIDDEN,POUCH].forEach(it=>{ it.glowM=new THREE.SpriteMaterial({map:GLOW,color:C(it.glow),transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}); });
const ITEM_M=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,metalness:.05,flatShading:true});
ITEM_M.onBeforeCompile=sh=>{   // 해질녘이라 어두워 보이지 않게 아이템은 살짝 스스로 빛남
  sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*0.4;');
};
const ITEM_H=0.42, ITEM_G=9, PICK_R=PLAYER_R+0.35;   // 바닥 위 떠 있는 높이, 떨어지는 중력, 줍는 거리
const items=[], collected={};

// 빈 거품 (미리 만들어 두고 돌려씀)
const AMB_GEO=new THREE.SphereGeometry(1,24,16);
const AMB_TINTS=['#ffd9ea','#d8edff','#dbf8ea','#ece2ff','#fff1c9'];
const amb=[];
for(let i=0;i<AMB_MAX;i++){
  const m=new THREE.Mesh(AMB_GEO,makeBubbleMat(AMB_TINTS[i%AMB_TINTS.length])); m.visible=false; m.renderOrder=5; scene.add(m);
  amb.push({m,state:'off',t:0,x:0,z:0,x0:0,z0:0,y:0,r:.5,vy:1,phase:0,burstT:-1});
}
let ambTimer=-1;   // 음수 = 아직 시작 전 (처음 코브들이 다 떠오른 뒤에 시작)
const sv=new THREE.Vector3();

function spawnAmb(){
  const b=amb.find(a=>a.state==='off'); if(!b) return false;
  for(let i=0;i<16;i++){
    // 카메라가 보고 있는 쪽 땅에서 (가까운 곳 ~ 조금 먼 곳)
    const d=rr(0,11), x=follow.x+rr(-1,1)*(5+d*0.55), z=follow.z+2-d;
    if(Math.hypot(x,z-MAP_Z)>WALK_R-2||pondD(x,z)<1.35||onBridge(x,z,1)) continue;
    if(Math.hypot(x-player.pos.x,z-player.pos.z)<1.4) continue;
    if(coves.some(cv=>Math.hypot(x-cv.home.x,z-cv.home.z)<2.4||Math.hypot(x-cv.ground.x,z-cv.ground.z)<1.6)) continue;
    if(OBST.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+1.6)) continue;
    if(amb.some(a=>a!==b&&a.state!=='off'&&Math.hypot(x-a.x0,z-a.z0)<1.6)) continue;
    // 나오는 자리도, 천장에서 터지는 자리도 화면 안에 보이게 (맨 위 메뉴바에 가리지 않게)
    if(!onScreen(sv.set(x,groundY(x,z)+.3,z),-0.08)) continue;
    tv.set(x,CEIL_Y-.45,z).project(camera); if(tv.y>0.8||Math.abs(tv.x)>0.92) continue;
    b.x0=b.x=x; b.z0=b.z=z; b.y=groundY(x,z); b.r=rr(.34,.58); b.vy=rr(.8,1.25); b.phase=rr(0,6.3);
    b.state='grow'; b.t=0; b.burstT=-1;
    const u=b.m.material.uniforms; u.uOpacity.value=1; u.uTint.value.set(AMB_TINTS[Math.floor(rnd()*AMB_TINTS.length)]);
    b.m.visible=true; puff(x,z,.55);
    return true;
  }
  return false;
}
function popAmb(b,byClick){
  if(b.state!=='grow'&&b.state!=='rise') return false;
  b.state='pop'; b.burstT=0; if(hoverAmb===b) hoverAmb=null;
  sv.set(b.x,b.y,b.z); burst(sv,b.r);
  if(byClick){ sfx.unlock(); sfx.pop(); }
  else if(onScreen(sv)) sfx.soft(0.05*Math.max(0.25,1-(camera.position.distanceTo(sv)-10)/25));
  const roll=rnd();
  if(roll<HIDDEN_CHANCE) dropItem(b.x,b.y,b.z,'hidden');
  else if(roll<HIDDEN_CHANCE+POUCH_CHANCE) dropItem(b.x,b.y,b.z,'pouch');
  else if(roll<HIDDEN_CHANCE+POUCH_CHANCE+ITEM_CHANCE) dropItem(b.x,b.y,b.z);
  return true;
}
function updateAmb(dt,T){
  if(ambTimer>=0){ ambTimer-=dt; if(ambTimer<0) ambTimer=spawnAmb()?rr(1.1,2.4):0.4; }
  for(const b of amb){
    if(b.state==='off') continue;
    b.t+=dt;
    const m=b.m;
    if(b.burstT>=0){   // 펑 — 살짝 커지며 사라짐
      b.burstT+=dt; const k=Math.min(b.burstT/(0.14*POP_SLOW),1);
      m.scale.setScalar(b.r*(1+0.35*k)); m.material.uniforms.uOpacity.value=1-k;
      if(k>=1){ m.visible=false; b.state='off'; b.burstT=-1; }
      continue;
    }
    let s=b.r;
    if(b.state==='grow'){   // 땅에서 쏙 부풀어 나옴
      const k=Math.min(b.t/0.55,1);
      s=b.r*Math.max(0.05,easeOutElastic(k));
      b.y=groundY(b.x0,b.z0)+b.r*easeOutBack(k)*1.02;
      if(k>=1){ b.state='rise'; b.t=0; }
    } else {                // 둥실둥실 떠오름
      b.y+=b.vy*Math.min(1,0.25+b.t/0.8)*dt;
      b.x=b.x0+Math.sin(b.t*1.3+b.phase)*0.28; b.z=b.z0+Math.cos(b.t*1.05+b.phase)*0.18;
      if(b.y+b.r>=CEIL_Y){ popAmb(b,false); continue; }
    }
    const w=Math.sin(T*3.4+b.phase)*.04; s*=1+(hoverAmb===b?0.12:0);
    m.position.set(b.x,b.y,b.z); m.scale.set(s*(1+w),s*(1-w),s*(1+w));
  }
}

function dropItem(x,y,z,kind){   // kind: 없음=일반 아이템, 'hidden'=무지개 물감, 'pouch'=금화 주머니
  // 너무 많이 쌓이면 제일 오래된 것부터 사라짐 (히든 물감·금화 주머니는 남겨 둠)
  const alive=items.filter(it=>it.state==='fall'||it.state==='rest');
  if(alive.length>=ITEM_MAX){ const old=alive.find(it=>it.state==='rest'&&!it.type.keep)||alive[0]; old.state='vanish'; old.t=0; }
  let type=kind==='pouch'?POUCH:(kind==='hidden'||kind===true)?HIDDEN:null;
  if(!type){ let r=rnd()*ITEM_W; type=ITEMS[0]; for(const t of ITEMS){ r-=t.w; if(r<=0){ type=t; break; } } }
  const mesh=new THREE.Mesh(type.geo,type.mat||ITEM_M), glow=new THREE.Sprite(type.glowM);
  mesh.rotation.set(rr(-.5,.5),rr(0,6.3),rr(-.5,.5));
  scene.add(mesh,glow);
  const a=rr(0,Math.PI*2), sp=rr(.2,.6);
  items.push({type,mesh,glow,x,y,z,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,vy:1.2,spin:(rnd()<.5?-1:1)*rr(3,6),
    state:'fall',t:0,age:0,phase:rr(0,6.3),baseY:0,bounced:false,sx:0,sy:0,sz:0});
}
function collectItem(it){
  it.state='collect'; it.t=0; it.sx=it.x; it.sy=it.y; it.sz=it.z;
  collected[it.type.id]=(collected[it.type.id]||0)+1;
  if(it.type.hidden){ sfx.sparkle(); return; }   // 히든 아이템은 코브에 쏙 들어가는 순간 색이 바뀜
  const W=window.covvWallet, n=it.type===POUCH?POUCH_COINS:1;
  const got=W?W.add(it.type===POUCH?'coin':it.type.id,n):n;   // 가방에 넣기 (새로고침해도 남음, 아이템마다 최대 9,999개)
  sfx.chime(); player.joy=0.35;
  popText(sv.set(it.x,it.y+0.35,it.z),it.type.emoji+(got>0?' +'+got:' 가득!'),'item-text');
}
function removeItem(i){ const it=items[i]; scene.remove(it.mesh,it.glow); items.splice(i,1); }
const hiddenGlow=new THREE.Color();
function updateItems(dt,T){
  const P=player, canPick=P.state==='walk';
  HIDDEN.glowM.color.copy(hiddenGlow.setHSL((T*0.35)%1,0.9,0.7).convertSRGBToLinear());   // 히든 아이템 반짝이도 무지개색
  for(let i=items.length-1;i>=0;i--){
    const it=items[i], m=it.mesh;
    it.t+=dt;
    let sc=1;
    switch(it.state){
      case 'fall':{   // 빙글빙글 떨어져서 톡톡
        it.vy-=ITEM_G*dt; it.x+=it.vx*dt; it.z+=it.vz*dt; it.y+=it.vy*dt;
        m.rotation.y+=it.spin*dt; m.rotation.x+=it.spin*.4*dt;
        const gy=surfaceY(it.x,it.z)+ITEM_H;
        if(it.y<=gy){
          it.y=gy;
          if(blockedAt(it.x,it.z)){ it.state='vanish'; it.t=0; puff(it.x,it.z,.5); }   // 연못·범위 밖이면 퐁당
          else if(it.vy<-1.6){ it.vy=-it.vy*0.42; it.vx*=.5; it.vz*=.5; if(!it.bounced){ it.bounced=true; puff(it.x,it.z,.5); it.type.hidden?sfx.sparkle():sfx.tink(); } }
          else { it.state='rest'; it.t=0; it.baseY=gy; }
        }
        break;
      }
      case 'rest':{   // 제자리에서 둥실 빙글
        it.age+=dt;
        m.rotation.y+=dt*1.8; m.rotation.x*=Math.max(0,1-dt*6); m.rotation.z*=Math.max(0,1-dt*6);
        it.y=it.baseY+(0.06+Math.sin(T*2.4+it.phase)*0.07)*Math.min(1,it.t/0.5);
        if(it.age>(it.type.keep?ITEM_LIFE*2:ITEM_LIFE)){ it.state='vanish'; it.t=0; }
        break;
      }
      case 'collect':{   // 코브 머리 위로 쏙 빨려 들어감
        const k=Math.min(it.t/0.45,1), e=easeInOutCubic(k);
        const hy=P.g.group.position.y+PLAYER_S*1.1;
        it.x=it.sx+(P.pos.x-it.sx)*e; it.z=it.sz+(P.pos.z-it.sz)*e; it.y=it.sy+(hy-it.sy)*e+Math.sin(k*Math.PI)*0.6;
        m.rotation.y+=dt*12;
        sc=k<0.35?1+k*0.9:(1-k)/0.65*1.315;
        if(k>=1){
          if(it.type.hidden){
            const name=changeCoveColor(), W=window.covvWallet;
            if(W){ W.add('color',1); W.log(name==='무지개'?'🌈 히든 물감을 먹고 무지개 코브가 됐어요!':`🎨 히든 물감을 먹고 ${name} 코브가 됐어요`); }
          }
          removeItem(i); continue;
        }
        break;
      }
      case 'vanish':{
        const k=Math.min(it.t/0.4,1); sc=1-k; it.y-=dt*0.3;
        if(k>=1){ removeItem(i); continue; }
        break;
      }
    }
    if(canPick&&(it.state==='rest'||(it.state==='fall'&&it.y<surfaceY(it.x,it.z)+1.2))&&Math.hypot(it.x-P.pos.x,it.z-P.pos.z)<PICK_R) collectItem(it);
    m.position.set(it.x,it.y,it.z); m.scale.setScalar(Math.max(0.001,sc));
    const gs=(it.type.keep?1.7:1.1)*(1+Math.sin(T*3+it.phase)*0.12)*sc;
    it.glow.position.set(it.x,it.y,it.z); it.glow.scale.set(gs,gs,1);
  }
}

/* ══════════ 코브 몰 점원 · 해커 코브 ══════════ */
const shop=(()=>{
  const g=makeCove('#ffc98a'); g.group.scale.setScalar(S);
  const [x,z]=stallLocal(0,-.45);
  g.group.position.set(x,1.05,z); g.group.rotation.y=STALL.ry; scene.add(g.group);   // 카운터 뒤 받침대 위에 서 있음
  const tag=document.createElement('button');
  tag.type='button'; tag.className='bubble-tag shop-tag';
  tag.innerHTML='<span aria-hidden="true">🛍️</span> 코브 몰';
  tag.setAttribute('aria-label','코브 몰 들어가기');
  tagsEl.appendChild(tag);
  const [fx,fz]=stallLocal(0,1.5);   // 가게 앞 (여기 들어오면 가게 화면으로)
  const [bx,bz]=stallLocal(0,-.72);  // 간판 자리 (이름표를 여기 붙임)
  const s={g,tag,shown:false,inside:false,front:{x:fx,z:fz},board:{x:bx,z:bz},hw:0,wave:0};
  tag.addEventListener('click',()=>openShop());
  return s;
})();
function openShop(){
  if(paused||!window.covvOpenScreen) return;
  const sp=screenPos(sv.set(shop.g.group.position.x,shop.g.group.position.y+0.4,shop.g.group.position.z));
  // 다른 화면 전환 중이라 못 열었으면 '들어옴'을 풀어서 다음 프레임에 다시 시도
  Promise.resolve(window.covvOpenScreen('mall',{x:sp.x,y:sp.y})).then(ok=>{ if(!ok&&!paused) shop.inside=false; });
}
function updateShop(dt,T){
  const g=shop.g, P=player;
  const d=Math.hypot(P.pos.x-g.group.position.x,P.pos.z-g.group.position.z);
  // 코브가 가까이 오면 그쪽을 보며 손 흔들기, 아니면 카메라 쪽을 보며 두리번
  const lookX=d<5?P.pos.x:camera.position.x, lookZ=d<5?P.pos.z:camera.position.z;
  g.group.rotation.y=lerpAngle(g.group.rotation.y,Math.atan2(lookX-g.group.position.x,lookZ-g.group.position.z),Math.min(1,dt*3));
  shop.wave+=((d<5?1:0)-shop.wave)*Math.min(1,dt*4);
  g.bodyG.rotation.set(0,0,Math.sin(T*1.1)*0.05);
  poseG(g,i=>i===1?[0,.25*shop.wave+Math.sin(T*9)*.08*shop.wave,.05*shop.wave]:[0,Math.sin(T*1.6+i)*.02,0]);
  g.group.position.y=1.05+Math.abs(Math.sin(T*2.2))*0.03;
  // 가게 앞에 '들어서는 순간'에만 가게 화면으로 (돌아왔을 때 가게 앞이면 다시 열리지 않게)
  const inside=P.state==='walk'&&Math.hypot(P.pos.x-shop.front.x,P.pos.z-shop.front.z)<1.05;
  if(inside&&!shop.inside&&!navCv) openShop();   // 거품을 터트려 다른 화면으로 가는 중이면 그 이동을 가로채지 않음
  shop.inside=inside;
}
// 해커 코브: 금화가 말도 안 되게 많으면 선글라스 🕶️ (해킹 환영 ㅋㅋ)
const shades=(()=>{
  const m=new THREE.MeshStandardMaterial({color:C('#1a1424'),roughness:.25,metalness:.35});
  const g=new THREE.Group();
  for(const ex of [-.2,.2]){ const l=new THREE.Mesh(new THREE.BoxGeometry(.27,.17,.05),m); l.position.set(ex,.08,.66); l.rotation.y=ex*.7; g.add(l); }
  const br=new THREE.Mesh(new THREE.BoxGeometry(.16,.035,.035),m); br.position.set(0,.12,.68); g.add(br);
  g.visible=false; player.g.bodyG.add(g);
  return g;
})();
let hacker=false, hackerCheck=0;
// 이미 해커인 채로 들어오면 조용히 선글라스만 (소식·효과음은 '되는 순간'에만)
(()=>{ const W=window.covvWallet; if(W&&W.get('coin')>=HACKER_COINS){ hacker=true; shades.visible=true; } })();
// 이름표: 코브 몰 계정을 만들면 '코브' 대신 내 닉네임 (mall.js covvWallet.coveName)
const coveName=()=>{ const W=window.covvWallet; return W&&W.coveName?W.coveName():'코브'; };
function paintTag(){ player.tag.textContent=(hacker?'🕶️ 해커 ':'🐾 ')+coveName(); }
paintTag();
// 계정을 만들거나 닉네임을 바꾸면 바로 반영 (다른 탭에서 바꿔도) — 들판이 보일 때 바뀌면 머리 위에 한 번 알려 줌
if(window.covvWallet) window.covvWallet.on(k=>{
  if(k!=='profile'&&k!=='account'&&k!=='*') return;
  const before=player.tag.textContent; paintTag();
  if(k==='profile'&&!paused&&player.state!=='hidden'&&player.tag.textContent!==before)
    popText(sv.set(player.pos.x,player.g.group.position.y+PLAYER_S*1.6,player.pos.z),'✨ '+coveName()+'!','item-text color-text');
});
function updateHacker(dt){
  hackerCheck-=dt; if(hackerCheck>0) return; hackerCheck=0.5;
  const W=window.covvWallet, coins=W?W.get('coin'):0, on=coins>=HACKER_COINS;
  if(on===hacker) return;
  hacker=on; shades.visible=on;
  paintTag();
  if(on&&window.covvWallet) window.covvWallet.log('🕶️ 금화를 9,999개 꽉 채워서 해커 코브가 됐어요 ㅋㅋ');
  if(on&&player.state!=='hidden'){
    sfx.magic();
    popText(sv.set(player.pos.x,player.g.group.position.y+PLAYER_S*1.6,player.pos.z),'해커 코브 발견! 🕶️','item-text color-text');
  }
}

/* ── 화면 좌표 변환 · 이름표 ── */
const tv=new THREE.Vector3();
let W=1,H=1;
function screenPos(v){
  tv.copy(v).project(camera);
  const r=cvs.getBoundingClientRect();
  return {x:r.left+(tv.x*.5+.5)*r.width, y:r.top+(-tv.y*.5+.5)*r.height};
}
function onScreen(v,margin=0){   // 카메라 앞 + 화면 안
  tv.copy(v).project(camera);
  return tv.z<1 && Math.abs(tv.x)<1+margin && Math.abs(tv.y)<1+margin;
}
function placeTag(el,x,y,z){
  tv.set(x,y,z).project(camera);
  el.style.transform=`translate(${((tv.x*.5+.5)*W).toFixed(1)}px,${((-tv.y*.5+.5)*H).toFixed(1)}px) translate(-50%,0)`;
}
function updateTags(){
  for(const cv of coves){
    const show=!paused&&(cv.state==='float'||cv.state==='rise')&&cv.burstT<0&&onScreen(cv.pos,0.05);
    if(show!==cv.shown){ cv.tag.classList.toggle('show',show); cv.shown=show; }
    cv.tag.classList.toggle('hover',hoverCv===cv);
    if(show) placeTag(cv.tag,cv.pos.x,cv.pos.y-BUBBLE_R*cv.bScale-0.1,cv.pos.z);
  }
  // 코브 몰 이름표 (간판 한가운데, 화면 밖으로 반쯤 걸리면 안쪽으로 밀어 넣음)
  const sb=shop.board;
  const sshow=!paused&&player.state!=='hidden'&&onScreen(sv.set(sb.x,2.95,sb.z),0.02);
  if(sshow!==shop.shown){ shop.tag.classList.toggle('show',sshow); shop.shown=sshow; if(sshow) shop.hw=0; }
  if(sshow){
    if(!shop.hw) shop.hw=(shop.tag.offsetWidth||96)/2+6;
    tv.set(sb.x,2.95,sb.z).project(camera);
    const x=Math.min(W-shop.hw,Math.max(shop.hw,(tv.x*.5+.5)*W));
    shop.tag.style.transform=`translate(${x.toFixed(1)}px,${((-tv.y*.5+.5)*H).toFixed(1)}px) translate(-50%,-50%)`;
  }
  const P=player, pshow=!paused&&P.state!=='hidden';
  P.tag.classList.toggle('show',pshow);
  if(pshow){
    tv.set(P.pos.x,P.g.group.position.y+PLAYER_S*0.75,P.pos.z).project(camera);
    P.tag.style.transform=`translate(${((tv.x*.5+.5)*W).toFixed(1)}px,${((-tv.y*.5+.5)*H).toFixed(1)}px) translate(-50%,-100%)`;
  }
}

/* ── 클릭 · 끌기 · 키보드 ── */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), GROUND=new THREE.Plane(new THREE.Vector3(0,1,0),0), hitP=new THREE.Vector3();
function setRay(cx,cy){ const r=cvs.getBoundingClientRect(); ndc.set(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera); }
function pickBubble(cx,cy){   // 누른 곳의 거품: 코브 거품 {cv} 또는 빈 거품 {amb}
  setRay(cx,cy);
  const list=coves.filter(cv=>(cv.state==='float'||cv.state==='rise')&&cv.burstT<0).map(cv=>cv.bubble);
  for(const b of amb) if(b.state==='grow'||b.state==='rise') list.push(b.m);
  const hit=ray.intersectObjects(list,false)[0];
  if(!hit) return null;
  const cv=coves.find(c=>c.bubble===hit.object);
  return cv?{cv}:{amb:amb.find(b=>b.m===hit.object)};
}
function itemAt(){   // 바로 전에 쏜 광선에 걸린 아이템 (누르면 그 아이템으로 걸어감)
  const hit=ray.intersectObjects(items.filter(it=>it.state==='rest'||it.state==='fall').map(it=>it.mesh),false)[0];
  const it=hit&&items.find(i=>i.mesh===hit.object);
  return it?{x:it.x,z:it.z}:null;
}
function groundAt(cx,cy){
  setRay(cx,cy);
  if(!ray.ray.intersectPlane(GROUND,hitP)) return null;
  // 걸어갈 수 있는 범위 안으로
  const dx=hitP.x, dz=hitP.z-MAP_Z, d=Math.hypot(dx,dz);
  if(d>WALK_R-0.5){ hitP.x=dx/d*(WALK_R-0.5); hitP.z=MAP_Z+dz/d*(WALK_R-0.5); }
  return {x:hitP.x,z:hitP.z};
}
let press=null, pointerHeld=false;
cvs.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0) return;
  sfx.unlock();
  const hit=pickBubble(e.clientX,e.clientY);
  press={x:e.clientX,y:e.clientY,hit,id:e.pointerId};
  if(!hit&&player.state==='walk'){
    const g=itemAt()||groundAt(e.clientX,e.clientY);
    if(g){ player.dest=g; pointerHeld=true; keys.clear(); try{ cvs.setPointerCapture(e.pointerId); }catch(_){} }
  }
});
cvs.addEventListener('pointermove',e=>{
  if(pointerHeld&&press&&e.pointerId===press.id){   // 누른 채로 끌면 코브가 커서를 따라감
    const g=groundAt(e.clientX,e.clientY); if(g) player.dest=g;
    return;
  }
  if(!IS_TOUCH){ const h=pickBubble(e.clientX,e.clientY); hoverCv=h&&h.cv||null; hoverAmb=h&&h.amb||null; cvs.style.cursor=h?'pointer':''; }
});
function endPress(e){
  if(!press||(e&&e.pointerId!==press.id)) return;
  if(press.hit&&e&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<10){ if(press.hit.cv) popCove(press.hit.cv,true); else popAmb(press.hit.amb,true); }
  pointerHeld=false; press=null;
}
cvs.addEventListener('pointerup',endPress);
cvs.addEventListener('pointercancel',()=>{ pointerHeld=false; press=null; });
const KEYMAP={ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d',ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r'};
addEventListener('keydown',e=>{
  const k=KEYMAP[e.code]; if(!k||paused||e.metaKey||e.ctrlKey||e.altKey) return;
  const t=e.target; if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  keys.add(k); e.preventDefault();
});
addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) keys.delete(k); });
addEventListener('blur',()=>keys.clear());

/* ── 크기 ── */
function resize(){
  W=stage.clientWidth||1; H=stage.clientHeight||1;
  const a=W/H;
  camCfg=a>=1.15?CAMS.wide:a>=0.8?CAMS.mid:CAMS.tall;
  camera.aspect=a; camera.fov=camCfg.fov; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,MAX_DPR));   // 다른 모니터로 옮겨도 선명도 유지
  camOff.fromArray(camCfg.off); camLookOff.fromArray(camCfg.look);
  // 세로 화면(휴대폰)에선 거품 4개를 가운데로 모아서 화면 밖으로 잘리지 않게
  const hx=camCfg===CAMS.tall?0.7:1;
  coves.forEach(cv=>{ cv.home.x=cv.c.home[0]*hx; if(cv.state==='idle'||cv.state==='wait'||cv.state==='emerge') cv.ground.x=cv.home.x; });
  if(!resize.done){ camera.position.copy(follow).add(camOff); camLook.copy(follow).add(camLookOff); camera.lookAt(camLook); resize.done=true; }
  renderer.setSize(W,H);
}
// 크기가 바뀌면 캔버스가 지워지므로 바로 한 장 다시 그림 (깜빡임 방지)
new ResizeObserver(()=>{ resize(); if(!first&&!paused) renderer.render(scene,camera); }).observe(stage);
resize();
(function watchDpr(){   // 창을 해상도가 다른 모니터로 옮길 때
  const mq=matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
  const h=()=>{ resize(); watchDpr(); };
  if(mq.addEventListener) mq.addEventListener('change',h,{once:true}); else if(mq.addListener) mq.addListener(h);
})();

/* ── 전체 업데이트 ── */
const camWant=new THREE.Vector3(), lookWant=new THREE.Vector3();
function update(dt){
  U.time.value+=dt;
  const T=U.time.value;
  updatePlayer(dt,T);
  // 카메라가 주인공 코브를 부드럽게 따라감
  follow.x+=(player.pos.x-follow.x)*Math.min(1,dt*3.2);
  follow.z+=(player.pos.z-follow.z)*Math.min(1,dt*3.2);
  camWant.copy(follow).add(camOff); lookWant.copy(follow).add(camLookOff);
  camera.position.lerp(camWant,Math.min(1,dt*6)); camLook.lerp(lookWant,Math.min(1,dt*6));
  camera.lookAt(camLook);
  for(const cv of coves) updateCove(cv,dt,T);
  updateAmb(dt,T);
  updateItems(dt,T);
  updateShop(dt,T);
  updateHacker(dt);
  for(let i=bursts.length-1;i>=0;i--){
    const b=bursts[i]; b.t+=dt;
    const arr=b.pts.geometry.attributes.position.array;
    b.vel.forEach((v,j)=>{ v[1]-=9/(POP_SLOW*POP_SLOW)*dt; arr[j*3]+=v[0]*dt; arr[j*3+1]+=v[1]*dt; arr[j*3+2]+=v[2]*dt; });
    b.pts.geometry.attributes.position.needsUpdate=true;
    b.pts.material.opacity=Math.max(0,1-b.t/(0.6*POP_SLOW));
    if(b.t>0.6*POP_SLOW){ scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i,1); }
  }
  for(let i=puffs.length-1;i>=0;i--){
    const p=puffs[i]; p.t+=dt; const k=p.t/0.55;
    p.m.scale.setScalar((.35+k*1.4)*p.size); p.m.material.opacity=.85*(1-k)*(p.size<1?0.7:1);
    if(k>=1){ scene.remove(p.m); p.m.material.dispose(); puffs.splice(i,1); }
  }
  for(const r of ripples){
    r.t+=dt; const k=(r.t%3.3)/3.3;
    if(k<dt/3.3*1.5){ const a=rnd()*Math.PI*2, d=Math.sqrt(rnd())*.6; r.m.position.set(r.p.x+Math.cos(a)*r.p.rx*d,WATER_Y+.01,r.p.z+Math.sin(a)*r.p.rz*d); }
    r.m.scale.setScalar(.2+k*1.5); r.m.material.opacity=.45*(1-k);
  }
  for(let i=0;i<flies.base.length;i++){
    const [x,y,z,p]=flies.base[i];
    flies.pos[i*3]=x+Math.sin(T*.3+p)*.8; flies.pos[i*3+1]=y+Math.sin(T*.7+p*2)*.35; flies.pos[i*3+2]=z+Math.cos(T*.25+p)*.8;
  }
  flies.geo.attributes.position.needsUpdate=true;
  flies.pts.material.opacity=.55+Math.sin(T*2.3)*.25;
  updateTags();
}

/* ── 렌더 루프 (다른 화면이 열리면 멈춤) ── */
let rafId=null, last=0, prev=0, first=true;
function frame(now){
  rafId=requestAnimationFrame(frame);
  const iv=1000/FPS;
  if(now-last<iv-2) return;
  last=Math.min(now,Math.max(last+iv,now-iv));   // 일정 간격 유지 → 90·120·144Hz 화면에서도 목표 프레임 근처
  const dt=Math.min((now-prev)/1000,0.05); prev=now;
  update(dt);
  renderer.render(scene,camera);
  if(first){ first=false; loading&&loading.classList.add('hide'); startIntro(); }
}
function start(){ if(rafId===null&&!paused){ last=prev=performance.now(); rafId=requestAnimationFrame(frame); } }
function stop(){ if(rafId!==null){ cancelAnimationFrame(rafId); rafId=null; } }

function startIntro(){
  // 주인공 코브가 먼저 쏙 → 작은 코브들이 차례로 쏙 나와 거품 타고 떠오름
  setTimeout(()=>{ player.state='emerge'; player.t=0; player.g.group.visible=true; puff(SPAWN.x,SPAWN.z); },150);
  coves.forEach((cv,i)=>{ cv.ground.set(cv.home.x,0,cv.home.z); cv.delay=0.9+i*0.3; setState(cv,'wait'); });
  ambTimer=4.5;   // 작은 코브들이 다 떠오른 뒤부터 빈 거품 시작
}

/* ── 다른 스크립트(screens.js)에서 쓰는 창구 ── */
window.covvField={
  popTo(id){   // 메뉴에서 누른 코브의 거품이 화면에 보이면 터트려서 이동, 안 보이면 false(바로 이동)
    const cv=coves.find(c=>c.c.id===id);
    if(!cv||!onScreen(cv.pos,-0.05)) return false;
    return popCove(cv,true);
  },
  pause(){ paused=true; pointerHeld=false; press=null; keys.clear(); stop(); updateTags(); },
  colors:[...COVE_COLORS.map(c=>({name:c.name,hex:c.hex})),{name:'무지개',hex:null}],
  coveColor(){ return player.colorName; },
  setCoveColor(name){ return applyLook(name); },   // 사탕으로 고른 색 (가게 화면에서 → 들판에 돌아오면 바뀌어 있음)
  // 내 오피스(office.js)가 같은 코브 모양·색을 쓰도록
  makeCove, poseG,
  coveLook(){ const p=findLook(player.colorName), W=window.covvWallet; return {name:player.colorName, hex:p&&p.hex||null, rainbow:player.rainbow, hacker:W?W.get('coin')>=HACKER_COINS:hacker}; },
  // 소개 화면의 아이템 확률표 — 실제 드롭 설정에서 바로 계산 (설정을 바꿔도 공개한 확률이 어긋나지 않게)
  drops(){
    const rate={color:HIDDEN_CHANCE, pouch:POUCH_CHANCE, none:1-HIDDEN_CHANCE-POUCH_CHANCE-ITEM_CHANCE};
    for(const it of ITEMS) rate[it.id]=ITEM_CHANCE*it.w/ITEM_W;
    return {rate, pouchCoins:POUCH_COINS, rainbow:RAINBOW_CHANCE};
  },
  resume(){
    paused=false;
    for(const cv of coves) if(cv.state==='landed'||cv.state==='fall') respawn(cv);
    navCv=null;   // 떨어지는 도중 다른 화면이 열렸던 경우에도 '이동 대기'가 남지 않게
    shop.inside=Math.hypot(player.pos.x-shop.front.x,player.pos.z-shop.front.z)<1.05;
    start();
  },
};
if(window.covvWallet&&window.covvWallet.state.look&&window.covvWallet.state.look!=='분홍') applyLook(window.covvWallet.state.look);

// 디버그용: 브라우저 창이 가려져 있어도 시간을 직접 흘려서 확인할 수 있게
window._field={renderer,scene,camera,coves,player,popCove,amb,items,collected,spawnAmb,popAmb,dropItem,changeCoveColor,shop,

  step(sec){ if(first){ first=false; loading&&loading.classList.add('hide'); startIntro(); player.state='emerge'; player.g.group.visible=true; }
    for(let t=0;t<sec;t+=1/60) update(1/60); renderer.render(scene,camera); }};
start();
})();
