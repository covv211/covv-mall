/* ══════════════════════════════════════════════════════════
   내 오피스 — 미니룸 3D (들판과 같은 해질녘 로우폴리 스타일)
   - 방 한 귀퉁이(바닥 + 벽 두 면)를 비스듬히 내려다보는 싸이월드 미니룸 느낌
   - 내 코브(들판에서 고른 색, 해커면 선글라스)가 책상·러그·빈백·창가·선반을 오가며 지냄
   - 모은 것이 방 꾸밈이 됨: 금화 저금통(100개까지 차오름), 트로피 선반(무지개·해커·보석), 키링 보드
   - 누르면: 모니터 → 작업물, 머그컵 → 연락처, 키링 보드 → 코브 몰, 액자 → 소개, 창문 → 들판, 저금통·선반 → 가방
   - 내 오피스 화면을 처음 열 때만 불러옴 (screens.js), 화면이 닫혀 있으면 그리지 않음
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const stage=document.getElementById('roomStage');
if(!stage) return;
const F=window.covvField, W=window.covvWallet;
if(!window.THREE||!F||!F.makeCove){ stage.classList.add('no-webgl'); return; }

const IS_TOUCH=matchMedia('(pointer: coarse)').matches;
const MAX_DPR=IS_TOUCH?1.25:1.5, FPS=IS_TOUCH?30:60;
const C=hex=>new THREE.Color(hex).convertSRGBToLinear();
const mat=(hex,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:C(hex),roughness:.9,metalness:0,flatShading:true},o));

/* ── 렌더러 ── */
let renderer;
try{ renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); }
catch(e){ stage.classList.add('no-webgl'); return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,MAX_DPR));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.setClearColor(0x000000,0);   // 뒤 배경은 CSS 해질녘 그라데이션
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;  // 가구는 안 움직이니 그림자는 필요할 때만 다시
stage.prepend(renderer.domElement);
const cvs=renderer.domElement;
cvs.addEventListener('webglcontextrestored',()=>{ renderer.shadowMap.needsUpdate=true; });

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(27,1,.1,100);
const CAM=new THREE.Vector3(11,9.4,11), LOOK=new THREE.Vector3(-.3,1.25,-.3);
let camDist=1;

/* ── 조명: 들판처럼 따뜻한 해질녘 + 책상 스탠드 ── */
scene.add(new THREE.HemisphereLight(C('#ffe9dc'),C('#8a5a7a'),.8));
const sun=new THREE.DirectionalLight(C('#ffd2a8'),.85);
sun.position.set(7,11,6); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});
sun.shadow.bias=-.0008; sun.shadow.normalBias=.03;
scene.add(sun);
const lampLight=new THREE.PointLight(C('#ffb95a'),.9,6,2); lampLight.position.set(.8,1.95,-3.3); scene.add(lampLight);

function box(w,h,d,m,x,y,z,parent=scene){
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.position.set(x,y,z);
  b.castShadow=true; b.receiveShadow=true; parent.add(b); return b;
}
function cyl(rt,rb,h,seg,m,x,y,z,parent=scene){
  const c=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m); c.position.set(x,y,z);
  c.castShadow=true; c.receiveShadow=true; parent.add(c); return c;
}
// 캔버스로 그린 그림 (창밖 풍경·모니터·액자)
function canvasTex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ g.clearRect(0,0,w,h); draw(g,w,h); t.needsUpdate=true; });
  return t;
}
const picture=(w,h,tex)=>new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));

/* ══════════ 방 ══════════ */
const TRIM=mat('#fff1e6'), WOOD=mat('#c7825c'), WOOD_D=mat('#8e5a44'), DARK=mat('#3d2f5a',{roughness:.6});
// 바닥 (나무 판자)
[mat('#eaa97c'),mat('#e09d70')].forEach((m,k)=>{ for(let i=k;i<8;i+=2) box(.97,.2,8,m,-3.5+i,-.1,0); });
// 뒷벽(라벤더) · 왼쪽 벽(살구) — 아래쪽은 한 톤 진한 판벽, 몰딩은 크림
box(8.25,4.4,.25,mat('#d9c7f5'),0,2.2,-4.125);
box(8.25,1.2,.3,mat('#bea8ea'),0,.6,-4.1);
box(.25,4.4,8,mat('#f8cbb2'),-4.125,2.2,0);
box(.3,1.2,8,mat('#efb395'),-4.1,.6,0);
for(const y of [1.22,.09]){ box(8.25,y>1?.08:.18,.36,TRIM,0,y,-4.07); box(.36,y>1?.08:.18,8,TRIM,-4.07,y,0); }
box(8.25,.12,.32,TRIM,0,4.4,-4.08); box(.32,.12,8,TRIM,-4.08,4.4,0);

