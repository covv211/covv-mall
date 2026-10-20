/* ══════════════════════════════════════════════════════════
   내 오피스 — 나만의 미니홈피 (방문자 각자의 방 + 계정 정보)
   - 왼쪽 프로필: 내 코브 그림 · 닉네임 · 한 줄 소개 · 오늘의 기분 · 처음 온 날 · 함께한 날
   - 오른쪽 탭(싸이월드 미니홈피처럼): 홈(미니룸 3D + 내 계정 요약 + 최근 소식) · 계정(계정 정보) · 가방 · 다이어리 · 방명록(준비 중)
   - 코브 몰 회원가입·로그인 창(서로 오가는 링크) + 상단 메뉴 👤 버튼도 여기 (아이디(영문+숫자) + 비밀번호로 로그인, 닉네임은 따로 마음대로 → 로그인 중이면 들판 코브 이름표가 내 닉네임)
   - 로그아웃하면 내 오피스(프로필·탭)를 잠그고 로그인 버튼만 보여 줌, 아이디 정하기(옛 계정만)·비밀번호 바꾸기는 계정 탭
   - 모든 기록은 가방(mall.js의 covvWallet)과 같이 이 브라우저에 저장. 로그인이 생기면 계정으로 옮김
   - 미니룸 3D(office.js)는 이 화면을 처음 열 때 screens.js가 불러옴
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const W=window.covvWallet, A=window.covvArt;
const root=document.getElementById('office');
if(!root||!W) return;
const $=s=>root.querySelector(s);
const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
// 저장된 기록에서 꺼낸 값은 모양을 확인하고 씀 (이상한 값이 들어 있어도 화면이 멈추지 않게) — 글자는 늘 textContent로만 넣음
const S=v=>typeof v==='string'?v:'';
const N=v=>typeof v==='number'&&isFinite(v)?v:0;
const MOODS=['😊','🥳','😴','😎','🥲','🤔'];
const fmtDate=s=>{ const p=(s||'').split('-'); return p.length===3?`${p[0]}년 ${p[1]}월 ${p[2]}일`:'오늘'; };
function daysSince(s){
  const p=(s||'').split('-').map(Number); if(p.length!==3) return 0;
  const a=new Date(p[0],p[1]-1,p[2]), b=new Date(); b.setHours(0,0,0,0);
  return Math.max(0,Math.round((b-a)/864e5));
}
function ago(t){
  const s=(Date.now()-t)/1000;
  if(!(s>=0)) return '';
  if(s<60) return '방금'; if(s<3600) return Math.floor(s/60)+'분 전'; if(s<86400) return Math.floor(s/3600)+'시간 전';
  if(s<172800) return '어제';
  const d=new Date(t); return `${d.getMonth()+1}월 ${d.getDate()}일`;
}
// 지금 내 코브 색 (들판이 있으면 들판 기준, 없으면 가방에 저장된 색)
function look(){
  const F=window.covvField;
  const l=F&&F.coveLook?F.coveLook():{name:S(W.state.look)||'분홍',hex:null,rainbow:W.state.look==='무지개',hacker:W.get('coin')>=9999};
  if(!l.hex&&!l.rainbow&&F&&F.colors){ const c=F.colors.find(c=>c.name===l.name); l.hex=c&&c.hex; }
  if(!l.hex) l.hex='#ff9ccb';
  return l;
}

let isOpen=false, tab='home', editing=false;
const locked=()=>W.member()&&!W.signedIn();   // 계정이 있는데 로그아웃한 상태 → 내 오피스를 가림

/* ══════════ 프로필 (왼쪽) ══════════ */
const moodsBox=$('#mhMoods');
MOODS.forEach(m=>{
  const b=el('button','mh-mood',m); b.type='button'; b.dataset.mood=m; b.setAttribute('aria-label','오늘의 기분 '+m);
  moodsBox.appendChild(b);
});
let avatarKey='';
// 방문 수는 아이템이 아니라 9,999에서 멈추지 않음 — 커지면 12.3만처럼 짧게
let compact=null; try{ compact=new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}); }catch(e){}
const count=v=>v<1e4||!compact?v.toLocaleString('ko-KR'):compact.format(v);
function paintSide(){
  const p=W.profile(), v=W.visits(), l=look();
  $('#mhTitle').textContent=locked()?'잠긴 오피스':`${p.name}의 오피스`;
  $('#mhToday').textContent=count(v.today); $('#mhTotal').textContent=count(v.total);
  $('#mhName').textContent=p.name;
  $('#mhMoodNow').textContent=p.mood;
  const st=$('#mhStatus'); st.textContent=p.status||'한 줄 소개를 적어 보세요'; st.classList.toggle('empty',!p.status);
  moodsBox.querySelectorAll('.mh-mood').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mood===p.mood)));
  const key=l.name+'|'+l.hacker;
  if(key!==avatarKey&&A){ avatarKey=key; $('#mhAvatar').innerHTML=A.coveSVG(l.hex,l.rainbow?'rainbow':null,{plain:true,shades:l.hacker}); }
  $('#mhColor').textContent=l.name+' 코브'+(l.hacker?' 🕶️':'');
  $('#mhFirst').textContent=fmtDate(v.first);
  $('#mhDplus').textContent='D+'+daysSince(v.first);
  $('#mhDays').textContent=v.days+'일';
}
$('#mhEdit').addEventListener('click',()=>{
  const p=W.profile();
  editing=true; $('#mhForm').hidden=false; $('#mhEdit').hidden=true;
  $('#mhNameInput').value=p.name; $('#mhStatusInput').value=p.status;
  $('#mhNameInput').focus();
});
function closeForm(){ editing=false; $('#mhForm').hidden=true; $('#mhEdit').hidden=false; $('#mhEdit').focus(); }
$('#mhCancel').addEventListener('click',closeForm);
$('#mhForm').addEventListener('keydown',e=>{ if(e.key==='Escape'&&!e.isComposing){ e.preventDefault(); closeForm(); } });
$('#mhForm').addEventListener('submit',e=>{
  e.preventDefault();
  let name=$('#mhNameInput').value.trim().slice(0,12);
  const status=$('#mhStatusInput').value.trim().slice(0,40), before=W.profile().name;
  if(W.member()&&name!==before){   // 계정 닉네임은 들판 이름표에도 나와서 계정 만들 때와 같은 규칙
    const c=W.checkNick(name);
    if(!c.ok){ if(window.covvToast) window.covvToast(ACCT_ERR[c.error]); $('#mhNameInput').focus(); return; }
    name=c.nick;
  }
  W.setProfile({name:name||'코브 친구',status});
  if(name&&name!==before) W.log(`✏️ 닉네임을 '${name}'(으)로 바꿨어요`);
  closeForm(); paintAll();
});
moodsBox.addEventListener('click',e=>{
  const b=e.target.closest('.mh-mood'); if(!b) return;
  W.setProfile({mood:b.dataset.mood}); paintSide();
});

