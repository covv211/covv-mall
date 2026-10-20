/* ══════════════════════════════════════════════════════════
   코브 몰 — 가방(모은 아이템) · 키링 가게 화면
   - 가방: 들판에서 주운 금화·하트·별·보석·사탕을 이 브라우저에 저장 (새로고침해도 남음)
   - 해킹 환영 ㅋㅋ: 금화 개수는 브라우저 안에 있어서 얼마든지 바꿀 수 있음.
     대신 할인은 '키링 1개당 최대 100원'(금화 100개 = 쿠폰 1장) — 계산은 checkout-rules.js 한 곳에서,
     실제 결제 때는 결제 서버가 같은 파일로 직접 계산해서 이 한도를 지킴
   - 하트 = 키링 응원 선물, 별 = 다음 키링 투표, 사탕 = 코브 색 고르기
   - '내 가방'(아이템 수·쿠폰 진행·할인 규칙·뱃지)은 코브 몰이 아니라 주문/결제 화면 맨 위(#checkoutBag)에 그림. 상품 창·장바구니·주문서는 checkout.js
   - 소개 화면의 '들판에서 줍는 아이템' 안내도 여기서 숫자·확률을 채움 (확률은 field.js의 covvField.drops())
   - 내 오피스(미니홈피)용 기록도 여기: 프로필·방문 수·다이어리·최근 소식 (myoffice.js가 화면을 그림)
   - 코브 몰 계정: 지금은 이 브라우저에 만드는 계정(로그인 아이디(영문+숫자) + 비밀번호, 닉네임은 따로 마음대로 · 개인정보 X) → 로그인 중이면 들판 주인공 코브 이름표가 내 닉네임.
     비밀번호는 글자 대신 PBKDF2 해시만 저장. 로그아웃하면 내 오피스가 잠기고 이름표는 '코브'로.
     로그인 정보(아이디·로그인 중인지·해시)는 가방 기록과 다른 저장 칸(AUTH_KEY)에 — 옛 버전 탭이 가방을 저장하며 모르는 칸을 버려도 안 지워지게
     카카오 로그인이 열리면 이 기록을 서버 계정으로 옮김 (창·버튼은 myoffice.js, 이름표는 field.js)
   - field.js보다 먼저 불러옴 (들판이 시작할 때 가방에 저장된 코브 색을 읽음)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const R=window.covvRules;   // 결제 규칙 (checkout-rules.js — 이 파일보다 먼저 불러옴)
if(!R){ try{ console.error('checkout-rules.js를 불러오지 못해서 가방을 열 수 없어요'); }catch(e){} return; }
const KEY='covv-wallet-v1';
const AUTH_KEY='covv-auth-v1';   // 로그인 정보 {since, on, id, salt, hash, it} — 가방 기록(KEY)과 따로
const COUPON_COINS=R.COUPON_COINS, COUPON_WON=R.COUPON_WON;   // 금화 100개 = 쿠폰 1장 = 키링 1개 100원 할인
const DAY_HEART=5, DAY_STAR=3;            // 한 상품에 하루 동안 줄 수 있는 하트·별
const DECO_CANDY=5;                       // 코브 색 한 번 바꾸는 데 드는 사탕
const GEM_EARLY=3;                        // 보석 3개 = 한정판 먼저 사기 자격
const ID_MIN=4, ID_MAX=16;                // 로그인 아이디 글자 수 — 영문+숫자를 섞어서 (대문자로 적어도 소문자로 맞춰 저장·비교)
const NICK_MIN=2, NICK_MAX=12;            // 계정 닉네임 글자 수 (프로필 닉네임 칸과 같은 12자)
const NICK_BAN=/운영자|관리자|admin|코브\s*몰|공식/i;   // 가게·운영자로 오해할 이름 막기 (서버 계정으로 옮길 때도 같은 규칙)
const PW_MIN=8, PW_MAX=64;                // 계정 비밀번호 글자 수 (짧으면 해시가 새어 나갔을 때 금방 풀림)
const PW_ITER=600000;                     // 비밀번호 해시(PBKDF2-SHA256) 반복 횟수 — OWASP 2023 권장값, 휴대폰에서 0.5초 안팎
const PW_EASY=new Set(['12345678','123456789','1234567890','87654321','password','password1','qwerty12','qwerty123','qwer1234','asdf1234','1q2w3e4r','1q2w3e4r5t','abcd1234','iloveyou','abc12345']);   // 누구나 먼저 넣어 보는 비밀번호

/* ── 가방 (이 브라우저에 저장) ── */
const DEF={coin:0,heart:0,star:0,gem:0,candy:0,color:0,rainbow:false,look:'분홍',gift:false,given:{},votes:{},
  profile:null, visits:null, diary:null, log:null, uid:null, account:null};   // 내 오피스: 프로필 · 방문 수 · 다이어리 · 최근 소식 · 게스트 번호 · 코브 몰 계정
const MAXN=Number.MAX_SAFE_INTEGER, ITEM_MAX=R.BAG_MAX, BAGK=new Set(['coin','heart','star','gem','candy','color']);
// 숫자·글자만 숫자로 바꿈 (다른 값은 0) — {"toString":0} 같은 값은 Number()에서 에러가 나서 페이지가 멈출 수 있음
const num=(v,max=MAXN)=>{ if(typeof v!=='number'&&typeof v!=='string') return 0; const n=Math.floor(Number(v)); return n>0?Math.min(n,max):0; };   // 글자·음수·NaN → 0, 무한대 → 상한
const item=v=>num(v,ITEM_MAX);   // 가방 아이템은 종류마다 최대 9,999개 (해킹해도 여기까지)
const fixBag=o=>{ for(const k of BAGK) o[k]=item(o[k]); };
const str=(v,max,def)=>typeof v==='string'?v.slice(0,max):def;
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const noProto=(k,v)=>k==='__proto__'?undefined:v;   // JSON.parse에서 '__proto__' 키는 버림 (Object.assign이 프로토타입을 바꾸지 않게)
const DIARY_MAX=200, LOG_MAX=30;

/* 저장된 기록 정리 — 기록은 개발자 도구·확장 프로그램·같은 컴퓨터를 쓰는 사람이 바꿀 수 있으니 그대로 믿지 않고,
   아는 칸만 알맞은 모양(숫자·글자·목록)으로 골라 담음. 이상한 값이 있어도 페이지가 멈추거나 코드로 바뀌지 않게 */
function sanitize(v){
  const o=Object.assign({},DEF,{given:{},votes:{}});
  if(!isObj(v)) return o;
  fixBag(Object.assign(o,{coin:v.coin,heart:v.heart,star:v.star,gem:v.gem,candy:v.candy,color:v.color}));
  o.rainbow=v.rainbow===true; o.gift=v.gift===true;
  o.look=str(v.look,10,'분홍')||'분홍';   // 들판은 아는 색 이름만 받아들임 (field.js findLook)
  for(const kind of ['given','votes']){   // 하트·별 기록 {상품 id: {total, today, day}}
    if(!isObj(v[kind])) continue;
    for(const id of Object.keys(v[kind]).slice(0,50)){
      const r=v[kind][id];
      if(id!=='__proto__'&&/^[a-z0-9_-]{1,20}$/.test(id)&&isObj(r)) o[kind][id]={total:num(r.total),today:num(r.today),day:str(r.day,12,'')};
    }
  }
  if(isObj(v.profile)) o.profile={name:str(v.profile.name,12,''),status:str(v.profile.status,40,''),mood:str(v.profile.mood,4,'')};
  if(isObj(v.visits)){ const s=v.visits; o.visits={first:str(s.first,20,''),last:str(s.last,20,''),prev:str(s.prev,20,''),today:num(s.today),total:num(s.total),days:num(s.days)}; }
  const time=t=>typeof t==='number'&&isFinite(t)?t:0;
  if(Array.isArray(v.diary)) o.diary=v.diary.filter(x=>isObj(x)&&typeof x.text==='string').slice(0,DIARY_MAX)
    .map(x=>({id:str(x.id,24,'')||time(x.t).toString(36),t:time(x.t),text:x.text.slice(0,300)}));
  if(Array.isArray(v.log)) o.log=v.log.filter(x=>isObj(x)&&typeof x.text==='string').slice(0,LOG_MAX)
    .map(x=>({t:time(x.t),text:x.text.slice(0,80)}));
  if(typeof v.uid==='string'&&/^CV-[A-Z0-9]{6}$/.test(v.uid)) o.uid=v.uid;
  if(isObj(v.account)) o.account={since:str(v.account.since,12,'')};   // 계정은 만든 날만 (로그인 정보는 AUTH_KEY에 따로)
  return o;
}
/* 로그인 정보 정리 {만든 날(계정과 짝), 로그인 중인지, 로그인 아이디, 비밀번호 소금·해시·반복 횟수} — 비밀번호 글자는 어디에도 저장하지 않음 */
function sanitizeAuth(v){
  if(!isObj(v)) return null;
  const o={since:str(v.since,12,''),on:v.on!==false};
  if(typeof v.id==='string'&&checkId(v.id).id===v.id) o.id=v.id;
  if(typeof v.salt==='string'&&/^[0-9a-f]{32}$/.test(v.salt)&&typeof v.hash==='string'&&/^[0-9a-f]{64}$/.test(v.hash)) Object.assign(o,{salt:v.salt,hash:v.hash,it:num(v.it,5e6)||PW_ITER});
  return o;
}
let raw, auth=null;
try{ const s=localStorage.getItem(AUTH_KEY); auth=sanitizeAuth(s?JSON.parse(s,noProto):null); }catch(e){}
try{
  const s=localStorage.getItem(KEY), v=s?JSON.parse(s,noProto):null;
  raw=sanitize(v);
  // 10월 4일 잠깐 가방 기록 안(account)에 두었던 로그인 정보는 따로 저장하는 칸으로 옮김
  if(!auth&&isObj(v)&&isObj(v.account)&&(v.account.hash||v.account.id||v.account.on===false)){ auth=sanitizeAuth(v.account); saveAuth(); save(); }
}
catch(e){   // 기록이 깨져 읽을 수 없으면 새 가방으로 시작하되, 원래 글자는 덮어쓰기 전에 옆 칸에 보관 (개발자 도구로 고치다 쉼표 하나 틀려도 일기가 통째로 사라지지 않게)
  raw=sanitize(null);
  try{ const s=localStorage.getItem(KEY); if(s) localStorage.setItem(KEY+'-broken',s); }catch(_){}
}
const subs=new Set();