/* 창문 (창밖은 코브's 들판의 해질녘) → 누르면 들판으로 */
const windowG=new THREE.Group(); scene.add(windowG);
(()=>{
  const x=-1.4, y=2.6, w=2.1, h=1.45;
  const view=picture(w,h,canvasTex(256,180,(g,W2,H2)=>{
    const sky=g.createLinearGradient(0,0,0,H2); sky.addColorStop(0,'#8f6db8'); sky.addColorStop(.62,'#f2a482'); sky.addColorStop(1,'#f6b690');
    g.fillStyle=sky; g.fillRect(0,0,W2,H2);
    g.fillStyle='rgba(255,255,255,.8)'; [[30,22],[70,14],[118,30],[210,18]].forEach(([a,b])=>g.fillRect(a,b,2,2));
    const sg=g.createRadialGradient(186,118,4,186,118,46); sg.addColorStop(0,'rgba(255,235,180,1)'); sg.addColorStop(.35,'rgba(255,220,160,.8)'); sg.addColorStop(1,'rgba(255,200,150,0)');
    g.fillStyle=sg; g.fillRect(120,60,140,120);
    g.fillStyle='#e5846a'; g.beginPath(); g.moveTo(0,150); g.quadraticCurveTo(70,112,140,146); g.quadraticCurveTo(200,120,256,138); g.lineTo(256,180); g.lineTo(0,180); g.fill();
    g.fillStyle='#d46f5d'; g.beginPath(); g.moveTo(0,168); g.quadraticCurveTo(90,140,170,164); g.quadraticCurveTo(220,150,256,160); g.lineTo(256,180); g.lineTo(0,180); g.fill();
    g.fillStyle='#f2a33f'; [[40,138],[58,142],[222,132]].forEach(([a,b])=>{ g.beginPath(); g.arc(a,b,9,0,Math.PI*2); g.fill(); });
    // 거품 타고 둥실 떠 있는 작은 코브
    g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=2; g.beginPath(); g.arc(96,70,15,0,Math.PI*2); g.stroke();
    g.fillStyle='#ff9ccb'; g.beginPath(); g.arc(96,72,8,0,Math.PI*2); g.fill(); g.beginPath(); g.arc(90,65,3.5,0,Math.PI*2); g.arc(102,65,3.5,0,Math.PI*2); g.fill();
  }));
  view.position.set(x,y,-3.99); windowG.add(view);
  box(w+.24,.12,.16,TRIM,x,y+h/2+.06,-3.95,windowG); box(w+.24,.12,.16,TRIM,x,y-h/2-.06,-3.95,windowG);
  box(.12,h,.16,TRIM,x-w/2-.06,y,-3.95,windowG); box(.12,h,.16,TRIM,x+w/2+.06,y,-3.95,windowG);
  box(.06,h,.08,TRIM,x,y,-3.95,windowG); box(w,.06,.08,TRIM,x,y,-3.95,windowG);
  box(w+.5,.1,.36,TRIM,x,y-h/2-.14,-3.86,windowG);   // 창턱
  const CUR=mat('#ffb0cf'), CUR2=mat('#ff9ccb');
  for(const side of [-1,1]) for(let k=0;k<4;k++)   // 주름진 커튼
    box(.15,1.9,.07,k%2?CUR2:CUR,x+side*(w/2+.15+k*.13),y-.05,-3.84+(k%2)*.05,windowG);
  cyl(.03,.03,w+1.5,6,TRIM,x,y+h/2+.32,-3.84,windowG).rotation.z=Math.PI/2;
})();