/* ══════════ 홈: 최근 소식 ══════════ */
function paintLog(){
  const ul=$('#mhLog'); ul.innerHTML='';
  const logs=W.logs().filter(x=>x&&typeof x==='object').slice(0,8);
  if(!logs.length){ ul.appendChild(el('li','mh-log-empty','아직 소식이 없어요. 들판에서 거품을 터트려 보세요!')); return; }
  for(const x of logs){
    const li=el('li'); li.appendChild(el('span','mh-log-text',S(x.text))); li.appendChild(el('time','mh-log-time',ago(N(x.t))));
    ul.appendChild(li);
  }
}

/* ══════════ 계정 정보 (내 오피스의 주 목적) ══════════
   로그인 전에는 '게스트 계정' — 이 브라우저에만 저장, 게스트 번호로 구분.
   이름·연락처·배송지 같은 개인정보는 가게가 열리고 로그인할 때(개인정보처리방침과 함께) 받음 */
function recOf(kind,id){ const m=W.state[kind]; const r=m&&typeof m==='object'?m[id]:null; return r&&typeof r==='object'?Math.max(0,Math.floor(N(r.total))):0; }
const sumOf=(kind,list)=>(list||[]).reduce((n,x)=>n+recOf(kind,x.id),0);
const sumAll=kind=>{ const m=W.state[kind]; return m&&typeof m==='object'?Object.keys(m).reduce((n,id)=>n+recOf(kind,id),0):0; };   // 진열대에서 내려간 상품에 준 하트도 셈
function badgeList(){
  const l=look(), n=W.coupons(), b=['🎁 첫 방문'];
  if(W.state.rainbow) b.push('🌈 무지개 코브');
  if(A&&W.get('gem')>=A.GEM_EARLY) b.push('💎 한정판 먼저 사기');
  if(l.hacker) b.push('🕶️ 해커 코브');
  if(n) b.push('🎟️ 할인 쿠폰');
  if(W.visits().days>=3) b.push('🐾 사흘 넘게 들른 단골');
  return b;
}
const acct=$('#mhAccount');
acct.innerHTML=`
  <h3 class="mh-h first">계정 정보</h3>
  <div class="acct-card">
    <div class="acct-head">
      <div class="acct-avatar" data-acct-avatar aria-hidden="true"></div>
      <div class="acct-who">
        <strong data-acct-name></strong>
        <span class="acct-chip" data-acct-chip>게스트 계정</span>
        <span class="acct-id"><span data-acct-idlabel>게스트 번호</span> <b data-acct-uid></b></span>
        <span class="acct-where">이 브라우저에만 저장돼요</span>
      </div>
    </div>
    <div class="acct-login">
      <p data-guest><b>회원가입하면</b> 들판의 내 코브가 내 닉네임으로 불려요. 아이디·비밀번호와 닉네임만 정하면 돼요.</p>
      <p data-member hidden><b>카카오 로그인이 열리면</b> 이 계정을 그대로 옮겨서 다른 기기에서도 이어서 쓰고, 주문·배송을 확인하고, 방명록을 남길 수 있어요.</p>
      <div class="acct-login-btns">
        <button type="button" class="mh-btn" data-guest data-join>✨ 회원가입</button>
        <button type="button" class="mh-btn ghost" data-member data-logout hidden>로그아웃</button>
        <button type="button" class="mh-btn kakao" disabled>카카오로 로그인 · 준비 중</button>
      </div>
    </div>
  </div>
  <div class="acct-grid">
    <section class="acct-sec" aria-labelledby="acctBasic">
      <h4 class="mh-h4" id="acctBasic">기본 정보</h4>
      <dl class="acct-dl" data-acct-basic></dl>
      <button type="button" class="mh-edit" data-acct-edit>✏️ 닉네임·소개 바꾸기</button>
    </section>
    <section class="acct-sec" aria-labelledby="acctPw" data-member hidden>
      <h4 class="mh-h4" id="acctPw">아이디 · 비밀번호</h4>
      <form class="acct-pw" data-id-form novalidate hidden>
        <p class="acct-pw-none">🪪 아직 로그인 아이디가 없어요. 정해 두어야 로그아웃했다가 다시 로그인할 수 있어요.</p>
        <label for="acctId">아이디</label>
        <input id="acctId" maxlength="${W.ID_MAX}" autocomplete="username" autocapitalize="off" spellcheck="false" aria-describedby="acctIdHelp acctIdErr">
        <label for="acctIdCur" data-id-cur>지금 비밀번호</label>
        <input type="password" id="acctIdCur" data-id-cur maxlength="${W.PW_MAX}" autocomplete="current-password" aria-describedby="acctIdErr">
        <p class="join-err" id="acctIdErr" role="alert"></p>
        <p class="fine" id="acctIdHelp">${W.ID_MIN}~${W.ID_MAX}자 · 영문과 숫자를 섞어서 (예: cove123) · 한 번 정하면 바꿀 수 없어요</p>
        <button type="submit" class="mh-btn small" data-id-submit>아이디 정하기</button>
      </form>
      <p class="acct-pw-none" data-pw-none hidden>🔒 아직 비밀번호가 없어요. 정해 두어야 로그아웃했다가 다시 로그인할 수 있어요.</p>
      <form class="acct-pw" data-pw-form novalidate>
        <input type="text" autocomplete="username" data-pw-user hidden>
        <label for="acctPwCur" data-pw-cur>지금 비밀번호</label>
        <input type="password" id="acctPwCur" data-pw-cur maxlength="${W.PW_MAX}" autocomplete="current-password" aria-describedby="acctPwErr">
        <label for="acctPwNew">새 비밀번호</label>
        <input type="password" id="acctPwNew" maxlength="${W.PW_MAX}" autocomplete="new-password" aria-describedby="acctPwHelp acctPwErr">
        <label for="acctPwNew2">새 비밀번호 한 번 더</label>
        <input type="password" id="acctPwNew2" maxlength="${W.PW_MAX}" autocomplete="new-password" aria-describedby="acctPwErr">
        <p class="join-err" id="acctPwErr" role="alert"></p>
        <p class="fine" id="acctPwHelp">${W.PW_MIN}자 이상 · 다른 사이트와 다른 비밀번호로</p>
        <button type="submit" class="mh-btn small" data-pw-submit>비밀번호 바꾸기</button>
      </form>
    </section>
    <section class="acct-sec" aria-labelledby="acctShop">
      <h4 class="mh-h4" id="acctShop">쇼핑 정보</h4>
      <dl class="acct-dl" data-acct-shop></dl>
    </section>
    <section class="acct-sec" aria-labelledby="acctAct">
      <h4 class="mh-h4" id="acctAct">활동 기록</h4>
      <dl class="acct-dl" data-acct-act></dl>
    </section>
    <section class="acct-sec" aria-labelledby="acctSet">
      <h4 class="mh-h4" id="acctSet">설정 · 내 기록</h4>
      <div class="acct-row" data-acct-sound-row><span id="acctSoundLabel">효과음</span><button type="button" class="acct-toggle" data-acct-sound aria-labelledby="acctSoundLabel" aria-pressed="true">켜짐</button></div>
      <div class="acct-actions">
        <button type="button" class="mh-btn ghost" data-backup>💾 내 기록 파일로 저장</button>
      </div>
    </section>
  </div>
  <p class="fine">이름·연락처·배송지 같은 개인정보는 가게가 열리고 로그인할 때 개인정보처리방침과 함께 받을게요. 지금은 개인정보를 하나도 모으지 않아요.</p>`;
