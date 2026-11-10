/* ══════════════════════════════════════════════════════════
   첫 주소 → 들판 — index.html이 부름
   - 주소 뒤 #mall 같은 화면 이름 · ?물음표 값을 그대로 들고 covv.html로 감
     (meta refresh만 쓰면 #이 버려져서 인스타 소개 링크 '…/covv-mall/#mall'을 눌러도 들판이 열렸음)
   - replace라 뒤로가기에 빈 첫 주소가 남지 않음. 스크립트가 꺼진 브라우저는 index.html의 meta refresh가 대신 보냄
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';
location.replace('covv.html'+location.search+location.hash);
})();