/* 책상 · 모니터(작업물) · 키보드 · 머그컵(연락처) · 스탠드 · 동그란 의자 */
box(2.5,.12,1.05,WOOD,1.75,1.45,-3.35);
for(const [lx,lz] of [[.6,-3.8],[.6,-2.9]]) box(.12,1.4,.12,WOOD_D,lx,.7,lz);
box(.8,1.38,.95,WOOD,2.6,.69,-3.35);
for(const dy of [.35,.85]) box(.3,.05,.03,TRIM,2.6,dy+.2,-2.86);
const monitorG=new THREE.Group(); scene.add(monitorG);
(()=>{
  box(.45,.04,.3,DARK,1.6,1.53,-3.55,monitorG); box(.12,.35,.12,DARK,1.6,1.7,-3.58,monitorG);
  box(1.25,.8,.08,DARK,1.6,2.2,-3.62,monitorG);
  const scr=picture(1.12,.68,canvasTex(224,136,(g,w,h)=>{
    const bg=g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#ffe3ef'); bg.addColorStop(1,'#ffc6de'); g.fillStyle=bg; g.fillRect(0,0,w,h);
    g.fillStyle='#b0306e'; g.font='700 30px Gaegu, "Apple SD Gothic Neo", sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText('💻 작업물',w/2,h/2-8);
    g.fillStyle='rgba(176,48,110,.35)'; for(let i=0;i<3;i++) g.fillRect(52,h/2+22+i*10,120-i*28,4);
  }));
  scr.position.set(1.6,2.2,-3.575); monitorG.add(scr);
})();
box(.8,.04,.28,TRIM,1.55,1.53,-3.0);
const mugG=new THREE.Group(); scene.add(mugG);
(()=>{
  cyl(.13,.11,.26,14,mat('#ffe3ef'),2.45,1.64,-2.98,mugG);
  const top=new THREE.Mesh(new THREE.CircleGeometry(.11,14),mat('#7a4a3a')); top.rotation.x=-Math.PI/2; top.position.set(2.45,1.765,-2.98); mugG.add(top);
  const h=new THREE.Mesh(new THREE.TorusGeometry(.07,.022,6,12),mat('#ffe3ef')); h.position.set(2.59,1.64,-2.98); mugG.add(h);
})();
cyl(.14,.16,.05,12,DARK,.75,1.53,-3.55); box(.04,.5,.04,DARK,.75,1.78,-3.55);
cyl(.08,.22,.22,12,mat('#ff9ccb',{side:THREE.DoubleSide}),.75,2.02,-3.45).rotation.x=.4;
const bulb=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color:C('#fff2c8')})); bulb.position.set(.75,1.95,-3.4); scene.add(bulb);
const STOOL=mat('#8472bd');
cyl(.38,.38,.12,16,STOOL,1.6,.8,-2.35); cyl(.06,.06,.7,8,DARK,1.6,.4,-2.35); cyl(.3,.34,.05,12,DARK,1.6,.03,-2.35);