function fillDl(dl,rows){
  dl.innerHTML='';
  for(const [k,v] of rows){ const d=el('div'); d.appendChild(el('dt',null,k)); d.appendChild(el('dd',null,v)); dl.appendChild(d); }
}
// 아이디 정하기 (아이디 없이 만든 옛 계정만 한 번) — 비밀번호가 있으면 W.setId가 지금 비밀번호를 해시로 확인
const idForm=acct.querySelector('[data-id-form]'), idErr=$('#acctIdErr');
idForm.addEventListener('submit',e=>{
  e.preventDefault();
  const id=$('#acctId'), cur=$('#acctIdCur'), btn=idForm.querySelector('[data-id-submit]');
  if(btn.disabled) return;
  const fail=code=>{ idErr.textContent=ACCT_ERR[code]||'다시 적어 주세요'; (code==='WRONG_CUR'?cur:id).focus(); };
  const c=W.checkId(id.value); if(!c.ok){ fail(c.error); return; }
  busy(btn,true);
  W.setId(id.value,cur.value).then(r=>{
    busy(btn,false);
    if(locked()) return;   // 해시 계산 중에 로그아웃 → paintLock이 이미 폼을 비움 (RETRY 오류를 남기지 않게)
    if(!r.ok){ fail(r.error); if(r.error==='WRONG_CUR') cur.value=''; return; }
    idForm.reset(); idErr.textContent=''; if(loginId) loginId.value='';
    if(window.covvToast) window.covvToast(`🪪 아이디를 '${r.id}'(으)로 정했어요`+(W.hasPw()?'. 이제 로그아웃할 수 있어요':'. 비밀번호도 정해 주세요'));
    paintAccount();
    (W.hasPw()?acct.querySelector('[data-logout]'):$('#acctPwNew')).focus();   // 누른 버튼은 폼과 같이 가려짐
  });
});
idForm.addEventListener('input',()=>{ idErr.textContent=''; });
// 비밀번호 바꾸기 (옛 계정은 지금 비밀번호 없이 정하기) — 맞는지는 W.setPw가 해시로 확인
const pwForm=acct.querySelector('[data-pw-form]'), pwErr=$('#acctPwErr');
pwForm.addEventListener('submit',e=>{
  e.preventDefault();
  const cur=$('#acctPwCur'), nw=$('#acctPwNew'), nw2=$('#acctPwNew2'), btn=pwForm.querySelector('[data-pw-submit]');
  if(btn.disabled) return;
  const fail=code=>{ pwErr.textContent=ACCT_ERR[code]||'다시 적어 주세요'; (code==='WRONG_CUR'?cur:code==='PW_DIFF'?nw2:nw).focus(); };
  const k=W.checkPw(nw.value,W.accountId(),W.profile().name); if(!k.ok){ fail(k.error); return; }
  if(nw.value!==nw2.value){ fail('PW_DIFF'); return; }
  busy(btn,true);
  W.setPw(cur.value,nw.value).then(r=>{
    busy(btn,false);
    if(locked()) return;   // 해시 계산 중에 로그아웃 → paintLock이 이미 폼을 비움 (RETRY 오류를 남기지 않게)
    if(!r.ok){ fail(r.error); if(r.error==='WRONG_CUR') cur.value=''; return; }
    pwForm.reset(); pwErr.textContent='';
    if(window.covvToast) window.covvToast(r.first?(W.hasId()?'🔒 비밀번호를 정했어요. 이제 로그아웃할 수 있어요':'🔒 비밀번호를 정했어요. 아이디도 정해 주세요'):'🔒 비밀번호를 바꿨어요');
    paintAccount();
  });
});
pwForm.addEventListener('input',()=>{ pwErr.textContent=''; });
let acctAvatarKey='';
function paintAccount(){
  const p=W.profile(), v=W.visits(), l=look(), c=W.get('coin'), n=W.coupons(), gem=W.get('gem');
  const key=l.name+'|'+l.hacker;
  if(key!==acctAvatarKey&&A){ acctAvatarKey=key; acct.querySelector('[data-acct-avatar]').innerHTML=A.coveSVG(l.hex,l.rainbow?'rainbow':null,{plain:true,shades:l.hacker}); }
  const m=W.signedIn(), pw=W.hasPw(), hid=W.hasId();
  acct.querySelector('[data-acct-name]').textContent=p.name;
  acct.querySelector('[data-acct-chip]').textContent=m?'코브 몰 계정':'게스트 계정';
  acct.querySelector('[data-acct-chip]').classList.toggle('on',m);
  acct.querySelector('[data-acct-idlabel]').textContent=m?'계정 번호':'게스트 번호';
  acct.querySelector('[data-acct-uid]').textContent=W.uid();
  acct.querySelectorAll('[data-guest]').forEach(e=>{ e.hidden=m; });
  acct.querySelectorAll('[data-member]').forEach(e=>{ e.hidden=!m; });
  fillDl(acct.querySelector('[data-acct-basic]'),[
    ['계정',m?'코브 몰 계정':'게스트 (회원가입 전)'],
    ...(m?[['가입한 날',fmtDate(W.memberSince())],['아이디',W.accountId()||'아직 없어요'],['로그인',hid&&pw?'아이디 + 비밀번호':[!hid&&'아이디',!pw&&'비밀번호'].filter(Boolean).join('·')+'를 정해 주세요']]:[]),
    ['닉네임',p.name],
    ['한 줄 소개',p.status||'아직 없어요'],
    ['오늘의 기분',p.mood],
    ['처음 온 날',fmtDate(v.first)],
    ['함께한 지','D+'+daysSince(v.first)],
    ['들른 날',v.days+'일 · 총 '+v.total.toLocaleString('ko-KR')+'번'],
    ['지난 방문',v.prev?fmtDate(v.prev):(v.days>1?'기록 없음':'오늘이 처음이에요')],
  ]);
  fillDl(acct.querySelector('[data-acct-shop]'),[
    ['보유 금화',W.short(c)+'개'],
    ['할인 쿠폰',n?`${n}장 · 키링 ${n}개 ${W.COUPON_WON}원씩`:`없음 · 금화 ${Math.max(0,W.COUPON_COINS-c)}개 더`],
    ['한정판 먼저 사기',A&&gem>=A.GEM_EARLY?'있어요 💎':`보석 ${gem} / ${A?A.GEM_EARLY:3}`],
    ['주문 내역','아직 없어요'],
    ['배송지','로그인 후 등록'],
  ]);
  fillDl(acct.querySelector('[data-acct-act]'),[
    ['선물한 하트',sumAll('given').toLocaleString('ko-KR')+'개'],
    ['투표한 별',sumOf('votes',A&&A.VOTES).toLocaleString('ko-KR')+'개'],
    ['쓴 일기',W.diary().length+'개'],
    ['먹은 히든 물감',W.short(W.get('color'))+'개'],
    ['코브 색',l.name+(l.hacker?' 🕶️':'')],
    ['받은 뱃지',badgeList().length+'개'],
  ]);
  // 효과음은 들판(field.js)이 켜졌을 때만 있음 — WebGL이 없으면 줄 자체를 숨김
  const sb=document.getElementById('soundBtn'), wired=!!(sb&&sb.hasAttribute('aria-pressed'));
  acct.querySelector('[data-acct-sound-row]').hidden=!wired;
  if(wired){ const on=sb.getAttribute('aria-pressed')!=='false', t=acct.querySelector('[data-acct-sound]'); t.setAttribute('aria-pressed',String(on)); t.textContent=on?'켜짐':'꺼짐'; }
  // 아이디·비밀번호 칸: 아이디 없는 옛 계정은 아이디 정하기(비밀번호가 있으면 지금 비밀번호로 확인), 비밀번호 없는 옛 계정은 '지금 비밀번호' 없이 정하기
  idForm.hidden=hid;
  idForm.querySelectorAll('[data-id-cur]').forEach(e=>{ e.hidden=!pw; });
  acct.querySelector('[data-pw-none]').hidden=pw;
  pwForm.querySelectorAll('[data-pw-cur]').forEach(e=>{ e.hidden=!pw; });
  pwForm.querySelector('[data-pw-user]').value=W.accountId();   // 비밀번호 관리자가 어느 아이디의 비밀번호인지 알게 (아이디 전엔 비움 — 닉네임으로 저장되면 나중에 로그인이 안 됨)
  const sub=pwForm.querySelector('[data-pw-submit]'); if(!sub.disabled) sub.textContent=pw?'비밀번호 바꾸기':'비밀번호 정하기';
}
function paintMini(){   // 홈 탭의 한 줄 요약
  const m=$('#mhAcctMini'); if(!m) return;
  const c=W.get('coin');
  m.querySelector('[data-mini-name]').textContent=W.profile().name;
  m.querySelector('[data-mini-uid]').textContent=(W.signedIn()?'· ':'· 게스트 ')+W.uid();
  m.querySelector('[data-mini-coin]').textContent=W.short(c)+'개';
  m.querySelector('[data-mini-coupon]').textContent=W.coupons()+'장';
}
$('#mhAcctMini [data-goto-account]').addEventListener('click',()=>showTab('account',true));
acct.addEventListener('click',e=>{
  if(e.target.closest('[data-join]')){ openJoin(); return; }
  if(e.target.closest('[data-logout]')){
    const r=W.logout();
    if(!r.ok){ const noId=!W.hasId(); (noId?idErr:pwErr).textContent=ACCT_ERR[r.error]||''; $(noId?'#acctId':'#acctPwNew').focus(); return; }   // 아직 안 정한 칸으로
    if(window.covvToast) window.covvToast('👋 로그아웃했어요');
    $('#mhLock [data-login]').focus();   // 잠금 화면의 로그인 버튼으로 (누른 버튼은 가려짐)
    return;
  }
  if(e.target.closest('[data-acct-edit]')){ const b=$('#mhEdit'); if(!b.hidden){ b.scrollIntoView({block:'center'}); b.click(); } else $('#mhNameInput').focus(); return; }
  if(e.target.closest('[data-acct-sound]')){ const sb=document.getElementById('soundBtn'); if(sb) sb.click(); paintAccount(); return; }
  if(e.target.closest('[data-backup]')){   // 내 기록을 파일로 (백업)
    // 저장소가 막힌 브라우저도 화면에 보이는 그대로 담도록 메모리 속 기록을 씀
    try{
      const uid=W.uid(), data=JSON.stringify(W.exportState(),null,1);   // 비밀번호 해시는 빼고
      const a=document.createElement('a'), url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      a.href=url; a.download=`코브-내기록-${uid}-${W.today()}.json`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      if(window.covvToast) window.covvToast('💾 내 기록을 파일로 저장했어요');
    }catch(_){ if(window.covvToast) window.covvToast('앗, 이 브라우저에서는 파일로 저장하지 못했어요'); }
    return;
  }
});