// 바로 저장 (작은 JSON이라 가벼움) — 미뤄 두면 탭을 닫거나 다른 탭이 저장할 때 마지막 변경이 사라질 수 있음
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(raw)); }catch(e){} }
function saveAuth(){ try{ if(auth) localStorage.setItem(AUTH_KEY,JSON.stringify(auth)); else localStorage.removeItem(AUTH_KEY); }catch(e){} }
function emit(k){ subs.forEach(f=>{ try{ f(k); }catch(e){} }); }

// 콘솔에서 covvWallet.state.coin = 9999 처럼 바꿔도 바로 저장·반영되게 (가방 숫자는 저장할 때 정리)
const state=new Proxy(raw,{ set(t,k,v){ t[k]=BAGK.has(k)?item(v):v; save(); emit(k); return true; } });

// 홈페이지를 탭 두 개로 열어도 서로 덮어쓰지 않게: 다른 탭이 저장하면 그 가방을 받아옴
addEventListener('storage',e=>{
  if(e.key===AUTH_KEY){   // 다른 탭에서 로그인·로그아웃·아이디·비밀번호를 바꾸면 여기도 (잠금·이름표가 따라감)
    let v=null; try{ v=e.newValue===null?null:JSON.parse(e.newValue,noProto); }catch(_){ return; }
    auth=sanitizeAuth(v); emit('account'); return;
  }
  if(e.key!==KEY) return;
  if(e.newValue===null){ location.replace(location.pathname+location.search); return; }   // 다른 탭에서 기록이 지워지면(개발자 도구 등) 여기도 처음 상태로
  let v; try{ v=JSON.parse(e.newValue,noProto); }catch(_){ return; }
  if(!isObj(v)) return;
  const next=sanitize(v);   // 정리를 먼저 끝낸 뒤에 바꿔 끼움 (중간에 멈춰도 지금 가방은 그대로)
  for(const k of Object.keys(raw)) delete raw[k];
  Object.assign(raw,next);
  emit('*');
});
const today=()=>{ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
// 콘솔로 이상한 값이 들어와도 내 오피스가 멈추지 않게 모양을 바로잡아서 꺼냄
function profile(){
  const p=isObj(raw.profile)?raw.profile:(raw.profile={});
  p.name=str(p.name,12,'')||'코브 친구'; p.status=str(p.status,40,''); p.mood=str(p.mood,4,'')||'😊';
  return p;
}
function visits(){
  const v=isObj(raw.visits)?raw.visits:(raw.visits={});
  v.first=str(v.first,20,''); v.last=str(v.last,20,''); v.prev=str(v.prev,20,''); v.today=num(v.today); v.total=num(v.total); v.days=num(v.days);
  return v;
}
const list=k=>Array.isArray(raw[k])?raw[k]:(raw[k]=[]);
// 닉네임 검사 → {ok:true,nick} 또는 {ok:false,error:'SHORT'|'LONG'|'CHARS'|'BANNED'}
function checkNick(v){
  const nick=(typeof v==='string'?v:'').normalize('NFC').trim().replace(/\s+/g,' ');
  if(nick.length<NICK_MIN) return {ok:false,error:'SHORT'};
  if(nick.length>NICK_MAX) return {ok:false,error:'LONG'};
  if(!/^[\p{L}\p{N} _.·-]+$/u.test(nick)) return {ok:false,error:'CHARS'};   // 글자·숫자·띄어쓰기·_ . · - 만 (보이지 않는 글자·방향 바꾸는 글자로 남을 흉내 내지 못하게)
  if(NICK_BAN.test(nick)) return {ok:false,error:'BANNED'};
  return {ok:true,nick};
}
// 로그인 아이디 검사 → {ok:true,id} 또는 {ok:false,error:'ID_SHORT'|'ID_LONG'|'ID_CHARS'|'ID_MIX'} — 소문자로 맞춘 id를 돌려줌
function checkId(v){
  const id=(typeof v==='string'?v:'').trim().toLowerCase();
  if(!id) return {ok:false,error:'ID_SHORT'};
  if(!/^[a-z0-9]+$/.test(id)) return {ok:false,error:'ID_CHARS'};   // 영문·숫자만 (한글·띄어쓰기·기호 X — 어느 기기 자판으로도 똑같이 칠 수 있게)
  if(id.length<ID_MIN) return {ok:false,error:'ID_SHORT'};
  if(id.length>ID_MAX) return {ok:false,error:'ID_LONG'};
  if(!/[a-z]/.test(id)||!/[0-9]/.test(id)) return {ok:false,error:'ID_MIX'};   // 영문과 숫자를 둘 다 섞어서
  return {ok:true,id};
}
// 비밀번호 검사 → {ok:true} 또는 {ok:false,error:'PW_SHORT'|'PW_LONG'|'PW_ID'|'PW_NICK'|'PW_EASY'}
function checkPw(pw,id,nick){
  if(typeof pw!=='string'||pw.length<PW_MIN) return {ok:false,error:'PW_SHORT'};
  if(pw.length>PW_MAX) return {ok:false,error:'PW_LONG'};
  const l=pw.toLowerCase();
  if(typeof id==='string'&&id&&l===id.toLowerCase()) return {ok:false,error:'PW_ID'};   // 아이디만 알면 들어오게 됨
  if(typeof nick==='string'&&nick&&l===nick.toLowerCase()) return {ok:false,error:'PW_NICK'};   // 닉네임은 누구나 보는 값
  if(PW_EASY.has(l)||/^(.)\1+$/.test(pw)) return {ok:false,error:'PW_EASY'};   // 흔한 비밀번호 · 같은 글자 반복
  return {ok:true};
}
/* 계정 비밀번호: 글자는 저장하지 않고 무작위 소금(16바이트)을 섞어 PBKDF2로 60만 번 돌린 해시만 저장
   (다른 사이트와 같은 비밀번호를 쓰는 사람이 많아서 — 내 기록 파일·이 컴퓨터 저장소가 새어도 비밀번호 글자는 안 나오게).
   브라우저 안 잠금이라 개발자 도구로 저장소를 바꾸면 풀 수 있음 → 진짜 계정 보호는 카카오 로그인(서버)에서 */
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
async function pwHash(pw,salt,it){   // → 64자 hex, 이 브라우저가 못 하면(https가 아닌 주소 등 crypto.subtle 없음) null
  try{
    const sub=crypto.subtle; if(!sub) return null;
    const key=await sub.importKey('raw',new TextEncoder().encode(String(pw).normalize('NFC')),'PBKDF2',false,['deriveBits']);
    const bits=await sub.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt.match(/../g).map(h=>parseInt(h,16))),iterations:it},key,256);
    return hex(bits);
  }catch(e){ return null; }
}
async function makePw(pw){   // 새 소금 + 해시 → {salt,hash,it} 또는 null
  let salt; try{ const b=new Uint8Array(16); crypto.getRandomValues(b); salt=hex(b); }catch(e){ return null; }
  const hash=await pwHash(pw,salt,PW_ITER);
  return hash?{salt,hash,it:PW_ITER}:null;
}
const pwOk=(a,pw)=>pwHash(typeof pw==='string'?pw:'',a.salt,a.it||PW_ITER).then(h=>h===null?null:h===a.hash);   // 맞으면 true, 틀리면 false, 확인 못 하면 null
// 지금 계정의 로그인 정보 — 만든 날이 짝이 맞을 때만 (없으면 null: 아이디·비밀번호를 정하기 전 옛 계정 = 늘 로그인 상태)
const au=()=>isObj(raw.account)&&auth&&auth.since===str(raw.account.since,12,'')?auth:null;
const newAuth=()=>(auth={since:str(raw.account.since,12,''),on:true});   // 옛 계정이 아이디·비밀번호를 처음 정할 때
const wallet={
  state,
  get(k){ return item(state[k]); },
  add(k,n=1){   // 실제로 들어간 개수를 돌려줌 (가방이 가득이면 0)
    const before=item(state[k]);
    state[k]=before+n;
    const after=item(state[k]);
    if(k==='coin'){ const a=R.coupons(before), b=R.coupons(after); if(b>a) wallet.log(`🎟️ 금화 ${(b*COUPON_COINS).toLocaleString('ko-KR')}개! 할인 쿠폰 ${b}장 준비 완료`); }
    return after-before;
  },
  coupons(){ return R.coupons(wallet.get('coin')); },   // 가진 할인 쿠폰 (금화 100개마다 1장, 최대 99장)
  spend(k,n=1){ if(item(state[k])<n) return false; state[k]=item(state[k])-n; return true; },
  on(f){ subs.add(f); return ()=>subs.delete(f); },
  // 내 오피스
  profile, visits, today,
  uid(){ return typeof raw.uid==='string'&&/^CV-[A-Z0-9]{6}$/.test(raw.uid)?raw.uid:(raw.uid=newUid()); },   // 게스트 번호 (로그인 전 내 계정 표시 — 누구나 볼 수 있는 값이라 계정 증명으로는 쓰지 않음)
  diary(){ return list('diary'); },
  logs(){ return list('log'); },
  log(text){ const l=list('log'); l.unshift({t:Date.now(),text:String(text).slice(0,80)}); if(l.length>30) l.length=30; save(); emit('log'); },
  setProfile(patch){ Object.assign(profile(),patch); profile(); save(); emit('profile'); },
  touch(){ save(); emit('*'); },   // 다이어리처럼 안쪽 목록을 바꾼 뒤 저장·알림
  // 코브 몰 계정 (지금은 이 브라우저 계정 — 콘솔로 만들어도 할인·결제와는 무관)
  // 비밀번호를 확인하는 함수는 Promise로 {ok:true,…} 또는 {ok:false,error:'코드'}를 돌려줌 (문구는 myoffice.js ACCT_ERR)
  member(){ return isObj(raw.account); },   // 이 브라우저에 계정이 있음 (로그아웃해도 true)
  signedIn(){ const a=au(); return isObj(raw.account)&&(!a||a.on); },   // 계정이 있고 로그인 중
  hasId(){ const a=au(); return !!(a&&a.id); },
  hasPw(){ const a=au(); return !!(a&&a.hash); },
  accountId(){ const a=au(); return a&&a.id||''; },   // 로그인 아이디 (내 계정 탭에만 보여 줌 — 들판 이름표는 닉네임)
  memberSince(){ return isObj(raw.account)?str(raw.account.since,12,''):''; },
  checkId, checkNick, checkPw,
  async join(id,name,pw,replace){   // 회원가입: 로그인 아이디(영문+숫자) + 비밀번호 + 닉네임(따로 마음대로 → 프로필 닉네임 + 들판 코브 이름표)
    // 계정은 한 브라우저에 하나 → 이미 있으면 로그아웃한 상태에서 replace일 때만 옛 계정을 지우고 새로 (로그인 중엔 막음)
    const blocked=()=>isObj(raw.account)&&(!replace||wallet.signedIn());
    if(blocked()) return {ok:false,error:'EXISTS'};
    const d=checkId(id); if(!d.ok) return d;
    const c=checkNick(name); if(!c.ok) return c;
    const k=checkPw(pw,d.id,c.nick); if(!k.ok) return k;
    const h=await makePw(pw); if(!h) return {ok:false,error:'NOCRYPTO'};
    if(blocked()) return {ok:false,error:'EXISTS'};   // 해시를 만드는 사이 다른 탭에서 계정을 만들거나 로그인했으면 덮어쓰지 않음
    const old=isObj(raw.account);
    if(old){ raw.profile=null; raw.diary=null; raw.log=null; }   // 옛 계정의 내 오피스 기록은 지움, 가방은 남김 ('계정 지우고 새로 시작'과 같음)
    const since=today();
    auth=Object.assign({since,on:true,id:d.id},h); saveAuth();
    raw.account={since};
    Object.assign(profile(),{name:c.nick}); save();
    wallet.log(`🎉 코브 몰에 회원가입했어요 · 닉네임 '${c.nick}'`);
    emit(old?'*':'profile');
    return {ok:true,id:d.id,nick:c.nick};
  },
  async login(id,pw){   // 로그인: 아이디 + 비밀번호 (어느 쪽이 틀렸는지는 알려 주지 않음)
    if(!isObj(raw.account)) return {ok:false,error:'NOACCT'};
    const a=au(); if(!a||a.on) return {ok:true,nick:profile().name};   // 이미 로그인 중 (다른 탭에서 먼저 로그인했거나 로그인 정보가 없는 옛 계정)
    let idOk;
    if(a.id) idOk=(typeof id==='string'?id:'').trim().toLowerCase()===a.id;
    else { const c=checkNick(id); idOk=c.ok&&c.nick.toLowerCase()===profile().name.toLowerCase(); }   // 아이디를 정하기 전 옛 계정은 닉네임으로 (로그인 뒤 계정 탭이 아이디 정하기를 안내)
    if(a.hash){
      const r=await pwOk(a,pw); if(r===null) return {ok:false,error:'NOCRYPTO'};
      if(!idOk||!r) return {ok:false,error:'WRONG'};
    } else if(!idOk) return {ok:false,error:'WRONG'};   // 비밀번호를 정하기 전 옛 계정은 닉네임만
    if(au()!==a) return {ok:false,error:'RETRY'};   // 확인하는 사이 다른 탭에서 로그인 정보가 바뀜 (가방 저장으로는 안 바뀜)
    a.on=true; saveAuth(); emit('account');
    return {ok:true,nick:profile().name};
  },
  logout(){   // 아이디·비밀번호가 없으면 다시 들어올 길이 없어서 먼저 정하게 함
    if(!wallet.signedIn()) return {ok:true};
    const a=au(); if(!a||!a.id||!a.hash) return {ok:false,error:'NOLOGIN'};
    a.on=false; saveAuth(); emit('account');
    return {ok:true};
  },
  async setId(v,cur){   // 아이디 정하기 — 아이디 없이 만든 옛 계정만 한 번 (정한 뒤엔 바꾸지 않음), 비밀번호가 있으면 지금 비밀번호로 확인
    if(!wallet.signedIn()) return {ok:false,error:'NOACCT'};
    const a=au(); if(a&&a.id) return {ok:false,error:'ID_SET'};
    const c=checkId(v); if(!c.ok) return c;
    if(a&&a.hash){
      const r=await pwOk(a,cur); if(r===null) return {ok:false,error:'NOCRYPTO'};
      if(!r) return {ok:false,error:'WRONG_CUR'};
      if(cur.toLowerCase()===c.id) return {ok:false,error:'ID_PW'};   // 비밀번호와 같은 아이디면 아이디만 알아도 들어옴
    }
    if(au()!==a||!wallet.signedIn()) return {ok:false,error:'RETRY'};   // 확인하는 사이 다른 탭에서 로그인 정보가 바뀜
    (a||newAuth()).id=c.id; saveAuth();
    wallet.log('🪪 로그인 아이디를 정했어요');
    emit('account');
    return {ok:true,id:c.id};
  },
  async setPw(cur,next){   // 비밀번호 바꾸기 — 아직 없으면(옛 계정) 지금 비밀번호 없이 정하기
    if(!wallet.signedIn()) return {ok:false,error:'NOACCT'};
    const a=au();
    const k=checkPw(next,a&&a.id,profile().name); if(!k.ok) return k;
    const first=!(a&&a.hash);
    if(!first){
      const r=await pwOk(a,cur); if(r===null) return {ok:false,error:'NOCRYPTO'};
      if(!r) return {ok:false,error:'WRONG_CUR'};
      if(cur===next) return {ok:false,error:'PW_SAME'};
    }
    const h=await makePw(next); if(!h) return {ok:false,error:'NOCRYPTO'};
    if(au()!==a||!wallet.signedIn()) return {ok:false,error:'RETRY'};
    Object.assign(a||newAuth(),h); saveAuth();
    wallet.log(first?'🔒 계정 비밀번호를 정했어요':'🔒 계정 비밀번호를 바꿨어요');
    emit('account');
    return {ok:true,first};
  },
  resetAccount(){   // 비밀번호를 잊었을 때: 계정과 내 오피스 기록(프로필·다이어리·최근 소식)을 지우고 게스트로 — 가방(금화·아이템)·코브 색은 남김
    auth=null; saveAuth();
    raw.account=null; raw.profile=null; raw.diary=null; raw.log=null; save(); emit('*');
  },
  exportState(){ return JSON.parse(JSON.stringify(raw)); },   // '내 기록 파일로 저장'용 복사본 — 로그인 정보(아이디·비밀번호 해시)는 따로 저장해서 안 들어감 (파일이 남에게 가도 비밀번호를 맞혀 보지 못하게)
  coveName(){ return wallet.signedIn()?profile().name:'코브'; },   // 들판 주인공 코브의 이름 — 로그인 중이면 내 닉네임
  COUPON_COINS, COUPON_WON, ITEM_MAX, ID_MIN, ID_MAX, NICK_MIN, NICK_MAX, PW_MIN, PW_MAX,
};
window.covvWallet=wallet;

