/* ══════════════════════════════════════════════════════════
   코브 몰 히어로 — 1분 2D 모션 광고 (캔버스 2D, 소리 없음 · 반복)
   - 코브 몰 화면 맨 위 #heroFilm에 그림. 아래 막대: 멈춤/재생 · 진행 줄 · '키링 보러 가기'(제품으로 내려감)
   - render(t)는 시간 t(0~60초)만 보고 그리는 순수 함수 → 멈췄다 이어 봐도 같은 화면, 끝 → 처음도 도화지 찢기로 이어짐
   - 대본 7장면 = 종이 8장(SHEETS, ⑤는 가게/진열대 두 장). 바뀔 때 나가는 화면을 버퍼에 그려 찢김선으로 위·아래로 벌림
   - 코브 몰 화면이 열려 있고 · 화면에 보이고 · 탭이 보일 때만 돌림(30fps · 해상도 상한) → 그래픽 카드 발열 줄임
   - 시안은 기획서 artifact '코브 몰 히어로 필름'(시안 2). 확정되면 힉스필드 영상으로 바꿀 자리(자막·쿠폰 글자·찢기 전환은 코드 합성)
   - mall.js 다음, screens.js 전에 불러옴 (주소가 #mall이면 screens.js가 바로 열면서 보내는 covv-screen을 받아야 함)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const cv=document.getElementById('heroFilm');
if(!cv||!cv.getContext) return;
const ctx=cv.getContext('2d');
if(!ctx) return;
const box=document.getElementById('mallHero');
const playBtn=box&&box.querySelector('[data-hero-play]'), fill=box&&box.querySelector('[data-hero-fill]'), shopBtn=box&&box.querySelector('[data-hero-shop]');

/* ══════════ 그림 도구 ══════════ */
const W=1920, H=1080, DUR=60, TAU=Math.PI*2, DEG=Math.PI/180;   // W·H: 광고 원본 크기(1920×1080 기준으로 그리고 캔버스에 맞춰 줄임)
const FPS=30;                                                   // 그리기 상한 (발열)
const MAX_PX=1280;                                              // 캔버스 실제 가로 픽셀 상한
const SERIF='Hahmlet, "Noto Serif KR", AppleMyungjo, serif';
const SANS='"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif';
const MONO='"IBM Plex Mono", ui-monospace, Menlo, monospace';
const INK='#1d1a22', PAPER='#f3eee6', ROSE='#cf6f88', GOLD='#d2ad5b', GOLD_D='#a9853a', VERM='#cc4e3e', MUTED='#8a8190';
const COL={pink:'#f6a7c6',mint:'#a3dcc6',sky:'#a2c6ee',lav:'#c7b8ef',lemon:'#f0d98a',cream:'#f3dcc0'};
const IRI=['#f5b8c9','#f6d2b0','#f2e6a6','#c6e8d4','#bcd6f2','#d4c6f1','#f5b8c9'];   // 무지개 코브 (파스텔 무지개)
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