/* ══════════ 가방 (모은 아이템) ══════════ */
const bag=$('#mhBag');
bag.innerHTML=`
  <h3 class="mh-h first">가방</h3>
  <ul class="bag-items mh-bag-items"></ul>
  <div class="coupon">
    <div class="coupon-row"><span data-coupon-text></span><span class="coupon-num" data-coupon-num></span></div>
    <div class="coupon-track" aria-hidden="true"><div class="coupon-fill" data-coupon-fill></div></div>
    <p class="fine">가방에는 아이템마다 최대 ${W.ITEM_MAX.toLocaleString('ko-KR')}개까지 담겨요. 금화를 아무리 많이 모아도(해킹해도 ㅋㅋ) 할인은 키링 1개당 최대 ${W.COUPON_WON}원이에요.</p>
    ${W.rulesHTML()}
  </div>
  <h4 class="mh-h4">뱃지</h4>
  <ul class="badges" data-badges></ul>
  <div class="mh-cols">
    <div><h4 class="mh-h4">내가 응원한 키링</h4><ul class="mh-list" data-hearts></ul></div>
    <div><h4 class="mh-h4">다음 키링 투표</h4><ul class="mh-list" data-votes></ul></div>
  </div>
  <div class="mh-actions">
    <a class="mh-btn" href="#mall" data-go="mall">🛍️ 코브 몰 가기</a>
  </div>`;
