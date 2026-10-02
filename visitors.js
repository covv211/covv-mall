/* ══════════════════════════════════════════════════════════
   방문 기록 — 화면에는 아무것도 보여 주지 않고 서버에 한 번만 알림
   - 페이지를 열 때 카페24 서버(server/visitors.py)에 한 번 알림 → 서버가 오늘 방문 수를 세고 IP를 잠가 기록
     (목적: 방문자 수 + 서버에 해를 끼친 IP 찾아 막기, 안내는 소개 화면·privacy.html)
   - 같은 IP는 서버가 하루 한 번만 셈. 브라우저에는 아무것도 저장하지 않음
   - 브라우저 GPC(추적 거부)가 켜져 있으면 기록하지 말라고(?skip=1) 알림
   - 2026-10-02 상단 방문자 수 표시는 뺌 (숫자는 서버 /visit 응답에 그대로 있음)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const API='https://180.70.116.93/visit';   // 주소를 바꾸면 covv.html CSP의 connect-src와 server/covv-api.conf도 같이 고칠 것
if(!window.fetch) return;
// 서버가 꺼져 있거나 막혀도 조용히 넘어감 (들판·가게는 그대로)
fetch(API+(navigator.globalPrivacyControl===true?'?skip=1':''),{mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true}).catch(()=>{});
})();