/* 게스트 번호: 로그인 전까지 이 브라우저의 내 계정을 가리키는 번호 (예: CV-7F3K2Q) */
function newUid(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r='';
  try{ const b=new Uint8Array(6); crypto.getRandomValues(b); b.forEach(x=>{ r+=A[x%A.length]; }); }
  catch(e){ for(let i=0;i<6;i++) r+=A[Math.floor(Math.random()*A.length)]; }
  return 'CV-'+r;
}

/* 방문 기록 (내 오피스의 TODAY · TOTAL · 지난 방문) */
(()=>{
  const v=visits(), d=today();
  wallet.uid();
  if(!v.first) v.first=d;
  if(v.last!==d){ if(v.last) v.prev=v.last; v.last=d; v.today=0; v.days++; }
  v.today++; v.total++;
  save();
})();

// 해커님께 드리는 인사 ㅋㅋ — 먼저 '남이 준 코드 붙여 넣기' 사기(Self-XSS) 경고부터
try{
  console.log('%c잠깐! ✋','font:700 26px sans-serif;color:#d33');
  console.log('%c누가 "여기에 이 코드를 붙여 넣으면 금화·쿠폰·한정판을 준다"고 했다면 사기예요.\n남이 준 코드는 내 일기와 기록을, 나중에는 계정까지 몰래 빼 갈 수 있어요. 모르는 코드는 붙여 넣지 마세요.','font:600 14px sans-serif;color:#d33');
  console.log('%c🕶️ 코브 몰 해커님 환영해요','font:700 16px sans-serif;color:#ec5c9f');
  console.log('공식 장난은 이 한 줄뿐이에요 → covvWallet.state.coin = 9999\n(가방은 아이템마다 최대 9,999개, 할인은 키링 1개당 최대 100원이에요 ㅋㅋ)');
}catch(e){}

