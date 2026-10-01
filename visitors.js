/* ══════════════════════════════════════════════════════════
   방문자 수 — 상단 메뉴 오른쪽 '👀 오늘 · 전체' (누르면 개인정보 처리방침)
   - 페이지를 열 때 카페24 서버(server/visitors.py)에 한 번 알리고, 돌아온 숫자를 보여 줌
   - 같은 IP는 서버가 하루 한 번만 셈. IP는 서버 메모장에 90일만 남고 브라우저에는 저장하지 않음
   - 브라우저 GPC(추적 거부)가 켜져 있으면 기록하지 말라고(?skip=1) 알리고 숫자만 받음
   - 서버가 꺼져 있거나 막히면 숫자 자리를 숨긴 채 조용히 넘어감 (들판·가게는 그대로)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const API='https://180.70.116.93/visit';   // 주소를 바꾸면 covv.html CSP의 connect-src와 server/covv-api.conf도 같이 고칠 것
const TIMEOUT=6000;                        // 서버가 늦으면 기다리지 않고 숨김 (ms)
const box=document.querySelector('[data-visit]');
if(!box||!window.fetch) return;
const todayEl=box.querySelector('[data-visit-today]'), totalEl=box.querySelector('[data-visit-total]');
const N=v=>{ const n=Math.floor(Number(v)); return isFinite(n)&&n>=0?n:-1; };
let fmt=n=>n.toLocaleString('ko-KR');
try{ const c=new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}); fmt=n=>n<10000?n.toLocaleString('ko-KR'):c.format(n); }catch(e){}   // 끝없이 커지는 누적 수는 '1.2만'

const ctl=window.AbortController?new AbortController():null;
const timer=setTimeout(()=>{ if(ctl) ctl.abort(); },TIMEOUT);
fetch(API+(navigator.globalPrivacyControl===true?'?skip=1':''),{mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:ctl?ctl.signal:undefined})
  .then(r=>r.ok?r.json():null)
  .then(d=>{
    clearTimeout(timer);
    const t=d?N(d.today):-1, a=d?N(d.total):-1;
    if(t<0||a<0) return;
    todayEl.textContent=fmt(t); totalEl.textContent=fmt(a);
    box.setAttribute('aria-label',`방문자 오늘 ${t.toLocaleString('ko-KR')}명 · 전체 ${a.toLocaleString('ko-KR')}명 (개인정보 처리방침 보기)`);
    box.hidden=false;
  })
  .catch(()=>{ clearTimeout(timer); });
})();
