/* ══════════════════════════════════════════════════════════
   휴대폰 미리보기 (phone.html) — 휴대폰이 없을 때 PC에서 코브 몰을 휴대폰 크기 틀 안에 띄움
   - 기종 알약 = 틀 크기(CSS px, 세로 기준), 가로로 돌리기 = 가로세로 바꿈, 화면 알약 = covv.html#화면을 새로 불러옴
   - 창이 낮거나 좁으면 틀째 줄여서(scale) 한눈에 보이게 — 틀 안 화면의 폭(CSS px)은 그대로라 배치는 휴대폰과 같음
   - 고른 기종 · 방향은 이 브라우저에 기억 (다음에 열면 그대로)
   - 같은 사이트 화면만 띄움 (CSP frame-src 'self') · 다른 파일과 주고받는 값 없음
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const stage=document.querySelector('[data-ph-stage]'), dev=document.querySelector('[data-ph-device]'), frame=document.querySelector('[data-ph-frame]');
if(!stage||!dev||!frame) return;
const DEVICES=[   // [id, 이름, 폭, 높이] — 화면 크기(CSS px, 세로)
  ['se',    'iPhone SE',       375, 667],
  ['ip15',  'iPhone 15',       393, 852],
  ['max',   'iPhone 15 Pro Max', 430, 932],
  ['s24',   'Galaxy S24',      360, 780],
];
const SCREENS=[['','들판'],['mall','코브 몰'],['office','내 오피스'],['checkout','주문/결제'],['about','소개']];
const BEZEL=12;            // 틀 테두리 두께(px) — style.css .ph-device 테두리와 같은 값
const PAD=24;              // 틀 둘레 여백(px) — 창에 맞춰 줄일 때 남기는 자리
const KEY='covv-phone-view';   // 고른 기종 · 방향 {d, land}
let devId='ip15', land=false, reloadN=0;
try{ const v=JSON.parse(localStorage.getItem(KEY)||'null'); if(v&&typeof v==='object'){ if(DEVICES.some(d=>d[0]===v.d)) devId=v.d; land=v.land===true; } }catch(e){}

const $=s=>document.querySelector(s);
$('[data-ph-devices]').innerHTML=DEVICES.map(([id,name])=>`<button type="button" class="ph-pill" data-ph-dev="${id}" aria-pressed="false">${name}</button>`).join('');   // 코드 상수만
$('[data-ph-screens]').innerHTML=SCREENS.map(([id,name])=>`<button type="button" class="ph-pill" data-ph-scr="${id}">${name}</button>`).join('');

function paint(){
  const d=DEVICES.find(x=>x[0]===devId)||DEVICES[1], w=land?d[3]:d[2], h=land?d[2]:d[3];
  frame.style.width=w+'px'; frame.style.height=h+'px';
  dev.classList.toggle('land',land);
  // 창에 맞춰 틀째 줄임 (틀 안 화면 폭은 그대로) — 줄인 만큼 자리도 줄여서 아래에 빈 곳이 남지 않게
  const fw=w+BEZEL*2, fh=h+BEZEL*2, stacked=matchMedia('(max-width: 720px)').matches;   // 좁은 창은 설정 아래에 틀 → 폭에만 맞추고 세로는 스크롤
  const pb=parseFloat(getComputedStyle(stage.parentElement).paddingBottom)||0;   // 페이지 아래 여백까지 빼야 창에 딱 맞음
  const k=Math.max(.3,Math.min(1,(stage.clientWidth-PAD)/fw,stacked?1:(innerHeight-stage.offsetTop-pb-PAD)/fh));   // 넓은 창은 틀 위끝부터 창 아래까지 남은 높이에 맞춤
  dev.style.scale=String(k); stage.style.height=Math.ceil(fh*k)+'px';
  document.querySelectorAll('[data-ph-dev]').forEach(b=>{ b.setAttribute('aria-pressed',String(b.dataset.phDev===devId)); });
  $('[data-ph-rotate]').setAttribute('aria-pressed',String(land));
  $('[data-ph-size]').textContent=`${d[1]} · ${w} × ${h}${k<1?` · ${Math.round(k*100)}%로 줄여 보는 중`:''}`;
  try{ localStorage.setItem(KEY,JSON.stringify({d:devId,land})); }catch(e){}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ph-dev]');
  if(b){ devId=b.dataset.phDev; paint(); return; }
  if(e.target.closest('[data-ph-rotate]')){ land=!land; paint(); return; }
  const s=e.target.closest('[data-ph-scr]');
  if(s){ frame.src=`covv.html?ph=${++reloadN}${s.dataset.phScr?'#'+s.dataset.phScr:''}`; return; }   // 새로 불러옴 (해시만 바꾸면 화면 전환 중에 막힐 수 있음)
  if(e.target.closest('[data-ph-reload]')){ try{ frame.contentWindow.location.reload(); }catch(_){ frame.src=frame.src; } }
});
addEventListener('resize',paint);
paint();
})();