/* ── 알림 (화면 아래 잠깐 떴다 사라짐) ── */
const toastEl=document.getElementById('covvToast');
let toastT=null;
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent=msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'),2800);
}

/* 첫 방문 선물: 게임을 안 해도 하트·별을 바로 눌러 볼 수 있게 */
if(!raw.gift){
  state.gift=true; wallet.add('heart',3); wallet.add('star',1);
  wallet.log('🎁 첫 방문 선물로 하트 3개와 별 1개를 받았어요');
  setTimeout(()=>toast('🎁 첫 방문 선물! 하트 3개와 별 1개를 가방에 넣어 드렸어요'),3200);
}

/* ── 가방 숫자 표시: 아이템은 최대 9,999개라 그대로 1,234처럼 (자르는 건 get()이 함) ── */
const short=v=>num(v).toLocaleString('ko-KR');
wallet.short=short; window.covvToast=toast;

/* ── 할인 쿠폰 표시 (코브 몰 · 내 오피스 가방이 같은 문구를 씀) ── */
function couponView(){
  const c=wallet.get('coin'), n=R.coupons(c), next=R.coinsToNext(c);
  if(!n) return {n, text:`🎟️ 금화 ${COUPON_COINS}개를 모으면 키링 1개 ${COUPON_WON}원 할인`, num:`${c} / ${COUPON_COINS}`, fill:c/COUPON_COINS*100};
  if(!next) return {n, text:`🎟️ 할인 쿠폰 ${n}장 · 최대예요`, num:'', fill:100};
  return {n, text:`🎟️ 할인 쿠폰 ${n}장 · 키링 ${n}개 ${COUPON_WON}원씩 할인`, num:`다음 ${c%COUPON_COINS} / ${COUPON_COINS}`, fill:c%COUPON_COINS/COUPON_COINS*100};
}
// 할인 규칙 — 나중에 '금화 사라졌어요 · 환불 얼마예요' 같은 문의가 오지 않게 미리 적어 둠
const RULES=[
  `금화 ${COUPON_COINS}개마다 할인 쿠폰 1장이 생겨요. 쿠폰 1장으로 키링 1개를 ${COUPON_WON}원 할인받아요. <b>키링 1개에는 쿠폰 1장까지</b>예요.`,
  `가방에는 아이템마다 최대 ${ITEM_MAX.toLocaleString('ko-KR')}개까지 담겨서 쿠폰은 최대 ${R.coupons(ITEM_MAX)}장이에요. 해킹해도 여기까지 ㅋㅋ`,
  `쓴 쿠폰만큼의 금화는 <b>결제가 끝난 뒤에</b> 빠져요. 결제를 그만두거나 실패하면 금화는 그대로예요.`,
  `배송비는 할인되지 않아요. ${R.COUPON_MIN_PRICE.toLocaleString('ko-KR')}원보다 싼 상품도 할인에서 빠져요.`,
  `반품하면 할인받은 금액을 뺀 만큼 환불되고, 쓴 금화는 돌아오지 않아요.`,
  `금화는 <b>이 브라우저에만</b> 저장돼요. 인터넷 사용 기록을 지우면 사라지고, 다른 기기나 브라우저에서는 보이지 않아요. 사파리(아이폰·아이패드·맥)는 7일 넘게 들르지 않으면 지워질 수도 있어요. <b>사라진 금화는 복구해 드릴 수 없어요.</b>`,
  `금화는 돈으로 바꾸거나 다른 사람에게 줄 수 없어요.`,
  `할인 규칙은 가게가 열리기 전에 바뀔 수 있어요.`,
];
const rulesHTML=()=>`<details class="deal-rules"><summary>🎟️ 할인 규칙 자세히 보기</summary><ul>${RULES.map(t=>`<li>${t}</li>`).join('')}</ul></details>`;
wallet.couponView=couponView; wallet.rulesHTML=rulesHTML;

/* ── 들판 오른쪽 위 작은 가방 표시 ── */
const hud=document.getElementById('bagHud');
const hudN={};
if(hud) hud.querySelectorAll('[data-n]').forEach(el=>{ hudN[el.dataset.n]=el; });
function paintHud(k){
  for(const n in hudN){
    const v=wallet.get(n), el=hudN[n], s=short(v);
    if(el.textContent!==s){
      el.textContent=s;
      if(k===n){ el.parentElement.classList.remove('bump'); void el.parentElement.offsetWidth; el.parentElement.classList.add('bump'); }
    }
  }
}
paintHud();
wallet.on(paintHud);

/* ── 들판 제목 위 쇼핑 안내: 몇 초마다 문구가 바뀜 (내 금화 진행도도 보여 줌) ── */
const promoText=document.getElementById('promoText');
if(promoText){
  const lines=()=>{
    const c=wallet.get('coin'), n=R.coupons(c);
    return [
      '💰 금화를 모아서 쇼핑하세요!',
      n?`🎟️ 할인 쿠폰 ${n}장 모았어요!`:`🎟️ 100원 할인까지 금화 ${COUPON_COINS-c}개!`,
      '💰 금화 주머니 하나면 금화 10개!',
      '🛍️ 코브 몰에서 키링 구경하기',
      '💗 하트로 좋아하는 키링을 응원해요',
    ];
  };
  let pi=0;
  setInterval(()=>{
    if(document.hidden||document.body.classList.contains('screen-open')) return;   // 들판이 안 보이면 쉼
    const L=lines(); pi=(pi+1)%L.length;
    promoText.classList.add('swap');
    setTimeout(()=>{ promoText.textContent=L[pi]; promoText.classList.remove('swap'); },220);
  },4000);
}

/* ── 소개 화면의 아이템 안내: 숫자·확률을 실제 설정(결제 규칙 · 들판 드롭)에서 채움 ── */
// 공개한 확률이 실제와 다르면 신뢰를 잃음 → HTML 숫자는 기본값일 뿐, 화면이 열릴 때 설정값으로 덮어씀
(()=>{
  const box=document.getElementById('itemGuide');
  if(!box) return;
  const pct=p=>`${Math.round(p*1000)/10}%`;   // .30004 → 30%, .0962 → 9.6%
  function paint(){
    const F=window.covvField, d=F&&F.drops?F.drops():null;   // WebGL이 없으면 들판이 없음 → 확률은 HTML 기본값 그대로
    const v={coupon:COUPON_COINS, won:COUPON_WON, bag:ITEM_MAX, heart:DAY_HEART, star:DAY_STAR, candy:DECO_CANDY, gem:GEM_EARLY};
    if(d){ v.pouch=d.pouchCoins; v.rainbow=Math.round(1/d.rainbow); }
    box.querySelectorAll('[data-v]').forEach(e=>{ const x=v[e.dataset.v]; if(x!=null) e.textContent=x.toLocaleString('ko-KR'); });
    if(d) box.querySelectorAll('[data-rate]').forEach(e=>{ const p=d.rate[e.dataset.rate]; if(p!=null) e.textContent=pct(p); });
  }
  addEventListener('covv-screen',e=>{ if(e.detail==='about') paint(); });
})();

