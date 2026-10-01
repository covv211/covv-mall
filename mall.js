/* ══════════════════════════════════════════════════════════
   코브 몰 — 가방(모은 아이템) · 키링 가게 화면
   - 가방: 들판에서 주운 금화·하트·별·보석·사탕을 이 브라우저에 저장 (새로고침해도 남음)
   - 해킹 환영 ㅋㅋ: 금화 개수는 브라우저 안에 있어서 얼마든지 바꿀 수 있음.
     대신 할인은 '키링 1개당 최대 100원'(금화 100개 = 쿠폰 1장) — 계산은 checkout-rules.js 한 곳에서,
     실제 결제 때는 결제 서버가 같은 파일로 직접 계산해서 이 한도를 지킴
   - 하트 = 키링 응원 선물, 별 = 다음 키링 투표, 사탕 = 코브 색 고르기
   - 소개 화면의 '들판에서 줍는 아이템' 안내도 여기서 숫자·확률을 채움 (확률은 field.js의 covvField.drops())
   - 내 오피스(미니홈피)용 기록도 여기: 프로필·방문 수·다이어리·최근 소식 (myoffice.js가 화면을 그림)
   - 코브 몰 계정: 지금은 이 브라우저에 만드는 계정(닉네임만, 개인정보 X) → 들판 주인공 코브 이름표가 내 닉네임.
     카카오 로그인이 열리면 이 기록을 서버 계정으로 옮김 (창·버튼은 myoffice.js, 이름표는 field.js)
   - field.js보다 먼저 불러옴 (들판이 시작할 때 가방에 저장된 코브 색을 읽음)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const R=window.covvRules;   // 결제 규칙 (checkout-rules.js — 이 파일보다 먼저 불러옴)
if(!R){ try{ console.error('checkout-rules.js를 불러오지 못해서 가방을 열 수 없어요'); }catch(e){} return; }
const KEY='covv-wallet-v1';
const COUPON_COINS=R.COUPON_COINS, COUPON_WON=R.COUPON_WON;   // 금화 100개 = 쿠폰 1장 = 키링 1개 100원 할인
const DAY_HEART=5, DAY_STAR=3;            // 한 상품에 하루 동안 줄 수 있는 하트·별
const DECO_CANDY=5;                       // 코브 색 한 번 바꾸는 데 드는 사탕
const GEM_EARLY=3;                        // 보석 3개 = 한정판 먼저 사기 자격
const NICK_MIN=2, NICK_MAX=12;            // 계정 닉네임 글자 수 (프로필 닉네임 칸과 같은 12자)
const NICK_BAN=/운영자|관리자|admin|코브\s*몰|공식/i;   // 가게·운영자로 오해할 이름 막기 (서버 계정으로 옮길 때도 같은 규칙)

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
  if(isObj(v.account)) o.account={since:str(v.account.since,12,'')};   // 계정을 만든 날 'YYYY-M-D'
  return o;
}
let raw;
try{ const s=localStorage.getItem(KEY); raw=sanitize(s?JSON.parse(s,noProto):null); }
catch(e){   // 기록이 깨져 읽을 수 없으면 새 가방으로 시작하되, 원래 글자는 덮어쓰기 전에 옆 칸에 보관 (개발자 도구로 고치다 쉼표 하나 틀려도 일기가 통째로 사라지지 않게)
  raw=sanitize(null);
  try{ const s=localStorage.getItem(KEY); if(s) localStorage.setItem(KEY+'-broken',s); }catch(_){}
}
const subs=new Set();

// 바로 저장 (작은 JSON이라 가벼움) — 미뤄 두면 탭을 닫거나 다른 탭이 저장할 때 마지막 변경이 사라질 수 있음
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(raw)); }catch(e){} }
function emit(k){ subs.forEach(f=>{ try{ f(k); }catch(e){} }); }

// 콘솔에서 covvWallet.state.coin = 9999 처럼 바꿔도 바로 저장·반영되게 (가방 숫자는 저장할 때 정리)
const state=new Proxy(raw,{ set(t,k,v){ t[k]=BAGK.has(k)?item(v):v; save(); emit(k); return true; } });

// 홈페이지를 탭 두 개로 열어도 서로 덮어쓰지 않게: 다른 탭이 저장하면 그 가방을 받아옴
addEventListener('storage',e=>{
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
  member(){ return isObj(raw.account); },
  memberSince(){ return isObj(raw.account)?str(raw.account.since,12,''):''; },
  checkNick,
  join(name){   // 계정 만들기: 닉네임이 프로필 닉네임 + 들판 코브 이름표가 됨
    const c=checkNick(name); if(!c.ok) return c;
    const first=!isObj(raw.account);
    if(first) raw.account={since:today()};
    Object.assign(profile(),{name:c.nick}); save();
    if(first) wallet.log(`🎉 코브 몰 계정을 만들었어요 · 닉네임 '${c.nick}'`);
    emit('profile');
    return {ok:true,nick:c.nick};
  },
  coveName(){ return isObj(raw.account)?profile().name:'코브'; },   // 들판 주인공 코브의 이름 — 계정을 만들면 내 닉네임
  COUPON_COINS, COUPON_WON, ITEM_MAX, NICK_MIN, NICK_MAX,
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
const PRODUCTS=[
  {id:'rainbow',name:'무지개 코브 키링',   color:'#ff9ccb', bg:'#fff4d6', variant:'rainbow', tag:'한정', limited:true, desc:'히든 물감을 먹고 무지개 코브가 된 사람만 살 수 있어요. 보석 3개를 모으면 출시 첫날 먼저 살 수 있어요.'},
  {id:'pink',   name:'분홍 코브 키링',     color:'#ff9ccb', bg:'#ffe3ef', desc:'들판의 주인공. 제일 먼저 만나는 코브예요.'},
  {id:'sky',    name:'하늘 코브 키링',     color:'#a6d4ff', bg:'#e2f1ff', desc:'작업물 거품을 타고 다니는 코브.'},
  {id:'mint',   name:'민트 코브 키링',     color:'#aeeccf', bg:'#dcf8ea', desc:'연락처 거품을 타고 다니는 코브.'},
  {id:'lav',    name:'라벤더 코브 키링',   color:'#d4bfff', bg:'#eee6ff', desc:'오피스 거품을 타고 다니는 코브.'},
  {id:'para',   name:'낙하산 코브 키링',   color:'#ff9ccb', bg:'#ffeede', variant:'para', tag:'NEW', desc:'거품이 터지면 낙하산을 펴고 내려오는 바로 그 장면.'},
  {id:'bubble', name:'거품 속 코브 키링',  color:'#a6d4ff', bg:'#eaf0ff', variant:'bubble', tag:'NEW', desc:'투명 아크릴 두 겹. 흔들면 거품 속에서 움직여요.'},
];
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
window.covvArt={coveSVG,PRODUCTS,VOTES,BAG,GEM_EARLY,DAY_HEART,DAY_STAR,DECO_CANDY};

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

root.innerHTML=`
  <p class="mall-notice">🚧 지금은 오픈 준비 중이에요. 먼저 구경하고, 마음에 드는 키링에 하트를 남겨 주세요.</p>

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
  </section>

  <section class="mall-block" aria-labelledby="shelfTitle">
    <h3 id="shelfTitle">🔑 키링 진열대</h3>
    <p class="fine">하트는 좋아하는 키링을 응원하는 선물이에요. 한 키링에 하루 ${DAY_HEART}개까지 줄 수 있어요.</p>
    <div class="shelf">
      ${PRODUCTS.map(p=>`
      <article class="kr${p.limited?' feature':''}" data-p="${p.id}">
        <div class="kr-art">${coveSVG(p.color,p.variant)}${p.tag?`<span class="kr-tag${p.limited?' lim':''}">${p.tag}</span>`:''}
          ${p.limited?`<div class="kr-lock" data-lock><span>🔒</span><b>무지개 코브가 되면 열려요</b><small>들판 어딘가의 히든 물감을 찾아보세요</small></div>`:''}
        </div>
        <div class="kr-body">
          <h4>${p.name}</h4>
          <p>${p.desc}</p>
          <div class="kr-row">
            <span class="kr-count" title="내가 준 하트">♥ <b data-given>0</b></span>
            <button type="button" class="kr-btn" data-heart>하트 선물</button>
          </div>
          <button type="button" class="kr-buy" disabled>가격 · 구매는 오픈 때 공개</button>
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
root.querySelectorAll('.bag-items .dot').forEach((d,i)=>{ d.style.background=BAG[i].dot; });
root.querySelectorAll('.kr').forEach(k=>{ const p=PRODUCTS.find(x=>x.id===k.dataset.p); if(p) k.querySelector('.kr-art').style.background=p.bg; });

const $=s=>root.querySelector(s);
const bagEls={}; root.querySelectorAll('[data-bag]').forEach(el=>{ bagEls[el.dataset.bag]=el; });

function paintMall(){
  for(const k in bagEls){ const v=wallet.get(k); bagEls[k].textContent=short(v); bagEls[k].title=v.toLocaleString('ko-KR'); }
  // 쿠폰
  const c=wallet.get('coin'), cv=couponView();
  $('#couponText').textContent=cv.text;
  $('#couponNum').textContent=cv.num;
  $('#couponFill').style.width=Math.min(100,cv.fill)+'%';
  // 뱃지
  const b=[];
  if(state.rainbow) b.push('🌈 무지개 코브가 되어 봤어요');
  if(wallet.get('gem')>=GEM_EARLY) b.push(`💎 한정판 먼저 사기 자격 (보석 ${GEM_EARLY}개)`);
  else b.push(`💎 보석 ${wallet.get('gem')} / ${GEM_EARLY} — 모으면 한정판 먼저 사기 자격`);
  if(c>=ITEM_MAX) b.push('🕶️ 해커 코브 ㅋㅋ (그래도 할인은 키링 1개당 100원)');
  $('#badges').innerHTML=b.map(t=>`<li>${t}</li>`).join('');
  // 상품
  root.querySelectorAll('.kr').forEach(el=>{
    const id=el.dataset.p, r=rec('given',id), p=PRODUCTS.find(x=>x.id===id);
    el.querySelector('[data-given]').textContent=r.total;
    const btn=el.querySelector('[data-heart]');
    const locked=p.limited&&!state.rainbow;
    const lock=el.querySelector('[data-lock]'); if(lock) lock.hidden=!locked;
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
  const h=e.target.closest('[data-heart]');
  if(h){
    const id=h.closest('.kr').dataset.p, p=PRODUCTS.find(x=>x.id===id), r=rec('given',id);
    if(p&&p.limited&&!state.rainbow) return;   // 잠긴 한정판
    if(r.today>=DAY_HEART||!wallet.spend('heart',1)) return;
    r.today++; r.total++; save(); floatUp(h,'♥ +1'); paintMall();
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
let mallOpen=false;
wallet.on(()=>{ if(mallOpen) paintMall(); });
addEventListener('covv-screen',e=>{ mallOpen=e.detail==='mall'; if(mallOpen) paintMall(); });
paintMall();
})();