/* 왼쪽 벽 선반: 금화 저금통 · 트로피 · 해커 선글라스 · 보석 (모은 게 여기 전시됨) */
const shelfG=new THREE.Group(); scene.add(shelfG);
const SHELF_Y=2.55, SX=-3.72;
box(.52,.08,2.8,WOOD,SX,SHELF_Y,-1.85,shelfG);
for(const bz of [-3,-.7]) box(.4,.3,.06,WOOD_D,-3.8,SHELF_Y-.19,bz,shelfG);
const jarG=new THREE.Group(); scene.add(jarG);
const coinStack=cyl(.2,.2,1,14,mat('#f2c14e',{roughness:.5}),SX,0,-2.95,jarG);
(()=>{
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.62,16,1,true),new THREE.MeshStandardMaterial({color:C('#dff3ff'),transparent:true,opacity:.28,roughness:.1,side:THREE.DoubleSide,depthWrite:false}));
  glass.position.set(SX,SHELF_Y+.35,-2.95); jarG.add(glass);
  cyl(.27,.27,.07,16,WOOD,SX,SHELF_Y+.69,-2.95,jarG);
  cyl(.25,.25,.02,16,mat('#dff3ff'),SX,SHELF_Y+.05,-2.95,jarG);
})();
// 무지개 트로피 (무지개 코브가 되어 보면 반짝, 아니면 흐릿한 자리만)
const RAINBOW_M=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0}},
  vertexShader:'varying vec3 vN; varying float vY; void main(){ vN=normalize(normalMatrix*normal); vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform float uTime; varying vec3 vN; varying float vY;
    vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
    void main(){ float rim=pow(1.0-abs(normalize(vN).z),2.0); gl_FragColor=vec4(mix(hue(vY*2.2-uTime*0.3),vec3(1.0),0.25+rim*0.4),1.0); }`,
});
const GHOST_M=new THREE.MeshStandardMaterial({color:C('#cfc6dc'),transparent:true,opacity:.4,roughness:.8,flatShading:true});
const trophyG=new THREE.Group(); scene.add(trophyG);
const trophyParts=[
  cyl(.2,.1,.3,12,GHOST_M,SX,SHELF_Y+.5,-2.15,trophyG),
  cyl(.04,.04,.14,6,GHOST_M,SX,SHELF_Y+.28,-2.15,trophyG),
  box(.3,.1,.3,GHOST_M,SX,SHELF_Y+.1,-2.15,trophyG),
];
for(const s of [-1,1]){ const h=new THREE.Mesh(new THREE.TorusGeometry(.08,.02,6,10),GHOST_M); h.position.set(SX,SHELF_Y+.52,-2.15+s*.22); h.rotation.y=Math.PI/2; trophyG.add(h); trophyParts.push(h); }
// 해커 선글라스 받침대
const shadesStandG=new THREE.Group(); scene.add(shadesStandG);
(()=>{
  cyl(.03,.05,.22,6,WOOD_D,SX,SHELF_Y+.15,-1.45,shadesStandG);
  const m=mat('#1a1424',{roughness:.25,metalness:.35});
  for(const s of [-1,1]) box(.05,.13,.2,m,SX+.02,SHELF_Y+.32,-1.45+s*.13,shadesStandG);
  box(.04,.03,.1,m,SX+.02,SHELF_Y+.35,-1.45,shadesStandG);
})();
// 보석 3칸
const GEM_M=mat('#7fe0f5',{roughness:.3,emissive:C('#2a8fb0'),emissiveIntensity:.35});
const gems=[0,1,2].map(i=>{ const g=new THREE.Mesh(new THREE.OctahedronGeometry(.11),GEM_M); g.scale.y=1.4; g.position.set(SX,SHELF_Y+.2,-.95+i*.24); g.castShadow=true; shelfG.add(g); return g; });

/* 왼쪽 벽: 액자(소개) · 키링 보드(코브 몰) */
const frameG=new THREE.Group(); scene.add(frameG);
(()=>{
  box(.08,1.05,1.3,TRIM,-3.97,3.2,1.25,frameG);
  const pic=picture(1.12,.87,canvasTex(224,174,(g,w,h)=>{
    g.fillStyle='#fde7f1'; g.fillRect(0,0,w,h);
    g.fillStyle='#ff9ccb';
    g.beginPath(); g.arc(112,98,44,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(76,64,17,0,Math.PI*2); g.arc(148,64,17,0,Math.PI*2); g.fill();
    g.fillStyle='#171220'; g.beginPath(); g.ellipse(98,96,6,7,0,0,Math.PI*2); g.ellipse(126,96,6,7,0,0,Math.PI*2); g.fill();
    g.fillStyle='#b0306e'; g.font='700 24px Gaegu, "Apple SD Gothic Neo", sans-serif'; g.textAlign='center'; g.fillText('👋 소개',112,164);
  }));
  pic.rotation.y=Math.PI/2; pic.position.set(-3.92,3.2,1.25); frameG.add(pic);
})();
const boardG=new THREE.Group(); scene.add(boardG);
(()=>{
  box(.08,.95,1.9,mat('#e9c29a'),-3.97,1.9,1.25,boardG);
  box(.1,.06,1.96,TRIM,-3.96,2.4,1.25,boardG); box(.1,.06,1.96,TRIM,-3.96,1.4,1.25,boardG);
  const cols=['#ff9ccb','#a6d4ff','#aeeccf','#d4bfff','#ffc98a','#ff8f86','#8fe3c4'];
  cols.forEach((hex,i)=>{
    const row=i<4?0:1, z=.62+(row?(i-4)*.42+.21:i*.42), y=row?1.62:2.1;
    box(.05,.03,.03,DARK,-3.91,y+.13,z,boardG);
    const d=cyl(.12,.12,.04,14,i===6?RAINBOW_M:mat(hex,{roughness:.5}),-3.88,y,z,boardG); d.rotation.z=Math.PI/2;
  });
})();

/* 바닥: 러그 · 빈백 · 화분(가을 나무) */
cyl(1.7,1.7,.03,40,mat('#ffb0cf'),.3,.015,.9).castShadow=false;
cyl(1.25,1.25,.035,40,mat('#ffd9ea'),.3,.02,.9).castShadow=false;
const bean=new THREE.Mesh(new THREE.SphereGeometry(.78,16,12),mat('#c3a6ff')); bean.scale.set(1,.6,1); bean.position.set(-2.2,.46,2.3); bean.castShadow=true; bean.receiveShadow=true; scene.add(bean);
cyl(.32,.25,.55,12,WOOD,3.35,.28,-3.3);
[['#f2a33f',.0,1.15,0,.42],['#ea8350',.22,1.45,.1,.32],['#f7c55a',-.18,1.5,-.12,.3]].forEach(([hex,dx,y,dz,r])=>{
  const l=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),mat(hex)); l.position.set(3.35+dx,y,-3.3+dz); l.castShadow=true; scene.add(l);
});

/* ══════════ 내 코브 ══════════ */
const RS=.62;   // 방 안의 코브 크기 (몸 중심 높이 = RS)
const cove=F.makeCove('#ff9ccb');
cove.group.scale.setScalar(RS); scene.add(cove.group);
const coveShades=(()=>{   // 해커 선글라스
  const m=new THREE.MeshStandardMaterial({color:C('#1a1424'),roughness:.25,metalness:.35});
  const g=new THREE.Group();
  for(const ex of [-.2,.2]){ const l=new THREE.Mesh(new THREE.BoxGeometry(.27,.17,.05),m); l.position.set(ex,.08,.66); l.rotation.y=ex*.7; g.add(l); }
  const br=new THREE.Mesh(new THREE.BoxGeometry(.16,.035,.035),m); br.position.set(0,.12,.68); g.add(br);
  g.visible=false; cove.bodyG.add(g); return g;
})();
const blob=(()=>{
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(0,0,0,1)'); r.addColorStop(.55,'rgba(0,0,0,.5)'); r.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=r; g.fillRect(0,0,64,64);
  const b=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),color:C('#5a2f5c'),transparent:true,opacity:.35,depthWrite:false}));
  b.scale.set(1.3,1,1.3); b.renderOrder=1; scene.add(b); return b;
})();

// 코브가 머무는 자리 (y가 있으면 그 위로 폴짝 올라감)
// 코브가 머무는 자리. y가 있는 자리(의자·빈백)는 옆자리(ax,az)까지 걸어간 뒤 폴짝 올라앉음 → 가구를 뚫고 걷지 않게
const SPOTS=[
  {x:1.6, z:-2.35, y:.86+RS, ax:1.45, az:-1.45, face:Math.PI, act:'work', say:['작업 중… 🖥️','오늘은 뭐 만들지?']},
  {x:.35, z:.95, face:null, act:'idle', say:['여기가 내 오피스야!','들판 가서 금화 주울까?']},
  {x:-2.2, z:2.25, y:.84+RS, ax:-1.0, az:1.4, face:null, act:'sit', say:['빈백 최고…','조금만 쉬었다 갈게']},
  {x:-1.4, z:-3.0, face:Math.PI, act:'look', say:['밖에 거품 떠다닌다!','해 지는 들판 예쁘다']},
  {x:-2.95, z:-1.9, face:-Math.PI/2, act:'look', say:['트로피 늘었으면…','저금통 얼마나 찼지?']},
  {x:-2.95, z:.9, face:-Math.PI/2, act:'look', say:['키링 뭐 살까?','하트 선물해야지 💗']},
];
const lerpAngle=(a,b,t)=>{ let d=((b-a+Math.PI)%(Math.PI*2))-Math.PI; if(d<-Math.PI) d+=Math.PI*2; return a+d*t; };
const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const me={spot:SPOTS[1], mode:'stay', t:0, stay:2.5, x:SPOTS[1].x, z:SPOTS[1].z, y:RS, h:0.7, to:null, gait:0, hop:0,
  hx0:0, hz0:0, hopFrom:0, hx1:0, hz1:0, hopTo:0, hopSeat:false, bw:0};
function startHop(x1,z1,y1,seat){ me.mode='hop'; me.t=0; me.hx0=me.x; me.hz0=me.z; me.hopFrom=me.y; me.hx1=x1; me.hz1=z1; me.hopTo=y1; me.hopSeat=seat; }
function pickNext(){
  const choices=SPOTS.filter(s=>s!==me.spot);
  me.to=choices[Math.floor(Math.random()*choices.length)];
  if(me.spot.y) startHop(me.spot.ax,me.spot.az,RS,false);   // 앉아 있던 자리에서 옆으로 폴짝 내려옴
  else { me.mode='walk'; me.t=0; }
}
function updateCove(dt,T){
  const g=cove, grp=g.group;
  me.t+=dt;
  let walking=false;
  if(me.mode==='stay'){
    if(me.t>me.stay) pickNext();
  } else if(me.mode==='hop'){   // 옆자리 ↔ 의자·빈백 위로 포물선 폴짝
    const k=Math.min(me.t/.5,1), e=ease(k);
    me.x=me.hx0+(me.hx1-me.hx0)*e; me.z=me.hz0+(me.hz1-me.hz0)*e;
    me.y=me.hopFrom+(me.hopTo-me.hopFrom)*e+Math.sin(k*Math.PI)*.4;
    const hd=Math.hypot(me.hx1-me.hx0,me.hz1-me.hz0);
    if(hd>.01) me.h=lerpAngle(me.h,Math.atan2(me.hx1-me.hx0,me.hz1-me.hz0),Math.min(1,dt*10));
    if(k>=1){
      me.x=me.hx1; me.z=me.hz1; me.y=me.hopTo;
      if(me.hopSeat){ me.mode='stay'; me.t=0; me.stay=4+Math.random()*4; }
      else { me.mode='walk'; me.t=0; }
    }
  } else if(me.mode==='walk'){
    const tx=me.to.y?me.to.ax:me.to.x, tz=me.to.y?me.to.az:me.to.z;   // 앉는 자리는 옆자리까지만 걸어감
    const dx=tx-me.x, dz=tz-me.z, d=Math.hypot(dx,dz), step=1.3*dt;
    if(d<=step){
      me.x=tx; me.z=tz; me.spot=me.to;
      if(me.spot.y) startHop(me.spot.x,me.spot.z,me.spot.y,true);
      else { me.mode='stay'; me.t=0; me.stay=3.5+Math.random()*3.5; }
    } else {
      me.x+=dx/d*step; me.z+=dz/d*step; walking=true;
      me.h=lerpAngle(me.h,Math.atan2(dx,dz),Math.min(1,dt*8));
    }
  }
  if(me.mode==='stay'){
    const s=me.spot, want=s.face!=null?s.face:Math.atan2(camera.position.x-me.x,camera.position.z-me.z);
    me.h=lerpAngle(me.h,want,Math.min(1,dt*4));
  }
  if(walking) me.gait+=dt*9;
  // 콩 (누르면 점프)
  let jump=0; if(me.hop>0){ me.hop=Math.max(0,me.hop-dt); jump=Math.sin((1-me.hop/.5)*Math.PI)*.45; }
  const bob=walking?Math.abs(Math.sin(me.gait))*.08:Math.sin(T*1.6)*.015;
  grp.position.set(me.x,me.y+bob+jump,me.z);
  grp.rotation.set(0,me.h,0);
  const act=me.mode==='stay'?me.spot.act:'';
  g.bodyG.rotation.set(act==='sit'?-.18:walking?.08:0,0,walking?Math.sin(me.gait)*.07:act==='look'?Math.sin(T*.9)*.06:Math.sin(T*.8)*.03);
  F.poseG(g,i=>{
    const ph=(i%2)*Math.PI;
    if(walking){ const s=Math.sin(me.gait+ph+(i<2?Math.PI:0)); return i<2?[0,Math.abs(s)*.04,s*.13]:[0,Math.max(0,s)*.2,s*.16]; }
    if(act==='work') return i<2?[i?-.12:.12,.28+Math.max(0,Math.sin(T*12+ph))*.06,.28]:[0,0,.1];
    if(act==='sit') return i<2?[0,.05,.05]:[0,.18,.32];
    if(jump>0) return i<2?[0,.35,0]:[0,.05,0];
    return i<2?[0,Math.sin(T*1.3+i)*.02,0]:[0,0,0];
  });
  // 발밑 그림자 (높은 데 앉아 있으면 그 아래 바닥에 흐릿하게)
  blob.position.set(me.x,.04,me.z); blob.material.opacity=me.y>RS+.1?.18:.35;
}

/* 색 · 선글라스 · 전시물: 가방 상태에 맞춤 */
const rainbowCol=new THREE.Color();
let look={name:'분홍',hex:'#ff9ccb',rainbow:false,hacker:false};
function refresh(){
  look=F.coveLook?F.coveLook():look;
  if(W) look.hacker=W.get('coin')>=9999;
  if(!look.rainbow&&look.hex){ cove.fur.color.copy(C(look.hex)); cove.fur.emissive.copy(cove.fur.color); }
  coveShades.visible=!!look.hacker;
  const coins=W?W.get('coin'):0, fill=Math.min(1,coins/(W?W.COUPON_COINS:100));
  const h=.03+.5*fill;
  coinStack.scale.y=h; coinStack.position.y=SHELF_Y+.06+h/2; coinStack.visible=fill>0;
  const rainbow=W?!!W.state.rainbow:false;
  trophyParts.forEach(p=>{ p.material=rainbow?RAINBOW_M:GHOST_M; });
  shadesStandG.visible=!!look.hacker;
  const gemN=W?Math.min(3,W.get('gem')):0;
  gems.forEach((g,i)=>{ g.material=i<gemN?GEM_M:GHOST_M; });
  renderer.shadowMap.needsUpdate=true;
}

/* ══════════ 누를 수 있는 것들 ══════════ */
const tip=document.getElementById('roomTip'), bubble=document.getElementById('roomBubble');
const open=(id,e)=>{ if(window.covvOpenScreen) window.covvOpenScreen(id,e?{x:e.clientX,y:e.clientY}:{}); };
const HOT=[
  {obj:monitorG, label:'💻 작업물 보기', act:e=>open('work',e)},
  {obj:mugG, label:'☕ 연락하기', act:e=>open('contact',e)},
  {obj:boardG, label:'🛍️ 코브 몰 가기', act:e=>open('mall',e)},
  {obj:frameG, label:'👋 소개 보기', act:e=>open('about',e)},
  {obj:windowG, label:'🌅 들판으로 나가기', act:e=>{ if(window.covvCloseScreen) window.covvCloseScreen(e?{x:e.clientX,y:e.clientY}:{}); }},
  {obj:jarG, label:'💰 저금통 · 가방 보기', act:()=>window.covvOffice&&window.covvOffice.showTab('bag')},
  {obj:shelfG, label:'🏆 트로피 · 가방 보기', act:()=>window.covvOffice&&window.covvOffice.showTab('bag')},
  {obj:trophyG, label:'🏆 트로피 · 가방 보기', act:()=>window.covvOffice&&window.covvOffice.showTab('bag')},
  {obj:shadesStandG, label:'🕶️ 해커 코브 기념품', act:()=>window.covvOffice&&window.covvOffice.showTab('bag')},
];
// 마우스를 올리면 살짝 커짐 — 물건마다 자기 가운데를 기준으로 (그룹은 원점에 있으니 위치로 보정)
const bb=new THREE.Box3();
HOT.forEach(h=>{ h.cur=1; h.center=bb.setFromObject(h.obj).getCenter(new THREE.Vector3()); });
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function setRay(e){ const r=cvs.getBoundingClientRect(); ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera); }
const shown=o=>{ for(;o;o=o.parent) if(o.visible===false) return false; return true; };
function pick(e){
  setRay(e);
  const hits=ray.intersectObjects([cove.group,...HOT.filter(h=>h.obj.visible).map(h=>h.obj)],true);
  for(const hit of hits){
    if(!shown(hit.object)) continue;   // 안 보이는 부품(숨은 선글라스·빈 저금통 속)은 건너뜀
    for(let o=hit.object;o;o=o.parent){
      if(o===cove.group) return 'cove';
      const h=HOT.find(h=>h.obj===o); if(h) return h;
    }
    return null;
  }
  return null;
}
let hover=null, bubbleT=0;
const parallax=new THREE.Vector2(), parallaxT=new THREE.Vector2();
cvs.addEventListener('pointermove',e=>{
  const r=cvs.getBoundingClientRect();
  parallaxT.set(((e.clientX-r.left)/r.width-.5)*2,((e.clientY-r.top)/r.height-.5)*2);
  if(IS_TOUCH) return;
  const p=pick(e), next=p&&p!=='cove'?p:null;
  if(next&&next!==hover&&next.cur===1) next.center=bb.setFromObject(next.obj).getCenter(next.center);   // 저금통처럼 모양이 바뀌는 물건도 지금 가운데 기준으로
  hover=next;
  cvs.style.cursor=p?'pointer':'';
  if(tip){
    if(hover){
      tip.textContent=hover.label; tip.classList.add('show');
      const tx=Math.min(r.width-tip.offsetWidth-6,e.clientX-r.left+14), ty=Math.min(r.height-tip.offsetHeight-6,e.clientY-r.top+10);
      tip.style.transform=`translate(${Math.max(6,tx)}px,${Math.max(6,ty)}px)`;
    } else tip.classList.remove('show');
  }
});
cvs.addEventListener('pointerleave',()=>{ hover=null; if(tip) tip.classList.remove('show'); parallaxT.set(0,0); });
cvs.addEventListener('click',e=>{
  const p=pick(e);
  if(p==='cove'){ me.hop=.5; say(); return; }
  if(p){ if(tip) tip.classList.remove('show'); p.act(e); }
});
function say(){
  if(!bubble) return;
  const name=W?W.profile().name:'';
  const lines=[...(me.mode==='stay'?me.spot.say:['어디 가지~']),`${name}님 안녕!`,'오늘도 금화 주우러 갈까?'];
  if(look.hacker) lines.push('해킹해도 할인은 1개당 100원이야 ㅋㅋ');
  if(look.rainbow) lines.push('무지개 코브 멋지지? 🌈');
  bubble.textContent=lines[Math.floor(Math.random()*lines.length)];
  bubble.classList.add('show'); bubbleT=2.6; me.bw=bubble.offsetWidth;
}

/* ══════════ 크기 · 렌더 ══════════ */
const tv=new THREE.Vector3();
function resize(){
  const w=stage.clientWidth||1, h=stage.clientHeight||1, a=w/h;
  camera.aspect=a;
  camDist=a<1?1.45:a<1.3?1.15:1;   // 세로로 긴 화면이면 한발 물러서서 방 전체가 보이게
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,MAX_DPR));
  renderer.setSize(w,h);
  if(active) drawOnce();
}
function drawOnce(){   // 첫 장면이 그려지면 '꾸미는 중' 가림막을 걷음
  renderer.render(scene,camera);
  if(first){ first=false; const l=document.getElementById('roomLoading'); if(l) l.classList.add('hide'); }
}
new ResizeObserver(resize).observe(stage);

let active=false, visible=true, rafId=null, last=0, prev=0, T=0, first=true;
const camPos=new THREE.Vector3();
function frame(now){
  rafId=requestAnimationFrame(frame);
  const iv=1000/FPS;
  if(now-last<iv-2) return;
  last=Math.min(now,Math.max(last+iv,now-iv));
  const dt=Math.min((now-prev)/1000,.05); prev=now; T+=dt;
  update(dt);
  drawOnce();
}
function update(dt){
  RAINBOW_M.uniforms.uTime.value=T;
  if(look.rainbow){ rainbowCol.setHSL((T*.12)%1,.8,.74).convertSRGBToLinear(); cove.fur.color.copy(rainbowCol); cove.fur.emissive.copy(rainbowCol); }
  updateCove(dt,T);
  // 마우스를 따라 살짝 움직이는 카메라 (싸이월드 미니룸을 비스듬히 보는 느낌)
  parallax.lerp(parallaxT,Math.min(1,dt*3));
  camPos.copy(CAM).multiplyScalar(camDist); camPos.x+=parallax.x*.8-parallax.y*.2; camPos.z+=-parallax.x*.8-parallax.y*.2; camPos.y+=-parallax.y*.4;
  camera.position.lerp(camPos,Math.min(1,dt*4)); camera.lookAt(LOOK);
  for(const h of HOT){
    const want=hover===h?1.04:1; if(Math.abs(want-h.cur)<1e-4&&h.cur===want) continue;
    h.cur+=(want-h.cur)*Math.min(1,dt*12); if(Math.abs(want-h.cur)<1e-4) h.cur=want;
    h.obj.scale.setScalar(h.cur); h.obj.position.copy(h.center).multiplyScalar(1-h.cur);
  }
  if(bubble&&bubbleT>0){
    bubbleT-=dt;
    tv.set(me.x,cove.group.position.y+RS*1.35,me.z).project(camera);
    const sw=stage.clientWidth, hw=(me.bw||120)/2+6, bx=Math.min(sw-hw,Math.max(hw,(tv.x*.5+.5)*sw));
    bubble.style.transform=`translate(${bx.toFixed(1)}px,${Math.max(40,(-tv.y*.5+.5)*stage.clientHeight).toFixed(1)}px) translate(-50%,-100%)`;
    if(bubbleT<=0) bubble.classList.remove('show');
  }
}
function run(){ if(active&&visible&&rafId===null&&!document.hidden){ last=prev=performance.now(); rafId=requestAnimationFrame(frame); } }
function halt(){ if(rafId!==null){ cancelAnimationFrame(rafId); rafId=null; } }
new IntersectionObserver(([e])=>{ visible=e.isIntersecting; visible?run():halt(); }).observe(stage);
document.addEventListener('visibilitychange',()=>{ document.hidden?halt():run(); });

camera.position.copy(CAM); camera.lookAt(LOOK);
refresh(); resize();
renderer.shadowMap.needsUpdate=true;
if(W) W.on(()=>{ if(active) refresh(); });

window.covvRoom={
  resume(){ active=true; refresh(); resize(); drawOnce(); run(); },
  pause(){ active=false; halt(); if(tip) tip.classList.remove('show'); },
  refresh,
};
window._room={renderer,scene,camera,cove,me,refresh,HOT,step(s){ for(let t=0;t<s;t+=1/60) update(1/60); drawOnce(); }};
// 불러오는 중에 이미 내 오피스 화면이 열려 있으면 바로 시작
if(document.getElementById('office')&&document.getElementById('office').classList.contains('open')) window.covvRoom.resume();
})();