const BAG6=[...(A?A.BAG:[]),{k:'color',label:'히든 물감',dot:'linear-gradient(135deg,#ff9ccb,#ffe27a,#8fe3c4,#8cc8ff)'}];
const bagList=bag.querySelector('.mh-bag-items');
BAG6.forEach(b=>{
  const li=el('li'); const d=el('span','dot'); d.style.background=b.dot; li.appendChild(d);
  li.appendChild(el('span','bag-label',b.label)); const n=el('strong'); n.dataset.k=b.k; li.appendChild(n); bagList.appendChild(li);
});
function paintBag(){
  bagList.querySelectorAll('strong').forEach(n=>{ const v=W.get(n.dataset.k); n.textContent=W.short(v); n.title=v.toLocaleString('ko-KR'); });
  const cv=W.couponView();
  bag.querySelector('[data-coupon-text]').textContent=cv.text;
  bag.querySelector('[data-coupon-num]').textContent=cv.num;
  bag.querySelector('[data-coupon-fill]').style.width=Math.min(100,cv.fill)+'%';
  const bl=bag.querySelector('[data-badges]'); bl.innerHTML=''; badgeList().forEach(t=>bl.appendChild(el('li',null,t)));
  const hl=bag.querySelector('[data-hearts]'); hl.innerHTML='';
  const given=W.state.given, nameOf=id=>{ const p=A&&A.PRODUCTS.find(x=>x.id===id); return p?p.name:A&&A.RETIRED&&Object.prototype.hasOwnProperty.call(A.RETIRED,id)?A.RETIRED[id]:'지난 키링'; };
  const hearts=(given&&typeof given==='object'?Object.keys(given):[]).map(id=>({name:nameOf(id),n:recOf('given',id)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);   // '선물한 하트'(sumAll)와 같은 기록 → 합이 맞음
  if(!hearts.length) hl.appendChild(el('li','mh-list-empty','아직 없어요. 코브 몰에서 하트를 선물해 보세요.'));
  hearts.forEach(x=>{ const li=el('li'); li.appendChild(el('span',null,x.name)); li.appendChild(el('b',null,'♥ '+x.n)); hl.appendChild(li); });
  const vl=bag.querySelector('[data-votes]'); vl.innerHTML='';
  const votes=(A?A.VOTES:[]).map(v=>({name:v.name,n:recOf('votes',v.id)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
  if(!votes.length) vl.appendChild(el('li','mh-list-empty','아직 없어요. 별로 다음 키링을 골라 주세요.'));
  votes.forEach(x=>{ const li=el('li'); li.appendChild(el('span',null,x.name)); li.appendChild(el('b',null,'★ '+x.n)); vl.appendChild(li); });
}

/* ══════════ 다이어리 ══════════ */
const diary=$('#mhDiary');
diary.innerHTML=`
  <h3 class="mh-h first">다이어리</h3>
  <form class="mh-diary-form" data-diary-form>
    <label class="sr-only" for="mhDiaryText">오늘의 일기</label>
    <textarea id="mhDiaryText" maxlength="300" rows="3" placeholder="오늘 코브랑 뭐 했나요? (나만 볼 수 있어요)"></textarea>
    <div class="mh-diary-bar"><span class="fine"><span data-diary-count>0 / 300</span> · 일기 <span data-diary-n>0</span> / ${200}</span><button type="submit" class="mh-btn" data-diary-save>기록하기</button></div>
    <p class="fine mh-diary-full" data-diary-full hidden>일기장이 가득 찼어요. 오래된 일기를 지우면 새로 쓸 수 있어요.</p>
  </form>
  <ul class="mh-diary" data-diary-list></ul>`;
const dText=diary.querySelector('#mhDiaryText');
dText.addEventListener('input',()=>{ diary.querySelector('[data-diary-count]').textContent=`${dText.value.length} / 300`; });
diary.querySelector('[data-diary-form]').addEventListener('submit',e=>{
  e.preventDefault();
  const text=dText.value.trim().slice(0,300); if(!text) { dText.focus(); return; }
  const list=W.diary(); if(list.length>=DIARY_MAX){ paintDiary(); return; }   // 꽉 차면 오래된 일기를 몰래 지우지 않음
  list.unshift({id:Date.now().toString(36),t:Date.now(),text});
  W.touch(); W.log('📔 다이어리를 썼어요');
  dText.value=''; diary.querySelector('[data-diary-count]').textContent='0 / 300';
  paintDiary(); dText.focus();
});
let delId=null;
const DIARY_MAX=200;
function paintDiary(){
  const ul=diary.querySelector('[data-diary-list]'); ul.innerHTML='';
  const list=W.diary().filter(x=>x&&typeof x==='object');
  const full=W.diary().length>=DIARY_MAX;
  diary.querySelector('[data-diary-n]').textContent=W.diary().length;
  diary.querySelector('[data-diary-full]').hidden=!full;
  diary.querySelector('[data-diary-save]').disabled=full;
  if(!list.length){ ul.appendChild(el('li','mh-list-empty','아직 쓴 일기가 없어요.')); return; }
  for(const x of list){
    const li=el('li'), id=S(x.id)||String(N(x.t)); li.dataset.id=id;
    const d=new Date(N(x.t)), when=isNaN(d)?'':`${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
    li.appendChild(el('time','mh-diary-date',when));
    li.appendChild(el('p','mh-diary-text',S(x.text)));
    if(delId===id){
      const row=el('div','mh-form-btns');
      const yes=el('button','mh-btn danger small','지우기'); yes.type='button'; yes.dataset.delYes='';
      const no=el('button','mh-btn ghost small','그만두기'); no.type='button'; no.dataset.delNo='';
      row.append(yes,no); li.appendChild(row);
    } else {
      const del=el('button','mh-del','지우기'); del.type='button'; del.dataset.del=''; del.setAttribute('aria-label',`${when} 일기 지우기`); li.appendChild(del);
    }
    ul.appendChild(li);
  }
}
diary.addEventListener('click',e=>{
  const li=e.target.closest('li[data-id]'); if(!li) return;
  if(e.target.closest('[data-del]')){ delId=li.dataset.id; paintDiary(); const y=diary.querySelector('[data-del-yes]'); if(y) y.focus(); return; }
  if(e.target.closest('[data-del-no]')){ delId=null; paintDiary(); dText.focus(); return; }
  if(e.target.closest('[data-del-yes]')){
    const list=W.diary(), i=list.findIndex(x=>x&&typeof x==='object'&&(S(x.id)||String(N(x.t)))===li.dataset.id);
    if(i>=0) list.splice(i,1);
    delId=null; W.touch(); paintDiary(); dText.focus();
  }
});

/* ══════════ 코브 몰 회원가입 · 로그인 (상단 메뉴 👤 · 계정 탭) ══════════
   지금은 이 브라우저에 만드는 계정 — 로그인 아이디(영문+숫자)·비밀번호와 닉네임(마음대로)만 받고 개인정보는 받지 않음. 카카오 로그인이 열리면 이 기록을 서버 계정으로 옮김 */
const ACCT_ERR={
  ID_SHORT:`아이디를 ${W.ID_MIN}자 이상 적어 주세요`,
  ID_LONG:`아이디는 ${W.ID_MAX}자까지예요`,
  ID_CHARS:'아이디는 영문과 숫자만 쓸 수 있어요',
  ID_MIX:'아이디는 영문과 숫자를 섞어서 만들어 주세요',
  ID_SET:'아이디는 이미 정했어요',
  ID_PW:'비밀번호와 같은 아이디는 쓸 수 없어요',
  SHORT:`닉네임을 ${W.NICK_MIN}자 이상 적어 주세요`,
  LONG:`닉네임은 ${W.NICK_MAX}자까지예요`,
  CHARS:'한글·영문·숫자와 띄어쓰기, _ . · - 만 쓸 수 있어요',
  BANNED:'운영자나 코브 몰로 오해할 수 있는 이름은 쓸 수 없어요',
  PW_SHORT:`비밀번호를 ${W.PW_MIN}자 이상 적어 주세요`,
  PW_LONG:`비밀번호는 ${W.PW_MAX}자까지예요`,
  PW_ID:'아이디와 같은 비밀번호는 쓸 수 없어요',
  PW_NICK:'닉네임과 같은 비밀번호는 쓸 수 없어요',
  PW_EASY:'너무 쉬운 비밀번호예요. 다른 걸로 정해 주세요',
  PW_SAME:'지금 비밀번호와 다른 걸로 정해 주세요',
  PW_DIFF:'두 비밀번호가 서로 달라요',
  WRONG:'아이디나 비밀번호가 맞지 않아요',
  WRONG_CUR:'지금 비밀번호가 맞지 않아요',
  NOLOGIN:'로그아웃하기 전에 아이디와 비밀번호를 먼저 정해 주세요',
  EXISTS:'이 브라우저에는 이미 계정이 있어요. 로그인해 주세요',
  NOACCT:'이 브라우저에는 아직 계정이 없어요. 아래 회원가입부터 해 주세요',
  NOCRYPTO:'이 주소에서는 비밀번호를 확인할 수 없어요. https 주소로 열어 주세요',
  RETRY:'다른 탭에서 계정이 바뀌었어요. 한 번 더 눌러 주세요',
};
// 비밀번호 확인(해시)에 0.5초쯤 걸려서 그동안 버튼을 잠금 (두 번 눌러 두 번 만들지 않게)
function busy(b,on){ if(on){ b.dataset.label=b.textContent; b.textContent='확인 중…'; } else b.textContent=b.dataset.label||b.textContent; b.disabled=on; }
const errFocus=(code,f)=>code==='PW_DIFF'?f.pw2:/^PW_/.test(code)?f.pw:/^(SHORT|LONG|CHARS|BANNED)$/.test(code)?f.nick:f.id;   // 오류가 난 칸으로 (나머지는 맨 위 아이디 칸)
const dlg=document.getElementById('joinDlg'), navAcct=document.getElementById('navAcct');
const joinId=document.getElementById('joinId'), joinNick=document.getElementById('joinNick'), joinErr=document.getElementById('joinErr');
const joinPw=document.getElementById('joinPw'), joinPw2=document.getElementById('joinPw2'), joinWarn=document.getElementById('joinWarn');
let joinReplace=false;   // 창을 열 때 정한 '기존 계정 지우고 가입' 여부 — 경고를 본 경우에만 덮어씀 (그사이 다른 탭에서 계정이 생기면 join이 EXISTS)
function openJoin(){
  if(!dlg||!dlg.showModal){ showTab('account'); if(window.covvOpenScreen) window.covvOpenScreen('office'); return; }   // <dialog>가 없는 옛 브라우저는 계정 탭으로
  if(dlg.open) return;
  const p=W.profile(), l=look(), old=W.member();   // old: 로그아웃한 계정이 있음 → 새로 가입하면 그 계정을 지움 (한 브라우저에 하나)
  joinId.value=''; joinNick.value=old||p.name==='코브 친구'?'':p.name;   // 게스트가 내 오피스에서 정해 둔 닉네임이 있으면 그대로 제안
  joinErr.textContent=''; joinPw.value=joinPw2.value='';
  joinReplace=old; joinWarn.hidden=!old; dlg.querySelector('[type="submit"]').textContent=old?'기존 계정 지우고 회원가입':'✨ 회원가입';
  joinId.setAttribute('aria-describedby',(old?'joinWarn ':'')+'joinIdHelp joinErr');   // 화면 읽기 프로그램도 첫 칸에서 경고를 읽게
  if(A) document.getElementById('joinCove').innerHTML=A.coveSVG(l.hex,l.rainbow?'rainbow':null,{plain:true,shades:l.hacker});
  dlg.showModal(); joinId.focus();
}
if(dlg){
  document.getElementById('joinForm').addEventListener('submit',e=>{
    e.preventDefault();
    const btn=e.target.querySelector('[type="submit"]'); if(btn.disabled) return;
    const fail=code=>{ joinErr.textContent=ACCT_ERR[code]||'다시 적어 주세요'; errFocus(code,{id:joinId,nick:joinNick,pw:joinPw,pw2:joinPw2}).focus(); };
    // 해시를 만들기 전에 바로 알 수 있는 오류부터 (칸 순서대로: 아이디 → 비밀번호 → 한 번 더 → 닉네임)
    const d=W.checkId(joinId.value); if(!d.ok){ fail(d.error); return; }
    const c=W.checkNick(joinNick.value);
    const k=W.checkPw(joinPw.value,d.id,c.ok?c.nick:''); if(!k.ok){ fail(k.error); return; }
    if(joinPw.value!==joinPw2.value){ fail('PW_DIFF'); return; }
    if(!c.ok){ fail(c.error); return; }
    busy(btn,true);
    W.join(joinId.value,joinNick.value,joinPw.value,joinReplace).then(r=>{
      busy(btn,false);
      if(!r.ok){ fail(r.error); return; }
      joinPw.value=joinPw2.value=''; if(loginId) loginId.value=''; dlg.close();   // 로그인 창에 남은 옛 아이디도 지움
      if(window.covvToast) window.covvToast(`🎉 환영해요, ${r.nick}님! 들판의 코브 이름표가 바뀌었어요`);
      if(isOpen){ const t=tabs.find(t=>t.dataset.tab===tab); if(t) t.focus(); }   // 창을 연 버튼(게스트 회원가입·잠금 화면)은 가려져서 내 오피스 탭으로
    });
  });
  dlg.addEventListener('input',()=>{ joinErr.textContent=''; });
  dlg.addEventListener('click',e=>{ if(e.target.closest('[data-to-login]')){ dlg.close(); openLogin(); } });   // 회원가입 ↔ 로그인 오가기
  dlg.addEventListener('close',()=>{ joinPw.value=joinPw2.value=''; });   // 비밀번호는 창을 닫으면 지움 (열 때·성공할 때도 따로 지움 — close 이벤트는 늦게 올 수 있음)
  closable(dlg);
}

/* 로그인 창: 계정은 있는데 로그아웃한 상태에서 상단 👤 · 잠금 화면의 로그인 버튼 */
const loginDlg=document.getElementById('loginDlg');
const loginId=document.getElementById('loginId'), loginPw=document.getElementById('loginPw'), loginErr=document.getElementById('loginErr');
function openLogin(){
  if(!loginDlg||!loginDlg.showModal||loginDlg.open) return;
  const l=look();
  loginErr.textContent=''; loginPw.value=''; resetAsk(false);
  const fg=loginDlg.querySelector('.join-forgot'); fg.open=false; fg.hidden=!W.member();   // 계정이 없으면 '잊었어요'(지우기)도 없음 — 게스트 다이어리가 지워지지 않게
  if(A) document.getElementById('loginCove').innerHTML=A.coveSVG(l.hex,l.rainbow?'rainbow':null,{plain:true,shades:l.hacker});
  loginDlg.showModal(); (loginId.value?loginPw:loginId).focus();
}
function resetAsk(on){ loginDlg.querySelector('[data-reset]').hidden=on; loginDlg.querySelector('[data-reset-ask]').hidden=!on; }
if(loginDlg){
  document.getElementById('loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    const btn=e.target.querySelector('[type="submit"]'); if(btn.disabled) return;
    busy(btn,true);
    W.login(loginId.value,loginPw.value).then(r=>{
      busy(btn,false);
      if(!r.ok){ loginErr.textContent=ACCT_ERR[r.error]||'다시 적어 주세요'; loginPw.value=''; (r.error==='WRONG'&&loginId.value?loginPw:loginId).focus(); return; }
      loginPw.value=''; loginDlg.close();
      const miss=[!W.hasId()&&'아이디',!W.hasPw()&&'비밀번호'].filter(Boolean).join('·');   // 계정 탭 '로그인' 줄과 같은 말
      if(window.covvToast) window.covvToast(`👋 다시 만나서 반가워요, ${r.nick}님!`+(miss?` 계정 탭에서 ${miss}를 정해 주세요`:''));
      if(isOpen){ const t=tabs.find(t=>t.dataset.tab===tab); if(t) t.focus(); }   // 잠금이 풀린 내 오피스로 (누른 로그인 버튼은 가려짐)
    });
  });
  loginDlg.addEventListener('input',()=>{ loginErr.textContent=''; });
  loginDlg.addEventListener('close',()=>{ loginPw.value=''; });
  // 비밀번호를 잊었을 때: 두 번 눌러야 지워짐 (되돌릴 수 없어서)
  loginDlg.addEventListener('click',e=>{
    if(e.target.closest('[data-to-join]')){ loginDlg.close(); openJoin(); return; }
    if(e.target.closest('[data-reset]')){ resetAsk(true); loginDlg.querySelector('[data-reset-no]').focus(); return; }
    if(e.target.closest('[data-reset-no]')){ resetAsk(false); loginDlg.querySelector('[data-reset]').focus(); return; }
    if(e.target.closest('[data-reset-yes]')){
      if(!W.member()){ loginDlg.close(); return; }   // 다른 탭에서 이미 지웠으면 게스트 기록은 건드리지 않음
      W.resetAccount(); loginId.value=''; loginDlg.close();
      if(window.covvToast) window.covvToast('🧹 계정을 지웠어요. 새로 만들 수 있어요');
      if(isOpen){ const t=tabs.find(t=>t.dataset.tab===tab); if(t) t.focus(); }
    }
  });
  closable(loginDlg);
}
function closable(d){
  d.addEventListener('click',e=>{ if(e.target===d||e.target.closest('[data-join-close]')) d.close(); });   // 바깥(배경)이나 ✕를 누르면 닫힘
  // Esc는 창만 닫음 (screens.js가 뒤에 열린 화면까지 닫지 않게 기본 동작을 막고 직접 닫음)
  d.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!e.isComposing){ e.preventDefault(); d.close(); } });
}
function paintNav(){
  if(!navAcct) return;
  const m=W.signedIn(), name=W.profile().name;
  navAcct.querySelector('[data-acct-label]').textContent=m?name:'로그인';
  navAcct.setAttribute('aria-label',m?`내 계정 · ${name}`:'로그인 · 회원가입');
  navAcct.classList.toggle('on',m);
}
if(navAcct) navAcct.addEventListener('click',e=>{
  if(!W.signedIn()){ openLogin(); return; }   // 로그인 창 (회원가입은 창 안 링크로)
  showTab('account');   // 로그인 중이면 내 오피스 계정 탭으로 (이미 열려 있으면 탭만 바꿈)
  if(window.covvOpenScreen) window.covvOpenScreen('office',e.detail===0?{}:{x:e.clientX,y:e.clientY});
});
W.on(k=>{ if(k==='profile'||k==='account'||k==='*') paintNav(); });   // 아이템을 주울 때마다 다시 그리지 않게
paintNav();

/* ══════════ 잠금 (로그아웃) ══════════
   계정이 있는데 로그아웃한 상태면 프로필·탭을 가리고 로그인 버튼만 — 같은 컴퓨터를 쓰는 사람이 내 다이어리를 바로 보지 못하게.
   기록은 이 브라우저 저장소에 그대로 있어서 개발자 도구로는 볼 수 있음 (진짜 잠금은 서버 로그인 때) */
let wasLocked=null;
function paintLock(){
  const l=locked(); if(l===wasLocked) return;
  wasLocked=l;
  $('#mhLock').hidden=!l; $('.mh-body').hidden=l;
  if(l&&editing){ editing=false; $('#mhForm').hidden=true; $('#mhEdit').hidden=false; }   // 고치던 프로필은 버림
  if(l){ pwForm.reset(); idForm.reset(); pwErr.textContent=idErr.textContent=''; if(loginId) loginId.value=''; delId=null; dText.value=''; diary.querySelector('[data-diary-count]').textContent='0 / 300'; }   // 저장 안 한 일기 초안도 (다음 사람이 보지 않게)
  if(window.covvRoom){ if(!l&&isOpen&&tab==='home') window.covvRoom.resume(); else if(l) window.covvRoom.pause(); }
  paintSide();
}
$('#mhLock').addEventListener('click',e=>{ if(e.target.closest('[data-login]')) openLogin(); });

/* ══════════ 탭 (싸이월드처럼 오른쪽) ══════════ */
const tabs=[...root.querySelectorAll('.mh-tabs [role="tab"]')];
function showTab(name,focus){
  if(!root.querySelector(`[data-panel="${name}"]`)) return;
  tab=name;
  tabs.forEach(t=>{ const on=t.dataset.tab===name; t.setAttribute('aria-selected',String(on)); t.tabIndex=on?0:-1; if(on&&focus) t.focus(); });
  root.querySelectorAll('.mh-panel').forEach(p=>{ p.hidden=p.dataset.panel!==name; });
  if(name==='bag') paintBag();
  if(name==='account') paintAccount();
  if(name==='diary') paintDiary();
  if(window.covvRoom){ if(isOpen&&name==='home'&&!locked()) window.covvRoom.resume(); else window.covvRoom.pause(); }
}
root.querySelector('.mh-tabs').addEventListener('click',e=>{ const t=e.target.closest('[role="tab"]'); if(t) showTab(t.dataset.tab); });
root.querySelector('.mh-tabs').addEventListener('keydown',e=>{
  const i=tabs.findIndex(t=>t.dataset.tab===tab);
  const k={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];
  if(k){ e.preventDefault(); showTab(tabs[(i+k+tabs.length)%tabs.length].dataset.tab,true); }
});

function paintAll(){ paintLock(); paintSide(); paintLog(); paintMini(); if(tab==='account') paintAccount(); if(tab==='bag') paintBag(); if(tab==='diary') paintDiary(); }
W.on(k=>{
  if(k==='account'||k==='*') paintLock();   // 로그아웃·로그인은 화면이 닫혀 있어도 바로 (다른 탭에서 바꿔도)
  if(!isOpen) return; if(!editing) paintSide(); paintLog(); paintMini(); if(tab==='account') paintAccount(); if(tab==='bag') paintBag();
  if(k==='*'&&tab==='diary') paintDiary();   // 계정을 지우면 다이어리도 비워짐
});
addEventListener('covv-screen',e=>{
  isOpen=e.detail==='office';
  if(isOpen){ paintAll(); if(window.covvRoom&&tab==='home'&&!locked()) window.covvRoom.resume(); }
  else if(window.covvRoom) window.covvRoom.pause();
});
window.covvOffice={showTab:n=>showTab(n,true)};
paintAll();
})();