const k01=x=>x<0?0:x>1?1:x;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,k)=>a+(b-a)*k;
const seg=(t,a,b)=>k01((t-a)/(b-a));
const eIO3=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const eOut=k=>1-Math.pow(1-k,3);
const eIn=k=>k*k*k;
const eExpo=k=>k>=1?1:1-Math.pow(2,-10*k);
const eBackLite=k=>{ const c1=.9, c3=c1+1; return 1+c3*Math.pow(k-1,3)+c1*Math.pow(k-1,2); };   // 살짝만 넘침
const frac=x=>x-Math.floor(x);
const arc=k=>4*k*(1-k);
const softSq=d=>d<0||d>.8?1:1+.13*Math.exp(-d*8)*Math.cos(d*18);   // 착지: 살짝 눌렸다 제자리
const stepK=(k,n)=>k>=1?1:Math.floor(k*n)/n;                       // 스톱모션 계단
const edge=f=>f<0?Math.min(f,-.12):Math.max(f,.12);                 // 빙글 돌 때 옆모습에서도 얇게 남김
function rng(s){ return ()=>{ s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const hash=n=>{ const x=Math.sin(n*127.1)*43758.5453; return x-Math.floor(x); };
const hex2=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mix=(a,b,k)=>{ const A=hex2(a), B=hex2(b); return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*k)).join(',')})`; };
const quad=(a,m,b,u)=>(1-u)*(1-u)*a+2*(1-u)*u*m+u*u*b;

function circ(c,x,y,r){ c.beginPath(); c.arc(x,y,r,0,TAU); }
function ell(c,x,y,rx,ry){ c.beginPath(); c.ellipse(x,y,rx,ry,0,0,TAU); }
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function poly(c,p){ c.beginPath(); c.moveTo(p[0][0],p[0][1]); for(let i=1;i<p.length;i++) c.lineTo(p[i][0],p[i][1]); c.closePath(); }
function tornRect(w,h,seed,step,j){   // 손으로 찢은 색종이 테두리
  const r=rng(seed), p=[], q=()=>(r()-.5)*2*j;
  for(let x=-w/2;x<w/2;x+=step) p.push([x,-h/2+q()]);
  for(let y=-h/2;y<h/2;y+=step) p.push([w/2+q(),y]);
  for(let x=w/2;x>-w/2;x-=step) p.push([x,h/2+q()]);
  for(let y=h/2;y>-h/2;y-=step) p.push([-w/2+q(),y]);
  return p;
}
function spaced(c,txt,x,y,sp,align){   // 자간 넓힌 영문 라벨 (canvas letterSpacing은 사파리 옛 버전에 없음)
  const ch=[...txt], ws=ch.map(s=>c.measureText(s).width), total=ws.reduce((a,b)=>a+b,0)+sp*(ch.length-1);
  let cx=align==='right'?x-total:align==='center'?x-total/2:x; c.textAlign='left';
  ch.forEach((s,i)=>{ c.fillText(s,cx,y); cx+=ws[i]+sp; });
}

/* ── 코브 (field.js makeCove 정면 2D: 몸 r68 · 눈 r15.5 · 귀 r26 · 손 r20 · 발 28×15, 평면 채색) ── */
const palCache={};
const covePal=col=>palCache[col]||(palCache[col]={fur:col,line:mix(col,'#2e1a35',.5),inner:mix(col,'#ffffff',.55)});
function pawXY(o){
  const cu=o.curl||0, d=lerp(80,54,cu);
  const al=(160+(o.pl||0)*58-cu*38)*DEG, ar=(20-(o.pr||0)*58+cu*38)*DEG;
  return [Math.cos(al)*d,Math.sin(al)*d+cu*8,Math.cos(ar)*d,Math.sin(ar)*d+cu*8];
}
function coveSil(c,o){
  const fy=lerp(85,72,o.curl||0), [lx,ly,rx,ry]=pawXY(o);
  c.beginPath();
  for(const sx of [-1,1]){ c.moveTo(sx*25+28,fy); c.ellipse(sx*25,fy,28,15,0,0,TAU); c.moveTo(sx*48+26,-42); c.arc(sx*48,-42,26,0,TAU); }
  c.moveTo(68,0); c.arc(0,0,68,0,TAU); c.moveTo(lx+20,ly); c.arc(lx,ly,20,0,TAU); c.moveTo(rx+20,ry); c.arc(rx,ry,20,0,TAU);
}
function drawCove(c,o){   // o: x·y(발 밑) · s · col · lift · sq(찌부) · rot · flip · back · eyes · blink · look · pl·pr(손 들기) · curl · cut · hat · iri · sheen · a
  const s=o.s||1, P=covePal(o.col||COL.pink), lift=o.lift||0, sq=o.sq||1;
  c.save(); c.translate(o.x,o.y);
  if(o.a!=null) c.globalAlpha*=o.a;
  if(o.shadow!==false){ const k=clamp(1-lift/420,.4,1); c.fillStyle='rgba(20,14,30,.13)'; ell(c,0,2*s,58*s*k,9*s*k); c.fill(); }
  c.translate(0,-lift); c.rotate(o.rot||0); c.scale(s*sq*(o.flip==null?1:o.flip),s/sq); c.translate(0,-100);
  c.lineJoin='round'; c.lineCap='round';
  if(o.cut){   // 스티커처럼 오린 흰 테두리 + 종이 그림자
    c.save(); c.translate(5,7); coveSil(c,o); c.fillStyle='rgba(60,40,25,.18)'; c.fill(); c.lineWidth=24; c.strokeStyle='rgba(60,40,25,.18)'; c.stroke(); c.restore();
    coveSil(c,o); c.fillStyle='#fffdf8'; c.fill(); c.lineWidth=24; c.strokeStyle='#fffdf8'; c.stroke();
  }
  let fur=P.fur, line=P.line, inner=P.inner;
  if(o.iri!=null){ const a=o.iri, g=c.createLinearGradient(Math.cos(a)*-120,Math.sin(a)*-120,Math.cos(a)*120,Math.sin(a)*120); IRI.forEach((h,i)=>g.addColorStop(i/(IRI.length-1),h)); fur=g; line='#8b7aa3'; inner='#ffffff'; }
  c.lineWidth=2.6; c.strokeStyle=line;
  const paint=f=>{ c.fillStyle=f; c.fill(); c.stroke(); };
  const fy=lerp(85,72,o.curl||0);
  for(const sx of [-1,1]){ ell(c,sx*25,fy,28,15); paint(fur); }
  for(const sx of [-1,1]){ circ(c,sx*48,-42,26); paint(fur); circ(c,sx*58,-51,9); c.fillStyle=inner; c.fill(); }
  circ(c,0,0,68); paint(fur);
  c.fillStyle='rgba(255,255,255,.2)'; ell(c,-22,-32,26,17); c.fill();
  if(o.sheen!=null&&o.sheen>0&&o.sheen<1){   // 무지개 코브: 빛줄기가 대각선으로 지나감
    c.save(); circ(c,0,0,67); c.clip(); c.rotate(.5); const x=lerp(-150,150,o.sheen), g=c.createLinearGradient(x-40,0,x+40,0);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.5,'rgba(255,255,255,.65)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(-160,-160,320,320); c.restore();
  }
  if(o.hat){ c.fillStyle=o.hat; ell(c,8,-64,44,15); c.fill(); c.stroke(); circ(c,10,-80,6); c.fill(); c.stroke(); }
  const [lx,ly,rx,ry]=pawXY(o);
  circ(c,lx,ly,20); paint(fur); circ(c,rx,ry,20); paint(fur);
  if(!o.back){
    const lk=o.look||[0,0]; c.save(); c.translate(lk[0],lk[1]);
    const ey=o.eyes||'open';
    if(ey==='open'){
      const b=o.blink||0, ery=15.5*(1-b*.9);
      c.fillStyle='#171220'; ell(c,-20,-7,15.5,ery); c.fill(); ell(c,20,-7,15.5,ery); c.fill();
      if(b<.5){ c.fillStyle='#fff'; circ(c,-14.4,-15+b*8,5); c.fill(); circ(c,14.4,-15+b*8,5); c.fill(); }
    } else {
      c.strokeStyle='#171220'; c.lineWidth=5; c.beginPath();
      if(ey==='joy'){ c.moveTo(-32,-4); c.quadraticCurveTo(-20,-19,-8,-4); c.moveTo(8,-4); c.quadraticCurveTo(20,-19,32,-4); }
      else { c.moveTo(-32,-9); c.quadraticCurveTo(-20,3,-8,-9); c.moveTo(8,-9); c.quadraticCurveTo(20,3,32,-9); }
      c.stroke();
    }
    c.fillStyle='#2a1418'; ell(c,0,18,7.2,4.7); c.fill();
    c.restore();
  }
  c.restore();
}
function pawWorld(o,left){ const [lx,ly,rx,ry]=pawXY(o), s=o.s||1, sq=o.sq||1, px=left?lx:rx, py=left?ly:ry; return [o.x+px*s*sq*(o.flip==null?1:o.flip),o.y-(o.lift||0)+(py-100)*s/sq]; }

/* ── 소품 (평면 · 가는 선) ── */
function drawBubble(c,x,y,r,o){
  o=o||{}; const w=o.wob||0;
  c.save(); c.translate(x,y); c.scale(1+w,1-w); if(o.a!=null) c.globalAlpha*=o.a;
  const g=c.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r); g.addColorStop(0,'rgba(255,255,255,.02)'); g.addColorStop(.8,'rgba(255,255,255,.08)'); g.addColorStop(1,'rgba(255,255,255,.3)');
  c.fillStyle=g; circ(c,0,0,r); c.fill();
  c.lineWidth=2; c.strokeStyle=o.dark?'rgba(29,26,34,.42)':'rgba(255,255,255,.82)'; circ(c,0,0,r); c.stroke();
  c.lineWidth=3; c.lineCap='round'; c.strokeStyle=o.dark?'rgba(29,26,34,.3)':'rgba(255,255,255,.9)'; c.beginPath(); c.arc(0,0,r*.76,3.7,4.25); c.stroke();
  c.restore();
}
function drawPop(c,x,y,r,k,col){   // 거품이 터질 때: 가는 고리 + 점
  if(k<=0||k>=1) return; const e=eExpo(k);
  c.save(); c.translate(x,y); c.globalAlpha*=1-k;
  c.strokeStyle=col; c.lineWidth=1.5; circ(c,0,0,r*(1+e*.3)); c.stroke();
  c.fillStyle=col; for(let i=0;i<16;i++){ const a=i/16*TAU, d=r*(1+e*.6); circ(c,Math.cos(a)*d,Math.sin(a)*d,2.4*(1-k)+.6); c.fill(); }
  c.restore();
}
function drawCoin(c,x,y,r,spin){
  c.save(); c.translate(x,y); c.scale(Math.abs(Math.cos(spin))*.75+.25,1);
  c.fillStyle=GOLD; circ(c,0,0,r); c.fill();
  c.strokeStyle=GOLD_D; c.lineWidth=r*.09; circ(c,0,0,r*.64); c.stroke();
  c.restore();
}
function starPath(c,r,inner){ c.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r*(inner||.45):r; c.lineTo(Math.cos(a)*q,Math.sin(a)*q); } c.closePath(); }
function drawStar(c,x,y,r,rot){ c.save(); c.translate(x,y); c.rotate(rot||0); starPath(c,r); c.fillStyle='#dfbf72'; c.fill(); c.restore(); }
function heartPath(c,s){ c.beginPath(); c.moveTo(0,16*s); c.bezierCurveTo(-26*s,-2*s,-16*s,-22*s,0,-10*s); c.bezierCurveTo(16*s,-22*s,26*s,-2*s,0,16*s); c.closePath(); }
function drawHeart(c,x,y,size,rot,col){ c.save(); c.translate(x,y); c.rotate(rot||0); heartPath(c,size/24); c.fillStyle=col||ROSE; c.fill(); c.restore(); }
function drawCandy(c,x,y,r,rot,col){
  c.save(); c.translate(x,y); c.rotate(rot||0); c.fillStyle=col;
  for(const sx of [-1,1]){ c.beginPath(); c.moveTo(sx*r*.9,0); c.lineTo(sx*r*1.75,-r*.62); c.lineTo(sx*r*1.75,r*.62); c.closePath(); c.fill(); }
  rr(c,-r*1.05,-r*.75,r*2.1,r*1.5,r*.75); c.fill();
  c.strokeStyle='rgba(255,255,255,.55)'; c.lineWidth=r*.2; c.lineCap='round'; c.beginPath(); c.moveTo(-r*.45,r*.3); c.lineTo(r*.15,-r*.35); c.stroke();
  c.restore();
}
function drawOrb(c,x,y,r){   // 비밀 견본에서 날아오는 무지개 물방울
  c.save(); c.translate(x,y); const g=c.createLinearGradient(-r,-r,r,r); IRI.forEach((h,i)=>g.addColorStop(i/(IRI.length-1),h));
  circ(c,0,0,r); c.fillStyle=g; c.fill(); c.fillStyle='rgba(255,255,255,.6)'; ell(c,-r*.35,-r*.4,r*.28,r*.18); c.fill(); c.restore();
}
function drawTape(c,x,y,w,h,rot){
  c.save(); c.translate(x,y); c.rotate(rot);
  c.beginPath(); c.moveTo(-w/2,-h/2);
  for(let i=0;i<=4;i++) c.lineTo(w/2+(i%2?-4:2),-h/2+i*h/4);
  for(let i=4;i>=0;i--) c.lineTo(-w/2+(i%2?4:-2),-h/2+i*h/4);
  c.closePath(); c.fillStyle='rgba(246,240,228,.78)'; c.fill();
  c.fillStyle='rgba(205,190,170,.25)'; for(let i=-w/2+12;i<w/2-10;i+=18) c.fillRect(i,-h/2,1.5,h);
  c.restore();
}
function drawChute(c,o,k,noStrings,a){
  if(k<=0) return; const s=o.s||1;
  c.save(); c.translate(o.x,o.y-(o.lift||0)); c.rotate(o.rot||0); c.scale(s,s); c.translate(0,-100);
  if(a!=null) c.globalAlpha*=a;
  const cs=o.cs||1, R=170*cs, base=-215*cs, ox=lerp(.2,1,eExpo(k)), oy=lerp(.4,1,eExpo(k));   // cs: 코브 대비 덮개 크기
  if(!noStrings){ const [lx,ly,rx,ry]=pawXY(o); c.strokeStyle='rgba(29,26,34,.45)'; c.lineWidth=1.6; c.beginPath();
    [[-1,lx,ly],[-.4,lx,ly],[.4,rx,ry],[1,rx,ry]].forEach(([u,px,py])=>{ c.moveTo(u*R*ox,base); c.lineTo(px,py); }); c.stroke(); }
  c.translate(0,base); c.scale(ox,oy);
  for(let i=0;i<5;i++){ c.beginPath(); c.moveTo(0,0); c.arc(0,0,R,Math.PI+i*Math.PI/5,Math.PI+(i+1)*Math.PI/5); c.closePath(); c.fillStyle=i%2?'#f5ece8':ROSE; c.fill(); }
  c.lineWidth=1.6/Math.max(.3,ox); c.strokeStyle='rgba(29,26,34,.55)'; c.beginPath(); c.arc(0,0,R,Math.PI,TAU); c.closePath(); c.stroke();
  c.restore();
}
function drawSeal(c,x,y,k){   // 주홍 도장: 겹테두리 + 둥근 글자
  if(k<=0) return; const s=lerp(1.45,1,eExpo(k));
  c.save(); c.translate(x,y); c.rotate(-.2); c.scale(s,s); c.globalAlpha*=Math.min(1,k*3)*.92;
  c.strokeStyle=VERM; c.fillStyle=VERM; c.lineWidth=3.5; circ(c,0,0,70); c.stroke(); c.lineWidth=1.4; circ(c,0,0,50); c.stroke();
  c.font=`600 12px ${MONO}`; c.textAlign='center'; c.textBaseline='middle';
  const ring='COVV MALL · COUPON · 2026 · '; [...ring].forEach((ch,i)=>{ c.save(); c.rotate(i/ring.length*TAU); c.fillText(ch,0,-60); c.restore(); });
  c.font=`700 30px ${SERIF}`; c.fillText('코브',0,2);
  c.restore();
}

/* ══════════ 화면 공통 ══════════ */
let SC=1, fontVer=0, SAFE_B=H, SAFE_T=0;   // 원본 좌표로 화면에 보이는 맨 아래 · 메뉴에 안 가리는 맨 위 — 높이 800px로 위아래가 잘리거나 투명 메뉴가 덮으면 자막 · 숫자판 · 견본을 그 안으로 옮김
const pushTop=(y,b)=>Math.max(0,Math.min(SAFE_T+16-y,SAFE_B-40-(b||0)));   // 맨 위 글자가 y인 덩어리를 메뉴 밑에서 빼낼 거리 — 덩어리 아래 끝 b가 잘린 아래로 나가지 않는 만큼만
const L={}, SPR={};
function label(c,num,word,col){   // 위쪽 작은 장면 라벨 (잡지처럼)
  if(SAFE_T>70) return;   // 라벨 줄(79~92)이 투명 메뉴 · 잘린 위쪽에 걸리면 그리지 않음 (히어로가 맨 위라 지금은 늘 이쪽)
  c.save(); c.fillStyle=col; c.globalAlpha*=.7; c.font=`500 18px ${MONO}`; c.textBaseline='alphabetic';
  spaced(c,num,72,92,3); c.fillRect(112,86,40,1.5); spaced(c,word,168,92,5); spaced(c,'COVV MALL',W-72,92,5,'right');
  c.restore();
}
/* 명조 자막: 줄마다 아래에서 밀려 올라옴, 다음 자막이 있으면 위로 빠짐 (마지막 자막은 도화지와 함께 찢어짐) */
function cap(c,t,lines,t0,t1,o){
  if(t<t0-.2) return; if(t1!=null&&t>t1) return;
  o=o||{}; const size=o.size||66, x=o.x==null?140:o.x, lh=size*1.3, col=o.col||INK, mid=o.align==='center', ax=mid?960:x;
  const y0=Math.min(o.y||930,SAFE_B-36-(lines.length-1)*lh-(o.sub?size*.95+12:size*.25));   // 잘린 아래에 걸리면 보이는 곳까지 올림 (보통 화면에선 그대로)
  const out=t1!=null?eIO3(seg(t,t1-.5,t1)):0;
  c.save();
  if(!o.noRule){ const rk=eExpo(seg(t,t0-.2,t0+.6)), rw=84*rk*(1-out); c.fillStyle=o.accent||ROSE; c.fillRect(mid?960-rw/2:x,y0-size-30,rw,3); }
  c.font=`${o.w||600} ${size}px ${SERIF}`; c.textAlign=mid?'center':'left'; c.textBaseline='alphabetic'; c.fillStyle=col;
  lines.forEach((ln,i)=>{
    const k=eExpo(seg(t,t0+i*.12,t0+i*.12+.95)); if(k<=0) return; const y=y0+i*lh;
    c.save(); c.beginPath(); c.rect(0,y-size*1.1,W,size*1.42); c.clip(); c.fillText(ln,ax,y+(1-k)*size*1.3-out*size*1.3); c.restore();
  });
  if(o.sub){ const k=eExpo(seg(t,t0+.35,t0+1.3)); c.font=`500 ${o.subSize||30}px ${SANS}`; c.fillStyle=o.subCol||MUTED; c.globalAlpha*=k*(1-out); c.fillText(o.sub,ax,y0+(lines.length-1)*lh+size*.95+(1-k)*12); }
  c.restore();
}
const GRAIN=(()=>{   // 종이 결 (한 번만 만들어 무늬로 깔아 씀)
  const g=document.createElement('canvas'); g.width=g.height=192; const x=g.getContext('2d'), id=x.createImageData(192,192), r=rng(5);
  for(let i=0;i<id.data.length;i+=4){ const v=r()<.5?24:255; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=Math.floor(r()*r()*46); }
  x.putImageData(id,0,0); return g;
})();

/* ══════════ 장소 소품 — 한 컷만 봐도 어디인지 알게 (들판은 field.js와 같은 것: 가을 나무 · 보랏빛 바위 · 등불 · 벤치 · 울타리 · 금빛 풀 · 꽃 · 연못과 나무다리) ══════════ */
const LEAF=['#e9a04a','#f1c062','#e2845a','#dcab55'], TRUNK='#6e4557', WOOD='#b9765a', WOOD_D='#8e5444', LAMP='#3d2f5a', GLASS='#ffe3a3';
const ROCK=['#9483c4','#7a68ae','#5f4f8e'];                    // 바위: 윗면 · 앞면 · 옆면
const FLOWER=['#f3a5c4','#fbeef3','#c9b2f0','#f3d987','#ef9a86'];
const BUNT=[ROSE,'#f3d987','#a3dcc6','#a2c6ee','#c7b8ef'];       // 깃발 줄 색
const mixHex=(a,b,k)=>'#'+hex2(a).map((v,i)=>Math.round(v+(hex2(b)[i]-v)*k).toString(16).padStart(2,'0')).join('');
const haze=(cols,sky,k)=>cols.map(h=>mixHex(h,sky,k));          // 멀수록 하늘색에 묻힘
const CANOPY=[[-92,-262,60],[90,-268,62],[-48,-332,70],[46,-340,72],[0,-280,80],[-118,-314,46],[116,-320,48],[0,-396,58]];   // 잎 뭉치 [x,y,r] (나무 크기 1 · 밑동 기준)
const HANG=[[-80,-214],[12,-206],[98,-216]];                   // 잎 아래 키링 매다는 자리
function tree(c,x,gy,s,o){   // 둥근 가을 잎 뭉치 나무 · o: seed · cols · trunk · sil(한 색 실루엣) · rim·rimA(실루엣 가장자리 빛 · 빛 오는 쪽) · flip(-1 좌우 뒤집기, 같은 모양 반복 안 보이게)
  o=o||{}; const r=rng(o.seed||1), cols=o.cols||LEAF, sil=o.sil, fl=o.flip||1;
  c.save(); c.translate(x,gy); c.scale(s*fl,s);
  c.fillStyle=sil||o.trunk||TRUNK;
  c.beginPath(); c.moveTo(-17,0); c.quadraticCurveTo(-8,-120,-10,-250); c.lineTo(10,-250); c.quadraticCurveTo(8,-120,17,0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(4,-150); c.quadraticCurveTo(46,-182,74,-236); c.lineTo(84,-229); c.quadraticCurveTo(54,-172,9,-126); c.closePath(); c.fill();
  const B=CANOPY.map(([bx,by,br])=>[bx+(r()-.5)*16,by+(r()-.5)*16,br+(r()-.5)*12]).sort((a,b)=>a[1]-b[1]);
  if(sil){   // 실루엣: 빛 쪽으로 살짝 민 잎 뭉치를 테두리 색으로 먼저 깔고 위에 덮음 → 바깥 가장자리만 빛남
    if(o.rim){ const ra=fl<0?Math.PI-(o.rimA||0):(o.rimA||0), rw=(o.rimW||3.4)/s, dx=Math.cos(ra)*rw, dy=Math.sin(ra)*rw; c.fillStyle=o.rim; for(const [bx,by,br] of B){ circ(c,bx+dx,by+dy,br); c.fill(); } }
    c.fillStyle=sil; for(const [bx,by,br] of B){ circ(c,bx,by,br); c.fill(); }
    c.restore(); return;
  }
  const base=cols[(o.seed||1)%cols.length], sh=mixHex(base,'#6b3550',.22), hi=mixHex(base,'#fff4dc',.14);   // 한 그루는 한 색 덩어리 (잎 뭉치마다 색을 바꾸면 풍선 다발처럼 보임)
  c.fillStyle=sh; for(const [bx,by,br] of B){ circ(c,bx,by,br); c.fill(); }
  c.fillStyle=base; for(const [bx,by,br] of B){ circ(c,bx-br*.14,by-br*.18,br*.92); c.fill(); }   // 덮고 남은 오른쪽 아래 가장자리가 그늘
  c.fillStyle=hi; for(const [bx,by,br] of B.slice(0,3)){ circ(c,bx-br*.3,by-br*.34,br*.5); c.fill(); }
  c.restore();
}
function rock(c,x,gy,w,h,seed,cols){   // 각진 바위: 밝은 윗면 · 앞면 · 어두운 옆면
  const r=rng(seed), C3=cols||ROCK, j=()=>(r()-.5)*.14;
  const p=[[-.5,0],[-.52+j(),-.48+j()],[-.26+j(),-.94+j()*.4],[.14+j(),-1],[.46+j(),-.6+j()],[.5,0]].map(([u,v])=>[x+u*w,gy+v*h]), m=[x+(.06+j())*w,gy-.52*h];
  poly(c,p); c.fillStyle=C3[1]; c.fill();
  poly(c,[p[1],p[2],p[3],p[4],m]); c.fillStyle=C3[0]; c.fill();
  poly(c,[m,p[4],p[5],[x+.1*w,gy]]); c.fillStyle=C3[2]; c.fill();
}
function lantern(c,x,gy,s,o){   // 길가 등불: 기둥 + 유리 초롱 (빛 번짐은 lampGlow로 따로 그려 깜빡임)
  o=o||{}; const f=o.sil||LAMP;
  c.save(); c.translate(x,gy); c.scale(s,s); c.fillStyle=f;
  c.fillRect(-4,-172,8,172); c.fillRect(-14,-6,28,6); c.fillRect(-17,-176,34,6); c.fillRect(-19,-216,38,6);
  c.beginPath(); c.moveTo(-23,-214); c.lineTo(0,-234); c.lineTo(23,-214); c.closePath(); c.fill();
  c.fillStyle=o.glass||GLASS; c.fillRect(-14,-210,28,34); c.fillStyle=f; c.fillRect(-1.5,-210,3,34); c.strokeStyle=f; c.lineWidth=3; c.strokeRect(-14,-210,28,34);
  c.restore();
}
const lampY=(gy,s)=>gy-193*s;
function lampGlow(c,x,y,r,t,ph){ c.save(); c.globalAlpha*=.5+.1*Math.sin(t*5.3+ph)+.05*Math.sin(t*13.7+ph*2); c.drawImage(SPR.lamp,x-r,y-r,r*2,r*2); c.restore(); }
function bench(c,x,gy,s,o){   // 나무 벤치 (앞에서 본 모양) · o: sil(실루엣) · leg(다리 색)
  o=o||{}; c.save(); c.translate(x,gy); c.scale(s,s);
  c.fillStyle=o.sil||o.leg||WOOD_D; c.fillRect(-82,-54,9,54); c.fillRect(73,-54,9,54); c.fillRect(-86,-104,8,52); c.fillRect(78,-104,8,52);
  c.fillStyle=o.sil||WOOD; c.fillRect(-98,-60,196,12); c.fillRect(-98,-104,196,12); c.fillRect(-98,-84,196,12);
  c.fillStyle=o.sil||mixHex(WOOD,'#ffffff',.15); c.fillRect(-98,-66,196,6);   // 앉는 판 윗면 (울타리 가로대와 구별)
  c.restore();
}
function fence(c,x0,x1,gy,s,col,col2){   // 나무 울타리: 뾰족 기둥 + 가로대 두 줄
  c.fillStyle=col2||WOOD_D; c.fillRect(x0,gy-64*s,x1-x0,8*s); c.fillRect(x0,gy-32*s,x1-x0,8*s);
  c.fillStyle=col||WOOD; for(let x=x0;x<=x1;x+=104*s){ c.beginPath(); c.moveTo(x-7*s,gy); c.lineTo(x-7*s,gy-78*s); c.lineTo(x,gy-88*s); c.lineTo(x+7*s,gy-78*s); c.lineTo(x+7*s,gy); c.closePath(); c.fill(); }
}
function tuft(c,x,gy,h,t,ph,col,tip){   // 금빛 풀 한 포기 · t를 주면 바람에 살랑
  const sw=t==null?0:Math.sin(t*1.7+ph)*.16+Math.sin(t*4.1+ph*1.3)*.05;
  for(let i=0;i<7;i++){ const u=i/6-.5, bx=x+u*h*.42, hh=h*(.5+.5*hash(i*7.7+ph)), a=u*1.1+sw*(.6+hh/h*.6), tx=bx+Math.sin(a)*hh, ty=gy-Math.cos(a)*hh;
    c.beginPath(); c.moveTo(bx-h*.04,gy); c.quadraticCurveTo(bx+(tx-bx)*.2,gy-hh*.5,tx,ty); c.quadraticCurveTo(bx+(tx-bx)*.3,gy-hh*.45,bx+h*.04,gy); c.closePath(); c.fillStyle=i%2?col:tip; c.fill(); }
}
function grassMarks(c,seed,n,y0,y1,col,skip){   // 땅에 짧은 풀 획 (가까울수록 크게) · skip: 비워 둘 [x0,y0,x1,y1] (자막 자리)
  const r=rng(seed); c.strokeStyle=col; c.lineCap='round';
  for(let i=0;i<n;i++){ const x=r()*W, y=y0+(y1-y0)*Math.pow(r(),.8), s=.45+.9*(y-y0)/(y1-y0); if(skip&&x>skip[0]&&x<skip[2]&&y>skip[1]&&y<skip[3]) continue;
    c.lineWidth=1.6*s; c.beginPath(); c.moveTo(x,y); c.lineTo(x-4*s,y-10*s); c.moveTo(x+4*s,y); c.lineTo(x+6*s,y-12*s); c.stroke(); }
}
function flower(c,x,y,r,col,stem){
  if(stem){ c.strokeStyle=stem; c.lineWidth=Math.max(1,r*.3); c.beginPath(); c.moveTo(x,y); c.lineTo(x+r*.4,y+r*4); c.stroke(); }
  c.fillStyle=col; for(let i=0;i<5;i++){ const a=i/5*TAU-Math.PI/2; circ(c,x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82,r*.66); c.fill(); }
  c.fillStyle='#f1c75e'; circ(c,x,y,r*.46); c.fill();
}
function flowers(c,x,y,n,seed,sc){ const r=rng(seed); for(let i=0;i<n;i++) flower(c,x+(r()-.5)*96*sc,y+(r()-.5)*26*sc,(5+r()*3)*sc,FLOWER[Math.floor(r()*FLOWER.length)],'#9b9a62'); }
function streak(c,x,y,w,col,shade){   // 길쭉한 구름 (옅은 타원 겹침)
  c.save(); c.globalAlpha*=.75; c.fillStyle=col; ell(c,x,y,w*.5,11); c.fill(); ell(c,x-w*.12,y-9,w*.3,9); c.fill();
  c.globalAlpha*=.6; c.fillStyle=shade; ell(c,x+w*.08,y+6,w*.34,5); c.fill(); c.restore();
}
function bird(c,x,y,s,f){ const w=Math.sin(f); c.beginPath(); c.moveTo(x-15*s,y-9*s*w); c.quadraticCurveTo(x-6*s,y-3*s*w-3*s,x,y); c.quadraticCurveTo(x+6*s,y-3*s*w-3*s,x+15*s,y-9*s*w); c.stroke(); }
function butterfly(c,x,y,s,f,col){
  const k=.2+.8*Math.abs(Math.sin(f)); c.save(); c.translate(x,y); c.fillStyle=col;
  for(const sx of [-1,1]){ c.save(); c.scale(sx*k,1); ell(c,7*s,-4*s,8*s,6.5*s); c.fill(); ell(c,5.5*s,5*s,5*s,4.2*s); c.fill(); c.restore(); }
  c.fillStyle='#4a3b4c'; c.fillRect(-s,-6*s,2*s,13*s); c.restore();
}
function leaf(c,x,y,s,rot,col){ c.save(); c.translate(x,y); c.rotate(rot); c.scale(1,Math.max(.15,Math.abs(Math.cos(rot*1.7)))); c.fillStyle=col; c.beginPath(); c.moveTo(-9*s,0); c.quadraticCurveTo(0,-7*s,9*s,0); c.quadraticCurveTo(0,7*s,-9*s,0); c.fill(); c.restore(); }
function bunting(c,x0,y0,x1,y1,sag,n,t){   // 삼각 깃발 줄 (가운데가 처지고 깃발은 살랑)
  const P=u=>[lerp(x0,x1,u),lerp(y0,y1,u)+sag*arc(u)];
  c.strokeStyle='rgba(70,50,44,.55)'; c.lineWidth=1.6; c.beginPath(); for(let i=0;i<=24;i++){ const [x,y]=P(i/24); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
  for(let i=0;i<n;i++){ const [x,y]=P((i+.5)/n); c.save(); c.translate(x,y); c.rotate(Math.sin(t*2.4+i*.9)*.12); c.beginPath(); c.moveTo(-15,0); c.lineTo(15,0); c.lineTo(0,34); c.closePath(); c.fillStyle=BUNT[i%BUNT.length]; c.fill(); c.restore(); }
}
function keyring(c,x,y,len,s,t,ph,col){   // 나무에 매단 작은 코브 키링 (끈 · 고리 · 살랑)
  c.save(); c.translate(x,y); c.rotate(Math.sin(t*1.9+ph)*.14);
  c.strokeStyle='#8e5a44'; c.lineWidth=1.6; c.beginPath(); c.moveTo(0,0); c.lineTo(0,len); c.stroke();
  c.strokeStyle='#b9bcc8'; c.lineWidth=2.4; circ(c,0,len+7,7); c.stroke();
  drawCove(c,{x:0,y:len+14+168*s,s,col,shadow:false,blink:arc(seg(frac(t*.23+ph),0,.05))});
  c.restore();
}
function coinTop(c,x,y,r){ c.fillStyle=GOLD; circ(c,x,y,r); c.fill(); c.strokeStyle=GOLD_D; c.lineWidth=2; c.stroke(); c.lineWidth=r*.09; circ(c,x,y,r*.64); c.stroke(); }
function stars(c,n,seed,ymax,a){ const r=rng(seed); c.fillStyle='#fff'; for(let i=0;i<n;i++){ const y=r()*ymax; c.globalAlpha=(1-y/ymax)*a; circ(c,r()*(W+40),y,r()*1.4+.6); c.fill(); } c.globalAlpha=1; }
function hill(c,col,y0,pts){ c.fillStyle=col; c.beginPath(); c.moveTo(0,H); c.lineTo(0,y0); for(let i=0;i<pts.length;i+=3) c.bezierCurveTo(...pts[i],...pts[i+1],...pts[i+2]); c.lineTo(W+40,H); c.closePath(); c.fill(); }
function skyGrad(c,stops,y1){ const g=c.createLinearGradient(0,0,0,y1); stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s)); c.fillStyle=g; c.fillRect(0,0,W+40,H); }
function groundGrad(c,y0,a,b,pts){ const g=c.createLinearGradient(0,y0,0,H); g.addColorStop(0,a); g.addColorStop(1,b); hill(c,g,y0,pts); }

/* ── 배경 레이어 (크기·글꼴이 바뀔 때만 다시 그림) ── */
const S1_LAMPS=[[700,1052,1],[862,934,.66],[1000,866,.46]];
function paintS1Sky(c){ skyGrad(c,['#201f3a','#352f58','#463f6c','#7d5f7f','#ad7884','#e2b18f'],780); stars(c,46,3,320,.55); }   // ① 새벽 하늘 (해는 따로 그려 떠오름)
function paintS1Mid(c){   // ① 먼 언덕(나무 · 멀리 불 켜진 코브 몰) · 가운데 언덕(나무 실루엣, 해 쪽 가장자리가 빛남)
  hill(c,'#5a527c',706,[[260,684],[520,700],[780,688],[1040,676],[1240,706],[1480,700],[1700,694],[1860,682],[W+40,690]]);
  for(const [x,y,s] of [[90,702,.15],[150,699,.12],[610,692,.14],[662,694,.11],[905,686,.16],[1180,700,.13],[1232,703,.1],[1870,686,.15]]) tree(c,x,y+6,s,{sil:'#5a527c',seed:x});
  c.save(); c.translate(1500,700); c.scale(1.3,1.3);   // 멀리 불 켜진 코브 몰 (떠오르는 해 앞 · 앞의 큰 나무에 안 가리는 자리)
  const g=c.createRadialGradient(0,-18,2,0,-18,70); g.addColorStop(0,'rgba(244,201,142,.45)'); g.addColorStop(1,'rgba(244,201,142,0)'); c.fillStyle=g; c.fillRect(-70,-88,140,140);
  c.fillStyle='#5a527c'; c.fillRect(-27,-30,54,30); for(let i=0;i<5;i++){ c.fillStyle=i%2?'#a77084':'#5a527c'; c.fillRect(-33+i*13.2,-44,13.2,13); } c.fillStyle='#f4c98e'; c.fillRect(-19,-24,38,9);
  c.restore();
  hill(c,'#3a3f5a',742,[[420,712],[760,736],[1060,720],[1380,704],[1660,730],[W+40,716]]);
  for(const [x,y,s,sd] of [[300,733,.5,4],[424,728,.36,6],[566,730,.3,8],[1604,726,.36,3]]) tree(c,x,y+8,s,{sil:'#30344f',rim:'#a77a84',rimA:x<1420?-.5:Math.PI+.5,seed:sd});
}
function paintS1Near(c){   // ① 가까운 들판: 연못과 나무다리 · 돌길 · 등불 · 바위 · 벤치 · 푯말 · 앞의 큰 나무
  hill(c,'#232e33',778,[[520,752],[1220,770],[W+40,760]]);
  c.strokeStyle='rgba(226,177,143,.35)'; c.lineWidth=2; c.beginPath(); c.moveTo(0,778); c.bezierCurveTo(520,752,1220,770,W+40,760); c.stroke();
  let g=c.createLinearGradient(0,794,0,836); g.addColorStop(0,'#c99591'); g.addColorStop(1,'#5f5576'); c.fillStyle=g; ell(c,1250,815,236,21); c.fill();   // 연못 (하늘이 비침)
  const BX0=1072, BX1=1428, by=x=>826-50*arc((x-BX0)/(BX1-BX0));   // 나무다리 (아치)
  c.fillStyle='#161b23'; c.beginPath(); for(let x=BX0;x<=BX1;x+=8) c.lineTo(x,by(x)); for(let x=BX1;x>=BX0;x-=8) c.lineTo(x,by(x)+12); c.closePath(); c.fill();
  c.strokeStyle='#161b23'; c.lineWidth=4; c.beginPath(); for(let x=BX0+12;x<=BX1-12;x+=8) x===BX0+12?c.moveTo(x,by(x)-34):c.lineTo(x,by(x)-34); c.stroke();
  for(let x=BX0+14;x<=BX1-10;x+=44){ c.beginPath(); c.moveTo(x,by(x)); c.lineTo(x,by(x)-36); c.stroke(); }
  for(let i=10;i>=0;i--){ const u=i/10, x=quad(590,720,1062,u), y=quad(1112,884,836,u), s=lerp(1.3,.32,u);   // 돌길 (다리에서 앞으로)
    c.fillStyle='#2c363f'; ell(c,x,y,46*s,13*s); c.fill(); c.fillStyle='#38434e'; ell(c,x-3*s,y-3*s,40*s,9*s); c.fill(); }
  for(const [x,gy,s] of S1_LAMPS) lantern(c,x,gy,s,{sil:'#131720'});
  const RN=['#34304d','#27243b','#1c1a2d'];   // 역광 바위 (윗면만 하늘빛을 조금 받음)
  rock(c,170,1050,160,94,11,RN); rock(c,288,1064,84,50,12,RN); rock(c,1572,908,124,74,13,RN); rock(c,1662,920,70,42,14,RN);
  bench(c,1442,904,.72,{sil:'#1b2028'});
  c.save(); c.translate(1210,1012); c.scale(.85,.85); c.fillStyle='#2a2227'; c.fillRect(-5,-112,10,112); rr(c,-68,-146,136,50,6); c.fill();   // 푯말 (들판의 '코브's' — 거품이 떠오르는 자리 옆)
  c.fillStyle='rgba(243,210,170,.82)'; c.font=`600 30px ${SERIF}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText("코브's",0,-120); c.restore();
  tree(c,1840,1120,1.5,{sil:'#1a1e2a',rim:'#9c6f7d',rimW:7,rimA:Math.PI+.25,seed:9});   // 해 쪽 가장자리가 빛남
  const r=rng(21); for(let i=0;i<70;i++){ const x=[300,860,1300,1700][i%4]+(r()-.5)*360, y=920+r()*160, d=.6+(y-910)/170*.9; c.globalAlpha=.35+r()*.25; c.fillStyle=mixHex(FLOWER[i%5],'#232e33',.35); circ(c,x,y,(1.1+r()*1.3)*d); c.fill(); } c.globalAlpha=1;   // 새벽빛 속 꽃 (무리 지어, 가까울수록 크게)
}
function paintS2(c){   // ② 오후 들판: 연보라 하늘 · 굽이진 먼 언덕 · 짚빛 풀밭 · 가을 나무 · 울타리 문에서 오는 돌길(코브가 내려앉는 곳) · 푯말 · 바위 · 등불 · 벤치 · 꽃
  const SKY='#ebe3ec', SHD='rgba(110,80,60,.16)';
  skyGrad(c,['#e3dcee','#e8e0ed','#ede3ea','#f4e4d7'],720);
  hill(c,'#d9cfd9',650,[[300,600],[620,668],[900,628],[1200,606],[1500,668],[W+40,630]]);
  for(const [x,y,s] of [[120,644,.16],[170,642,.12],[520,646,.15],[800,642,.13],[1100,628,.14],[1150,626,.11],[1590,648,.15]]) tree(c,x,y,s,{cols:haze(LEAF,SKY,.62),trunk:mixHex(TRUNK,SKY,.62),seed:x});
  hill(c,'#d3c4c4',700,[[500,676],[900,708],[1300,684],[1600,672],[1800,700],[W+40,690]]);
  groundGrad(c,712,'#e3d0a4','#d6ba86',[[600,710],[1300,726],[W+40,714]]);
  tree(c,640,738,.42,{seed:3,cols:haze(LEAF,SKY,.32),trunk:mixHex(TRUNK,SKY,.32)});
  tree(c,1300,742,.5,{seed:5,cols:haze(LEAF,SKY,.32),trunk:mixHex(TRUNK,SKY,.32)});
  fence(c,-30,940,784,.6,mixHex(WOOD,SKY,.2),mixHex(WOOD_D,SKY,.2)); fence(c,1060,1950,784,.6,mixHex(WOOD,SKY,.2),mixHex(WOOD_D,SKY,.2));   // 가운데는 울타리 문
  grassMarks(c,25,520,730,1080,'rgba(140,104,58,.32)',[110,880,800,1030]); grassMarks(c,26,320,730,1080,'rgba(255,246,222,.45)',[110,880,800,1030]);
  for(let i=10;i>=0;i--){ const u=i/10, x=quad(860,930,1000,u), y=quad(1100,900,790,u), s=lerp(1.25,.4,u); c.fillStyle='#c4ad84'; ell(c,x,y,46*s,13*s); c.fill(); c.fillStyle='#e9dcc2'; ell(c,x-3*s,y-3*s,40*s,9*s); c.fill(); }   // 울타리 문에서 오는 돌길
  c.save(); c.translate(470,880); c.scale(.8,.8); c.fillStyle=WOOD_D; c.fillRect(-5,-112,10,112); c.fillStyle=WOOD; rr(c,-68,-146,136,50,6); c.fill();   // 들판 푯말
  c.fillStyle='#fbf3e6'; c.font=`600 30px ${SERIF}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText("코브's",0,-120); c.restore();
  c.fillStyle=SHD; for(const [x,y,rx,ry] of [[215,822,70,10],[1885,810,66,10],[650,874,72,8],[730,882,40,6],[1400,868,90,9],[1312,876,44,6],[1600,908,104,8],[1236,850,24,5]]){ ell(c,x,y,rx,ry); c.fill(); }   // 땅에 닿는 그림자
  tree(c,215,820,1.02,{seed:7}); tree(c,1885,808,.98,{seed:2});
  const RK=haze(ROCK,'#d6ba86',.25); rock(c,650,872,116,72,21,RK); rock(c,730,880,62,38,22,RK); rock(c,1400,866,146,88,23,RK); rock(c,1312,874,72,42,24,RK);
  lantern(c,1236,848,.8,{glass:'#f6ecd2',sil:mixHex(LAMP,'#e3dcee',.15)}); bench(c,1600,906,.95,{leg:mixHex(WOOD_D,'#3d2a2a',.25)});
  flowers(c,330,846,6,31,.85); flowers(c,1240,944,7,32,1.1); flowers(c,1690,982,6,33,1.25); flowers(c,1080,1046,5,34,1.3);
}
function paintS3(c){   // ③ 한낮 들판: 아이보리 하늘 · 짚빛 땅 · 먼 언덕 · 멀리 연못과 나무다리(①과 같은 들판) · 나무 · 등불 · 벤치 · 바위 (풀밭 가장자리 · 벤치 키링은 매 프레임)
  const SKY='#f3ede4';
  skyGrad(c,['#f3eee6','#f4ebe0','#f6e6d5'],740);
  hill(c,'#e9dcc8',700,[[360,664],[760,704],[1100,676],[1400,656],[1700,700],[W+40,672]]);
  for(const [x,y,s] of [[260,688,.14],[310,690,.11],[900,690,.15],[1180,672,.12],[1500,670,.14]]) tree(c,x,y,s,{cols:haze(LEAF,SKY,.6),trunk:mixHex(TRUNK,SKY,.6),seed:x});
  hill(c,'#e2d0b2',748,[[500,716],[1000,752],[1400,728],[1700,714],[1850,742],[W+40,730]]);
  groundGrad(c,772,'#e8d5ae','#efe0c4',[[700,756],[1300,778],[W+40,764]]);
  let g=c.createLinearGradient(0,778,0,806); g.addColorStop(0,'#e4e2da'); g.addColorStop(1,'#d3d3d0'); c.fillStyle=g; ell(c,1110,792,240,15); c.fill();   // 멀리 연못
  const BX0=960, BX1=1240, BC=mixHex(WOOD_D,SKY,.38), by=x=>798-28*arc((x-BX0)/(BX1-BX0));   // 멀리 나무다리
  c.fillStyle=BC; c.beginPath(); for(let x=BX0;x<=BX1;x+=8) c.lineTo(x,by(x)); for(let x=BX1;x>=BX0;x-=8) c.lineTo(x,by(x)+7); c.closePath(); c.fill();
  c.strokeStyle=BC; c.lineWidth=2.4; c.beginPath(); for(let x=BX0+8;x<=BX1-8;x+=8) x===BX0+8?c.moveTo(x,by(x)-20):c.lineTo(x,by(x)-20); c.stroke();
  for(let x=BX0+10;x<=BX1-6;x+=30){ c.beginPath(); c.moveTo(x,by(x)); c.lineTo(x,by(x)-21); c.stroke(); }
  const rf=rng(39), FH=haze(FLOWER,SKY,.35); c.globalAlpha=.55; for(let i=0;i<60;i++){ const x=rf()*W, y=782+rf()*70; c.fillStyle=FH[i%5]; circ(c,x,y,1.8+rf()*2); c.fill(); } c.globalAlpha=1;   // 멀리 핀 꽃
  tree(c,1640,772,.6,{seed:4,cols:haze(LEAF,SKY,.28),trunk:mixHex(TRUNK,SKY,.28)});
  grassMarks(c,35,320,780,1080,'rgba(176,132,76,.42)',[110,880,760,1030]);
  tree(c,22,868,1.16,{seed:6});
  lantern(c,1426,874,.74,{glass:'#f6ecd2'});
  bench(c,1724,886,.9);
  rock(c,1542,882,96,58,31); rock(c,36,884,116,68,32);
  flowers(c,840,962,5,37,1.1); flowers(c,1120,1008,6,38,1.25); flowers(c,1500,1010,6,39,1.3); flowers(c,1810,962,5,40,1.15);
}
function paintDesk(c){   // ④ 밤 책상(위에서 봄): 나무판 · 스탠드 불빛 · 장부(금화 100개 = 바를 정 20묶음) · 연필 · 금화 접시 · 인주 · 가위 · 클립 · 화분 · 빈 쿠폰 묶음
  c.fillStyle='#231c25'; c.fillRect(0,0,W,H);
  const r=rng(41);
  for(let y=0;y<H;y+=180){ c.fillStyle=(y/180)%2?'#261e28':'#211a23'; c.fillRect(0,y,W,180); c.fillStyle='rgba(0,0,0,.4)'; c.fillRect(0,y,W,2);
    c.strokeStyle='rgba(255,226,200,.035)'; c.lineWidth=1.4; for(let i=0;i<7;i++){ const yy=y+20+r()*140, ph=r()*TAU; c.beginPath(); for(let x=0;x<=W;x+=40) c.lineTo(x,yy+Math.sin(x/260+ph)*6); c.stroke(); } }
  let g=c.createRadialGradient(1090,440,40,1090,440,1000); g.addColorStop(0,'rgba(255,214,160,.2)'); g.addColorStop(.5,'rgba(255,214,160,.06)'); g.addColorStop(1,'rgba(255,214,160,0)'); c.fillStyle=g; c.fillRect(0,0,W,H);   // 스탠드 불빛 (어둠은 소품까지 덮게 맨 끝에)
  c.save(); c.translate(400,330); c.rotate(-5*DEG);   // 장부
  c.fillStyle='rgba(0,0,0,.42)'; rr(c,-258,-168,540,364,10); c.fill(); c.fillStyle='#6a3f4a'; rr(c,-270,-182,540,364,10); c.fill();
  c.fillStyle='#cfc2ad'; rr(c,-258,-172,254,344,4); c.fill(); rr(c,4,-172,254,344,4); c.fill(); c.fillStyle='rgba(0,0,0,.2)'; c.fillRect(-10,-172,20,344);
  c.fillStyle='#b9aa93'; for(let y=-124;y<160;y+=28){ c.fillRect(-238,y,214,1.2); c.fillRect(24,y,214,1.2); }
  c.fillStyle='#5d5160'; c.font=`600 15px ${MONO}`; c.textBaseline='alphabetic'; spaced(c,'COINS',-238,-140,4);
  c.font=`500 14px ${MONO}`; for(let i=0;i<9;i++){ const y=-104+i*28; c.fillStyle='#5d5160'; c.textAlign='left'; c.fillText('No.'+String(i+1).padStart(2,'0'),-238,y); c.textAlign='right'; c.fillText('+5',-34,y); coinTop(c,-138,y-5,6); }
  c.strokeStyle='#6c6270'; c.lineWidth=2.2; c.lineCap='round';
  for(let n=0;n<20;n++){ const gx=44+(n%4)*52, gy=-140+Math.floor(n/4)*58; c.beginPath(); for(let k=0;k<4;k++){ c.moveTo(gx+k*9,gy); c.lineTo(gx+k*9+1,gy+34); } c.moveTo(gx-6,gy+28); c.lineTo(gx+34,gy+6); c.stroke(); }
  c.fillStyle='#a8505f'; c.font=`600 28px ${SERIF}`; c.textAlign='left'; c.textBaseline='alphabetic'; c.fillText('= 100',52,160); c.strokeStyle='rgba(168,80,95,.8)'; c.lineWidth=2; c.beginPath(); c.ellipse(90,150,56,20,-.06,0,TAU); c.stroke();   // 빨간 연필로 합계
  c.fillStyle=ROSE; c.beginPath(); c.moveTo(150,170); c.lineTo(166,170); c.lineTo(166,236); c.lineTo(158,228); c.lineTo(150,236); c.closePath(); c.fill();
  c.restore();
  c.save(); c.translate(214,668); c.fillStyle='rgba(0,0,0,.42)'; circ(c,8,12,56); c.fill(); rr(c,58,-1,34,26,12); c.fill(); c.fillStyle='#d9cdbb'; rr(c,48,-13,36,26,12); c.fill();   // 코코아 잔 (김은 매 프레임)
  c.fillStyle='#e6dccb'; circ(c,0,0,56); c.fill(); c.fillStyle='#4e3128'; circ(c,0,0,44); c.fill(); c.strokeStyle='rgba(255,230,200,.12)'; c.lineWidth=2; circ(c,0,0,40); c.stroke(); c.restore();
  c.save(); c.translate(565,566); c.rotate(-28*DEG);   // 연필
  c.fillStyle='rgba(0,0,0,.35)'; c.fillRect(-170,8,320,14); c.fillStyle='#d8b25e'; c.fillRect(-150,-8,270,16); c.fillStyle='#c39a48'; c.fillRect(-150,2,270,6);
  c.fillStyle='#a7a3ab'; c.fillRect(-158,-8,10,16); c.fillStyle='#c9a2a4'; c.fillRect(-180,-8,22,16);
  c.fillStyle='#e7d3b0'; c.beginPath(); c.moveTo(120,-8); c.lineTo(156,0); c.lineTo(120,8); c.closePath(); c.fill(); c.fillStyle='#3a3540'; c.beginPath(); c.moveTo(146,-2.2); c.lineTo(156,0); c.lineTo(146,2.2); c.closePath(); c.fill();
  c.restore();
  c.save(); c.translate(1786,292); c.fillStyle='rgba(0,0,0,.42)'; circ(c,9,13,118); c.fill(); c.fillStyle='#6d6371'; circ(c,0,0,118); c.fill(); c.fillStyle='#4f4653'; circ(c,0,0,100); c.fill();   // 금화 접시
  const rc=rng(43); for(let i=0;i<17;i++){ const a=rc()*TAU, d=Math.sqrt(rc())*70; coinTop(c,Math.cos(a)*d,Math.sin(a)*d,23); } c.restore();
  c.save(); c.translate(1590,702); c.fillStyle='rgba(0,0,0,.42)'; circ(c,7,11,76); c.fill(); c.fillStyle='#8d8797'; circ(c,0,0,76); c.fill(); c.fillStyle='#6c6676'; circ(c,0,0,66); c.fill();   // 인주
  c.fillStyle='#9c3a31'; circ(c,0,0,58); c.fill(); c.fillStyle='rgba(255,255,255,.08)'; ell(c,-18,-20,26,14); c.fill(); c.restore();
  c.save(); c.translate(1742,842); c.fillStyle='rgba(0,0,0,.42)'; circ(c,7,11,76); c.fill(); c.fillStyle='#8d8797'; circ(c,0,0,76); c.fill(); c.strokeStyle='#a39eac'; c.lineWidth=2; circ(c,0,0,60); c.stroke();   // 인주 뚜껑
  c.fillStyle='#6c6676'; c.font=`600 18px ${MONO}`; c.textBaseline='middle'; spaced(c,'INK',0,0,5,'center'); c.restore();
  c.save(); c.translate(1186,866); c.rotate(-.5);   // 가위
  for(const sg of [-1,1]){ c.save(); c.rotate(sg*.11); c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(4,1); c.lineTo(182,8); c.lineTo(4,19); c.fill(); c.fillStyle='#b8b4bf'; c.beginPath(); c.moveTo(0,-9); c.lineTo(178,0); c.lineTo(0,9); c.closePath(); c.fill();
    c.strokeStyle='#c46a7c'; c.lineWidth=10; circ(c,-46,-sg*20,22); c.stroke(); c.restore(); }   // 손잡이는 날 반대쪽 → X자로 엇갈림
  c.fillStyle='#8a8592'; circ(c,6,0,5); c.fill(); c.restore();
  c.strokeStyle='#a9a6b2'; c.lineWidth=3; for(const [x,y,a] of [[900,752,.4],[952,788,-.3]]){ c.save(); c.translate(x,y); c.rotate(a); rr(c,-24,-8,48,16,8); c.stroke(); rr(c,-16,-4,34,8,4); c.stroke(); c.restore(); }   // 클립
  c.save(); c.translate(1834,994); c.fillStyle='rgba(0,0,0,.42)'; circ(c,8,12,72); c.fill(); c.fillStyle='#b8664f'; circ(c,0,0,72); c.fill(); c.fillStyle='#4b3a33'; circ(c,0,0,58); c.fill();   // 화분
  for(let i=0;i<8;i++){ c.save(); c.rotate(i/8*TAU+.3); c.fillStyle=i%2?'#6f8f6a':'#86a57d'; ell(c,0,-38,15,38); c.fill(); c.restore(); } c.restore();
  for(const [dx,dy,a,col] of [[34,30,6,'#b9ad9c'],[18,15,3,'#cbbfae']]){ c.save(); c.translate(C4[0]+dx,C4[1]+dy); c.rotate(CTILT+a*DEG); c.fillStyle='rgba(0,0,0,.3)'; rr(c,-CW/2+8,-CH/2+12,CW,CH,12); c.fill(); c.fillStyle=col; rr(c,-CW/2,-CH/2,CW,CH,12); c.fill();   // 빈 쿠폰 묶음 (맨 위 장은 쿠폰처럼 손잡이 칸 · 절취선)
    if(a===3){ c.save(); rr(c,-CW/2,-CH/2,CW,CH,12); c.clip(); c.fillStyle='rgba(236,219,224,.35)'; c.fillRect(-CW/2,-CH/2,200,CH); c.restore(); c.fillStyle='rgba(120,100,90,.3)'; for(let y=-CH/2+16;y<CH/2-8;y+=17){ circ(c,-CW/2+200,y,2); c.fill(); } }
    c.restore(); }
  g=c.createRadialGradient(1090,440,320,1090,440,1150); g.addColorStop(0,'rgba(12,8,16,0)'); g.addColorStop(1,'rgba(12,8,16,.55)'); c.fillStyle=g; c.fillRect(0,0,W,H);   // 불빛 밖은 소품까지 어둑하게
}
function paintS5a(c){   // ⑤ 들판 한쪽 코브 몰 가게 앞: 하늘 · 먼 언덕 · 가게 옆 큰 나무(키링은 따로 흔들림) · 돌길 · 등불 · 벤치 · 칠판 · 화분 · 꽃
  const SKY='#f1e6da';
  skyGrad(c,['#eee5dc','#f1e6da','#f6e3d0'],720);
  hill(c,'#e9dccc',676,[[400,652],[800,680],[1150,664],[1450,650],[1700,676],[W+40,660]]);
  for(const [x,y,s] of [[640,666,.14],[690,669,.11],[1020,668,.15],[1300,656,.13]]) tree(c,x,y,s,{cols:haze(LEAF,SKY,.6),trunk:mixHex(TRUNK,SKY,.6),seed:x});
  hill(c,'#e3d4c1',712,[[500,694],[1000,716],[1400,702],[1700,692],[1850,708],[W+40,700]]);
  groundGrad(c,734,'#e6d3ab','#dcc393',[[700,722],[1300,740],[W+40,728]]);
  tree(c,440,744,.48,{seed:12,cols:haze(LEAF,SKY,.3),trunk:mixHex(TRUNK,SKY,.3)});
  grassMarks(c,45,420,760,1080,'rgba(140,104,58,.3)'); grassMarks(c,46,260,760,1080,'rgba(255,246,222,.42)');
  tree(c,170,774,.78,{seed:13});
  tree(c,1880,868,1.1,{seed:14});                               // 가게 오른쪽 나무 (field.js처럼 가지에 키링)
  bench(c,170,856,.8); lantern(c,384,856,.86,{glass:'#f6ecd2'});
  c.save(); c.translate(560,868);   // 칠판 간판
  c.fillStyle=WOOD_D; c.beginPath(); c.moveTo(-58,0); c.lineTo(-44,-196); c.lineTo(-36,-196); c.lineTo(-48,0); c.fill(); c.beginPath(); c.moveTo(58,0); c.lineTo(44,-196); c.lineTo(36,-196); c.lineTo(48,0); c.fill();
  c.fillStyle=WOOD; rr(c,-64,-200,128,156,6); c.fill(); c.fillStyle='#3d3b42'; rr(c,-56,-192,112,140,3); c.fill();
  c.fillStyle='rgba(245,240,230,.9)'; c.font=`600 24px ${SERIF}`; c.textAlign='center'; c.textBaseline='alphabetic'; c.fillText('오늘의',0,-148); c.fillText('키링',0,-116);
  c.save(); c.translate(0,-84); heartPath(c,.62); c.strokeStyle='rgba(245,170,190,.9)'; c.lineWidth=2.4; c.stroke(); c.restore(); c.restore();
  for(let x=-40;x<1150;x+=118){ c.fillStyle='#c4ad84'; ell(c,x,878,54,13); c.fill(); c.fillStyle='#e9dcc2'; ell(c,x-2,875,50,11); c.fill(); }   // 가게로 가는 돌길
  c.save(); c.translate(1814,862); c.fillStyle='#b8664f'; c.beginPath(); c.moveTo(-30,-58); c.lineTo(30,-58); c.lineTo(22,0); c.lineTo(-22,0); c.closePath(); c.fill(); c.fillStyle='#a3573f'; c.fillRect(-33,-64,66,10);   // 가게 옆 화분
  c.fillStyle='#7f9a6e'; for(const [x,y,rx,ry] of [[-14,-84,12,26],[10,-90,12,30],[0,-104,10,24]]){ ell(c,x,y,rx,ry); c.fill(); } flower(c,-16,-110,7,FLOWER[0]); flower(c,14,-118,7,FLOWER[3]); flower(c,0,-130,6,FLOWER[2]); c.restore();
  const RK=haze(ROCK,'#dcc393',.25); rock(c,1862,892,96,58,51,RK); rock(c,664,846,58,34,52,RK);   // 오른쪽 바위는 화면 안에 · 가운데 바위는 돌길 뒤로
  flowers(c,330,946,6,53,1.2); flowers(c,1010,938,6,54,1.15); flowers(c,1520,968,7,55,1.25); flowers(c,700,1040,5,56,1.4);
}
const BULBS=[];   // 진열 벽 꼬마전구 자리 (깜빡임은 매 프레임)
function paintBoard(c){   // ⑤ 가게 안 진열 벽: 크라프트 타공판 · 꼬마전구 줄 · 걸이(리본 · 가위 · 마스킹 테이프) · 오른쪽 아래 선반(사탕병 · 화분 · 선물 상자 · 쿠폰 묶음)
  const g=c.createLinearGradient(0,0,W,H); g.addColorStop(0,'#d3b693'); g.addColorStop(1,'#c7a780'); c.fillStyle=g; c.fillRect(0,0,W,H);
  const r=rng(9);
  for(let i=0;i<3600;i++){ c.fillStyle=r()<.5?'rgba(90,60,30,.07)':'rgba(255,245,225,.08)'; const s=1+r()*2; c.fillRect(r()*W,r()*H,s,s); }
  c.lineWidth=1.1; for(let i=0;i<240;i++){ const x=r()*W, y=r()*H, a=r()*TAU, l=8+r()*24; c.strokeStyle=r()<.5?'rgba(110,75,40,.11)':'rgba(250,236,212,.12)'; c.beginPath(); c.moveTo(x,y); c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); c.stroke(); }
  const v=c.createRadialGradient(960,420,240,960,420,1200); v.addColorStop(0,'rgba(255,228,176,.12)'); v.addColorStop(1,'rgba(70,40,15,.24)'); c.fillStyle=v; c.fillRect(0,0,W,H);   // 꼬마전구 아래가 밝고 구석이 어두운 가게 안
  for(let y=150;y<H;y+=64) for(let x=48;x<W;x+=64){ c.fillStyle='rgba(255,244,226,.24)'; circ(c,x,y+1.8,5); c.fill(); c.fillStyle='rgba(74,48,24,.4)'; circ(c,x,y,4.6); c.fill(); }   // 타공판 구멍
  BULBS.length=0;
  for(const [x0,x1] of [[-20,960],[960,1940]]){   // 꼬마전구 줄 (두 번 처짐)
    const P=u=>[lerp(x0,x1,u),148+64*arc(u)];
    c.strokeStyle='#4a3a2c'; c.lineWidth=2; c.beginPath(); for(let i=0;i<=30;i++){ const [x,y]=P(i/30); i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
    for(let i=0;i<7;i++){ const [x,y]=P((i+.5)/7); c.fillStyle='#4a3a2c'; c.fillRect(x-3.5,y,7,9); c.fillStyle='#ffe6a8'; ell(c,x,y+17,7,9); c.fill(); BULBS.push([x,y+17]); }
  }
  const hook=(x,y)=>{ c.strokeStyle='#5d5048'; c.lineWidth=3; c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+18); c.quadraticCurveTo(x,y+26,x+8,y+24); c.stroke(); };
  hook(112,342); c.save(); c.translate(120,404); c.fillStyle='rgba(60,40,20,.2)'; c.fillRect(-24,-22,54,50); c.fillStyle='#e9d9c3'; c.fillRect(-28,-26,56,8); c.fillRect(-28,18,56,8); c.fillStyle=ROSE; c.fillRect(-22,-18,44,36);   // 리본 실패 (옆에서 본 모양 + 늘어진 리본)
  c.fillStyle='rgba(255,255,255,.18)'; for(let y=-14;y<18;y+=6) c.fillRect(-22,y,44,1.2); c.strokeStyle=ROSE; c.lineWidth=7; c.beginPath(); c.moveTo(18,16); c.bezierCurveTo(30,60,4,90,22,130); c.stroke(); c.restore();
  hook(112,598); c.save(); c.translate(120,700); c.rotate(.04); c.fillStyle='#b8b4bf'; c.beginPath(); c.moveTo(-5,-40); c.lineTo(0,90); c.lineTo(5,-40); c.fill(); c.strokeStyle='#cc6f86'; c.lineWidth=7; circ(c,-11,-62,14); c.stroke(); circ(c,11,-62,14); c.stroke(); c.restore();   // 가위
  hook(1838,598); c.save(); c.translate(1846,650); c.fillStyle='rgba(60,40,20,.2)'; circ(c,5,6,32); c.fill(); c.fillStyle='#ece0c8'; circ(c,0,0,32); c.fill(); c.strokeStyle='rgba(120,90,60,.25)'; c.lineWidth=1; circ(c,0,0,26); c.stroke(); c.fillStyle='#d3b693'; circ(c,0,0,15); c.fill();   // 마스킹 테이프 (풀린 끝)
  c.fillStyle='rgba(236,224,200,.92)'; c.beginPath(); c.moveTo(22,22); c.lineTo(36,10); c.lineTo(52,64); c.lineTo(44,70); c.lineTo(38,62); c.closePath(); c.fill(); c.restore();
  c.fillStyle='rgba(60,40,20,.22)'; c.fillRect(1064,930,600,16);   // 선반 (오른쪽 끝은 고개 내미는 코브 자리)
  c.fillStyle='#8e6342'; for(const x of [1110,1610]){ c.beginPath(); c.moveTo(x,930); c.lineTo(x+34,930); c.lineTo(x,972); c.closePath(); c.fill(); }
  c.fillStyle='#b0825a'; c.fillRect(1060,906,604,20); c.fillStyle='#8e6342'; c.fillRect(1060,924,604,8);
  c.save(); c.translate(1150,906); rr(c,-44,-112,88,112,16); c.fillStyle='rgba(255,255,255,.3)'; c.fill(); c.save(); c.clip(); const rj=rng(57);   // 사탕병
  for(let i=0;i<26;i++){ c.fillStyle=[COL.pink,COL.mint,COL.lemon,COL.sky][i%4]; circ(c,-34+rj()*68,-8-rj()*62,9); c.fill(); } c.restore();
  c.strokeStyle='rgba(60,40,30,.35)'; c.lineWidth=2; rr(c,-44,-112,88,112,16); c.stroke(); c.fillStyle='#cfb592'; rr(c,-36,-128,72,18,5); c.fill(); c.restore();
  c.save(); c.translate(1610,906); c.fillStyle='#c97b5e'; c.beginPath(); c.moveTo(-32,-60); c.lineTo(32,-60); c.lineTo(24,0); c.lineTo(-24,0); c.closePath(); c.fill();   // 선인장 화분
  c.fillStyle='#7f9a6e'; rr(c,-14,-136,28,82,14); c.fill(); rr(c,-38,-112,16,42,8); c.fill(); rr(c,22,-122,16,46,8); c.fill(); flower(c,0,-138,6,FLOWER[0]); c.restore();
  c.save(); c.translate(1472,906); c.fillStyle='#e7b9c6'; c.fillRect(-52,-82,104,82); c.fillStyle='#f0cbd5'; c.fillRect(-58,-96,116,20); c.fillStyle=ROSE; c.fillRect(-8,-96,16,96);   // 선물 상자
  for(const sx of [-1,1]){ c.beginPath(); c.ellipse(sx*18,-104,18,10,sx*.4,0,TAU); c.fill(); } c.restore();
  for(let i=0;i<3;i++){ c.save(); c.translate(1300+i*6,906-i*9); c.rotate((-4+i*5)*DEG); c.fillStyle=i===2?'#f4efe6':'#e6dccd'; rr(c,-62,-30,124,30,4); c.fill(); if(i===2){ c.fillStyle='#ecdbe0'; c.fillRect(-62,-30,34,30); c.fillStyle=INK; c.font=`700 16px ${SERIF}`; c.textAlign='left'; c.textBaseline='alphabetic'; c.fillText('100원',-20,-9); } c.restore(); }   // 쿠폰 묶음
  for(let i=0;i<21;i++){ const x=i*96; c.fillStyle='rgba(60,40,20,.16)'; c.beginPath(); c.ellipse(x+48,34,48,24,0,0,Math.PI); c.fill(); c.fillStyle=i%2?'#fbf7f1':ROSE; c.fillRect(x,0,96,28); c.beginPath(); c.ellipse(x+48,28,48,24,0,0,Math.PI); c.fill(); }   // ⑤-1 가게 차양 끝 → 같은 가게 안
}
const CHIP_JARS=[COL.pink,COL.mint,COL.lemon,COL.sky,null];   // 선반 사탕병 (마지막은 천을 덮은 비밀 병)
function paintStudio(c){   // ⑥ 색 공방: 벽 선반 사탕병(색마다 · 무지개는 천을 덮은 비밀 병) · 색상환 · 견본 거는 줄 · 나무 작업대(스케치북 · 팔레트 · 물감 · 붓통)
  c.fillStyle='#ebe7e2'; c.fillRect(0,0,W,H);
  c.fillStyle='rgba(29,26,34,.025)'; for(let x=0;x<W;x+=48) c.fillRect(x,0,22,770);
  c.save(); c.beginPath(); c.rect(652,56,216,170); c.clip();   // 들판이 보이는 창 (공방도 같은 들판에 있음)
  skyGrad(c,['#efe6dc','#f3e5d3'],226); hill(c,'#e3d4c1',172,[[700,160],[780,178],[880,166]]); groundGrad(c,196,'#e6d3ab','#dcc393',[[740,192],[820,200],[880,196]]);
  tree(c,700,204,.16,{seed:3,cols:haze(LEAF,'#f1e6da',.6),trunk:mixHex(TRUNK,'#f1e6da',.6)}); tree(c,826,240,.36,{seed:12,cols:haze(LEAF,'#f1e6da',.3),trunk:mixHex(TRUNK,'#f1e6da',.3)}); c.restore();
  c.fillStyle='#c9a77e'; c.fillRect(640,44,240,12); c.fillRect(640,226,240,12); c.fillRect(640,44,12,194); c.fillRect(868,44,12,194); c.fillRect(754,56,12,170); c.fillRect(652,136,216,10); c.fillStyle='#b8946c'; c.fillRect(626,238,268,14);
  poly(c,[[652,252],[868,252],[1090,770],[840,770]]); c.fillStyle='rgba(255,247,230,.22)'; c.fill();   // 창으로 드는 빛
  c.fillStyle='rgba(60,40,30,.12)'; c.fillRect(60,292,494,12); c.fillStyle='#b8946c'; for(const x of [96,510]){ c.beginPath(); c.moveTo(x,290); c.lineTo(x+30,290); c.lineTo(x,326); c.closePath(); c.fill(); }   // 벽 선반 (커진 코브 귀에 안 가리게 왼쪽 위로)
  c.fillStyle='#c9a77e'; c.fillRect(56,276,502,16);
  CHIP_JARS.forEach((col,i)=>{ const x=118+i*92;
    c.save(); c.translate(x,276); rr(c,-42,-118,84,118,16); c.fillStyle='rgba(255,255,255,.4)'; c.fill();
    if(col){ c.save(); c.clip(); const rj=rng(60+i); for(let k=0;k<14;k++) drawCandy(c,-26+rj()*52,-14-rj()*78,7,rj()*TAU,k%3?col:mixHex(col,'#ffffff',.4)); c.restore(); }   // 날아가는 것과 같은 포장 사탕
    c.strokeStyle='rgba(29,26,34,.28)'; c.lineWidth=2; rr(c,-42,-118,84,118,16); c.stroke(); c.fillStyle='#cfb592'; rr(c,-34,-134,68,18,5); c.fill();
    if(!col){ c.fillStyle='#b4a6d3'; c.beginPath(); c.moveTo(-50,-138); c.quadraticCurveTo(0,-162,50,-138); c.lineTo(54,-52); for(let k=0;k<=6;k++) c.lineTo(54-k*18,-52+(k%2?11:0)); c.closePath(); c.fill();   // 천 덮개 + 끈 + ? 꼬리표
      c.strokeStyle='#8e5a44'; c.lineWidth=2.4; c.beginPath(); c.moveTo(-46,-114); c.quadraticCurveTo(0,-104,46,-114); c.stroke(); c.beginPath(); c.moveTo(26,-110); c.lineTo(38,-74); c.stroke();
      c.fillStyle='#fbf9f5'; rr(c,26,-74,26,32,3); c.fill(); c.fillStyle=INK; c.font=`600 19px ${SERIF}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?',39,-57); }
    else { c.fillStyle='rgba(251,249,245,.92)'; c.fillRect(-22,-26,44,16); c.fillStyle=MUTED; c.font=`500 10px ${MONO}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('CV-0'+(i+1),0,-18); }
    c.restore(); });
  c.save(); c.translate(214,566); c.rotate(-3*DEG);   // 색상환 포스터
  c.fillStyle='rgba(29,26,34,.1)'; c.fillRect(-112,-108,236,236); c.fillStyle='#f8f5f0'; c.fillRect(-118,-118,236,236);
  for(let i=0;i<12;i++){ c.beginPath(); c.moveTo(0,0); c.arc(0,-6,86,i/12*TAU,(i+1)/12*TAU); c.closePath(); c.fillStyle=`hsl(${i*30},40%,81%)`; c.fill(); }
  c.fillStyle='#f8f5f0'; circ(c,0,-6,30); c.fill(); c.fillStyle=MUTED; c.font=`500 12px ${MONO}`; c.textBaseline='alphabetic'; spaced(c,'COLOR WHEEL',0,104,3,'center');
  drawTape(c,0,-120,96,26,4*DEG); c.restore();
  c.strokeStyle='rgba(29,26,34,.32)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(CHX+CHW/2,96); c.lineTo(CHX+CHW/2,770); c.stroke();   // 견본 거는 줄
  c.fillStyle='rgba(29,26,34,.4)'; circ(c,CHX+CHW/2,96,5); c.fill();
  c.fillStyle='#dcc8aa'; c.fillRect(0,770,W,246); c.fillStyle='rgba(120,80,40,.08)'; for(let y=790;y<1010;y+=22) c.fillRect(y>900?780:0,y,W,1.2);   // 작업대 (자막 자리엔 나뭇결 없이)
  c.fillStyle='rgba(29,26,34,.12)'; c.fillRect(0,770,W,3); c.fillStyle='#c7ab85'; c.fillRect(0,1016,W,24); c.fillStyle='#b49671'; c.fillRect(0,1040,W,40);
  c.save(); c.translate(250,812); c.rotate(-4*DEG); c.scale(.85,.85); c.fillStyle='rgba(29,26,34,.12)'; c.fillRect(-112,-44,236,104); c.fillStyle='#f7f2e8'; c.fillRect(-118,-50,236,100);   // 스케치북 (코브 밑그림)
  c.fillStyle='#8a8190'; for(let x=-104;x<110;x+=16){ circ(c,x,-50,3); c.fill(); }
  c.strokeStyle='rgba(90,80,100,.55)'; c.lineWidth=1.6; circ(c,-40,8,24); c.stroke(); circ(c,-58,-12,9); c.stroke(); circ(c,-22,-12,9); c.stroke(); c.beginPath(); c.moveTo(10,-6); c.lineTo(84,-6); c.moveTo(10,10); c.lineTo(70,10); c.moveTo(10,26); c.lineTo(78,26); c.stroke(); c.restore();
  c.save(); c.translate(1590,884); c.rotate(-8*DEG); c.fillStyle='rgba(29,26,34,.12)'; ell(c,6,8,112,58); c.fill(); c.fillStyle='#ead9bd'; ell(c,0,0,112,58); c.fill(); c.fillStyle='#dcc8aa'; ell(c,-64,14,16,12); c.fill();   // 팔레트
  [[-20,-28,COL.pink],[22,-34,COL.mint],[60,-14,COL.lemon],[52,22,COL.sky],[10,30,COL.lav]].forEach(([x,y,col])=>{ c.fillStyle=col; ell(c,x,y,16,12); c.fill(); }); c.restore();
  for(const [x,y,a,col] of [[1330,934,-.18,COL.pink],[1826,914,.26,COL.sky]]){ c.save(); c.translate(x,y); c.rotate(a); c.fillStyle='rgba(29,26,34,.12)'; rr(c,-56,-8,124,30,8); c.fill();   // 물감 튜브
    c.fillStyle='#f4f1ec'; rr(c,-60,-14,110,28,8); c.fill(); c.fillStyle=col; c.fillRect(-30,-14,50,28); c.fillStyle='#c9c4cc'; c.fillRect(-68,-12,10,24); c.fillStyle='#8a8190'; rr(c,50,-8,18,16,3); c.fill(); c.restore(); }
  c.save(); c.translate(1800,812); c.fillStyle='rgba(29,26,34,.12)'; ell(c,6,14,46,10); c.fill();   // 붓통 (사탕이 날아가는 길 밖)
  for(const [a,col] of [[-.16,COL.pink],[.04,COL.mint],[.2,COL.lav]]){ c.save(); c.rotate(a); c.fillStyle=WOOD; c.fillRect(-3,-180,6,150); c.fillStyle='#c9c4cc'; c.fillRect(-4,-196,8,18); c.fillStyle=col; c.beginPath(); c.moveTo(-5,-196); c.quadraticCurveTo(0,-236,5,-196); c.fill(); c.restore(); }
  c.fillStyle='rgba(255,255,255,.45)'; rr(c,-40,-80,80,90,10); c.fill(); c.strokeStyle='rgba(29,26,34,.25)'; c.lineWidth=2; c.stroke(); c.restore();
}
const S7_LAMPS=[[420,1040,.42],[600,1012,.33],[760,992,.26]];   // 돌길 따라 멀어질수록 작게
function paintNight(c){   // ⑦ 밤 들판: 별 · 달 · 언덕 · 나무 실루엣 · 멀리 불 켜진 코브 몰 · 등불 기둥(빛은 따로)
  skyGrad(c,['#1c1b32','#24223e','#2e2a4b'],H);
  let g=c.createRadialGradient(960,1250,40,960,1250,900); g.addColorStop(0,'rgba(207,111,136,.38)'); g.addColorStop(1,'rgba(207,111,136,0)'); c.fillStyle=g; c.fillRect(0,0,W,H);
  stars(c,90,3,640,.6);
  g=c.createRadialGradient(1650,200,20,1650,200,190); g.addColorStop(0,'rgba(240,228,200,.22)'); g.addColorStop(1,'rgba(240,228,200,0)'); c.fillStyle=g; c.fillRect(1450,0,400,400);
  c.fillStyle='#efe4c8'; circ(c,1650,200,46); c.fill(); c.fillStyle='rgba(180,165,140,.25)'; circ(c,1636,190,9); c.fill(); circ(c,1664,214,6); c.fill();
  hill(c,'#282644',932,[[300,906],[620,940],[980,926],[1300,912],[1600,940],[W+40,918]]);
  c.save(); c.translate(1430,934); c.scale(.2,.2);   // 멀리 불 켜진 코브 몰 (돌길 끝)
  g=c.createRadialGradient(0,-330,20,0,-330,520); g.addColorStop(0,'rgba(255,196,120,.35)'); g.addColorStop(1,'rgba(255,196,120,0)'); c.fillStyle=g; c.fillRect(-520,-850,1040,1300);
  c.fillStyle='rgba(255,206,140,.82)'; c.fillRect(-238,-478,476,232);
  c.fillStyle='#1d1b33'; c.fillRect(-250,-540,12,540); c.fillRect(238,-540,12,540); for(let i=0;i<8;i++){ c.fillStyle=i%2?'#2b2846':'#1d1b33'; c.fillRect(-280+i*70,-560,70,82); c.beginPath(); c.arc(-280+i*70+35,-478,35,0,Math.PI); c.fill(); }
  c.fillStyle='#1d1b33'; c.fillRect(-270,-250,540,250); c.fillRect(-290,-268,580,26); c.restore();
  hill(c,'#1f1d36',978,[[360,958],[760,990],[1100,974],[1400,962],[1700,986],[W+40,968]]);
  for(let i=13;i>=0;i--){ const u=i/13, x=quad(300,900,1400,u), y=quad(1074,986,948,u), s=lerp(1.05,.28,u); c.fillStyle='#252341'; ell(c,x,y,44*s,12*s); c.fill(); c.fillStyle='#2f2d50'; ell(c,x-3*s,y-3*s,38*s,8*s); c.fill(); }   // 코브 몰로 가는 돌길
  const RN=haze(ROCK,'#1c1b32',.7); rock(c,64,1082,160,86,61,RN); rock(c,1708,1080,140,74,63,RN); rock(c,1300,1084,96,46,62,RN);
  c.save(); c.translate(236,1090); c.scale(.8,.8); c.fillStyle='#17162b'; c.fillRect(-5,-112,10,112); rr(c,-68,-146,136,50,6); c.fill();   // 푯말 (①과 짝)
  c.fillStyle='rgba(243,210,170,.45)'; c.font=`600 26px ${SERIF}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText("코브's",0,-120); c.restore();
  for(const [x,gy,s] of S7_LAMPS){ const g2=c.createRadialGradient(x,gy,0,x,gy,150*s); g2.addColorStop(0,'rgba(255,196,120,.16)'); g2.addColorStop(1,'rgba(255,196,120,0)'); c.fillStyle=g2; ell(c,x,gy+4,150*s,36*s); c.fill(); lantern(c,x,gy,s,{sil:'#15142a'}); }   // 등불 + 땅에 번진 빛
  tree(c,130,1012,1.12,{sil:'#16152a',rim:'#3a3863',rimA:-.5,seed:2}); tree(c,362,968,.62,{sil:'#1b1a31',rim:'#3a3863',rimA:-.45,seed:5});
  tree(c,1612,960,.6,{sil:'#1b1a31',rim:'#6a4f5e',rimA:2.62,seed:8}); tree(c,1812,1018,1.18,{sil:'#16152a',rim:'#3a3863',rimA:Math.PI+2,seed:11,flip:-1});   // 가게 쪽은 따뜻한 빛 · 달 쪽은 푸른 빛
}
function layer(fn,pad){ const cv2=document.createElement('canvas'); cv2.width=Math.round((W+(pad||0))*SC); cv2.height=cv.height; const c=cv2.getContext('2d'); c.setTransform(SC,0,0,SC,0,0); fn(c); return cv2; }
function sprite(w,h,fn){ const cv2=document.createElement('canvas'); cv2.width=Math.max(1,Math.round(w*SC)); cv2.height=Math.max(1,Math.round(h*SC)); const c=cv2.getContext('2d'); c.setTransform(SC,0,0,SC,0,0); fn(c); return cv2; }
function buildLayers(){
  L.s1sky=layer(paintS1Sky,20); L.s1mid=layer(paintS1Mid,20); L.s1near=layer(paintS1Near,40);
  L.s2=layer(paintS2); L.s3=layer(paintS3); L.desk=layer(paintDesk); L.s5a=layer(paintS5a); L.board=layer(paintBoard); L.studio=layer(paintStudio); L.night=layer(paintNight);
  SPR.glow=sprite(32,32,c=>{ const g=c.createRadialGradient(16,16,0,16,16,16); g.addColorStop(0,'rgba(246,227,161,.8)'); g.addColorStop(1,'rgba(246,227,161,0)'); c.fillStyle=g; c.fillRect(0,0,32,32); });
  SPR.lamp=sprite(64,64,c=>{ const g=c.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,206,130,.85)'); g.addColorStop(.35,'rgba(255,190,110,.3)'); g.addColorStop(1,'rgba(255,190,110,0)'); c.fillStyle=g; c.fillRect(0,0,64,64); });
}

/* ══════════ ① 오프닝 0–6 (새벽 들판: 해가 뜨고 · 돌길 등불 · 연못과 나무다리 · 멀리 코브 몰 불빛) ══════════ */
const FLIES=(()=>{ const r=rng(77), a=[]; for(let i=0;i<10;i++) a.push({x:120+r()*1680,y:620+r()*360,ax:16+r()*30,ay:10+r()*18,k1:1+Math.floor(r()*3),k2:2+Math.floor(r()*3),k3:5+Math.floor(r()*7),p1:r()*TAU,p2:r()*TAU,p3:r()*TAU}); return a; })();
const S1_CLOUDS=[[260,300,520],[980,384,640],[1560,252,460],[640,470,360]];   // 길쭉한 새벽 구름 [x,y,w]
const S1_BIRDS=[[-80,300,150,0,1],[-210,342,162,1.7,.8],[-330,288,146,3.1,.7]];   // 새 [시작 x,y,속도,위상,크기]
const S1_TUFTS=[[30,104,0],[170,80,1],[930,70,2],[1250,96,3],[1560,84,4],[1720,120,5],[1900,100,6]];
function s1(c,t){
  const k=t/6;   // 가까운 것일수록 왼쪽으로 더 흘러감 (카메라가 천천히 오른쪽으로)
  c.drawImage(L.s1sky,0,0,W+20,H);
  const sy=lerp(836,752,eOut(seg(t,0,6))), g=c.createRadialGradient(1420,sy,10,1420,sy,520); g.addColorStop(0,'rgba(245,214,170,.5)'); g.addColorStop(1,'rgba(245,214,170,0)'); c.fillStyle=g; c.fillRect(0,0,W,H);   // 해가 떠오름
  c.fillStyle='#f0cfa2'; circ(c,1420,sy,128); c.fill();
  c.save(); for(const [x,y,w] of S1_CLOUDS){ const cx=x+t*9; c.globalAlpha=.2; c.fillStyle='#d897a0'; ell(c,cx,y,w*.5,10); c.fill(); ell(c,cx-w*.12,y-9,w*.3,9); c.fill(); c.globalAlpha=.18; c.fillStyle='#f3c3b0'; ell(c,cx+w*.08,y+6,w*.34,5); c.fill(); } c.restore();   // 길쭉한 새벽 구름
  c.save(); c.strokeStyle='rgba(30,26,46,.7)'; c.lineWidth=2.4; c.lineCap='round'; for(const [x0,y,v,ph,s] of S1_BIRDS) bird(c,x0+v*t,y+Math.sin(t*1.3+ph)*8,s,t*9+ph); c.restore();
  c.drawImage(L.s1mid,-8*k,0,W+20,H);
  c.save(); c.fillStyle='#c9a3a8'; c.globalAlpha=.14; for(let i=0;i<3;i++){ const mx=frac(t*.012+i*.37)*(W+1000)-500; ell(c,mx,748+i*12,560,13); c.fill(); } c.restore();   // 새벽 안개 (언덕 사이에 낮게 깔려 천천히 흐름)
  c.drawImage(L.s1near,-26*k,0,W+40,H);
  c.save(); c.translate(-26*k,0);
  c.fillStyle='#f3cfae'; for(let i=0;i<6;i++){ const p=frac(t*.35+i*.19); c.globalAlpha=arc(p)*.55; c.fillRect(1110+i*46+p*30,826+(i%3)*3,24,2); }   // 연못 물비늘 (다리 아래 물에만)
  c.globalAlpha=1; for(const [x,gy,s] of S1_LAMPS) lampGlow(c,x,lampY(gy,s),74*s,t,x);
  c.restore();
  for(const f of FLIES){ const x=f.x+Math.sin(TAU*f.k1*t/60+f.p1)*f.ax, y=f.y+Math.sin(TAU*f.k2*t/60+f.p2)*f.ay; c.globalAlpha=.25+.6*(.5+.5*Math.sin(TAU*f.k3*t/60+f.p3)); c.drawImage(SPR.glow,x-12,y-12,24,24); c.fillStyle='#f6e3a1'; circ(c,x,y,2); c.fill(); }
  c.globalAlpha=1;
  for(let i=0;i<3;i++){ const p=frac(t*.16+i*.33); leaf(c,1700-p*420,560+p*380+Math.sin(p*8+i)*24,1.2,p*8+i,'#3a2e3e'); }   // 큰 나무에서 떨어지는 잎
  c.save(); c.translate(-40*k,0); for(const [x,h,ph] of S1_TUFTS) tuft(c,x,1092,h,t,ph,'#151b24','#5b4a5e'); c.restore();   // 맨 앞 풀은 땅보다 더 흘러감
  const x=1150+Math.sin(t*.9)*10, y=lerp(1200,500,eOut(seg(t,.1,4.4)))+Math.sin(t*1.6)*6*seg(t,4,4.6), r=lerp(192,280,eOut(seg(t,.1,2.2))), sc=r/280;   // 코브 2배 (2026-10-04)
  const eyes=t<3.2?'sleep':'open', blink=t<3.2?0:Math.max(1-seg(t,3.2,3.36),arc(seg(t,4.6,4.76)));
  drawCove(c,{x,y:y+12+100*1.16*sc,s:1.16*sc,curl:1,eyes,blink,shadow:false,rot:Math.sin(t*1.1)*.05});
  drawBubble(c,x,y,r,{wob:Math.sin(t*3.1)*.015});
  label(c,'01','FIELD',PAPER);
  cap(c,t,['오늘도 들판에'],1.0,null,{col:PAPER,y:900});
}

/* ══════════ ② 코브 등장 6–14 (연보라 종이) ══════════ */
const GY2=850, B2=[960,420], S2=2.2, CS2=.55;   // B2: 처음 거품 자리 · S2: 코브 크기(2026-10-04 2배) · CS2: 코브 대비 낙하산 덮개 크기 (덮개가 화면 위로 안 잘리게)
const FRIENDS=[{col:COL.sky,x:430,y:560,t:11.5},{col:COL.mint,x:1490,y:520,t:11.8},{col:COL.lav,x:1730,y:650,t:12.1}];
function cove2(t){
  const o={x:960,y:GY2,s:S2,cs:CS2,col:COL.pink,eyes:'open',look:[0,0],lift:0,sq:1,rot:0,pl:0,pr:0,chute:0};
  if(t<7){ const k=seg(t,6.7,7), s=lerp(1.16,S2,eBackLite(k)), cy=lerp(B2[1]+12,410,eExpo(k)); return Object.assign(o,{s,lift:GY2-(cy+100*s),curl:1-k,eyes:'joy',pl:.8*k,pr:.8*k,chute:seg(t,6.85,7.35)}); }
  if(t<10.6){   // 낙하산: 덮개를 축으로 흔들림
    const sway=1-seg(t,9.8,10.6), ph=t-7, th=Math.sin(ph*2.4)*.08*sway, xc=960+Math.sin(ph*1.3)*80*sway, feet=lerp(410+100*S2,GY2,eIO3(seg(t,7,10.6)));
    return Object.assign(o,{rot:th,x:xc-Math.sin(th)*(215*CS2+100)*S2,lift:GY2-feet,pl:.8,pr:.8,chute:seg(t,6.85,7.35),blink:arc(seg(t,8.6,8.76))});
  }
  const hk=seg(t,11,11.42);
  o.chuteAway=seg(t,10.65,12.2); o.lift=92*arc(hk);
  o.sq=t<11?softSq(t-10.6):softSq(t-11.42);
  o.eyes=t<11.8?'joy':'open'; o.pl=o.pr=t<10.9?lerp(.8,0,seg(t,10.6,10.9)):.5*Math.sin(Math.PI*hk);
  if(t>=11.8){ o.look=[t<12.6?-8:8,0]; o.blink=arc(seg(t,13,13.16)); }
  return o;
}
const S2_CLOUDS=[[300,190,280],[1120,128,210],[1640,236,320]];
const S2_BIRDS=[[2000,300,120,0,.9],[2090,330,128,1.9,.7]];   // 오른쪽에서 왼쪽으로 지나가는 새
const S2_TUFTS=[[40,112,0],[1470,92,1],[1622,126,2],[1792,104,3],[1906,134,4]];
const S2_MID=[[560,884,44,7],[1250,884,40,9],[1480,882,46,10],[1700,876,36,11]];   // 가운데쯤 살랑이는 풀 [x,땅,높이,위상]
const S2_FLY=[[640,640,0,'#f3a5c4'],[1262,600,2,'#f3d987']];   // 나비 [x,y,위상,색]
function s2(c,t){
  c.drawImage(L.s2,0,0,W,H);
  for(const [x,y,w] of S2_CLOUDS) streak(c,x+(t-6)*10,y,w,'#faf6f8','#e9d9e4');
  c.save(); c.strokeStyle='rgba(80,64,96,.55)'; c.lineWidth=2.2; c.lineCap='round'; for(const [x0,y,v,ph,s] of S2_BIRDS) bird(c,x0-v*(t-6),y+Math.sin(t*1.2+ph)*6,s,t*8+ph); c.restore();
  for(const [x,gy,h,ph] of S2_MID) tuft(c,x,gy,h,t,ph,'#c79a55','#ad7d3e');
  for(let i=0;i<5;i++){ const p=frac(t*.11+i*.2), side=i%2, x=(side?1872:228)+(side?-1:1)*p*240+Math.sin(p*9+i)*28, y=470+p*420; c.save(); c.globalAlpha*=1-seg(p,.85,1); leaf(c,x,y,1.3,p*9+i,LEAF[i%4]); c.restore(); }   // 나무에서 떨어지는 잎
  for(const [x0,y0,ph,col] of S2_FLY) butterfly(c,x0+Math.sin(t*.7+ph)*120+Math.sin(t*1.9+ph)*20,y0+Math.sin(t*1.1+ph*1.3)*40,1.4,t*16+ph,col);
  for(const f of FRIENDS){
    if(t<f.t) continue; const k=eExpo(seg(t,f.t,f.t+.9)), r=78*lerp(.5,1,k), x=f.x, y=lerp(GY2+70,f.y,k)+Math.sin(t*1.4+f.x)*7;
    drawCove(c,{x,y:y+4+100*.36*(r/78),s:.36*(r/78),col:f.col,shadow:false,look:[Math.sign(960-f.x)*6,0],blink:arc(seg(frac(t*.31+f.x*.001),0,.05)),a:k});
    drawBubble(c,x,y,r,{dark:true,a:k});
  }
  if(t<6.7){ const tr=seg(t,6.45,6.7); drawCove(c,{x:B2[0],y:B2[1]+12+116,s:1.16,curl:1,eyes:'open',shadow:false}); drawBubble(c,B2[0],B2[1],280,{dark:true,wob:Math.sin(t*44)*.03*tr}); }
  drawPop(c,B2[0],B2[1],280,seg(t,6.7,7.3),'rgba(29,26,34,.55)');
  if(t>=6.7){
    const o=cove2(t);
    if(o.chuteAway!=null&&o.chuteAway<1){ const k=o.chuteAway; drawChute(c,{x:960+eIO3(k)*300,y:GY2-eIn(k)*760,s:S2,cs:CS2,rot:.2*k},lerp(1,.75,k),true,1-k); }
    if(o.chute>0) drawChute(c,o,o.chute);
    drawCove(c,o);
  }
  for(const [x,h,ph] of S2_TUFTS) tuft(c,x,1092,h,t,ph,'#b98a48','#9f6f36');
  label(c,'02','ARRIVAL',INK);
  cap(c,t,['코브가 놀러 왔어요'],7.4,null,{y:990});
}

/* ══════════ ③ 줍기 14–24 (아이보리 종이) — 떨어지는 것·코브 경로는 미리 계산 ══════════ */
const GY3=860, G=2300, CNT=[1600,250];   // G: 떨어지는 가속(px/s²) · CNT: 큰 숫자 자리
const S3=2.1, PICK3=150, X3=[260,1220];   // 코브 크기(2026-10-04 2배) · 줍는 거리(코브 몸 반지름쯤) · 코브가 다니는 범위 (오른쪽 숫자판과 안 겹치게)
const POPS=[[520,360],[900,300],[300,440],[1150,400],[700,250],[1200,268],[420,320],[980,470]].map(([x,y],i)=>({x,y,i,t:14.7+i*.5,appear:14.25+i*.07,r:58+(i%3)*8}));
const popY=p=>p.y+Math.sin(p.t*1.7+p.i)*10;
const MINI3={heart:[1392,440],star:[1522,440],candy:[1652,440]};
const CANDY_COL=['#e9a3b8','#a3dcc6','#f0d98a','#a2c6ee'];
const ITEMS=[];
(()=>{ const r=rng(42), extra=['heart','star','candy','heart','candy','star','heart','candy'], coins=[3,2,3,2,3,2,3,2];
  POPS.forEach((p,i)=>{
    Array(coins[i]).fill('coin').concat(extra[i]).forEach(kind=>{
      const rad=kind==='coin'?22:18, yg=GY3-rad; let vx=(r()-.5)*520; const vy=-(200+r()*300), x0=p.x+(r()-.5)*30, y0=popY(p);
      const t1=(-vy+Math.sqrt(vy*vy+2*G*(yg-y0)))/G, vb=-(vy+G*t1)*.3, tb=2*-vb/G;
      let xr=x0+vx*t1+vx*.35*tb; if(xr<170||xr>1310){ vx=-vx; xr=x0+vx*t1+vx*.35*tb; }
      ITEMS.push({kind,ts:p.t,x0,y0,vx,vy,t1,vb,tb,yg,spin:r()*6,col:CANDY_COL[Math.floor(r()*4)],tp:null,magnet:false});
    });
  });
})();
function itemPos(it,t){
  const d=t-it.ts; let x,y;
  if(d<it.t1){ x=it.x0+it.vx*d; y=it.y0+it.vy*d+.5*G*d*d; }
  else if(d<it.t1+it.tb){ const e=d-it.t1; x=it.x0+it.vx*it.t1+it.vx*.35*e; y=it.yg+it.vb*e+.5*G*e*e; }
  else { x=it.x0+it.vx*it.t1+it.vx*.35*it.tb; y=it.yg; }
  return [clamp(x,160,1320),y];
}
const SIM_DT=1/120, simX=[], simV=[];
(()=>{ let x=720, v=0, m=0; const N=Math.round(11/SIM_DT);
  for(let n=0;n<=N;n++){ const t=14+n*SIM_DT; let tgt=x;
    if(t>=20.1){ for(const it of ITEMS) if(it.tp==null){ it.tp=20.1+m*.05; it.magnet=true; m++; } tgt=760; }   // 못 주운 건 숫자판으로 끌려감
    else { let bd=1e9; for(const it of ITEMS){ if(it.tp!=null||t<it.ts+it.t1*.5) continue; const ix=itemPos(it,t)[0], d=Math.abs(ix-x); if(d<bd){ bd=d; tgt=ix; } } }
    const want=clamp((tgt-x)*6,-780,780); v+=(want-v)*Math.min(1,SIM_DT*10); x=clamp(x+v*SIM_DT,X3[0],X3[1]);
    if(t<20.1) for(const it of ITEMS) if(it.tp==null&&t>=it.ts+it.t1&&Math.abs(itemPos(it,t)[0]-x)<PICK3) it.tp=t;
    simX.push(x); simV.push(v);
  }
})();
ITEMS.forEach(it=>{ it.ta=it.tp+.6; it.from=itemPos(it,it.tp); it.to=it.kind==='coin'?CNT:MINI3[it.kind]; });
const COINS=ITEMS.filter(it=>it.kind==='coin').sort((a,b)=>a.ta-b.ta);
const COIN_VAL=100/COINS.length;            // 20개 × 5 = 금화 100개
const T100=COINS[COINS.length-1].ta;        // 숫자가 100이 되는 순간
const PICKS=ITEMS.filter(it=>!it.magnet).map(it=>it.tp).sort((a,b)=>a-b);
const lastPick=t=>{ let p=-9; for(const x of PICKS){ if(x<=t) p=x; else break; } return p; };
const HOP3_END=14.15+15/2.2;                 // 콩콩 15번째 착지에서 끝 → 공중에서 멈추지 않음
function drawItem(c,it,x,y,s,t){
  const sp=it.spin+t*(it.kind==='coin'?6:1.5);
  if(it.kind==='coin') drawCoin(c,x,y,22*s,sp);
  else if(it.kind==='heart') drawHeart(c,x,y,36*s,Math.sin(sp)*.25);
  else if(it.kind==='star') drawStar(c,x,y,22*s,sp*.3);
  else drawCandy(c,x,y,13*s,Math.sin(sp)*.5,it.col);
}
const S3_CLOUDS=[[330,210,300],[860,150,220],[560,330,150]];   // 숫자판 쪽은 비워 둠
const S3_TUFTS=[[30,110,4],[1400,96,0],[1566,122,1],[1752,100,2],[1904,128,3]];
const S3_EDGE=Array.from({length:30},(_,i)=>[i*66+hash(i)*28-10,24+hash(i*3.1)*22,i*1.7]);   // 아이템이 내려앉는 풀밭 가장자리 [x,높이,위상]
function s3(c,t){
  c.drawImage(L.s3,0,0,W,H);
  for(const [x,y,w] of S3_CLOUDS) streak(c,x+(t-14)*8,y,w,'#fdfaf4','#ece0d0');
  butterfly(c,1520+Math.sin(t*.8)*90,640+Math.sin(t*1.3)*36,1.3,t*15,'#c9b2f0');
  for(let i=0;i<3;i++){ const p=frac(t*.1+i*.33), x=1660-p*180+Math.sin(p*8+i)*24, y=560+p*300; c.save(); c.globalAlpha*=1-seg(p,.85,1); leaf(c,x,y,1.2,p*9+i,LEAF[i]); c.restore(); }   // 오른쪽 나무 잎 (아이템 범위 밖에서만)
  [[1688,COL.mint,'open'],[1762,COL.lemon,'joy']].forEach(([x,col,eyes],i)=>drawCove(c,{x,y:832,s:.2,col,cut:true,shadow:false,eyes,blink:arc(seg(frac(t*.29+i*.4),0,.05))}));   // 벤치에 앉은 키링 (field.js처럼)
  for(const [x,h,ph] of S3_EDGE) tuft(c,x,878,h,t,ph,'#d8b36c','#c39853');
  for(const p of POPS){
    if(t<p.appear) continue;
    if(t<p.t){ const k=eExpo(seg(t,p.appear,p.appear+.6)), tr=seg(t,p.t-.22,p.t); drawBubble(c,p.x,p.y+Math.sin(t*1.7+p.i)*10,p.r*lerp(.6,1,k),{dark:true,a:k,wob:Math.sin(t*46)*.04*tr}); }
    else drawPop(c,p.x,popY(p),p.r,seg(t,p.t,p.t+.5),'rgba(29,26,34,.5)');
  }
  for(const it of ITEMS){ if(t<it.ts||t>=it.tp) continue; const [x,y]=itemPos(it,t); drawItem(c,it,x,y,1,t); }
  const n=clamp(Math.round((t-14)*120),0,simX.length-1), v=simV[n], o={x:simX[n],y:GY3,s:S3,col:COL.pink,look:[clamp(v/600,-1,1)*8,0],eyes:'open'};
  if(t>=14.15&&t<HOP3_END){ const p=frac((t-14.15)*2.2); o.lift=80*arc(p); o.sq=p<.1?1+.08*(1-p/.1):p>.9?1+.08*((p-.9)/.1):1-.03*Math.sin(Math.PI*p); }
  if(t<HOP3_END&&t-lastPick(t)<.25) o.eyes='joy';
  if(t>=T100&&t<T100+2.6){ o.eyes='joy'; o.pl=o.pr=.9*eExpo(seg(t,T100,T100+.4))*(1-seg(t,T100+2.2,T100+2.6)); }
  drawCove(c,o);
  /* 큰 숫자판 */
  let cnt=0, bump=0; for(const it of COINS){ if(it.ta<=t){ cnt++; bump=Math.max(bump,1-seg(t,it.ta,it.ta+.2)); } }
  const val=Math.round(cnt*COIN_VAL), full=t>=T100, dn=pushTop(112,480);   // dn: 숫자판 덩어리(COINS 글자 위 112 ~ 아이템 줄 아래 480)를 메뉴 밑에서 내림
  c.save(); c.translate(0,dn); c.textBaseline='alphabetic';
  c.fillStyle=MUTED; c.font=`500 20px ${MONO}`; spaced(c,'COINS',1780,130,6,'right');
  if(full){ const k=seg(t,T100,T100+1); if(k<1){ c.strokeStyle=ROSE; c.globalAlpha=1-k; c.lineWidth=2; circ(c,1590,250,lerp(110,260,eExpo(k))); c.stroke(); c.globalAlpha=1; } }
  c.font=`700 230px ${SERIF}`; c.textAlign='right'; c.fillStyle=full?ROSE:INK; c.fillText(String(val).padStart(3,'0'),1780,345-bump*6);
  c.fillStyle='#ded6cb'; c.fillRect(1360,380,420,3); c.fillStyle=ROSE; c.fillRect(1360,380,420*val/100,3);
  c.font=`500 22px ${MONO}`; c.textAlign='left';
  for(const k of ['heart','star','candy']){ const [mx,my]=MINI3[k], n2=ITEMS.filter(it=>it.kind===k&&it.ta<=t).length; drawItem(c,{kind:k,spin:0,col:'#e9a3b8'},mx-26,my-8,.7,0); c.fillStyle=INK; c.fillText('×'+n2,mx-6,my); }
  c.restore();
  for(const it of ITEMS){   // 숫자판으로 날아가는 것
    if(t<it.tp||t>=it.ta) continue;
    const u=eIO3(seg(t,it.tp,it.ta)), [fx,fy]=it.from, tx=it.to[0], ty=it.to[1]+dn, mx=lerp(fx,tx,.35), my=Math.min(fy,ty)-240;
    c.globalAlpha=1-seg(u,.82,1); drawItem(c,it,quad(fx,mx,tx,u),quad(fy,my,ty,u),lerp(1,.6,u),t); c.globalAlpha=1;
  }
  for(const [x,h,ph] of S3_TUFTS) tuft(c,x,1092,h,t,ph,'#b98a48','#9f6f36');
  label(c,'03','COLLECT',INK);
  cap(c,t,['터트리고, 줍고'],14.7,T100-.15,{y:990});
  cap(c,t,['금화 100개'],T100+.05,null,{y:990});
}

/* ══════════ ④ 쿠폰 24–32 (먹색 종이) — 금화 소용돌이 → 덮개가 뒤로 접혀 쿠폰 → 도장 ══════════ */
const C4=[1090,430], CW=680, CH=300, CTILT=-2*DEG, SEAL=[CW/2-96,-58];
function couponFace(c,ink){
  const w=CW, h=CH;
  rr(c,-w/2,-h/2,w,h,12); c.fillStyle='#f4efe6'; c.fill();
  c.save(); rr(c,-w/2,-h/2,w,h,12); c.clip(); c.fillStyle='#ecdbe0'; c.fillRect(-w/2,-h/2,200,h); c.restore();
  c.fillStyle='#cdb7ad'; for(let y=-h/2+16;y<h/2-8;y+=17){ circ(c,-w/2+200,y,2.2); c.fill(); }
  drawCove(c,{x:-w/2+100,y:66,s:.44,shadow:false,eyes:'joy'});
  c.textBaseline='alphabetic';
  c.fillStyle='#9a5468'; c.font=`600 18px ${MONO}`; spaced(c,'COUPON',-w/2+240,-h/2+60,7);
  c.fillStyle='#d8cbbd'; c.fillRect(-w/2+240,-h/2+82,w-268,1.5);
  c.fillStyle=INK; c.font=`700 116px ${SERIF}`; c.textAlign='left'; c.fillText('100원',-w/2+232,48);
  const wd=c.measureText('100원').width; c.font=`500 40px ${SERIF}`; c.fillText('할인',-w/2+244+wd,46);
  c.fillStyle='#7d7280'; c.font=`500 24px ${SANS}`; c.fillText('키링 1개',-w/2+240,h/2-40);
  c.fillStyle='#a99aa0'; c.font=`500 15px ${MONO}`; c.textAlign='right'; c.fillText('No. 0001',w/2-26,h/2-40);
  if(ink>0) drawSeal(c,SEAL[0],SEAL[1],ink);
}
function couponFlap(c,cs){   // 금화 무늬 덮개: 쿠폰 오른쪽 변을 축으로 뒤로 접힘 (cs 1=펼침 → -1=뒤에 숨음)
  if(Math.abs(cs)<.02) return;
  const fw=CW*.5;
  c.save(); c.translate(CW/2,0); c.scale(cs,1);
  if(cs>0){ c.fillStyle='rgba(0,0,0,.25)'; rr(c,6,-CH/2+12,fw,CH,12); c.fill(); }
  rr(c,-14,-CH/2,fw+14,CH,12); c.fillStyle=cs>0?'#eee3d2':'#e2d6c5'; c.fill();
  if(cs>0) for(let i=0;i<2;i++) for(let j=0;j<3;j++) drawCoin(c,92+i*120,-92+j*92,24,i+j*.7);
  c.setLineDash([8,8]); c.lineWidth=1.5; c.strokeStyle='#cdbba5'; c.beginPath(); c.moveTo(0,-CH/2+10); c.lineTo(0,CH/2-10); c.stroke(); c.setLineDash([]);
  c.fillStyle=`rgba(30,20,30,${(1-Math.abs(cs))*.3})`; c.fillRect(0,-CH/2,fw,CH);
  c.restore();
}
function drawCoupon(c,x,y,sc,rot,fold,ink,a){
  fold=fold==null?1:fold; ink=ink||0; const cs=Math.cos(Math.PI*fold);
  c.save(); c.translate(x,y); c.rotate(rot); c.scale(sc,sc); if(a!=null) c.globalAlpha*=a;
  if(cs<0) couponFlap(c,cs);
  c.fillStyle='rgba(0,0,0,.28)'; rr(c,-CW/2+8,-CH/2+14,CW,CH,12); c.fill();
  couponFace(c,ink);
  if(cs>=0) couponFlap(c,cs);
  c.restore();
}
const STAMP={rest:[1590,702],at:[1332,364],aside:[1566,516]};   // 도장: 인주 위 · 쿠폰 도장 자리(쿠폰 기울기 반영) · 찍고 내려놓는 곳
function stampPos(t){   // 들어 올려 쿠폰 위로 → 꾹 → 옆에 내려놓음 (h: 높이 0~1)
  const [rx,ry]=STAMP.rest, [sx,sy]=STAMP.at, [ax,ay]=STAMP.aside;
  if(t<27.35) return {x:rx,y:ry,h:0};
  if(t<27.9){ const k=eIO3(seg(t,27.35,27.9)); return {x:lerp(rx,sx,k),y:lerp(ry,sy,k),h:arc(k)*.6+k*.4}; }
  if(t<28) return {x:sx,y:sy,h:lerp(.4,0,eIn(seg(t,27.9,28)))};
  if(t<28.25) return {x:sx,y:sy,h:0};
  if(t<28.85){ const k=eIO3(seg(t,28.25,28.85)); return {x:lerp(sx,ax,k),y:lerp(sy,ay,k),h:arc(k)*.7}; }
  return {x:ax,y:ay,h:0};
}
function drawStamp(c,p){   // 위에서 본 나무 도장 (바닥이 도장 자국보다 큼 · 높이 들수록 크고 그림자가 멀어짐)
  const s=1+p.h*.22, off=8+p.h*40;
  c.fillStyle=`rgba(0,0,0,${.42-p.h*.2})`; circ(c,p.x+off*.6,p.y+off,76*s*(1-p.h*.1)); c.fill();
  c.save(); c.translate(p.x,p.y); c.scale(s,s);
  c.fillStyle='#5b3a2b'; circ(c,0,0,76); c.fill(); c.strokeStyle='rgba(204,78,62,.75)'; c.lineWidth=3; circ(c,0,0,74); c.stroke();
  c.fillStyle='#7b4d36'; circ(c,0,0,50); c.fill(); c.fillStyle='#a8714f'; circ(c,0,0,32); c.fill(); c.fillStyle='#8a5a3e'; circ(c,0,0,12); c.fill();
  c.restore();
}
const S4_COINS=[[690,650],[1474,884],[1530,912]];   // 책상에 흩어진 금화 (도장 찍을 때 들썩)
function s4(c,t){
  c.drawImage(L.desk,0,0,W,H);
  c.save(); c.strokeStyle='#f4e6d4'; c.lineCap='round'; for(let i=0;i<3;i++){ const p=frac(t*.32+i/3), x=214+Math.sin(p*6+i*2.1)*16, y=640-p*170; c.globalAlpha=.14*arc(p); c.lineWidth=12-p*6; c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+18,y-34,x-4,y-70); c.stroke(); } c.restore();   // 코코아 김
  const hop=t>28&&t<28.4?6*arc(seg(t,28,28.4)):0; for(const [x,y] of S4_COINS) coinTop(c,x,y-hop,22);
  const [cx,cy]=C4;
  if(t<26.5) for(let i=0;i<30;i++){
    const ts=24.1+i*.06; if(t<ts) continue; const u=seg(t,ts,26.4); if(u>=1) continue;
    const a0=i*2.4, sx=1786+Math.cos(a0)*55, sy=292+Math.sin(a0)*55, dx=sx-cx, dy=sy-cy, rs=Math.hypot(dx,dy), th0=Math.atan2(dy,dx);   // 금화 접시에서 날아올라 소용돌이
    const rad=rs*Math.pow(1-u,1.25), th=th0+u*(TAU*1.25+i*.17);
    drawCoin(c,cx+Math.cos(th)*rad,cy+Math.sin(th)*rad*.82,22*lerp(1,.5,u),t*10+i);
  }
  const fk=seg(t,26.4,27.1); if(fk>0&&fk<1){ c.strokeStyle=GOLD; c.globalAlpha=1-fk; c.lineWidth=2; circ(c,cx,cy,lerp(30,260,eExpo(fk))); c.stroke(); c.globalAlpha=1; }
  if(t>=26.4){
    const a=eExpo(seg(t,26.4,26.9)), fold=eIO3(seg(t,27,27.55)), ink=seg(t,28.2,28.26), d=t-28, nudge=d>0&&d<.5?5*Math.exp(-d*12)*Math.sin(d*42):0;   // 도장 자국은 도장 밑에서 생기고 들어 올릴 때 보임
    drawCoupon(c,cx,cy+nudge,lerp(.94,1,a),CTILT,fold,ink,a);
  }
  drawStamp(c,stampPos(t));
  label(c,'04','COUPON',PAPER);
  cap(c,t,['금화 100개 = 쿠폰 1장'],28.5,null,{col:PAPER,y:900,size:62,sub:'키링 1개 100원 할인',subCol:'#aaa0b6'});
}

/* ══════════ ⑤ 가게 32–36.5 → 진열대 36.5–44 (크라프트지) ══════════ */
const GY5=860, STORE=1440, STORE_S=1.2, S5=2;   // 가게 자리·크기 · 코브 크기(2026-10-04 2배, 가게는 1.2배만 키워 간판이 화면 안에)
function drawStore(c,x,gy,t,mid,s){   // 코브 몰 가게: 타공판 뒷벽(⑤-2 진열 벽과 같은 벽) · 줄무늬 차양 · 나무 간판 · 계산대(앞에 키링 · 종) — mid: 점원 코브
  c.save(); c.translate(x,gy); if(s) c.scale(s,s);
  c.fillStyle='rgba(20,14,30,.08)'; ell(c,0,4,300,14); c.fill();
  c.fillStyle='#d3b693'; c.fillRect(-238,-480,476,214); c.fillStyle='rgba(74,48,24,.3)'; for(let y=-456;y<-280;y+=30) for(let x=-210;x<=210;x+=30){ circ(c,x,y,2.4); c.fill(); }
  c.fillStyle='#a8825c'; c.fillRect(-250,-540,12,540); c.fillRect(238,-540,12,540);
  c.fillStyle='rgba(60,40,20,.18)'; for(let i=0;i<8;i++){ c.beginPath(); c.arc(-280+i*70+35,-470,35,0,Math.PI); c.fill(); }   // 차양 그림자
  c.fillStyle='#a8825c'; c.fillRect(-286,-566,572,8);
  for(let i=0;i<8;i++){ c.fillStyle=i%2?'#fbf7f1':ROSE; c.fillRect(-280+i*70,-560,70,82); }
  for(let i=0;i<8;i++){ c.fillStyle=i%2?'#fbf7f1':ROSE; c.beginPath(); c.arc(-280+i*70+35,-478,35,0,Math.PI); c.fill(); }
  c.fillStyle=WOOD_D; c.fillRect(-92,-584,6,20); c.fillRect(86,-584,6,20); rr(c,-128,-650,256,72,6); c.fillStyle=WOOD; c.fill(); rr(c,-118,-641,236,54,3); c.fillStyle=PAPER; c.fill();   // 각목에 단 나무 간판
  c.fillStyle=INK; c.font=`700 36px ${SERIF}`; c.textAlign='center'; c.textBaseline='alphabetic'; c.fillText('코브 몰',0,-596);
  for(const [kx,col,ph] of [[-190,COL.sky,0],[190,COL.lemon,1.3]]){
    const sw=Math.sin(t*2+ph)*.12; c.save(); c.translate(kx,-438); c.rotate(sw);
    c.strokeStyle='rgba(29,26,34,.5)'; c.lineWidth=2; c.beginPath(); c.moveTo(0,0); c.lineTo(0,24); c.stroke(); circ(c,0,30,6); c.stroke();
    drawCove(c,{x:0,y:108,s:.28,col,cut:true,shadow:false}); c.restore();
  }
  if(mid) mid();
  c.fillStyle='#c99f76'; c.fillRect(-270,-250,540,250);
  c.fillStyle='#d9b38b'; c.fillRect(-290,-268,580,26);
  c.fillStyle='rgba(29,26,34,.12)'; c.fillRect(-250,-200,500,1.5);
  c.fillStyle='rgba(29,26,34,.06)'; for(let x=-216;x<270;x+=54) c.fillRect(x,-242,1.5,242);   // 계산대 판자 이음
  [COL.pink,COL.mint,COL.sky,COL.lemon,COL.lav].forEach((col,i)=>keyring(c,-200+i*100,-242,12,.2,t,i*1.3,col));   // 계산대 앞에 건 키링
  c.save(); c.translate(196,-268); c.fillStyle=WOOD_D; rr(c,-26,-8,52,8,3); c.fill(); c.fillStyle=GOLD; c.beginPath(); c.arc(0,-8,19,Math.PI,TAU); c.fill(); c.fillRect(-2,-33,4,7); c.restore();   // 종
  c.restore();
}
function cove5(t){
  const o={x:260,y:GY5,s:S5,col:COL.pink,pr:1,look:[7,-2],eyes:'open'};
  if(t<34.8){ const k=seg(t,32.3,34.8), p=frac((t-32.3)*3), fade=1-seg(t,34.5,34.8); o.x=lerp(260,900,k); o.lift=20*arc(p)*fade; o.rot=Math.sin((t-32.3)*3*Math.PI)*.035*fade; return o; }
  o.x=900; o.pr=lerp(1,1.3,eExpo(seg(t,35,35.4))); o.eyes=t>35.05?'joy':'open'; o.look=[9,-4]; return o;
}
const S5_CLOUDS=[[420,170,300],[1010,110,200],[1560,140,240]];
const S5_TUFTS=[[60,120,0],[520,96,1],[1240,110,2],[1880,130,3]];
function s5a(c,t){
  c.drawImage(L.s5a,0,0,W,H);
  for(const [x,y,w] of S5_CLOUDS) streak(c,x+(t-32)*10,y,w,'#fdf8f1','#eadbc9');
  for(let i=0;i<4;i++){ const p=frac(t*.12+i*.25), side=i%2, x=(side?1820:200)+(side?-1:1)*p*160+Math.sin(p*9+i)*24, y=(side?640:560)+p*300; c.save(); c.globalAlpha*=1-seg(p,.85,1); leaf(c,x,y,1.2,p*9+i,LEAF[i%4]); c.restore(); }   // 양쪽 나무에서 떨어지는 잎
  [[COL.pink,0],[COL.sky,1.4]].forEach(([col,ph],i)=>{ const [hx,hy]=HANG[i]; keyring(c,1866+hx*1.1,868+hy*1.1,26+i*16,.26,t,ph,col); });   // 가게 옆 나무에 매단 키링 (오른쪽 끝에 안 잘리게 살짝 안쪽)
  bunting(c,232,440,1146,392,60,13,t);
  drawStore(c,STORE,GY5,t,()=>{
    const wave=t>=33, w=wave?lerp(.1,.7+.3*Math.sin((t-33)*8),1-seg(t,35.9,36.3)):.1;
    drawCove(c,{x:0,y:-252,s:1.1,col:COL.cream,hat:ROSE,shadow:false,pr:w,eyes:wave&&t<36.3?'joy':'open',look:[-8,0]});
  },STORE_S*Math.min(1,(GY5-SAFE_T-16)/(650*STORE_S)));   // 간판(가게 바닥에서 650 위)이 메뉴 밑에 깔리거나 잘리면 가게를 바닥 기준으로 줄임
  const o=cove5(t), [px,py]=pawWorld(o); drawCoupon(c,px+20,py-84,.36,-.12+(o.rot||0),1,1); drawCove(c,o);   // 손이 쿠폰 아래 끝을 쥐고 머리 위로 들어 보임
  butterfly(c,720+Math.sin(t*.9)*110,400+Math.sin(t*1.4)*36,1.3,t*15,'#a2c6ee');
  for(const [x,h,ph] of S5_TUFTS) tuft(c,x,1092,h,t,ph,'#b98a48','#9f6f36');
  label(c,'05','SHOP',INK);
}
const CARDS=[   // 진열대 키링 (지금은 그린 코브 — 실제 판매 키링 사진이 정해지면 바꿀 자리)
  {x:330, y:420,tilt:-6,col:COL.pink, paper:'#f1d6de',name:'분홍 코브'},
  {x:660, y:565,tilt:5, col:COL.mint, paper:'#d6ebe1',name:'민트 코브',isNew:true},
  {x:990, y:405,tilt:-3,col:COL.sky,  paper:'#d8e3f1',name:'하늘 코브'},
  {x:1320,y:565,tilt:6, col:COL.lemon,paper:'#f2e7c3',name:'레몬 코브',isNew:true},
  {x:1645,y:420,tilt:-5,col:COL.lav,  paper:'#e3dbf1',name:'라벤더 코브'},
];
CARDS.forEach((cd,i)=>{ cd.tIn=36.95+i*.38; cd.tTape=cd.tIn+.45; cd.torn=tornRect(250,300,101+i*7,14,4); cd.tapeRot=(i%2?7:-6)*DEG; });
CARDS[1].tNew=39; CARDS[3].tNew=39.3;
const FAV=2, HEARTS=[40.6,41.25,41.9].map(t=>({t,ta:t+.7}));
const MINI={x:1792,y:1086,s:1.4};   // 오른쪽 아래에서 고개를 내미는 코브 (2026-10-04 2배)
function miniPose(t){
  const o={x:MINI.x,y:MINI.y,s:MINI.s,shadow:false,look:[-8,-7],eyes:'open',lift:-lerp(560,0,eExpo(seg(t,39.7,40.3)))};
  for(const h of HEARTS){ const d=t-h.t; if(d>-.2&&d<.35) o.pl=1.1*arc(seg(t,h.t-.2,h.t+.35)); }
  if(t>HEARTS[0].ta) o.eyes='joy';
  return o;
}
function s5b(c,t){
  c.drawImage(L.board,0,0,W,H);
  BULBS.forEach(([x,y],i)=>{ c.save(); c.globalAlpha*=.4+.3*(.5+.5*Math.sin(t*2.2+i*1.7)); c.drawImage(SPR.lamp,x-34,y-34,68,68); c.restore(); });   // 꼬마전구 빛이 천천히 깜빡임
  const favHop=HEARTS.reduce((m,h)=>Math.max(m,arc(seg(t,h.ta,h.ta+.35))),0);
  const favWig=HEARTS.reduce((m,h)=>m+(t>h.ta?Math.sin((t-h.ta)*26)*3.5*(1-seg(t,h.ta,h.ta+.5)):0),0);
  CARDS.forEach((cd,i)=>{
    const k=stepK(seg(t,cd.tIn,cd.tIn+.34),4); if(k<=0) return;
    const jit=(hash(Math.floor(t*8)+i*13)-.5)*.6;   // 스톱모션처럼 1/8초마다 살짝 떨림
    const hop=i===FAV?favHop:0, sc=lerp(1.22,1,k)*(1+hop*.05), lift=lerp(24,0,k);
    c.save(); c.translate(cd.x,cd.y-hop*10); c.rotate((cd.tilt+lerp(8,0,k)+jit+(i===FAV?favWig:0))*DEG); c.scale(sc,sc);
    c.save(); c.translate(7+lift*.5,10+lift); poly(c,cd.torn); c.fillStyle='rgba(60,40,20,.22)'; c.fill(); c.restore();
    poly(c,cd.torn); c.fillStyle=cd.paper; c.fill();
    c.strokeStyle='#9d96a6'; c.lineWidth=5; circ(c,0,-66,17); c.stroke();
    c.lineWidth=3.5; c.beginPath(); c.moveTo(0,-49); c.lineTo(0,-26); c.stroke();
    drawCove(c,{x:0,y:116,s:.82,col:cd.col,cut:true,shadow:false,eyes:i===FAV&&t>HEARTS[0].ta?'joy':'open',blink:arc(seg(frac(t*.27+i*.19),0,.05))});
    if(cd.isNew&&t>=cd.tNew){ const nk=stepK(seg(t,cd.tNew,cd.tNew+.25),3); c.save(); c.translate(64,112); c.rotate(-.2); c.scale(lerp(1.6,1,nk),lerp(1.6,1,nk)); c.globalAlpha*=lerp(.3,.9,nk);
      c.strokeStyle=VERM; c.lineWidth=2.5; c.strokeRect(-46,-20,92,40); c.fillStyle=VERM; c.font=`600 24px ${MONO}`; c.textBaseline='alphabetic'; spaced(c,'NEW',0,9,4,'center'); c.restore(); }
    if(i===FAV&&t>=HEARTS[0].ta){ const n=HEARTS.filter(h=>t>=h.ta).length, pk=HEARTS.reduce((m,h)=>Math.max(m,arc(seg(t,h.ta,h.ta+.3))),0);
      c.save(); c.translate(98,-118); c.scale(1+pk*.2,1+pk*.2); circ(c,0,0,30); c.fillStyle='#fffdf8'; c.fill(); drawHeart(c,0,1,22,0); rr(c,14,12,30,22,11); c.fillStyle=INK; c.fill();   // 하트 수는 따로 알약에
      c.fillStyle='#fffdf8'; c.font=`600 15px ${MONO}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(n),29,23.5); c.restore(); }
    c.restore();
    c.save(); c.translate(cd.x+12,cd.y+186); c.rotate(cd.tilt*-.5*DEG); c.globalAlpha*=k;
    c.fillStyle='rgba(60,40,20,.16)'; c.fillRect(-90,-22,190,56); c.fillStyle='#fffdf8'; c.fillRect(-95,-28,190,56);
    c.fillStyle=MUTED; c.font=`500 13px ${MONO}`; c.textAlign='left'; c.textBaseline='alphabetic'; c.fillText('No.0'+(i+1),-80,-8);
    c.fillStyle=INK; c.font=`600 24px ${SERIF}`; c.fillText(cd.name,-80,20); c.restore();
  });
  CARDS.forEach(cd=>{ if(t<cd.tTape) return; const k=stepK(seg(t,cd.tTape,cd.tTape+.2),3);
    c.save(); c.translate(cd.x,cd.y); c.rotate(cd.tilt*DEG); drawTape(c,0,-150,lerp(160,124,k),34,cd.tapeRot); c.restore(); });
  if(t>=39.7) drawCove(c,miniPose(t));
  c.fillStyle='rgba(60,40,20,.22)'; c.fillRect(0,1030,W,10); c.fillStyle='#b0825a'; c.fillRect(0,1038,W,14); c.fillStyle='#8e6342'; c.fillRect(0,1052,W,28);   // 가게 계산대 앞턱 → 코브가 계산대 뒤에서 올려다봄
  for(const h of HEARTS){
    if(t<h.t||t>=h.ta) continue;
    const [sx,sy]=pawWorld(miniPose(h.t),true), cd=CARDS[FAV], tx=cd.x+98, ty=cd.y-118, u=eIO3(seg(t,h.t,h.ta));
    drawHeart(c,quad(sx,1380,tx,u),quad(sy,240,ty,u),lerp(22,40,u),Math.sin(u*TAU)*.2);
  }
  label(c,'05','SHELF',INK);
  cap(c,t,['손으로 고른 키링'],37.1,40.3,{y:990});
  cap(c,t,['마음에 들면 하트'],40.5,null,{y:990});
}

/* ══════════ ⑥ 내 코브 꾸미기 44–52 (회색 종이 · 색 견본) ══════════ */
const CHIPS=[{name:'분홍',en:'PINK',code:'CV-01',col:COL.pink},{name:'민트',en:'MINT',code:'CV-02',col:COL.mint},{name:'레몬',en:'LEMON',code:'CV-03',col:COL.lemon},{name:'하늘',en:'SKY',code:'CV-04',col:COL.sky},{name:'무지개',en:'SECRET',code:'CV-??',col:null}];
const CHX=1330, CHW=380, CHH=112;
const chipY=i=>{ const y0=140+pushTop(122), st=Math.max(90,Math.min(126,(770-CHH-y0)/4)); return y0+i*st; };   // 마지막 견본도 작업대(770) 위에 걸리게 · 메뉴 밑에 걸리면 내리고 간격을 좁힘(모자라면 견본끼리 살짝 겹침)
const CANDIES=[1,2,3].map((ci,j)=>({ci,L:44.7+j*1.2}));
CANDIES.forEach(cd=>{ cd.A=cd.L+.55; cd.sw=cd.A+.6*.25; });   // sw: 도는 중 옆모습일 때 색이 바뀜
const ORB={L:48.4,A:48.95,spin:.8}; ORB.sw=ORB.A+ORB.spin*.125; ORB.end=ORB.A+ORB.spin;
const R6={x:740,y:880,s:3.7};   // 작업대 위 코브 (2026-10-04 2배)
function s6(c,t){
  c.drawImage(L.studio,0,0,W,H);
  c.save(); c.beginPath(); c.rect(652,56,216,170); c.clip(); for(let i=0;i<2;i++){ const p=frac(t*.16+i*.5); leaf(c,670+p*170+Math.sin(p*8+i*3)*16,52+p*190,1.2,t*1.6+i,LEAF[i*2]); } c.restore();   // 창밖에 떨어지는 잎
  c.fillStyle='#c9a77e'; c.fillRect(754,56,12,170); c.fillRect(652,136,216,10);
  c.fillStyle='#fff6e6'; for(let i=0;i<9;i++){ const p=frac(t*.07+hash(i)); c.globalAlpha=.5*arc(p); circ(c,lerp(700,1000,hash(i+3))+p*60,lerp(330,740,hash(i+7))-p*50,2); c.fill(); } c.globalAlpha=1;   // 빛 속 먼지
  c.fillStyle='rgba(29,26,34,.08)'; ell(c,R6.x,R6.y+4,330,40); c.fill();
  let idx=0, col=COL.pink, iri=null, flip=1, sq=1, lift=0, eyes='open', sheen=null;
  CANDIES.forEach(cd=>{ if(t>=cd.sw){ idx=cd.ci; col=CHIPS[cd.ci].col; } });
  if(t>=ORB.sw){ idx=4; iri=t*.8; }
  for(const cd of CANDIES){
    if(t>=cd.A&&t<cd.A+.6){ const k=seg(t,cd.A,cd.A+.6); flip=edge(Math.cos(TAU*k)); lift=68*arc(k); eyes='joy'; }
    if(t>=cd.A) sq*=softSq(t-cd.A);
  }
  if(t>=ORB.A&&t<ORB.end){ const k=seg(t,ORB.A,ORB.end); flip=edge(Math.cos(2*TAU*k)); lift=120*arc(k); eyes='joy'; }
  if(t>=ORB.end){ eyes='joy'; sq=softSq(t-ORB.end); sheen=seg(t,ORB.end+.1,ORB.end+1); }
  CHIPS.forEach((ch,i)=>{
    const on=i===idx, since=i===0?44:i===4?ORB.sw:CANDIES[i-1].sw, ok=eExpo(seg(t,since,since+.5))*(on?1:0);
    const x=CHX-28*ok, y=chipY(i), px=CHX+CHW/2;
    c.save(); c.translate(px,y-18); c.rotate(Math.sin(t*1.2+i*1.9)*.5*DEG); c.translate(-px,-(y-18));   // 집게를 축으로 살짝 흔들림
    c.fillStyle=`rgba(29,26,34,${.06+ok*.08})`; c.fillRect(x+4,y+6,CHW,CHH);
    c.fillStyle='#fbf9f5'; c.fillRect(x,y,CHW,CHH);
    if(ch.col){ c.fillStyle=ch.col; c.fillRect(x,y,CHH,CHH); }
    else if(idx>=4){ const g=c.createLinearGradient(x,y,x+CHH,y+CHH); IRI.forEach((h,j)=>g.addColorStop(j/(IRI.length-1),h)); c.fillStyle=g; c.fillRect(x,y,CHH,CHH); }
    else { c.fillStyle='#d9d3cc'; c.fillRect(x,y,CHH,CHH); c.fillStyle='#fbf9f5'; c.font=`600 46px ${SERIF}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?',x+CHH/2,y+CHH/2+3); }
    if(on){ c.fillStyle=ROSE; c.fillRect(x-10,y,3,CHH); }
    c.textBaseline='alphabetic'; c.fillStyle=MUTED; c.font=`500 15px ${MONO}`; spaced(c,!ch.col&&idx>=4?'IRIDESCENT':ch.en,x+CHH+24,y+38,3);
    c.textAlign='right'; c.fillText(ch.code,x+CHW-18,y+38);
    c.fillStyle=INK; c.font=`600 32px ${SERIF}`; c.textAlign='left'; c.fillText(!ch.col&&idx<4?'비밀':ch.name,x+CHH+24,y+84);
    c.fillStyle='#c9a77e'; rr(c,px-7,y-18,14,32,3); c.fill(); c.fillStyle='#a8865e'; c.fillRect(px-7,y-4,14,3);   // 줄에 집은 빨래집게 (뽑힌 견본이 옆으로 나와도 집게는 줄 위)
    c.restore();
  });
  const cy=R6.y-R6.s*100;
  for(const cd of CANDIES){ if(t<cd.L||t>=cd.A) continue; const u=eIO3(seg(t,cd.L,cd.A)), fx=CHX+CHH/2, fy=chipY(cd.ci)+CHH/2;
    drawCandy(c,quad(fx,lerp(fx,R6.x,.5),R6.x,u),quad(fy,Math.min(fy,cy)-200,cy,u),24*lerp(1,.5,eIn(u)),t*5,CHIPS[cd.ci].col); }
  if(t>=ORB.L&&t<ORB.A){ const u=eIO3(seg(t,ORB.L,ORB.A)), fx=CHX+CHH/2, fy=chipY(4)+CHH/2; drawOrb(c,quad(fx,lerp(fx,R6.x,.5),R6.x,u),quad(fy,Math.min(fy,cy)-260,cy,u),26*lerp(1,.6,u)); }
  drawCove(c,{x:R6.x,y:R6.y,s:R6.s,col,iri,flip,back:flip<0,sq,lift,eyes,look:[8,-2],sheen,shadow:false});
  label(c,'06','COLOR',INK);
  cap(c,t,['사탕으로 내 코브 색을'],44.7,49,{y:990});
  cap(c,t,['무지개 코브는 비밀'],50,null,{y:990});
}

/* ══════════ ⑦ 엔딩 52–60 (남색 종이) — 글자가 올라오고 코브가 밟고 지나감 ══════════ */
const BASE7=600, HOLD7=.14;   // BASE7: 글자 밑줄 높이 · HOLD7: 글자 위에서 머물며 누르는 시간
const HOP7=[{t0:53.85,t1:54.3,a:-2,b:0},{t0:54.3+HOLD7,t1:54.85,a:0,b:1},{t0:54.85+HOLD7,t1:55.4,a:1,b:2},{t0:55.4+HOLD7,t1:56.1,a:2,b:-3}];   // a·b: 받침(글자 번호, -2=하늘, -3=화면 밖)
let L7=null;
function layout7(c){   // 글자 폭·높이는 글꼴이 오면 다시 잼
  if(L7&&L7.v===fontVer) return L7;
  c.save(); c.font=`800 250px ${SERIF}`; const chs=['코','브','몰'], ws=chs.map(s=>c.measureText(s).width), asc=chs.map(s=>c.measureText(s).actualBoundingBoxAscent||190), gap=64;
  let x=960-(ws[0]+ws[1]+gap+ws[2])/2; const xs=[]; ws.forEach((w,i)=>{ xs.push(x+w/2); x+=w+(i===1?gap:0); }); c.restore();
  L7={v:fontVer,chs,ws,asc,xs}; return L7;
}
const press7=(j,t)=>{ const d=t-HOP7[j].t1; if(d<0) return 0; if(d<.07) return eOut(d/.07); const e=d-.07; return e>.8?0:Math.exp(-e*7)*Math.cos(e*15); };   // 밟는 순간 0에서 눌리기 시작
const top7=(Lt,j,t)=>BASE7+9*press7(j,t)-Lt.asc[j]/(1+.07*press7(j,t))-2;
function cove7(c,t){
  const Lt=layout7(c); if(t<HOP7[0].t0||t>=HOP7[HOP7.length-1].t1) return null;
  const o={s:1.24,eyes:'joy',look:[6,0],shadow:false};   // 2026-10-04 2배
  const hop=HOP7.find(h=>t>=h.t0&&t<h.t1);
  if(!hop){ const pv=HOP7.filter(h=>h.t1<=t).pop(), j=pv.b; o.x=Lt.xs[j]; o.y=top7(Lt,j,t); o.sq=softSq(t-pv.t1); return o; }
  const xOf=i=>i>=0?Lt.xs[i]:i===-2?Lt.xs[0]:Lt.xs[2]+600, yOf=(i,tt)=>i>=0?top7(Lt,i,tt):i===-2?-180:H+320;
  const k=seg(t,hop.t0,hop.t1), ya=yOf(hop.a,hop.t0), yb=yOf(hop.b,hop.t1);
  o.x=lerp(xOf(hop.a),xOf(hop.b),k); o.y=hop.a===-2?lerp(ya,yb,eIn(k)):lerp(ya,yb,k)-(hop.b===-3?260:220)*arc(k);
  const pv=HOP7.find(h=>h.t1<=hop.t0&&hop.t0-h.t1<.2); o.sq=pv?softSq(t-pv.t1):1; o.pl=o.pr=hop.a===-2?.6:.6*arc(k);
  return o;
}
const S7_TWINKLE=(()=>{ const r=rng(71), a=[]; for(let i=0;i<14;i++) a.push([r()*W,30+r()*420,r()*TAU,1.4+r()*1.4]); return a; })();
const S7_BUBBLES=[[280,0,26],[470,.45,18],[1540,.7,30]];
const S7_TUFTS=[[24,120,0],[300,84,1],[560,70,2],[1180,74,3],[1500,90,4],[1650,110,5],[1900,126,6]];   // 언덕에서 천천히 떠오르는 빈 거품 [x,위상,r]
function s7(c,t){
  c.drawImage(L.night,0,0,W,H);
  c.fillStyle='#fff'; for(const [x,y,ph,r] of S7_TWINKLE){ c.globalAlpha=.2+.6*(.5+.5*Math.sin(t*2.4+ph)); circ(c,x,y,r); c.fill(); } c.globalAlpha=1;
  for(const [x,ph,r] of S7_BUBBLES){ const p=frac(t*.06+ph); drawBubble(c,x+Math.sin(p*7+ph*9)*20,lerp(1010,380,p),r,{a:.45*arc(p)}); }
  for(const [x,gy,s] of S7_LAMPS) lampGlow(c,x,lampY(gy,s),110*s,t,x);
  c.fillStyle='rgba(60,56,96,.45)'; for(const [x0,y,w,sp] of [[1560,232,300,9],[1720,176,180,6]]){ ell(c,x0+(t-52)*sp,y,w/2,7); c.fill(); }   // 달 앞을 지나는 가는 구름
  HANG.forEach(([hx,hy],i)=>keyring(c,1612+hx*.6,960+hy*.6,14,.1,t,i*1.3,mixHex([COL.pink,COL.mint,COL.lemon][i],'#2e2a4b',.35)));   // 가게 옆 나무에 매단 키링
  for(const f of FLIES){ if(f.x>520&&f.x<1400) continue; const x=f.x+Math.sin(TAU*f.k1*t/60+f.p1)*f.ax, y=f.y+60+Math.sin(TAU*f.k2*t/60+f.p2)*f.ay; c.globalAlpha=.2+.5*(.5+.5*Math.sin(TAU*f.k3*t/60+f.p3)); c.drawImage(SPR.glow,x-12,y-12,24,24); }
  c.globalAlpha=1;
  for(const [x,h,ph] of S7_TUFTS) tuft(c,x,1084,h,t,ph,'#14132a','#1c1b34');
  const Lt=layout7(c);
  c.save(); c.beginPath(); c.rect(0,BASE7-330,W,410); c.clip();
  c.font=`800 250px ${SERIF}`; c.textAlign='center'; c.textBaseline='alphabetic'; c.fillStyle=PAPER;
  Lt.chs.forEach((ch,j)=>{ const k=eExpo(seg(t,52.45+j*.14,53.5+j*.14)); if(k<=0) return; const p=press7(j,t), sq=1+.07*p;
    c.save(); c.translate(Lt.xs[j],BASE7+9*p+(1-k)*300); c.scale(sq,1/sq); c.fillText(ch,0,0); c.restore(); });
  c.restore();
  const rk=eExpo(seg(t,53.3,54.3)); c.fillStyle='rgba(243,238,230,.35)'; c.fillRect(960-280*rk,668,560*rk,1.5);
  const o=cove7(c,t); if(o) drawCove(c,o);
  cap(c,t,['들판에서 놀고, 키링으로 데려가요'],55.7,null,{col:PAPER,y:770,size:50,w:500,align:'center',noRule:true});
  const sk=eExpo(seg(t,56.5,57.4));
  const yb=Math.min(896,SAFE_B-30);   // 아주 넓은 화면에서 아래가 잘리면 안내 줄을 보이는 곳까지 올림, 'COVV MALL' 줄은 자리가 모자라면 뺌
  if(sk>0){ c.save(); c.globalAlpha=sk; c.fillStyle='#aaa1bd'; c.font=`500 22px ${MONO}`; c.textBaseline='alphabetic'; if(yb-44>=800) spaced(c,'COVV MALL',960,yb-44-(1-sk)*10,7,'center');
    c.font=`500 24px ${SANS}`; c.textAlign='center'; c.fillText('지금은 오픈 준비 중 · 구경은 언제나 환영',960,yb-(1-sk)*10); c.restore(); }
}

/* ══════════ 도화지 찢기 전환 ══════════ */
const SHEETS=[
  {t0:0,   t1:6,   draw:s1, dark:true},   // dark: 위쪽이 어두운 장면 → 그 위 메뉴 글씨를 밝게 (style.css .nav.clear.dark)
  {t0:6,   t1:14,  draw:s2},
  {t0:14,  t1:24,  draw:s3},
  {t0:24,  t1:32,  draw:s4, dark:true},
  {t0:32,  t1:36.5,draw:s5a},
  {t0:36.5,t1:44,  draw:s5b},
  {t0:44,  t1:52,  draw:s6},
  {t0:52,  t1:60,  draw:s7, dark:true},
];
const TEAR_PRE=.28, TEAR_OPEN=.75;          // 금이 가로로 번지는 시간(초) → 위아래로 벌어지는 시간(초)
const TEARS=SHEETS.map((s,i)=>{   // 화면마다 다른 찢김선 (그 화면이 시작하는 순간 찢어짐)
  const r=rng(900+i*37), base=H*(.45+r()*.1), amp=18+r()*20, ph=r()*TAU, fq=1+r()*1.6, pts=[];
  for(let x=-60;x<=W+60;x+=20) pts.push([x,base+Math.sin(x/W*TAU*fq+ph)*amp+(r()-.5)*18]);
  return {pts,dir:i%2?-1:1};
});
function tearLine(c,pts,upTo,dir){
  c.beginPath(); let first=true;
  const list=dir>0?pts:pts.slice().reverse();
  for(const [x,y] of list){ if(dir>0?x>upTo:x<upTo) break; if(first){ c.moveTo(x,y); first=false; } else c.lineTo(x,y); }
}
function crack(c,tr,k){   // 찢기 직전: 금이 한쪽에서 반대쪽으로 번짐
  const e=eIO3(k), x=tr.dir>0?lerp(-60,W+60,e):lerp(W+60,-60,e);
  c.save(); c.lineJoin='round';
  c.translate(0,1.5); tearLine(c,tr.pts,x,tr.dir); c.strokeStyle='rgba(255,252,246,.85)'; c.lineWidth=2.4; c.stroke();
  c.translate(0,-1.5); tearLine(c,tr.pts,x,tr.dir); c.strokeStyle='rgba(20,14,24,.6)'; c.lineWidth=1.8; c.stroke();
  c.restore();
}
function halfPath(c,pts,top){
  c.beginPath(); const yy=top?-80:H+80; c.moveTo(-80,yy); c.lineTo(W+80,yy);
  for(let i=pts.length-1;i>=0;i--) c.lineTo(pts[i][0],pts[i][1]);
  c.closePath();
}
function halfXf(c,top,d,a){ if(top){ c.translate(W/2,0); c.rotate(-a); c.translate(-W/2,-d); } else { c.translate(W/2,H); c.rotate(a); c.translate(-W/2,-H+d); } }
function tearOpen(c,tr,k,src){   // 나가는 화면(src)을 찢김선으로 나눠 위는 위로, 아래는 아래로
  const e=eIO3(k), d=e*H*.64, a=e*1.8*DEG, g=k01(k*5);   // g: 금에서 찢김으로 이어지게 속살·그림자를 0에서 키움
  for(const top of [true,false]){ c.save(); halfXf(c,top,d,a); c.translate(0,(top?14:-14)*g); halfPath(c,tr.pts,top); c.fillStyle=`rgba(10,6,16,${.26*g})`; c.fill(); c.restore(); }
  for(const top of [true,false]){
    c.save(); halfXf(c,top,d,a);
    c.save(); halfPath(c,tr.pts,top); c.clip(); c.drawImage(src,0,0,W,H); c.restore();
    c.lineJoin='round'; c.beginPath(); tr.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.strokeStyle='#fbf8f2'; c.lineWidth=1.8+5.2*g; c.stroke();   // 찢어진 종이 속살
    c.beginPath(); tr.pts.forEach(([x,y],i)=>{ const j=(hash(i*3.1+(top?1:2))-.5)*5; i?c.lineTo(x,y+j):c.moveTo(x,y+j); });
    c.strokeStyle=`rgba(235,228,216,${.9*g})`; c.lineWidth=3; c.stroke();
    c.restore();
  }
}
const sheetAt=t=>{ for(let j=0;j<SHEETS.length;j++) if(t>=SHEETS[j].t0&&t<SHEETS[j].t1) return j; return SHEETS.length-1; };
const buf=document.createElement('canvas'), bctx=buf.getContext('2d');   // 찢어져 나가는 화면을 그리는 곳
let grainPat=null;
function render(t){
  const c=ctx; c.setTransform(SC,0,0,SC,0,0); c.globalAlpha=1; c.lineCap='butt';   // 장면이 바꿔 둔 선 끝 모양이 다음 장면으로 새지 않게
  const i=sheetAt(t), sh=SHEETS[i], n=SHEETS.length;
  sh.draw(c,t);
  const ko=(t-sh.t0)/TEAR_OPEN;
  if(ko<1){ const pi=(i+n-1)%n; bctx.setTransform(SC,0,0,SC,0,0); bctx.globalAlpha=1; bctx.lineCap='butt'; SHEETS[pi].draw(bctx,i===0?t+DUR:t); tearOpen(c,TEARS[i],ko,buf); }
  if(t>sh.t1-TEAR_PRE) crack(c,TEARS[(i+1)%n],seg(t,sh.t1-TEAR_PRE,sh.t1));
  if(!grainPat) grainPat=c.createPattern(GRAIN,'repeat');
  c.fillStyle=grainPat; c.fillRect(0,0,W,H);
}

/* ══════════ 재생 ══════════ */
let T=0, userPaused=false, mallOpen=false, inView=true, raf=0, lastNow=0, ready=false, shownP=-1;
const running=()=>!userPaused&&mallOpen&&inView&&!document.hidden;
function resize(){   // 코브 몰이 닫혀 있으면(display:none) 폭이 0 → 열릴 때 다시 잼
  const cssW=cv.clientWidth; if(!cssW) return;
  const vis=W*cv.clientHeight/cssW, crop=vis<H?(H-vis)/2:0;   // 높이 800px · object-fit: cover → 가운데 기준으로 위아래가 똑같이 잘림
  let top=0; for(let e=cv;e&&e!==scr;e=e.offsetParent) top+=e.offsetTop;   // 스크롤 맨 위일 때 캔버스 위치 (열리며 올라오는 연출의 transform과 상관없게)
  const st=crop+Math.max(0,(nav?nav.getBoundingClientRect().bottom:0)-top)*W/cssW;   // 메뉴(고정)가 덮는 높이를 원본 좌표로
  if(H-crop!==SAFE_B||st!==SAFE_T){ SAFE_B=H-crop; SAFE_T=st; if(ready) draw(); }
  const bw=Math.max(320,Math.round(Math.min(cssW*Math.min(window.devicePixelRatio||1,2),MAX_PX)));
  if(ready&&Math.abs(bw-cv.width)<2) return;
  cv.width=buf.width=bw; cv.height=buf.height=Math.round(bw*9/16); SC=bw/W; grainPat=null; buildLayers(); ready=true; draw();
}
function draw(){
  if(!ready) return;
  render(T); navTone();
  const p=Math.round(T/DUR*1000);
  if(fill&&p!==shownP){ shownP=p; fill.style.width=(p/10)+'%'; }
}
function loop(now){
  raf=0;
  if(!running()) return;
  raf=requestAnimationFrame(loop);
  if(!lastNow){ lastNow=now; return; }
  const dt=(now-lastNow)/1000; if(dt<1/FPS-.004) return;
  lastNow=now; T=(T+Math.min(dt,.1))%DUR; draw();
}
function kick(){ if(!raf&&running()){ lastNow=0; raf=requestAnimationFrame(loop); } }
/* 위쪽 메뉴(.nav): 히어로 위에 걸려 있는 동안은 바탕 없이(.clear), 히어로를 지나 내려가면 원래 흰 알약 · 어두운 장면이면 글씨를 밝게(.dark)
   걸렸는지는 스크롤 · 크기 · 화면이 바뀔 때만 잼 (매 프레임 레이아웃을 읽지 않게), 장면은 그릴 때마다 번호만 비교 */
const nav=document.querySelector('.nav'), scr=document.getElementById('mall');
let navOver=false, navSheet=-1;
function navOverHero(){
  if(!nav) return;
  const over=mallOpen&&cv.getBoundingClientRect().bottom>nav.getBoundingClientRect().bottom;
  if(over!==navOver){ navOver=over; nav.classList.toggle('clear',over); }
  navTone();
}
function navTone(){
  if(!nav) return;
  const i=navOver?sheetAt((T-TEAR_OPEN*.55+DUR)%DUR):-1; if(i===navSheet) return;   // 새 장면은 가운데부터 드러나고 맨 위 띠는 찢김의 절반쯤 지나야 바뀜
  navSheet=i; nav.classList.toggle('dark',i>=0&&!!SHEETS[i].dark);
}
function setPaused(v){
  userPaused=v;
  if(playBtn){ playBtn.textContent=v?'▶':'❚❚'; playBtn.setAttribute('aria-label',v?'광고 재생':'광고 멈추기'); }
  kick();
}

if(playBtn) playBtn.addEventListener('click',()=>setPaused(!userPaused));
cv.addEventListener('click',()=>setPaused(!userPaused));
if(shopBtn) shopBtn.addEventListener('click',()=>{ const to=box.nextElementSibling; if(to) to.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'}); });   // 히어로 다음(코브 몰 제목)으로 — 주소(#)를 바꾸면 screens.js가 화면을 닫으니 스크롤만
addEventListener('covv-screen',e=>{ mallOpen=e.detail==='mall'; if(mallOpen){ resize(); draw(); } navOverHero(); kick(); });
if(scr) scr.addEventListener('scroll',navOverHero,{passive:true});
document.addEventListener('visibilitychange',kick);
if('IntersectionObserver' in window) new IntersectionObserver(es=>{ inView=es[0].isIntersecting; kick(); },{threshold:.15}).observe(cv);
if('ResizeObserver' in window) new ResizeObserver(()=>{ if(mallOpen){ resize(); navOverHero(); } }).observe(cv); else addEventListener('resize',()=>{ if(mallOpen){ resize(); navOverHero(); } });

/* 글꼴: 한글은 글자 묶음별로 나눠 받으니 화면에 쓰는 글자를 미리 요청 → 오면 다시 그림 */
const ALL='의오늘도들판에코브가놀러왔어요터트리고,줍고금화100개=쿠폰1장키링원할인손으로고른마음에들면하트사탕내색을무지개는비밀서놀고데려가지금오픈준비중·구경언제나환영몰분홍민트레몬하늘라벤더0123456789COVVMALLCOUPONFIELDARRIVALCOLLECTSHELFNEWPINKMINTLEMONSKYSECRETIRIDESCENTNo.?×';
if(document.fonts&&document.fonts.load){
  Promise.all([`800 250px ${SERIF}`,`700 116px ${SERIF}`,`600 66px ${SERIF}`,`500 40px ${SERIF}`,`500 24px ${SANS}`,`500 18px ${MONO}`,`600 18px ${MONO}`].map(f=>document.fonts.load(f,ALL).catch(()=>{}))).then(()=>{ fontVer++; if(ready) buildLayers(); draw(); });   // 레이어 속 글자(장부 · 칠판 · 푯말)도 다시
}

window._hero={ seek:t=>{ T=((t%DUR)+DUR)%DUR; resize(); draw(); }, step:sec=>{ T=(T+sec)%DUR; draw(); }, get t(){ return T; }, pause:()=>setPaused(true) };   // 디버그 · 숨은 미리보기 창 검증용 (rAF가 멈춰도 시간 흘리기)
})();