/* ══════════ 키링 그림 (아크릴 키링 느낌의 SVG) ══════════ */
let svgSeq=0;
function coveSVG(color,variant,opts={}){   // opts.plain: 고리·아크릴 테두리 없이(프로필 사진용), opts.shades: 해커 선글라스
  const id='k'+(++svgSeq);
  const rainbow=variant==='rainbow';
  const fill=rainbow?`url(#${id}r)`:color;
  const eyes=variant==='sleepy'
    ? `<path d="M44 90 q6 5 12 0 M64 90 q6 5 12 0" fill="none" stroke="#171220" stroke-width="3" stroke-linecap="round"/>
       <text x="92" y="58" font-size="16" font-weight="700" fill="#6a4fb0" font-family="Gaegu,sans-serif">z z</text>`
    : `<ellipse cx="50" cy="90" rx="5" ry="6" fill="#171220"/><ellipse cx="70" cy="90" rx="5" ry="6" fill="#171220"/>
       <circle cx="48.3" cy="87.6" r="1.7" fill="#fff"/><circle cx="68.3" cy="87.6" r="1.7" fill="#fff"/>`;
  // 코브 몸 (귀 · 몸 · 앞발 · 발)
  const body=f=>`<circle cx="33" cy="66" r="13" fill="${f}"/><circle cx="87" cy="66" r="13" fill="${f}"/>
    <circle cx="60" cy="92" r="34" fill="${f}"/>
    <circle cx="27" cy="104" r="10" fill="${f}"/><circle cx="93" cy="104" r="10" fill="${f}"/>
    <ellipse cx="46" cy="125" rx="12" ry="7" fill="${f}"/><ellipse cx="74" cy="125" rx="12" ry="7" fill="${f}"/>`;
  let top=`<circle cx="60" cy="16" r="10" fill="none" stroke="#b9b3c4" stroke-width="4"/>
    <rect x="57.5" y="25" width="5" height="14" rx="2.5" fill="#b9b3c4"/>`;
  let extraBack='', extraFront='';
  if(variant==='para'){   // 낙하산 코브
    top=`<circle cx="60" cy="8" r="7" fill="none" stroke="#b9b3c4" stroke-width="3.5"/>`;
    extraBack=`<path d="M14 50 Q60 -4 106 50 Z" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>
      <path d="M14 50 Q60 -4 106 50 Z" fill="${color}"/>
      <path d="M60 14 L42 50 M60 14 L78 50" stroke="#fff4f8" stroke-width="7"/>
      <path d="M18 50 L27 98 M40 50 L30 96 M102 50 L93 98 M80 50 L90 96" stroke="#6b4a5e" stroke-width="1.6"/>`;
  }
  if(variant==='bubble'){   // 거품 속 코브
    extraFront=`<circle cx="60" cy="92" r="54" fill="url(#${id}b)" stroke="rgba(255,255,255,.9)" stroke-width="2.5"/>
      <path d="M26 70 A40 40 0 0 1 52 44" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
    top=`<circle cx="60" cy="14" r="9" fill="none" stroke="#b9b3c4" stroke-width="4"/><rect x="57.5" y="22" width="5" height="16" rx="2.5" fill="#b9b3c4"/>`;
  }
  if(variant==='scarf'){
    extraFront=`<path d="M30 106 Q60 118 90 106 L90 114 Q60 126 30 114 Z" fill="#e8584f"/><rect x="72" y="112" width="10" height="20" rx="3" fill="#e8584f"/>`;
  }
  if(variant==='astro'){
    extraFront=`<circle cx="60" cy="86" r="46" fill="rgba(190,225,255,.28)" stroke="#dfe6f0" stroke-width="5"/>
      <path d="M30 64 A34 34 0 0 1 50 48" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 120 150" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff9ccb"/><stop offset=".3" stop-color="#ffe27a"/><stop offset=".55" stop-color="#8fe3c4"/><stop offset=".8" stop-color="#8cc8ff"/><stop offset="1" stop-color="#c3a6ff"/>
      </linearGradient>
      <radialGradient id="${id}b" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".75" stop-color="#d8edff" stop-opacity=".25"/><stop offset="1" stop-color="#c3a6ff" stop-opacity=".55"/>
      </radialGradient>
    </defs>
    ${opts.plain?'':top}
    ${extraBack}
    ${opts.plain?'':`<g stroke="#fff" stroke-width="12" stroke-linejoin="round">${body('#fff')}</g>
    <circle cx="60" cy="44" r="6" fill="#fff" stroke="#fff" stroke-width="8"/>
    <circle cx="60" cy="44" r="3.2" fill="none" stroke="#e5dde9" stroke-width="1.5"/>`}
    ${body(fill)}
    <ellipse cx="41" cy="101" rx="5.5" ry="3.2" fill="#ff7aa8" opacity=".35"/><ellipse cx="79" cy="101" rx="5.5" ry="3.2" fill="#ff7aa8" opacity=".35"/>
    ${eyes}
    ${opts.shades?`<rect x="39" y="83" width="19" height="13" rx="4" fill="#1a1424"/><rect x="62" y="83" width="19" height="13" rx="4" fill="#1a1424"/><rect x="56" y="86" width="8" height="3" fill="#1a1424"/><rect x="42" y="85" width="6" height="2.5" rx="1" fill="#fff" opacity=".5"/>`:''}
    <ellipse cx="60" cy="100" rx="3.6" ry="2.6" fill="#2a1418"/>
    ${extraFront}
  </svg>`;
}

/* ══════════ 코브 몰 화면 ══════════ */
// 진열대: 한정판(그린 코브, 들판 무지개 코브와 이어짐)은 맨 위 카드, 나머지는 배경 지운 키링 사진(images/stall 300×300)을 종이로 오려 붙인 모양
// (지금 사진 20장은 테스트용 남의 상품 → 공개 전 실제 상품 사진·이름으로 바꿀 것. 하트 기록은 id로 남으니 id는 상품마다 새로. 들판 가판대는 앞 5장만 field.js에 따로)
// 진열 순서 = '추천' 정렬. sold·reviews는 '판매량'·'리뷰 많은' 정렬에만 쓰는 예시 숫자(화면엔 안 보임), day = 진열대에 올린 날('NEW' 정렬)
// 상품 창 큰 사진 아래: shots:['images/…'] = 사진 몇 장(차례로), story:'…' = 상품 소개 글(\n = 문단 나눔). 없으면 빈 사진 자리 · 짧은 소개(desc)만 (✏️ 직접 넣으세요, OPTIONS 종류마다 따로 줘도 됨)
const PRODUCTS=[
  {id:'rainbow',   name:'무지개 코브 키링',   color:'#ff9ccb', bg:'#fff4d6', variant:'rainbow', tag:'한정', limited:true, desc:'히든 물감을 먹고 무지개 코브가 된 사람만 살 수 있어요. 보석 3개를 모으면 출시 첫날 먼저 살 수 있어요.'},
  {id:'tiger',     name:'주황 호랑이 키링',   img:'images/stall/keyring-1.webp',  paper:'#ffb98a', price:12000, sold:132, reviews:24, day:'2026-10-2', tag:'NEW', desc:'도넛 참을 단 주황 호랑이. 손을 흔들며 인사해요.'},
  {id:'violet',    name:'보라 머리 소녀 키링', img:'images/stall/keyring-2.webp',  paper:'#c3a6ff', price:15000, sold:96,  reviews:41, day:'2026-10-2',            desc:'금빛 동전 참이 함께 달린 에나멜 키링.'},
  {id:'squirrel',  name:'도토리 다람쥐 키링', img:'images/stall/keyring-3.webp',  paper:'#ffe27a', price:11000, sold:58,  reviews:12, day:'2026-10-2',            desc:'도토리와 단풍잎 참을 단 금빛 다람쥐.'},
  {id:'dino',      name:'초록 공룡 키링',     img:'images/stall/keyring-4.webp',  paper:'#8fe3c4', price:9000,  sold:210, reviews:37, day:'2026-10-2',            desc:'볼이 발그레한 초록 공룡 아크릴 키링.'},
  {id:'fox',       name:'무지개 여우 키링',   img:'images/stall/keyring-5.webp',  paper:'#8cc8ff', price:13000, sold:74,  reviews:33, day:'2026-10-2', tag:'NEW', desc:'버섯·클로버 참을 단 알록달록 펠트 여우.'},
  {id:'flower5',   name:'5잎 솜 키링',        img:'images/stall/keyring-6.webp',  paper:'#9fe0b0', price:12000, sold:88,  reviews:19, day:'2026-10-5',            desc:'폭신한 검정 꽃잎 다섯 장에 초록 받침을 댄 솜 키링.'},
  {id:'leatherdog',name:'가죽 강아지 키링',   img:'images/stall/keyring-7.webp',  paper:'#ffc08a', price:14000, sold:47,  reviews:15, day:'2026-10-5',            desc:'주황 가죽 강아지와 땋은 가죽 고리.'},
  {id:'clover',    name:'네잎클로버 키링',    img:'images/stall/keyring-8.webp',  paper:'#c9e89a', price:9000,  sold:163, reviews:28, day:'2026-10-5',            desc:'매트한 검정 네잎클로버에 주황 가죽 태그를 달았어요.'},
  {id:'metalkuma', name:'메탈 쿠마 키링',     img:'images/stall/keyring-9.webp',  paper:'#c9c6cf', price:15000, sold:69,  reviews:22, day:'2026-10-5',            desc:'은빛 메탈 곰과 검정 땋은 끈 고리.'},
  {id:'blackcat',  name:'블랙캣 키링',        img:'images/stall/keyring-10.webp', paper:'#ffd9a8', price:16000, sold:121, reviews:52, day:'2026-10-5',            desc:'빨간 줄무늬 목도리를 두른 털복숭이 검은 고양이 인형.'},
  {id:'blackkuma', name:'블랙 쿠마 키링',     img:'images/stall/keyring-11.webp', paper:'#ff9b9b', price:15000, sold:54,  reviews:9,  day:'2026-10-5',            desc:'검정 곰과 땋은 가죽 끈, 로고 태그가 함께 달려요.'},
  {id:'bluekuma',  name:'블루스타 쿠마 키링', img:'images/stall/keyring-12.webp', paper:'#9fd3ff', price:18000, sold:38,  reviews:17, day:'2026-10-5',            desc:'파란 큐빅이 촘촘히 박힌 곰과 술 장식.'},
  {id:'redheart',  name:'빨강 하트 키링',     img:'images/stall/keyring-13.webp', paper:'#ffb3cf', price:11000, sold:102, reviews:31, day:'2026-10-5',            desc:'빨간 하트 참과 구슬 줄, 리본을 엮은 체인 키링.'},
  {id:'shaun',     name:'숀더쉽 키링',        img:'images/stall/keyring-14.webp', paper:'#ffe27a', price:13000, sold:85,  reviews:44, day:'2026-10-5',            desc:'복슬복슬 흰 털옷을 입은 양 인형 키링.'},
  {id:'amulet',    name:'액운 방지 키링',     img:'images/stall/keyring-15.webp', paper:'#cfe8c4', price:12000, sold:29,  reviews:6,  day:'2026-10-5',            desc:'흰 옥과 초록 옥 매듭 장식. 나쁜 기운을 막아 준대요.'},
  {id:'carmodel',  name:'자동차 모형 키링',   img:'images/stall/keyring-16.webp', paper:'#d6dbe6', price:10000, sold:77,  reviews:20, day:'2026-10-5',            desc:'좋아하는 차를 고르는 아크릴 자동차 키링.'},
  {id:'carkey',    name:'자동차용 키링',      img:'images/stall/keyring-17.webp', paper:'#e3d2bd', price:9000,  sold:140, reviews:26, day:'2026-10-5',            desc:'땋은 검정 가죽 끈과 큰 고리, 자동차 키에 잘 어울려요.'},
  {id:'dice',      name:'주사위 키링',        img:'images/stall/keyring-18.webp', paper:'#c3a6ff', price:11000, sold:63,  reviews:14, day:'2026-10-5',            desc:'8번 공과 주사위를 주렁주렁 단 체인 키링.'},
  {id:'keycap',    name:'키보드 키링',        img:'images/stall/keyring-19.webp', paper:'#ffd1b3', price:14000, sold:91,  reviews:38, day:'2026-10-5',            desc:'고양이 키캡 다섯 개를 눌러 볼 수 있는 미니 키보드.'},
  {id:'pinkjade',  name:'핑크 옥 키링',       img:'images/stall/keyring-20.webp', paper:'#ffc4d6', price:12000, sold:44,  reviews:11, day:'2026-10-5',            desc:'분홍 옥 고리와 흰 옥 꽃을 매듭으로 엮었어요.'},
];   // price·sold·reviews는 예시 (✏️ 주인님이 정하면 직접 수정) — 화면 표시·정렬용, 실제 결제 금액은 결제 서버의 가격표로 다시 계산. 가게가 열리면 sold·reviews는 서버의 실제 숫자로
// 상품 창 '색상 · 캐릭터 선택' 칸: 상품 id → 그 키링의 종류. 첫 줄 = 진열대에 붙은 그 상품(id 같음, 이름·색은 PRODUCTS 그대로)
// 장바구니·주문서·가격표는 종류 id로 셈 (가격은 price를 따로 안 적으면 기본 상품과 같음) → 결제 서버 가격표에도 같은 id로 넣을 것
// (✏️ 지금 종류 이름·색은 예시: 종류별 사진이 생기면 img:'images/…'를 넣고 이름·색도 직접 수정하세요. img가 없으면 기본 사진 + paper 색 칸)
const OPTIONS={
  tiger:[
    {id:'tiger'},
    {id:'tiger-white',    name:'흰 호랑이 키링',          paper:'#ece6dc'},
    {id:'tiger-black',    name:'검정 호랑이 키링',        paper:'#a59cab'},
    {id:'tiger-pink',     name:'분홍 호랑이 키링',        paper:'#ffb3cf'},
    {id:'tiger-sky',      name:'하늘 호랑이 키링',        paper:'#9fd3ff'},
  ],
  violet:[
    {id:'violet'},
    {id:'violet-red',     name:'빨강 머리 소녀 키링',     paper:'#ff9b9b'},
    {id:'violet-blue',    name:'파랑 머리 소녀 키링',     paper:'#8fb6ff'},
    {id:'violet-pink',    name:'분홍 머리 소녀 키링',     paper:'#ffb3d9'},
    {id:'violet-mint',    name:'민트 머리 소녀 키링',     paper:'#8fe3c4'},
  ],
  squirrel:[
    {id:'squirrel'},
    {id:'squirrel-brown', name:'갈색 다람쥐 키링',        paper:'#d9b08c'},
    {id:'squirrel-gray',  name:'회색 다람쥐 키링',        paper:'#c9c6cf'},
    {id:'squirrel-white', name:'흰 다람쥐 키링',          paper:'#f1ece2'},
    {id:'squirrel-pink',  name:'분홍 다람쥐 키링',        paper:'#ffc4d6'},
  ],
  dino:[
    {id:'dino'},
    {id:'dino-pink',      name:'분홍 공룡 키링',          paper:'#ffb3cf'},
    {id:'dino-blue',      name:'파랑 공룡 키링',          paper:'#8fb6ff'},
    {id:'dino-yellow',    name:'노랑 공룡 키링',          paper:'#ffe27a'},
    {id:'dino-purple',    name:'보라 공룡 키링',          paper:'#c3a6ff'},
  ],
  fox:[
    {id:'fox'},
    {id:'fox-red',        name:'빨강 여우 키링',          paper:'#ff9b8a'},
    {id:'fox-white',      name:'흰 여우 키링',            paper:'#ece6dc'},
    {id:'fox-pink',       name:'분홍 여우 키링',          paper:'#ffb3d9'},
    {id:'fox-yellow',     name:'노랑 여우 키링',          paper:'#ffe27a'},
  ],
};
// 진열대 정렬 탭 [키, 이름] — '추천' = PRODUCTS 순서 그대로, 같은 값끼리도 추천 순서를 지킴
const SORTS=[['pick','추천'],['low','낮은가격'],['high','높은가격'],['review','리뷰 많은'],['sold','판매량'],['new','NEW']];
const RETIRED={pink:'분홍 코브 키링',sky:'하늘 코브 키링',mint:'민트 코브 키링',lav:'라벤더 코브 키링',para:'낙하산 코브 키링',bubble:'거품 속 코브 키링'};   // 진열대에서 내려간 상품 이름 (하트 기록이 남아 있어 내 오피스 '응원한 키링' 목록에 씀)
const VOTES=[
  {id:'sleepy', name:'잠꾸러기 코브', color:'#c3a6ff', variant:'sleepy', desc:'눈 감고 쿨쿨'},
  {id:'scarf',  name:'목도리 코브',   color:'#ffb98a', variant:'scarf',  desc:'겨울에 어울리는'},
  {id:'astro',  name:'우주복 코브',   color:'#e9edf5', variant:'astro',  desc:'헬멧 속 코브'},
];
const BAG=[
  {k:'coin',  label:'금화',  dot:'#f2a93b'},
  {k:'heart', label:'하트',  dot:'#ff6fa8'},
  {k:'star',  label:'별',    dot:'#ffd24a'},
  {k:'gem',   label:'보석',  dot:'#5fc8ea'},
  {k:'candy', label:'사탕',  dot:'#ff8fc0'},
];

// 내 오피스(myoffice.js)에서도 같은 그림·상품 목록을 씀
window.covvArt={coveSVG,PRODUCTS,OPTIONS,RETIRED,VOTES,BAG,GEM_EARLY,DAY_HEART,DAY_STAR,DECO_CANDY,tornClip};   // tornClip: 상품 창·주문서 썸네일의 찢은 색종이도 같은 모양 (checkout.js)

const root=document.getElementById('mallRoot');
if(!root) return;

// 하루 한도 기록 {총합, 오늘 준 개수, 날짜} — 콘솔에서 이상한 값을 넣어도 가게가 멈추지 않게 모양을 바로잡음
const bucket=k=>(raw[k]&&typeof raw[k]==='object'&&!Array.isArray(raw[k]))?raw[k]:(raw[k]={});
function rec(kind,id){
  const map=bucket(kind);
  let r=map[id];
  if(!r||typeof r!=='object') r=map[id]={total:0,today:0,day:''};
  r.total=num(r.total); r.today=num(r.today);
  if(r.day!==today()){ r.day=today(); r.today=0; }
  return r;
}

// 내 가방: 주문/결제 화면 맨 위 자리(covv.html #checkoutBag)에 그림 — 쿠폰을 쓰는 곳에서 바로 보이게
const bagRoot=document.getElementById('checkoutBag')||document.createElement('div');
bagRoot.innerHTML=`
  <section class="mall-block mall-bag" aria-labelledby="bagTitle">
    <h3 id="bagTitle">🎒 내 가방</h3>
    <ul class="bag-items">
      ${BAG.map(b=>`<li><span class="dot"></span><span class="bag-label">${b.label}</span><strong data-bag="${b.k}">0</strong></li>`).join('')}
    </ul>
    <div class="coupon">
      <div class="coupon-row"><span id="couponText"></span><span class="coupon-num" id="couponNum"></span></div>
      <div class="coupon-track" aria-hidden="true"><div class="coupon-fill" id="couponFill"></div></div>
      <p class="fine">쿠폰은 가게가 열리면 결제할 때 써요. 금화를 아무리 많이 모아도(해킹해도 ㅋㅋ) 할인은 키링 1개당 최대 ${COUPON_WON}원이에요.</p>
      ${rulesHTML()}
    </div>
    <ul class="badges" id="badges"></ul>
  </section>`;

root.innerHTML=`
  <div class="mall-top">
    <div class="mall-sort" role="group" aria-label="키링 정렬">
      ${SORTS.map(([k,t])=>`<button type="button" data-sort="${k}" aria-pressed="${k==='pick'}">${t}</button>`).join('')}
    </div>
    <button type="button" class="mall-cart" data-cart>🛒 장바구니 <b data-cart-n>0</b></button>
  </div>

  <section class="mall-block" aria-label="키링 진열대">
    <div class="kr-board">
      ${PRODUCTS.filter(p=>p.img).map(p=>`
      <article class="kr cut" data-p="${p.id}">
        <div class="kr-card">
          <button type="button" class="kr-pic" data-open aria-label="${p.name} 자세히 보기 · 구매">
            <span class="kr-paper" aria-hidden="true"></span>
            <img src="${p.img}" alt="${p.name} 사진" width="300" height="300" loading="lazy" decoding="async">
            <span class="kr-tape" aria-hidden="true"></span>
            ${p.tag?`<span class="kr-stamp">${p.tag}</span>`:''}
          </button>
          <div class="kr-slip"><div class="kr-label">
            <h4>${p.name}</h4>
            <div class="kr-row">
              <span class="kr-count" title="내가 준 하트">♥ <b data-given>0</b></span>
              <button type="button" class="kr-btn" data-heart>하트 선물</button>
            </div>
            <button type="button" class="kr-buy go" data-open>자세히 · 구매</button>
          </div></div>
        </div>
      </article>`).join('')}
    </div>
  </section>

  <section class="mall-block" aria-labelledby="voteTitle">
    <h3 id="voteTitle">⭐ 다음 키링 투표</h3>
    <p class="fine">별을 걸어 다음에 만들 키링을 골라 주세요. 한 후보에 하루 ${DAY_STAR}개까지예요.</p>
    <div class="votes">
      ${VOTES.map(v=>`
      <article class="vt" data-v="${v.id}">
        <div class="vt-art">${coveSVG(v.color,v.variant)}</div>
        <div class="vt-body">
          <h4>${v.name}</h4><p>${v.desc}</p>
          <div class="kr-row"><span class="kr-count" title="내가 건 별">★ <b data-voted>0</b></span><button type="button" class="kr-btn star" data-star>별 걸기</button></div>
        </div>
      </article>`).join('')}
    </div>
  </section>

  <section class="mall-block" aria-labelledby="decoTitle">
    <h3 id="decoTitle">🍬 사탕으로 코브 꾸미기</h3>
    <p class="fine">사탕 ${DECO_CANDY}개로 들판의 내 코브 색을 바꿀 수 있어요. 무지개는 무지개 코브가 된 적이 있어야 열려요.</p>
    <div class="swatches" id="swatches"></div>
  </section>
`;

// 색은 HTML의 style="" 대신 여기서 칠함 (CSP가 style 속성을 막음 — el.style로 넣는 건 괜찮음)
bagRoot.querySelectorAll('.bag-items .dot').forEach((d,i)=>{ d.style.background=BAG[i].dot; });
// 찢은 종이 가장자리 (clip-path 다각형, 씨앗 고정이라 열 때마다 같은 모양) — 진열대 색종이 · 이름표는 윗변만, 상품 창 · 주문서 색종이는 네 변 들쭉날쭉
function tornClip(seed,top,sides){
  let s=seed; const r=()=>(s=(s*9301+49297)%233280)/233280, j=v=>(v*r()).toFixed(1), pts=[];
  for(let x=0;x<=100;x+=6) pts.push(`${x}% ${j(top)}%`);
  for(let y=6;y<=100;y+=6) pts.push(`${(100-j(sides))}% ${y}%`);
  for(let x=94;x>=0;x-=6) pts.push(`${x}% ${100-j(sides)}%`);
  for(let y=94;y>0;y-=6) pts.push(`${j(sides)}% ${y}%`);
  return `polygon(${pts.join(',')})`;
}
// 진열대 콜라주: 상품마다 크기(3배 · 1.5배 · 0.5배 · 그대로)와 기울기(반은 0~20도, 반은 0~-20도)를 섞어 정함
// 씨앗 고정 → 새로고침해도 같은 배치, 정렬을 바꿔도 카드를 따라감
const KR_SIZE=[['big',2],['mid',4],['mini',4]];   // [크기, 장수] — 나머지는 지금 크기
const KR_TURN=20;                                  // 기울기 최대(도) — 카드마다 0~20 사이, 반은 반대쪽(0~-20)
function shuffled(n,seed){ let s=seed; const r=()=>(s=(s*9301+49297)%233280)/233280, a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
(()=>{
  const ks=[...root.querySelectorAll('.kr.cut')], look=ks.map(()=>({size:'',turn:0}));
  let at=0; const bySize=shuffled(ks.length,23);
  for(const [cls,n] of KR_SIZE) for(let j=0;j<n&&at<bySize.length;j++) look[bySize[at++]].size=cls;
  let s=97; const r=()=>(s=(s*9301+49297)%233280)/233280;
  shuffled(ks.length,41).forEach((i,j)=>{ look[i].turn=Math.round(r()*KR_TURN)*(j%2?-1:1); });   // 섞은 순서로 번갈아 + · - → 양쪽이 반씩
  ks.forEach((k,i)=>{
    const L=look[i]; if(L.size) k.classList.add(L.size); if(Math.abs(L.turn)>10) k.classList.add('turn');
    k.style.setProperty('--tilt',L.turn+'deg'); k.style.setProperty('--dy',(i*29+11)%53+'px');   // --dy: 위 여백을 0~52px로 조금씩 달리 (나란히 줄 서 보이지 않게, 높낮이가 엇갈려 빈 곳이 숨 쉼)
    if(L.size==='big'||L.size==='mid'){ const im=k.querySelector('.kr-pic img'); if(im){ const src=im.getAttribute('src'); im.onerror=()=>{ im.onerror=null; im.src=src; }; im.src=src.replace(/\.webp$/,'-l.webp'); } }   // 큰 카드는 고해상도 사본(images/stall/keyring-N-l.webp, 최대 720px) — 300px 사진을 늘리면 흐려짐, 사본이 없으면 원래 사진으로
  });
})();
root.querySelectorAll('.kr.cut').forEach((k,i)=>{
  const p=PRODUCTS.find(x=>x.id===k.dataset.p); if(!p) return;
  const paper=k.querySelector('.kr-paper'); paper.style.background=p.paper; paper.style.clipPath=tornClip(17+i*131,4,0);   // 윗변만 찢음 — 양옆·아래는 곧게 해서 이름표와 한 장으로 이어지게
  k.querySelector('.kr-label').style.clipPath=tornClip(911+i*71,5,0);
});

const $=s=>root.querySelector(s);
const bagEls={}; bagRoot.querySelectorAll('[data-bag]').forEach(el=>{ bagEls[el.dataset.bag]=el; });
const $b=s=>bagRoot.querySelector(s);

// 내 가방 (주문/결제 화면 맨 위)
function paintBag(){
  for(const k in bagEls){ const v=wallet.get(k); bagEls[k].textContent=short(v); bagEls[k].title=v.toLocaleString('ko-KR'); }
  // 쿠폰
  const c=wallet.get('coin'), cv=couponView();
  $b('#couponText').textContent=cv.text;
  $b('#couponNum').textContent=cv.num;
  $b('#couponFill').style.width=Math.min(100,cv.fill)+'%';
  // 뱃지
  const b=[];
  if(state.rainbow) b.push('🌈 무지개 코브가 되어 봤어요');
  if(wallet.get('gem')>=GEM_EARLY) b.push(`💎 한정판 먼저 사기 자격 (보석 ${GEM_EARLY}개)`);
  else b.push(`💎 보석 ${wallet.get('gem')} / ${GEM_EARLY} — 모으면 한정판 먼저 사기 자격`);
  if(c>=ITEM_MAX) b.push('🕶️ 해커 코브 ㅋㅋ (그래도 할인은 키링 1개당 100원)');
  $b('#badges').innerHTML=b.map(t=>`<li>${t}</li>`).join('');
}
function paintMall(){
  // 상품
  root.querySelectorAll('.kr').forEach(el=>{
    const id=el.dataset.p, r=rec('given',id), p=PRODUCTS.find(x=>x.id===id);
    el.querySelector('[data-given]').textContent=r.total;
    const btn=el.querySelector('[data-heart]');
    const locked=p.limited&&!state.rainbow;
    btn.disabled=locked||r.today>=DAY_HEART||wallet.get('heart')<1;
    btn.textContent=r.today>=DAY_HEART?'오늘은 여기까지!':wallet.get('heart')<1?'하트가 없어요':'하트 선물';
  });
  root.querySelectorAll('.vt').forEach(el=>{
    const r=rec('votes',el.dataset.v);
    el.querySelector('[data-voted]').textContent=r.total;
    const btn=el.querySelector('[data-star]');
    btn.disabled=r.today>=DAY_STAR||wallet.get('star')<1;
    btn.textContent=r.today>=DAY_STAR?'오늘은 여기까지!':wallet.get('star')<1?'별이 없어요':'별 걸기';
  });
  paintSwatches();
}

let swBuilt=false;
function paintSwatches(){
  const F=window.covvField, box=$('#swatches');
  if(!F){ if(!swBuilt) box.innerHTML='<p class="fine">들판이 열려야 꾸밀 수 있어요.</p>'; return; }
  if(!swBuilt){
    swBuilt=true;
    box.innerHTML=F.colors.map(c=>`<button type="button" class="sw" data-look="${c.name}"><span class="sw-dot"></span><span class="sw-name"></span></button>`).join('');
    box.querySelectorAll('.sw-dot').forEach((d,i)=>{ d.style.background=F.colors[i].hex||'linear-gradient(135deg,#ff9ccb,#ffe27a,#8fe3c4,#8cc8ff,#c3a6ff)'; });
  }
  const cur=F.coveColor(), candy=wallet.get('candy');
  box.querySelectorAll('.sw').forEach(b=>{
    const name=b.dataset.look, locked=name==='무지개'&&!state.rainbow, on=name===cur;
    b.classList.toggle('on',on);
    b.setAttribute('aria-pressed',String(on));
    b.disabled=!on&&(locked||candy<DECO_CANDY);   // 지금 색은 누를 수 있게 둠(아무 일도 안 일어남) → 포커스가 사라지지 않음
    b.setAttribute('aria-label',`${name} 코브${on?' (지금 색)':locked?' (잠김)':''}`);
    b.querySelector('.sw-name').textContent=(locked?'🔒 ':'')+name;
  });
}

// 하트 선물 · 별 걸기 · 색 고르기
function floatUp(btn,text){
  const s=document.createElement('span'); s.className='float-up'; s.textContent=text;
  btn.parentElement.appendChild(s); s.addEventListener('animationend',()=>s.remove());
}
root.addEventListener('click',e=>{
  const so=e.target.closest('[data-sort]');
  if(so){ if(so.dataset.sort!==sortKey) sortBoard(so.dataset.sort); return; }
  const h=e.target.closest('[data-heart]');
  if(h){
    const id=h.closest('.kr').dataset.p, p=PRODUCTS.find(x=>x.id===id), r=rec('given',id);
    if(p&&p.limited&&!state.rainbow) return;   // 잠긴 한정판
    if(r.today>=DAY_HEART||!wallet.spend('heart',1)) return;
    r.today++; r.total++; save(); floatUp(h,'♥ +1'); paintMall();
    const pic=h.closest('.kr').querySelector('.kr-pic'); if(pic){ pic.classList.remove('hop'); void pic.offsetWidth; pic.classList.add('hop'); }
    if(p) wallet.log(`💗 ${p.name}에 하트를 선물했어요`);
    return;
  }
  const st=e.target.closest('[data-star]');
  if(st){
    const id=st.closest('.vt').dataset.v, r=rec('votes',id);
    if(r.today>=DAY_STAR||!wallet.spend('star',1)) return;
    r.today++; r.total++; save(); floatUp(st,'★ +1'); paintMall();
    const v=VOTES.find(x=>x.id===id); if(v) wallet.log(`⭐ 다음 키링 투표: ${v.name}에 별을 걸었어요`);
    return;
  }
  const sw=e.target.closest('[data-look]');
  if(sw&&window.covvField){
    const name=sw.dataset.look;
    if(name==='무지개'&&!state.rainbow) return;
    if(name===window.covvField.coveColor()) return;   // 이미 이 색
    if(!wallet.spend('candy',DECO_CANDY)) return;
    if(window.covvField.setCoveColor(name)){ toast(`🎨 ${name} 코브로 변신! 들판으로 돌아가면 보여요`); wallet.log(`🍬 사탕으로 ${name} 코브가 됐어요`); }
    else wallet.add('candy',DECO_CANDY);   // 실패하면 사탕 돌려줌
    paintMall();
  }
});

// 가게 화면이 열려 있을 때만 다시 그림 (들판에서 아이템을 주울 때마다 다시 그릴 필요 없음)
let mallOpen=false, bagOpen=false;
wallet.on(()=>{ if(mallOpen) paintMall(); if(bagOpen) paintBag(); });
addEventListener('covv-screen',e=>{ mallOpen=e.detail==='mall'; bagOpen=e.detail==='checkout'; if(mallOpen) paintMall(); if(bagOpen) paintBag(); resetBoard(); });
// 종이 진열대는 카드가 화면에 들어올 때 한 장씩 붙음 — 20장(4줄)이라 보드 전체를 한 번에 틀면 아래 줄은 스크롤하기 전에 끝나 버림.
// 같이 들어온 카드끼리 앞에서부터 차례로, 가게를 다시 열거나 정렬을 바꾸면 처음부터
const board=$('.kr-board');
const cards=()=>board?[...board.querySelectorAll('.kr.cut')]:[];
const boardIO=board&&'IntersectionObserver' in window?new IntersectionObserver(es=>{
  const now=es.filter(x=>x.isIntersecting&&x.target.classList.contains('wait')).map(x=>x.target).sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1);   // 진열 순서대로 (4 = b가 a 뒤)
  now.forEach((k,i)=>{ boardIO.unobserve(k); k.style.setProperty('--i',i); k.classList.remove('wait'); k.classList.add('in'); });
},{rootMargin:'0px 0px -12% 0px'}):null;
// 카드마다 제 높이 + 위아래 간격(--gap-y)만큼 줄(8px)을 차지하게 → 3배 · 1.5배 · 0.5배 카드가 섞여도 간격이 고르게 쌓임 (글꼴이 오거나 폭 · 단추 글자가 바뀌어 높이가 변하면 다시)
const ROW=8, EDGE=6;   // grid-auto-rows와 같은 값 · 보드 끝에서 띄울 거리(px)
function packBoard(){
  const ks=cards(); if(!ks.length||!board.clientWidth) return;   // 화면이 닫혀 있으면(폭 0) 건너뜀
  const hs=ks.map(k=>k.offsetHeight);   // 읽기를 먼저 몰아서 → 줄 수를 쓸 때마다 레이아웃을 다시 재지 않게 (줄 수가 바뀌어도 카드 높이는 그대로: align-items: start)
  const g=parseFloat(getComputedStyle(board).getPropertyValue('--gap-y')), gy=isNaN(g)?84:g;   // 카드 사이 위아래 간격 (style.css --gap-y, 화면 폭마다 다름)
  ks.forEach((k,i)=>{ const n='span '+Math.ceil((hs[i]+gy)/ROW); if(k.style.gridRowEnd!==n) k.style.gridRowEnd=n; });
  // 꺾인 카드가 보드 밖(화면 밖)으로 삐져나가면 안쪽으로 밀어 넣음 — 기울인 모서리 폭을 계산으로 (붙는 연출 중 크기와 상관없게)
  // 꺾인 폭이 보드보다 넓으면 가운데로 (한쪽 끝만 맞추면 반대쪽이 화면 밖에서 잘림)
  const cw=board.clientWidth;
  const geo=ks.map(k=>{
    const tk=parseFloat(getComputedStyle(k).getPropertyValue('--tk'))||1;   // 기울기 배율 — 휴대폰 절반, 한 줄 가득 찬 3배 카드는 더 작게 (style.css --tk)
    const c=k.firstElementChild, a=parseFloat(k.style.getPropertyValue('--tilt'))*tk*Math.PI/180||0, w=c.offsetWidth, h=c.offsetHeight;
    const hw=(w*Math.abs(Math.cos(a))+h*Math.abs(Math.sin(a)))/2, cx=k.offsetLeft+k.offsetWidth/2;
    const nx=hw*2>cw-EDGE*2?cw/2-cx:cx-hw<EDGE?EDGE-(cx-hw):cx+hw>cw-EDGE?cw-EDGE-(cx+hw):0;
    const ox=k.offsetLeft+c.offsetLeft+w/2+nx, oy=k.offsetTop+c.offsetTop+h/2;   // 종이 가운데(보드 기준, 도는 축)
    const pts=[...k.querySelectorAll('.kr-btn,.kr-buy')].flatMap(b=>{   // 단추 가운데 · 양쪽(폭의 30%)을 종이와 같이 돌린 자리
      let x=b.offsetWidth/2-c.offsetLeft-w/2, y=b.offsetHeight/2-c.offsetTop-h/2; for(let e=b;e&&e!==k;e=e.offsetParent){ x+=e.offsetLeft; y+=e.offsetTop; }
      return [0,-.3,.3].map(f=>{ const px=x+f*b.offsetWidth; return [ox+px*Math.cos(a)-y*Math.sin(a),oy+px*Math.sin(a)+y*Math.cos(a)]; });
    });
    return {nx,ox,oy,w,h,a,pts};
  });
  // 꺾인 카드끼리 겹쳐 단추(하트 · 자세히)가 다른 카드 종이 밑에 깔리면 그 카드를 위로(--zi) — 터치는 마우스처럼 올려서 앞으로 꺼낼 수 없어서
  // 종이는 가장자리 4px을 뺀 사각형으로 봄(찢은 가장자리) · 서로의 단추를 덮는 짝은 더 많이 덮이는 쪽을 위로
  const under=(p,o)=>{ const dx=p[0]-o.ox, dy=p[1]-o.oy, u=dx*Math.cos(o.a)+dy*Math.sin(o.a), v=dy*Math.cos(o.a)-dx*Math.sin(o.a); return Math.abs(u)<o.w/2-4&&Math.abs(v)<o.h/2-4; };
  const hit=geo.map((g,i)=>geo.map((o,j)=>j===i?0:g.pts.filter(p=>under(p,o)).length));   // hit[i][j]: i의 단추 점 중 j 종이 밑에 놓인 수
  const z=ks.map(k=>k.classList.contains('turn')?0:1), above=(i,j)=>z[i]>z[j]||z[i]===z[j]&&i>j;   // style.css: 꺾인 카드 0 · 보통 1, 같으면 뒤 카드가 위
  for(let n=0;n<4;n++) hit.forEach((h,i)=>h.forEach((c,j)=>{ if(c>hit[j][i]&&!above(i,j)) z[i]=z[j]+1; }));
  ks.forEach((k,i)=>{ k.style.setProperty('--nx',Math.round(geo[i].nx)+'px'); k.style.setProperty('--zi',z[i]); });
}
if(board&&'ResizeObserver' in window){ const ro=new ResizeObserver(packBoard); cards().forEach(k=>ro.observe(k)); } else addEventListener('resize',packBoard);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(packBoard);
function resetBoard(){
  if(!boardIO) return;
  cards().forEach(k=>{ boardIO.unobserve(k); k.classList.remove('in'); k.classList.add('wait'); if(mallOpen) boardIO.observe(k); });   // 다시 관찰 → 지금 보이는 카드를 바로 알려 줌
}
/* 정렬 — 카드를 새 순서로 다시 끼움 (크기 · 기울기 · 찢은 색종이 모양은 상품을 따라가고 자리만 바뀜) */
let sortKey='pick';
const dayN=s=>{ const [y,m,d]=String(s||'').split('-').map(Number); return (y||0)*1e4+(m||0)*100+(d||0); };   // 'YYYY-M-D' → 비교용 숫자
const ORDER={
  pick:  ()=>0,
  low:   (a,b)=>a.price-b.price,
  high:  (a,b)=>b.price-a.price,
  review:(a,b)=>num(b.reviews)-num(a.reviews),
  sold:  (a,b)=>num(b.sold)-num(a.sold),
  new:   (a,b)=>(b.tag==='NEW')-(a.tag==='NEW')||dayN(b.day)-dayN(a.day),   // NEW 도장 먼저, 다음은 최근에 올린 것
};
function sortBoard(key){
  if(!ORDER[key]||!board) return;
  sortKey=key;
  PRODUCTS.filter(p=>p.img).sort(ORDER[key]).forEach(p=>{ const k=board.querySelector(`.kr[data-p="${p.id}"]`); if(k) board.append(k); });   // sort는 안정 정렬 → 같은 값은 추천 순서
  root.querySelectorAll('[data-sort]').forEach(b=>{ b.setAttribute('aria-pressed',String(b.dataset.sort===key)); });
  board.classList.toggle('sorted',key!=='pick');   // 정렬 중엔 빈 곳을 뒤 카드로 메우지 않음 → 보이는 순서 = 정렬 순서 (style.css)
  packBoard(); resetBoard();   // 자리가 바뀌면 보드 끝에 걸리는 카드도 바뀜
}
resetBoard();
paintBag();
paintMall();
})();
