/* ══════════════════════════════════════════════════════════
   화면 전환 — 들판(홈) ↔ 소개 · 작업물 · 연락처 · 오피스
   - 동그랗게 퍼지는 전환(아이리스)으로 화면을 덮고 → 바꾸고 → 걷어냄
   - 주소창 #about 등과 연동(뒤로가기 · 새로고침해도 그 화면)
   - 내 오피스의 미니룸(3D, office.js)은 처음 열 때만 불러옴
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const iris=document.getElementById('iris');
const fieldEl=document.getElementById('field');
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const screens=Object.create(null);   // 주소 #constructor · #__proto__ 같은 이름이 화면으로 잘못 잡히지 않게 (기본 객체 속성이 없는 빈 목록)
document.querySelectorAll('.screen[data-screen]').forEach(s=>{ screens[s.dataset.screen]=s; s.tabIndex=-1; });
if(fieldEl) fieldEl.tabIndex=-1;
let current=null, busy=false, officeLoaded=false;

const center=()=>({x:innerWidth/2,y:innerHeight/2});
function point(o){   // 전환 동그라미의 시작점 (화면 밖이면 안쪽으로)
  const p=o&&o.x!=null&&(o.x||o.y)?o:center();
  return {x:Math.max(0,Math.min(innerWidth,p.x)), y:Math.max(0,Math.min(innerHeight,p.y))};
}
const finished=a=>a.finished||new Promise(r=>{ a.onfinish=r; });

function irisIn(x,y){
  iris.classList.add('active');
  iris.style.opacity='1';
  if(!iris.animate) return Promise.resolve();
  // '동작 줄이기' 설정이면 퍼지는 동그라미 대신 부드럽게 겹쳐 사라지기
  if(REDUCED) return finished(iris.animate([{opacity:0},{opacity:1}],{duration:320,easing:'ease',fill:'forwards'}));
  const R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  return finished(iris.animate(
    [{clipPath:`circle(0px at ${x}px ${y}px)`},{clipPath:`circle(${R}px at ${x}px ${y}px)`}],
    {duration:520,easing:'cubic-bezier(.65,0,.35,1)',fill:'forwards'}));
}
function irisReset(){ if(iris.getAnimations) iris.getAnimations().forEach(a=>a.cancel()); iris.classList.remove('active'); iris.style.opacity=''; }
function irisOut(){
  if(!iris.animate){ irisReset(); return Promise.resolve(); }
  return finished(iris.animate([{opacity:1},{opacity:0}],{duration:380,easing:'ease',fill:'forwards'})).then(irisReset);
}

function loadScript(src){
  return new Promise((ok,fail)=>{ const s=document.createElement('script'); s.src=src; s.dataset.office='1'; s.onload=ok; s.onerror=fail; document.body.appendChild(s); });
}
function loadOffice(){
  if(officeLoaded) return;
  const st=document.getElementById('roomStage');
  if(!window.THREE){ if(st) st.classList.add('no-webgl'); return; }
  officeLoaded=true;
  if(st) st.classList.remove('no-webgl');
  loadScript('office.js?v=1002a')
    .catch(()=>{   // 한 번 실패해도 다음에 열 때 다시 시도
      officeLoaded=false;
      document.querySelectorAll('script[data-office]').forEach(s=>s.remove());
      if(st) st.classList.add('no-webgl');
    });
}

function setNav(id){ document.querySelectorAll('.nav [data-go]').forEach(a=>a.classList.toggle('active',a.dataset.go===id)); }

// 전환 중에 뒤로/앞으로가 눌렸어도, 끝난 뒤 주소에 맞춰 화면을 맞춤
function sync(){
  const id=location.hash.slice(1), want=screens[id]?id:null;
  if(want!==current){ if(want) open(want,{push:false}); else close({push:false}); }
}

async function open(id,opts={}){
  const s=screens[id];
  if(!s||busy||current===id) return false;
  busy=true;
  try{
    const p=point(opts);
    if(!opts.instant) await irisIn(p.x,p.y);
    if(current) screens[current].classList.remove('open');
    s.classList.add('open'); s.scrollTop=0;
    document.body.classList.add('screen-open');
    current=id;
    dispatchEvent(new CustomEvent('covv-screen',{detail:id}));   // 코브 몰 화면이 열릴 때 내용 새로 그림
    if(window.covvField) window.covvField.pause();
    if(id==='office') loadOffice();
    if(opts.push!==false) history.pushState({screen:id},'','#'+id);
    setNav(id);
    if(!opts.instant) await irisOut();
  } finally { busy=false; irisReset(); }
  s.focus({preventScroll:true});   // 키보드·화면낭독기 사용자를 새 화면으로 (테두리는 안 보이게)
  sync();
  return true;
}
async function close(opts={}){
  if(!current||busy) return false;
  busy=true;
  try{
    const p=point(opts);
    if(!opts.instant) await irisIn(p.x,p.y);
    screens[current].classList.remove('open');
    document.body.classList.remove('screen-open');
    current=null;
    dispatchEvent(new CustomEvent('covv-screen',{detail:null}));
    if(opts.push!==false) history.pushState({},'',location.pathname+location.search);
    setNav(null);
    if(window.covvField) window.covvField.resume();   // 떨어져 있던 코브는 다시 거품 타고 올라감
    if(!opts.instant) await irisOut();
  } finally { busy=false; irisReset(); }
  if(fieldEl) fieldEl.focus({preventScroll:true});
  sync();
  return true;
}

/* 메뉴 · 뒤로 버튼 */
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');
  if(go){
    e.preventDefault();
    const id=go.dataset.go;
    const kb=e.detail===0;   // 키보드로 누른 경우 화면 가운데서 전환
    // 들판에 있을 땐 해당 코브의 거품이 보이면 터트려서 이동 (안 보이면 바로 이동)
    if(!current&&window.covvField&&window.covvField.popTo(id)) return;
    open(id,kb?{}:{x:e.clientX,y:e.clientY});
    return;
  }
  const home=e.target.closest('[data-home],[data-close]');
  if(home){ e.preventDefault(); close(e.detail===0?{}:{x:e.clientX,y:e.clientY}); return; }
  // 아직 주소를 안 넣은 링크(href="#")는 눌러도 아무 일 없게 (화면이 닫히지 않도록)
  const empty=e.target.closest('a[href="#"]');
  if(empty) e.preventDefault();
});
addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!current||e.defaultPrevented||e.isComposing) return;
  const t=e.target;   // 입력칸에서 Esc는 '입력 취소'이지 화면 닫기가 아님
  if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  close();
});
addEventListener('popstate',sync);

/* 주소에 #about 등이 있으면 바로 그 화면으로 */
const first=location.hash.slice(1);
if(screens[first]) open(first,{push:false,instant:true});

window.covvOpenScreen=(id,opts)=>open(id,opts||{});
window.covvCloseScreen=close;
})();
