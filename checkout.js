/* ══════════════════════════════════════════════════════════
   코브 몰 주문 — 상품 창(즉시구매 · 장바구니 담기) · 장바구니 · 주문/결제 화면
   - 코브 몰에서 오린 키링 사진이나 '자세히 · 구매'를 누르면 상품 창(<dialog id=pdDlg>): 색상 · 캐릭터 선택(그 키링의 종류, 사진 칸) · 수량 → 장바구니 담기 / 즉시구매
     (왼쪽 큰 사진 아래 사진 몇 장 · 상품 소개 — 길어지면 창이 스크롤되고 오른쪽 고르기 · 구매 칸은 크기 그대로 위에 붙어 있음, 그 칸 맨 밑 리뷰는 한 장씩 1.5초 동안 넘어가고 2초 쉼)
   - 즉시구매 = 그 상품만, 코브 몰 위 '🛒 장바구니' = 담아 둔 상품 전부로 주문/결제 화면(#checkout)을 엶
     (네이버 주문서처럼 왼쪽 주문 상품 · 배송지 · 할인 · 결제 수단, 오른쪽 최종 결제 금액. 맨 위 '내 가방'은 mall.js가 #checkoutBag에 그림)
   - 금액은 checkout-rules.js quote() · shippingFor()로 계산 — 실제 결제 때는 결제 서버가 같은 파일과 서버 가격표로 다시 계산
   - 지금은 결제가 열리지 않아 '결제하기'는 안내만 하고 금화도 그대로. 배송지도 받지 않음(카카오 로그인 · 개인정보 처리방침 전에는 이름·연락처·주소 X)
   - 장바구니는 가방(covv-wallet-v1)과 다른 저장 칸(CART_KEY) — 옛 버전 탭이 가방을 저장하며 모르는 칸을 버려도 안 지워지게, 다른 탭과는 storage 이벤트로 맞춤
   - mall.js 다음, screens.js 전에 불러옴 (주소가 #checkout이면 screens.js가 바로 열면서 보내는 covv-screen을 받아야 함)
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const W=window.covvWallet, A=window.covvArt, R=window.covvRules;
if(!W||!A||!R) return;
const CART_KEY='covv-cart-v1';     // 장바구니 [{id, qty}] — 이 브라우저에만
const ORDER_KEY='covv-order-v1';   // 지금 주문서에 올린 것 {mode:'now'|'cart', items} — 이 탭에만(sessionStorage), 새로고침해도 즉시구매 주문서가 비지 않게
const REVIEW_KEY='covv-reviews-v1';   // 내가 쓴 리뷰 {상품 id: {star, sku, size, quality, text, day, photos}} — 이 브라우저에만, 상품마다 하나 (문을 열면 서버 리뷰로)
const SELL=A.PRODUCTS.filter(p=>p.img&&p.price>0);   // 진열대에서 살 수 있는 상품 = 사진 상품 (한정판 무지개는 아직)
// 실제로 주문하는 단위 = 상품마다 고르는 색상 · 캐릭터 종류(covvArt.OPTIONS). 종류가 없거나 첫 줄이 빠져도 진열대 상품 자체는 늘 하나로 들어가게
const SKUS=[];
SELL.forEach(p=>{
  const os=(A.OPTIONS&&Array.isArray(A.OPTIONS[p.id]))?A.OPTIONS[p.id]:[];
  (os.some(o=>o&&o.id===p.id)?os:[{id:p.id},...os]).forEach(o=>{
    if(!o||typeof o.id!=='string'||SKUS.some(x=>x.id===o.id)) return;   // 다른 상품과 겹친 id는 버림 (장바구니 줄이 섞이지 않게)
    if(o.id!==p.id&&!o.img&&!A.PREVIEW) return;   // 자기 사진이 없는 종류는 공개 화면에서 뺌 — '흰 호랑이'를 골라도 주황 호랑이 사진 그대로 담기면 본 적 없는 물건을 주문하게 됨 (미리보기에선 그대로 보여서 고르기 칸을 볼 수 있음)
    SKUS.push({id:o.id, base:p.id, name:o.name||p.name, img:o.img||p.img, paper:o.paper||p.paper, price:o.price||p.price, desc:o.desc||p.desc, shots:o.shots||p.shots, story:o.story||p.story});
  });
});
const CATALOG={}; SKUS.forEach(k=>{ CATALOG[k.id]={price:k.price}; });   // quote()용 가격표 (화면 표시용 — 서버는 자기 가격표로 다시 계산)
const byId=id=>SKUS.find(k=>k.id===id)||null;
const won=n=>n.toLocaleString('ko-KR')+'원';
const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
const toast=t=>{ if(window.covvToast) window.covvToast(t); };
const liftToast=()=>{ if(window.covvToast&&window.covvToast.lift) window.covvToast.lift(); };   // 떠 있는 알림을 방금 연 창 안으로 (mall.js)
const noProto=(k,v)=>k==='__proto__'?undefined:v;

/* ══════════ 장바구니 ══════════ */
// 줄 모양 맞추기 — 저장소는 손님이 바꿀 수 있으니 아는 상품 · 1~99개 · 최대 20줄만 (같은 상품 두 줄은 합침)
const goneIds=new Set();   // 불러온 장바구니에서 빠진 상품 (진열대에서 내려갔거나 공개 화면에서 뺀 종류) — 처음 코브 몰 · 주문서를 열 때 한 번 알림
function cleanLines(v){
  const out=[];
  if(!Array.isArray(v)) return out;
  for(const it of v.slice(0,50)){
    if(it&&typeof it==='object'&&typeof it.id==='string'&&!byId(it.id)) goneIds.add(it.id.slice(0,40));
    if(!it||typeof it!=='object'||typeof it.id!=='string'||!byId(it.id)||typeof it.qty!=='number'||!(it.qty>=1)) continue;
    const q=Math.min(R.QTY_MAX,Math.floor(it.qty)), have=out.find(x=>x.id===it.id);
    if(have) have.qty=Math.min(R.QTY_MAX,have.qty+q);
    else if(out.length<R.LINES_MAX) out.push({id:it.id,qty:q});
  }
  return out;
}
let cart=[];
try{ cart=cleanLines(JSON.parse(localStorage.getItem(CART_KEY)||'[]',noProto)); }catch(e){}
const goneN=goneIds.size; goneIds.clear(); let goneTold=false;   // 처음 불러올 때 것만 셈 (다른 탭 storage로 다시 정리할 때는 안 셈)
function saveCart(){
  try{ if(cart.length) localStorage.setItem(CART_KEY,JSON.stringify(cart)); else localStorage.removeItem(CART_KEY); }catch(e){}
  paintCartN();
}
const cartCount=()=>cart.reduce((n,x)=>n+x.qty,0);
function paintCartN(){ document.querySelectorAll('[data-cart-n]').forEach(b=>{ b.textContent=cartCount(); }); }
if(goneN) saveCart();   // 빠진 줄을 저장소에서도 지움 (다음에 또 알리지 않게) — cartCount · paintCartN 선언 뒤에 (앞이면 TDZ 오류로 이 파일 전체가 멈춤)
function addToCart(id,qty){
  const p=byId(id), have=cart.find(x=>x.id===id);
  if(!p) return false;
  if(!have&&cart.length>=R.LINES_MAX){ toast(`🛒 장바구니에는 ${R.LINES_MAX}종류까지 담을 수 있어요`); return false; }
  const before=have?have.qty:0, q=Math.min(R.QTY_MAX,before+qty);
  if(have) have.qty=q; else cart.push({id,qty:q});
  saveCart();
  return q-before;   // 실제로 더해진 개수 (한 상품 99개까지)
}

/* ══════════ 주문서에 올린 것 ══════════ */
let order={mode:'cart',items:[]};
try{ const o=JSON.parse(sessionStorage.getItem(ORDER_KEY)||'null',noProto); if(o&&o.mode==='now') order={mode:'now',items:cleanLines(o.items).slice(0,1)}; }catch(e){}
function saveOrder(){ try{ sessionStorage.setItem(ORDER_KEY,JSON.stringify(order.mode==='now'?order:{mode:'cart'})); }catch(e){} }
const lines=()=>order.mode==='now'?order.items:cart;
function goCheckout(mode,items){
  order=mode==='now'?{mode,items}:{mode:'cart',items:[]}; saveOrder();
  closePd();
  if(isOpen) paint();
  else if(window.covvOpenScreen) window.covvOpenScreen('checkout');
}

/* ══════════ 상품 창 (즉시구매 · 장바구니 담기) ══════════ */
const dlg=document.getElementById('pdDlg');
let pdId=null, pdQty=1;
const $d=s=>dlg.querySelector(s);
// 색상 · 캐릭터 선택 칸: 연 상품의 종류마다 75×75 사진 버튼 (칸 바탕 = 그 종류의 색종이를 옅게). 다른 상품을 열 때만 다시 만듦
const optBox=dlg&&dlg.querySelector('#pdOpts');
let optBase=null;
function paintOpts(k){
  if(!optBox) return;
  const os=SKUS.filter(x=>x.base===k.base);
  if(optBase!==k.base){
    optBase=k.base; optBox.textContent='';
    os.forEach(o=>{
      const b=el('button','pd-opt'), im=el('img');
      b.type='button'; b.dataset.pdOpt=o.id; b.setAttribute('aria-label',o.name);
      b.style.background=`color-mix(in srgb, ${o.paper} 50%, #fff)`;
      im.src=o.img; im.alt=''; im.width=im.height=75; im.decoding='async';
      b.append(im); optBox.append(b);
    });
  }
  $d('.pd-opts').hidden=os.length<2;
  optBox.querySelectorAll('[data-pd-opt]').forEach(b=>{ b.setAttribute('aria-pressed',String(b.dataset.pdOpt===k.id)); });
}
// 상품 정보 제공 고시 (전자상거래법 — 판매 전에 꼭): [mall.js INFO의 칸, 표 이름] — 값은 종류 id가 상품 id보다 먼저, 비면 GOSI_EMPTY (지어 넣지 않음)
const GOSI=[['material','소재'],['size','크기'],['maker','제조자 · 수입자'],['origin','제조국'],['care','취급 시 주의사항'],['warranty','품질보증기준'],['as','A/S 책임자 · 전화번호'],['kc','KC 인증 · 사용 연령']];
const GOSI_EMPTY='판매를 시작할 때 적어요';
function paintGosi(p){
  const box=$d('#pdGosi'); if(!box) return;
  const I=A.INFO||{}, info=Object.assign({},I[p.base],I[p.id]), val=k=>typeof info[k]==='string'&&info[k].trim()?info[k].trim():'';
  const rows=[['상품 코드',p.base],['품명',(SELL.find(x=>x.id===p.base)||p).name],...GOSI.map(([k,t])=>[t,val(k)]),['판매자','']];
  box.textContent='';
  rows.forEach(([t,v])=>{ const dd=el('dd',v?null:'empty',v||(t==='판매자'?`${GOSI_EMPTY} · 코브 몰 맨 아래 가게 정보에도 함께`:GOSI_EMPTY)); box.append(el('dt',null,t),dd); });   // 값은 글자로만 (textContent)
  const size=val('size'), mat=val('material'), line=$d('[data-pd-size]');
  line.textContent=size?`크기 ${size}${mat?' · '+mat:''}`:''; line.hidden=!size;
  $d('[data-pd-size-todo]').hidden=!!size;
}
// 큰 사진 아래: 사진 몇 장 · 상품 소개 (mall.js PRODUCTS의 shots · story, 종류마다 따로 줘도 됨). 아직 없으면 빈 사진 자리 · 짧은 소개(desc) + 채울 곳 안내
const SHOT_HOLES=3;   // 사진이 없을 때 보여 줄 빈 사진 자리 수
function paintMore(p){
  const box=$d('#pdShots'), st=$d('#pdStory'); if(!box||!st) return;
  const shots=Array.isArray(p.shots)?p.shots.filter(s=>typeof s==='string'&&s):[];
  box.textContent='';
  shots.forEach((s,i)=>{ const f=el('figure','pd-shot'), im=el('img'); im.src=s; im.alt=`${p.name} 사진 ${i+2}`; im.loading='lazy'; im.decoding='async'; im.width=im.height=560; f.append(im); box.append(f); });
  // ↑ width·height = 불러오기 전에도 네모 자리를 잡아 둠(아래 소개가 덜 밀림), 불러오면 사진 비율대로
  if(!shots.length) for(let i=0;i<SHOT_HOLES;i++){ const h=el('div','pd-shot hole','사진 자리'); h.setAttribute('aria-hidden','true'); box.append(h); }   // 빈 사진 자리는 공개 화면에도 (주인님 11-10: 큰 사진 아래로 내려 보는 자리가 있게 · ✏️ 안내만 미리보기에서)
  box.hidden=!box.childElementCount;
  $d('[data-pd-shots-todo]').hidden=shots.length>0;
  st.textContent='';
  String(p.story||p.desc||'').split('\n').map(t=>t.trim()).filter(Boolean).forEach(t=>st.append(el('p',null,t)));   // 줄바꿈 = 문단
  $d('[data-pd-story-todo]').hidden=!!p.story;
}
/* ── 리뷰 (고르기 · 구매 칸 맨 밑): 한 장씩 넘어가는 카드 (Swiper speed 1500 · autoplay delay 2000과 같게) ── */
// 끌기(마우스 · 손가락) · 트랙패드로 옆으로 밀기 · ‹ › 로도 넘김. 마우스를 올려 둔 동안 · 키보드로 버튼에 온 동안 · ⏸ · 안 보일 때(창 닫힘 · 칸 밖 · 탭 숨김)는 멈춤
// 양 끝에 복사 카드(RV_CLONES)를 붙여 끝 → 처음 · 처음 → 끝도 같은 쪽으로 넘어간 뒤 몰래 진짜 카드로 옮김(Swiper loop처럼). 넘어가는 중엔 ‹ › 를 무시. 동작 줄이기면 옆으로 밀지 않고 제자리 페이드(style.css)
// ✏️ 예시 리뷰 — 산 분이 쓴 게 아니라서 카드마다 '예시' 표시가 붙음. 문을 열면 서버의 실제 리뷰(상품마다)로 바꿀 것 (예시를 실제 리뷰처럼 보이게 두면 표시광고법 위반)
const REVIEW_SAMPLES=[
  {who:'예시 1',  star:5, text:'가방에 달았더니 친구들이 어디서 샀냐고 물어봐요.'},
  {who:'예시 2',  star:5, text:'사진보다 실물이 더 귀여워요. 색도 화면에서 본 그대로예요.'},
  {who:'예시 3',  star:4, text:'생각보다 조금 작은데 열쇠에 달기엔 딱 좋아요.'},
  {who:'예시 4',  star:5, text:'포장이 꼼꼼해서 선물로 보내기 좋았어요.'},
  {who:'예시 5',  star:5, text:'고리가 튼튼해서 매일 들고 다녀도 걱정 없어요.'},
  {who:'예시 6',  star:4, text:'표정이 너무 귀여워서 다른 색도 하나 더 샀어요.'},
  {who:'예시 7',  star:5, text:'가벼워서 이어폰 케이스에 달아도 부담 없어요.'},
  {who:'예시 8',  star:5, text:'들판에서 모은 금화 쿠폰으로 싸게 샀어요!'},
  {who:'예시 9',  star:4, text:'배송은 하루 늦었지만 키링이 예뻐서 괜찮아요.'},
  {who:'예시 10', star:5, text:'책상에 걸어 두고 볼 때마다 기분이 좋아져요.'},
];
/* 내가 쓴 리뷰 (리뷰 쓰기 창 — 아래 '리뷰 쓰기') */
const RW_MIN=10, RW_MAX=500;          // 리뷰 글자 수 (한두 마디만 남지 않게 · 이 브라우저 저장소가 넘치지 않게)
const RW_PHOTOS=3;                    // 리뷰 사진 장수 (멘케트는 10장 — 사진을 이 브라우저 저장소(5MB 안팎)에 두므로 상품마다 3장)
const RW_PX=480, RW_Q=.72;            // 사진을 긴 변 480px · JPEG 품질 0.72로 줄여 저장 (한 장 30KB 안팎)
const RW_FILE_MAX=25e6;               // 이보다 큰 파일은 읽지 않음 (휴대폰이 멈추지 않게)
const RW_PHOTO_LEN=200000;            // 사진 한 장 data URL 최대 글자 수 (RW_PX · RW_Q로 줄인 사진은 크롬에서 잡음 사진도 17만 자 안팎) — 줄일 때 · 불러올 때 같은 한도
const RW_STORE_MAX=1.5e6;             // 리뷰 전체 저장 글자 수 — 넘으면 사진을 빼고 저장 (같은 저장소(5MB 안팎)를 쓰는 가방 · 장바구니 자리를 남김)
const RW_KEEP=60;                     // 저장소에서 읽는 리뷰 수 상한 (변조로 수천 개를 넣어도 멈추지 않게)
const RW_SIZE=[['small','작아요'],['fit','딱 좋아요'],['large','커요']];                                   // 멘케트 '착용감' 자리 → 키링 크기
const RW_QUALITY=[['great','아주 좋아요'],['good','좋아요'],['okay','보통이에요'],['poor','아쉬워요']];
const RW_PHOTO_RE=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;   // 저장소에서 읽은 사진은 이 브라우저가 만든 JPEG 모양만
const rwLabel=(list,v,pre)=>{ const f=list.find(x=>x[0]===v); return f?pre+f[1]:''; };
// 저장소는 손님이 바꿀 수 있으니 아는 상품 · 알맞은 모양만 (별 1~5 · 글 RW_MIN~RW_MAX자 · 사진은 JPEG data URL만)
function cleanReviews(v){
  const out={};
  if(!v||typeof v!=='object'||Array.isArray(v)) return out;
  for(const id of Object.keys(v).slice(0,RW_KEEP)){
    const r=v[id];
    if(!SELL.some(p=>p.id===id)||!r||typeof r!=='object') continue;
    const star=typeof r.star==='number'&&r.star>=1&&r.star<=5?Math.round(r.star):0, text=typeof r.text==='string'?r.text.trim().slice(0,RW_MAX):'';
    if(!star||text.length<RW_MIN) continue;
    const k=typeof r.sku==='string'?byId(r.sku):null;
    out[id]={star, sku:k&&k.base===id?k.id:id, size:RW_SIZE.some(x=>x[0]===r.size)?r.size:'', quality:RW_QUALITY.some(x=>x[0]===r.quality)?r.quality:'', text,
      day:typeof r.day==='string'&&/^\d{4}-\d{1,2}-\d{1,2}$/.test(r.day)?r.day:'', photos:Array.isArray(r.photos)?r.photos.filter(d=>typeof d==='string'&&d.length<RW_PHOTO_LEN&&RW_PHOTO_RE.test(d)).slice(0,RW_PHOTOS):[]};
  }
  return out;
}
let reviews={};
const loadReviews=()=>{ try{ reviews=cleanReviews(JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}',noProto)); }catch(e){ reviews={}; } };
loadReviews();
function saveReviews(){   // → 저장했으면 true (리뷰 전체가 RW_STORE_MAX를 넘거나 저장소가 가득 차면 false)
  try{
    if(!Object.keys(reviews).length){ localStorage.removeItem(REVIEW_KEY); return true; }
    const s=JSON.stringify(reviews); if(s.length>RW_STORE_MAX) return false;
    localStorage.setItem(REVIEW_KEY,s); return true;
  }catch(e){ return false; }
}
const RV_SPEED=1500;   // 한 장이 넘어가는 시간(ms) = Swiper speed (style.css 전환 시간도 이 값 — --rv-speed로 넘김, 끌다 놓을 때 · ‹ › 도 같음)
const RV_MS=2000;      // 다 넘어간 뒤 다음 장까지 쉬는 시간(ms) = Swiper autoplay delay → 한 장에 3.5초
const RV_SWIPE=40;     // 이만큼(px) 끌거나 밀면 넘김, 덜 끌면 제자리로
const RV_CLONES=2;     // 양 끝에 붙이는 복사 카드 수 (앞엔 끝 카드들, 뒤엔 처음 카드들 — 지금 카드 + 옆에 살짝 보이는 카드, 끄는 동안 한 칸 더)
const RM=matchMedia('(prefers-reduced-motion: reduce)');   // 넘길 때마다 읽음 + 바뀌면 그 카드로 바로 (아래 change)
const rvTrack=dlg&&dlg.querySelector('#pdReviews'), rvBox=rvTrack&&rvTrack.parentElement;
let rvN=0, rvH=0, rvI=0, rvAt=0, rvTimer=0, rvSeen=false, rvHover=false, rvKey=false, rvUser=false, rvDrag=null;   // rvH = 앞 복사 카드 수, rvI = 지금 차례(-rvH ~ rvN+rvH-1, 0 ~ rvN-1이 진짜), rvAt = 마지막으로 움직이기 시작한 때
const rvSet=i=>{ rvI=i; rvTrack.style.setProperty('--i',i); };
const rvReal=i=>(i%rvN+rvN)%rvN;   // 복사 카드 차례 → 똑같이 생긴 진짜 카드 차례
// 움직임 없이 i 자리로 — 복사 카드 ↔ 진짜 카드처럼 똑같이 생긴 자리라 티 안 남. 넘어가는 중(1.5초) · 끄는 중이어도 지금 보이는 위치는 그대로(지금 카드가 비켜 있는 만큼 --dx로), fresh = 처음부터(상품을 열 때)
function rvJump(i,fresh){
  const c=!fresh&&rvTrack.children[rvI+rvH], d=c?Math.round(c.getBoundingClientRect().left-rvBox.getBoundingClientRect().left):0;
  rvTrack.classList.add('jump'); rvTrack.style.setProperty('--dx',`${d}px`); rvSet(i); void rvTrack.offsetWidth; rvTrack.classList.remove('jump');
}
const rvRun=()=>rvN>1&&dlg.open&&rvSeen&&!rvHover&&!rvKey&&!rvUser&&!rvDrag&&!document.hidden;
function rvSched(){ clearTimeout(rvTimer); rvTimer=rvRun()?setTimeout(()=>rvGo(rvI+1),Math.max(0,rvAt+RV_SPEED-performance.now())+RV_MS):0; }   // 다 넘어간 뒤부터 RV_MS 쉬고 다음 장(Swiper autoplay처럼) → 손으로 넘긴 바로 뒤에도 또 넘어가지 않음
function rvGo(i){
  if(!rvN) return;
  if(RM.matches) i=rvReal(i);
  else if(rvI<0||rvI>=rvN){ i+=rvReal(rvI)-rvI; rvJump(rvReal(rvI)); }   // 복사 카드에 있으면(넘어가는 중이어도) 진짜 카드로 먼저 → 앞뒤에 늘 복사 카드가 이어져 있음
  if(i!==rvI||rvTrack.style.getPropertyValue('--dx')!=='0px') rvAt=performance.now();   // 움직이기 시작 (제자리로 돌아가는 것도)
  rvTrack.style.setProperty('--dx','0px'); rvSet(i);
  const k=rvReal(i);
  rvTrack.querySelectorAll('.pd-rv-card:not(.clone)').forEach((c,j)=>c.classList.toggle('on',j===k));
  $d('[data-rv-dots]').querySelectorAll('span').forEach((d,j)=>d.classList.toggle('on',j===k));
  rvSched();
}
const rvStep=d=>{ if(!rvDrag&&performance.now()-rvAt>=RV_SPEED) rvGo(rvI+d); };   // ‹ › · 트랙패드: 넘어가는 중(1.5초) · 끄는 중엔 무시 = Swiper loop의 loopPreventsSliding (연달아 누르면 복사 카드 밖이 비어 보이던 것 막음)
function paintReviews(){   // 상품을 열 때마다 첫 카드부터 (지금은 예시뿐이라 상품마다 같음 → 실제 리뷰가 생기면 그 상품 것만)
  if(!rvTrack) return;
  const p=byId(pdId), mine=p&&reviews[p.base];
  const list=mine?[{...mine,mine:true},...REVIEW_SAMPLES]:REVIEW_SAMPLES, dots=$d('[data-rv-dots]');   // 내가 쓴 리뷰(이 브라우저에만)는 맨 앞
  const card=(r,clone)=>{
    const n=Math.max(1,Math.min(5,Math.round(r.star)||5)), li=el('li',clone?'pd-rv-card clone':'pd-rv-card'), s=el('span','pd-rv-stars','★'.repeat(n)+'☆'.repeat(5-n)), who=el('p','pd-rv-who');
    s.setAttribute('role','img'); s.setAttribute('aria-label',`별 5개 중 ${n}개`);
    who.append(el('span',null,r.mine?'내 리뷰':r.who),el('span','pd-rv-tag',r.mine?'이 브라우저에만':'예시'));
    li.append(s,el('p','pd-rv-text',r.text));   // 손님이 쓴 글 → textContent (el)
    if(r.mine){
      li.classList.add('mine');
      const k=byId(r.sku), meta=[k&&k.id!==p.base?k.name:'',rwLabel(RW_SIZE,r.size,'크기 '),rwLabel(RW_QUALITY,r.quality,'품질 ')].filter(Boolean).join(' · ');
      if(meta) li.append(el('p','pd-rv-meta',meta));
      if(r.photos.length){ const ps=el('div','pd-rv-pics'); r.photos.forEach((d,i)=>{ const im=el('img'); im.src=d; im.alt=`내 리뷰 사진 ${i+1}`; im.width=im.height=44; ps.append(im); }); li.append(ps); }
    }
    li.append(who);
    if(clone) li.setAttribute('aria-hidden','true');   // 화면낭독기엔 진짜 카드만
    return li;
  };
  rvN=list.length; rvH=rvN>1?Math.min(RV_CLONES,rvN):0; rvTrack.textContent=''; dots.textContent='';
  list.forEach((r,j)=>{ const c=card(r); if(!j) c.classList.add('on'); rvTrack.append(c); dots.append(el('span',j?null:'on')); });   // 첫 카드 · 점은 처음부터 켬 → 동작 줄이기에서 창을 열 때 빈 칸에서 페이드로 시작하지 않음
  if(rvH){ rvTrack.prepend(...list.slice(-rvH).map(r=>card(r,true))); list.slice(0,rvH).forEach(r=>rvTrack.append(card(r,true))); }   // 앞엔 끝 카드들, 뒤엔 처음 카드들 (Swiper loop처럼 양 끝이 이어짐)
  rvTrack.style.setProperty('--h',rvH);
  $d('[data-rv-count]').textContent=!rvN?'':mine?`내 리뷰 1 · 예시 ${rvN-1}`:`${rvN}개 · 예시`;   // 실제 리뷰 수처럼 보이지 않게
  $d('.pd-rv-ctrl').hidden=dots.hidden=rvN<2; rvBox.hidden=!rvN; $d('[data-rv-empty]').hidden=rvN>0;
  rvHover=rvKey=false; rvDrag=null; rvAt=0; rvTrack.classList.remove('drag'); rvJump(0,true); rvGo(0);
}
if(rvTrack){
  rvTrack.style.setProperty('--rv-speed',`${RV_SPEED}ms`);   // style.css 전환 시간 (옆으로 밀기 · 페이드 둘 다)
  rvTrack.addEventListener('transitionend',e=>{ if(e.target===rvTrack&&!(rvDrag&&rvDrag.on)&&(rvI<0||rvI>=rvN)) rvJump(rvReal(rvI)); });   // 복사 카드에 닿으면 진짜 카드로
  if(RM.addEventListener) RM.addEventListener('change',()=>{ if(rvN){ const k=rvReal(rvI); rvJump(k,true); rvGo(k); } });   // 창을 연 채 동작 줄이기를 켜고 끄면 미끄러지지 않고 그 카드로 바로
  const sec=rvBox.closest('.pd-review');
  sec.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse'){ rvHover=true; rvSched(); } });   // 읽는 동안 안 넘어가게 (휴대폰은 끄는 동안만)
  sec.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse'){ rvHover=false; rvSched(); } });
  sec.addEventListener('focusin',e=>{ rvKey=e.target.matches(':focus-visible'); rvSched(); });   // 키보드로 버튼에 온 동안만 (마우스로 누른 뒤 포커스가 남아도 계속 넘어가게)
  sec.addEventListener('focusout',()=>{ rvKey=false; rvSched(); });
  rvBox.addEventListener('pointerdown',e=>{
    if(rvN<2||e.button>0) return;
    rvDrag={id:e.pointerId, x:e.clientX, dx:0, base:0, max:0, on:false};
    try{ rvBox.setPointerCapture(e.pointerId); }catch(_){}   // 누를 때부터 붙잡음 → 카드 밖에서 놓아도 pointerup이 여기로 와서 끄는 중으로 남지 않음
    rvSched();
  });
  rvBox.addEventListener('pointermove',e=>{
    if(!rvDrag||e.pointerId!==rvDrag.id) return;
    if(!e.buttons){ rvDrop(e); return; }   // 놓은 걸 놓쳤으면(오른쪽 클릭 메뉴 등) 여기서 놓은 걸로
    rvDrag.dx=e.clientX-rvDrag.x;
    if(!rvDrag.on){
      if(Math.abs(rvDrag.dx)<6) return;   // 그냥 누른 것과 구별
      rvDrag.on=true;
      if(!RM.matches){   // 넘어가는 중에 잡아도 그 자리에서 멈춰 손가락을 따라옴 (복사 카드였으면 진짜 카드로)
        const c=rvTrack.children; rvDrag.max=c[1]?c[1].getBoundingClientRect().left-c[0].getBoundingClientRect().left:0;   // 끌 수 있는 만큼 = 카드 한 칸 (그 너머는 복사 카드도 없어 빈 칸이 보임)
        rvJump(rvReal(rvI)); let b=parseFloat(rvTrack.style.getPropertyValue('--dx'))||0;
        const s=rvDrag.max?Math.round(b/rvDrag.max):0; if(s){ b-=s*rvDrag.max; rvTrack.style.setProperty('--dx',`${b}px`); rvSet(rvReal(rvI-s)); }   // 기준 = 넘어가던 목적지가 아니라 지금 가장 많이 보이는 카드 → 다음 · 이전이 늘 한 장씩 (아래 .drag가 붙은 뒤에 그려져 움직임 없음)
        rvDrag.base=b;
      }
      rvTrack.classList.add('drag');
    }
    if(!RM.matches) rvTrack.style.setProperty('--dx',`${Math.max(-rvDrag.max,Math.min(rvDrag.max,rvDrag.base+rvDrag.dx))}px`);   // 페이드는 따라오지 않고 놓을 때 넘김만
  });
  const rvDrop=e=>{
    if(!rvDrag||e.pointerId!==rvDrag.id) return;
    const g=rvDrag; rvDrag=null; rvTrack.classList.remove('drag');
    if(!g.on){ rvSched(); return; }   // 그냥 누른 것(탭 · 세로 스크롤 시작) → 넘어가던 건 그대로 둠
    const p=g.max?rvI-(parseFloat(rvTrack.style.getPropertyValue('--dx'))||0)/g.max:rvI;   // 놓은 순간 보이는 자리 (카드 차례, 소수)
    rvGo(Math.abs(g.dx)<RV_SWIPE?Math.round(p):g.dx<0?Math.min(rvI+1,Math.floor(p)+1):Math.max(rvI-1,Math.ceil(p)-1));   // 덜 끌었으면 가까운 카드로, 넘겼으면 보이던 자리에서 한 장 (기준 카드 ±1 안 → 복사 카드 밖으로 안 나감)
  };
  rvBox.addEventListener('pointerup',rvDrop); rvBox.addEventListener('pointercancel',rvDrop);   // 세로로 밀어 창이 스크롤되면 cancel
  let wx=0, wt=0, wDone=false;
  rvBox.addEventListener('wheel',e=>{   // 트랙패드 두 손가락 옆으로 = 넘기기 (세로 굴림은 창 스크롤 그대로)
    if(rvN<2||Math.abs(e.deltaX)<=Math.abs(e.deltaY)) return;
    e.preventDefault();   // 옆으로 밀기가 브라우저 '뒤로 가기'가 되지 않게
    const now=performance.now(); if(now-wt>250){ wx=0; wDone=false; } wt=now;   // 손을 떼고 다시 밀면 새 몸짓, 관성으로 이어지는 굴림은 한 번만 넘김
    wx+=e.deltaX; if(!wDone&&Math.abs(wx)>=RV_SWIPE){ wDone=true; rvStep(wx>0?1:-1); }
  },{passive:false});
  document.addEventListener('visibilitychange',rvSched);
  dlg.addEventListener('close',()=>{ rvDrag=null; rvTrack.classList.remove('drag'); rvSched(); });   // 창을 닫으면 바로 멈춤
  if('IntersectionObserver' in window) new IntersectionObserver(es=>{ rvSeen=es[es.length-1].isIntersecting; rvSched(); }).observe(rvBox);   // 조금이라도 보이면 넘김(1366×768 노트북은 처음엔 카드 절반쯤만 보임), 다 가려지면 멈춤(정보 칸 밖 · 휴대폰에서 아래)
  else rvSeen=true;
}
// 창 안 내용을 한 종류로 — 처음 열 때와 색상 · 캐릭터를 고를 때 같이 씀 (수량은 그대로 둠)
function fillPd(p){
  pdId=p.id;
  const img=$d('#pdImg'); img.onerror=()=>{ img.onerror=null; img.src=p.img; }; img.src=p.img.replace(/\.webp$/,'-l.webp'); img.alt=p.name+' 사진';   // 창은 크게 보이니 고해상도 사본(-l), 없으면 원래 사진
  const paper=$d('.kr-paper'); paper.style.background=p.paper; if(A.tornClip) paper.style.clipPath=A.tornClip(17+SELL.findIndex(x=>x.id===p.base)*131,4,4);   // 찢은 모양은 상품마다, 색은 종류마다
  $d('#pdName').textContent=p.name;
  $d('#pdDesc').textContent=p.desc;
  $d('#pdPrice').textContent=p.price.toLocaleString('ko-KR');
  paintOpts(p);
  paintMore(p);
  paintGosi(p);
  $d('[data-pd-added]').hidden=true; $d('[data-pd-live]').textContent=''; $d('[data-pd-share-box]').hidden=true;
  paintPd();
}
function openProduct(id){
  const p=byId(id);
  if(!p||!dlg) return;
  pdQty=1;
  fillPd(p);
  const n=R.coupons(W.get('coin'));
  $d('#pdCoupon').textContent=n?`금화 쿠폰 ${n}장 있음 · 키링 1개당 ${R.COUPON_WON}원 할인`:`금화 ${R.COUPON_COINS}개를 모으면 키링 1개 ${R.COUPON_WON}원 할인`;
  $d('#pdShip').textContent=`${won(R.SHIP_FEE)} · 상품 ${won(R.SHIP_FREE)} 이상이면 무료`;
  if(!dlg.showModal){ goCheckout('now',[{id,qty:1}]); return; }   // <dialog>를 모르는 옛 브라우저(iOS 15.3 이하) → 창 대신 바로 주문서로 (살 길이 막히지 않게)
  const g=$d('.pd-gosi'); if(g) g.open=false;   // 다른 상품을 열면 고시 표는 접힌 채로 (종류만 바꿀 땐 그대로 — fillPd)
  if(!dlg.open) dlg.showModal();
  liftToast();   // 창을 열기 직전에 뜬 알림(장바구니에서 빠진 상품 등)이 창 뒤에 가려지지 않게
  dlg.scrollTop=0; $d('.pd-info').scrollTop=0; if(optBox) optBox.scrollLeft=0;   // 다른 상품을 열면 맨 위(큰 사진)부터 · 휴대폰 종류 띠도 처음부터
  paintReviews();   // 창이 열린 뒤 (열려 있어야 자동 넘김이 켜짐)
  $d('[data-pd-buy]').focus({preventScroll:true});   // 그냥 focus()면 짧은 창 · 휴대폰에서 버튼 쪽으로 다시 스크롤돼 위의 되감기가 풀림
}
function paintPd(){
  const p=byId(pdId); if(!p) return;
  $d('#pdQty').textContent=pdQty;
  $d('#pdTotal').textContent=won(p.price*pdQty);
  $d('[data-qty="-1"]').disabled=pdQty<=1;
  $d('[data-qty="1"]').disabled=pdQty>=R.QTY_MAX;
}
function closePd(){ if(dlg&&dlg.open) dlg.close(); }
if(dlg){
  dlg.addEventListener('click',e=>{
    if(e.target.closest('[data-pd-close]')){ closePd(); return; }   // ✕를 눌러야만 닫힘 — 바깥(배경)을 눌러도 안 닫힘 (주인님 11-10: 회원가입 창과 같게)
    const tp=e.target.closest('[data-tip]'); if(tp){ openTip(tp.dataset.tip); return; }   // 혜택 줄의 ⓘ → 안내 창
    if(e.target.closest('[data-pd-share]')){ sharePd(); return; }   // 가격 옆 🔗 공유
    if(e.target.closest('[data-rv-write]')){ openWrite(); return; }   // 리뷰 '리뷰 쓰기'
    const o=e.target.closest('[data-pd-opt]');
    if(o){ const p=byId(o.dataset.pdOpt); if(p&&p.id!==pdId){ fillPd(p); const img=$d('#pdImg'); img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap'); } return; }   // 종류가 바뀐 걸 알게 사진이 살짝 톡
    const rv=e.target.closest('[data-rv]'); if(rv){ rvStep(Number(rv.dataset.rv)); return; }   // 리뷰 ‹ ›
    const pl=e.target.closest('[data-rv-play]'); if(pl){ rvUser=!rvUser; pl.setAttribute('aria-pressed',String(rvUser)); rvSched(); return; }   // 리뷰 ⏸ ↔ ▶ (눌림 = 멈춤)
    const q=e.target.closest('[data-qty]');
    if(q){ pdQty=Math.max(1,Math.min(R.QTY_MAX,pdQty+Number(q.dataset.qty))); paintPd(); $d('[data-pd-added]').hidden=true; if(q.disabled) $d(`[data-qty="${-Number(q.dataset.qty)}"]`).focus(); return; }   // 1·99에서 꺼진 버튼 → 반대쪽
    if(e.target.closest('[data-pd-cart]')){
      const p=byId(pdId), added=addToCart(pdId,pdQty);
      if(added===false) return;
      const msg=$d('[data-pd-added]'), have=(cart.find(x=>x.id===pdId)||{qty:0}).qty;
      const t=added<pdQty?`한 상품은 ${R.QTY_MAX}개까지라 장바구니에 ${have}개 있어요`:`${p.name} ${pdQty}개를 담았어요 · 장바구니에 ${have}개`;
      msg.querySelector('span').textContent=t; msg.hidden=false; $d('[data-pd-live]').textContent=t;
      return;
    }
    if(e.target.closest('[data-pd-buy]')) goCheckout('now',[{id:pdId,qty:pdQty}]);
  });
  // Esc는 창만 닫고 코브 몰 화면은 그대로 — screens.js(나중에 불러옴)의 Esc = 화면 닫기보다 먼저 받음. 창 안 글자를 누르거나 버튼이 꺼져 포커스가 body로 빠져도
  // 안내 창이 떠 있으면 그 창만 닫음 · 회원가입 창처럼 먼저 Esc를 받아 닫은 창이 있으면(defaultPrevented) 상품 창은 그대로
  addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.isComposing||e.defaultPrevented) return;
    const t=tips.filter(x=>x.open).pop();   // 맨 위(나중에 연) 창 — 리뷰 쓰기 위에 리뷰 운영 안내가 겹쳐 열릴 수 있음
    if(t){ e.preventDefault(); if(t===rwDlg){ rwEscAt=performance.now(); rwTryClose(); } else t.close(); return; }
    if(dlg.open){ e.preventDefault(); closePd(); }
  });
}

/* ── 상품 창 위 안내 창: 신규 가입 혜택 · 카드 혜택 · 배송 정보 (멘케트 상품 상세 안내 창을 코브 몰 규칙대로, covv.html dialog.tip) ──
   열 때마다 지금 상태로 채움: 규칙 숫자(data-r) · 내 계정(가입 전 · 로그아웃 · 로그인 중) · 지금 고른 수량의 배송비 */
const tips=[...document.querySelectorAll('dialog.tip')];
const tipJoinTitle=document.querySelector('[data-tip-join-title]'), TIP_JOIN_TITLE=tipJoinTitle?tipJoinTitle.innerHTML:'';   // 처음 문구(코드 상수) — 로그인 중 문구에서 되돌릴 때
let tipDownOut=false;
function paintTip(t){
  t.querySelectorAll('[data-r]').forEach(s=>{ const v=R[s.dataset.r]; if(typeof v==='number') s.textContent=v.toLocaleString('ko-KR'); });
  if(t.id==='tipJoin'){
    const on=W.signedIn(), b=t.querySelector('[data-tip-join]');
    if(on) tipJoinTitle.textContent=`${W.profile().name} 님은 이미 코브 몰 회원이에요`;   // 닉네임은 손님이 쓴 글자 → textContent
    else tipJoinTitle.innerHTML=TIP_JOIN_TITLE;
    b.hidden=on; b.textContent=W.member()?'로그인':'회원가입';   // 로그아웃한 계정이 있으면 로그인 창 (한 브라우저에 계정 하나)
    t.querySelector('.tip-btn.ghost').textContent=on?'확인':'닫기';
  }
  if(t.id==='tipShip'){
    const p=byId(pdId), sum=p?p.price*pdQty:0, free=sum>=R.SHIP_FREE;
    t.querySelector('[data-tip-ship-lead]').textContent=free?`이 키링 ${pdQty}개는 배송비가 무료예요`:`이 키링은 배송비 ${won(R.SHIP_FEE)}이에요`;
    t.querySelector('[data-tip-ship-sub]').textContent=free?`상품 ${won(R.SHIP_FREE)} 이상이라 무료 · 숫자는 예시예요`:`${won(R.SHIP_FREE-sum)} 더 담으면 배송비 무료 · 숫자는 예시예요`;
  }
}
function openTip(id){
  const t=document.getElementById(id);
  if(!t||!t.showModal||t.open) return;
  paintTip(t); t.showModal(); liftToast();
  t.querySelector('.tip-body').scrollTop=0;
}
tips.forEach(t=>{
  t.addEventListener('pointerdown',e=>{ tipDownOut=e.target===t; });   // 창 안 글자를 끌다 배경에서 놓아도 닫히지 않게 (상품 창과 같음)
  t.addEventListener('click',e=>{
    if((e.target===t&&tipDownOut&&t!==rwDlg)||e.target.closest('[data-tip-close]')){ if(t===rwDlg) rwTryClose(); else t.close(); return; }   // 바깥(배경) · ✕ · 닫기 · 확인 — 리뷰 쓰기는 바깥을 눌러도 안 닫힘(쓰던 글이 날아가지 않게)
    if(e.target.closest('[data-tip-join]')){ t.close(); if(window.covvJoin) window.covvJoin(); }   // 안내 창을 닫고 회원가입(또는 로그인) 창 — 상품 창은 뒤에 그대로
  });
});

/* ── 키링 주소 · 공유: covv.html?k=상품id#mall → 그 키링 창이 바로 열림 ──
   틱톡 · 레드노트 소개 글이나 친구에게 키링 하나를 바로 보여 주려고. 휴대폰은 기기 공유 창, 그 밖엔 링크 복사 (카카오 SDK 같은 외부 스크립트 없음 — CSP 그대로)
   k는 진열대 상품 id와 똑같을 때만 조회 키로 쓰고 화면에 넣지 않음 · 연 뒤엔 주소에서 지움(새로고침 · 뒤로 가기에 같은 창이 또 뜨지 않게, history.state는 그대로 — screens.js 방문 기록) */
const shareUrl=id=>location.origin+location.pathname+'?k='+encodeURIComponent(id)+'#mall';
(()=>{
  let k=''; try{ k=new URLSearchParams(location.search).get('k')||''; }catch(e){}
  if(!k) return;
  const drop=()=>{ try{ const u=new URL(location.href); u.searchParams.delete('k'); history.replaceState(history.state,'',u.pathname+u.search+u.hash); }catch(e){} };
  const p=SELL.find(x=>x.id===k);
  if(!p||location.hash!=='#mall'){ drop(); return; }   // 모르는 상품 · #mall 없는 주소(?k=tiger#about 등)는 열지 않음
  const on=e=>{ if(e.detail!=='mall') return; removeEventListener('covv-screen',on); drop(); setTimeout(()=>openProduct(p.id),0); };   // 코브 몰 화면이 열린 뒤 (screens.js가 #mall을 열며 보냄) — 같은 이벤트의 '화면이 바뀌면 상품 창 닫기'(아래)가 먼저 끝나게 한 박자 뒤
  addEventListener('covv-screen',on);
})();
async function sharePd(){
  const p=byId(pdId); if(!p) return;
  const base=SELL.find(x=>x.id===p.base)||p, url=shareUrl(base.id), box=$d('[data-pd-share-box]');
  if(navigator.share&&matchMedia('(pointer: coarse)').matches){
    try{ await navigator.share({title:`${base.name} · 코브 몰`,text:'들판에서 놀고, 키링으로 데려가요',url}); return; }
    catch(e){ if(e&&e.name==='AbortError') return; }   // 손님이 공유 창을 닫음 → 아무것도 안 함 (다른 실패면 아래 복사로)
  }
  try{
    await navigator.clipboard.writeText(url);
    toast('🔗 링크를 복사했어요 · 열면 이 키링 창이 바로 떠요'); box.hidden=true; return;
  }catch(e){}
  $d('#pdShareHelp').textContent=matchMedia('(pointer: coarse)').matches?'길게 눌러 복사하세요':'⌘C (Ctrl+C)로 복사하세요';
  const inp=box.querySelector('input'); inp.value=url; box.hidden=false; inp.focus(); inp.select();   // 복사가 막힌 브라우저(http로 연 와이파이 미리보기 등) → 직접 복사
}

/* ── 리뷰 쓰기 (멘케트 상품 상세 리뷰 쓰기 창, covv.html #rwDlg) ──
   열 때마다 그 상품의 내 리뷰로 채움(없으면 별 5 · 딱 좋아요 · 아주 좋아요 · 빈 글) → 등록하면 이 브라우저에만 저장하고 리뷰 카드 맨 앞에 '내 리뷰'로
   사진은 고르는 즉시 이 브라우저 안에서 줄여 data URL로 (CSP가 blob: 그림을 막음) — 어디에도 보내지 않음
   rwSess = 창을 연 회차: 크롬은 dialog close 이벤트를 다음 프레임에 보내고 사진 줄이기는 몇 초 걸림 → 지난 회차의 늦은 일이 새로 연 창을 건드리지 않게 (사진 1장이 보였는데 0장으로 저장되던 것) */
const rwDlg=document.getElementById('rwDlg'), rwForm=document.getElementById('rwForm');
const $w=s=>rwDlg.querySelector(s);
let rwPhotos=[], rwBusy=false, rwDelArmed=false, rwCloseArmed='', rwSess=0, rwStart='', rwEscAt=0, rvStale=false;   // rwCloseArmed = 닫기 경고를 띄운 때의 내용(rwState)
if(rwDlg&&rwForm){
  // 고른 별 · 칩과 포커스 표시는 input 바로 뒤 span에 (:has()를 모르는 브라우저에서도 보이게) — 코드 상수만 innerHTML
  $w('[data-rw-stars]').innerHTML=[1,2,3,4,5].map(n=>`<label class="rw-star"><input class="sr-only" type="radio" name="star" value="${n}"><span aria-hidden="true">★</span><span class="sr-only">${n}점</span></label>`).join('');
  [['size',RW_SIZE],['quality',RW_QUALITY]].forEach(([nm,list])=>{ $w(`[data-rw-chips="${nm}"]`).innerHTML=list.map(([v,t])=>`<label class="rw-chip"><input class="sr-only" type="radio" name="${nm}" value="${v}"><span>${t}</span></label>`).join(''); });
  $w('#rwText').maxLength=RW_MAX;
}
const rwState=()=>JSON.stringify([...new FormData(rwForm)].concat([['photos',rwPhotos.map(d=>d.length).join(',')]]));   // 지금 쓴 내용 (열 때와 다르면 닫기 전에 한 번 더 확인)
function paintStars(){ const v=Number((rwForm.querySelector('[name="star"]:checked')||{}).value)||0; rwForm.querySelectorAll('.rw-star').forEach((l,i)=>{ l.classList.toggle('on',i<v); }); $w('[data-rw-score]').textContent=`${v} / 5`; }
function paintCount(){ $w('#rwCount').textContent=`${$w('#rwText').value.length} / ${RW_MAX}`; }
function paintPhotos(){
  const ul=$w('#rwPics'); ul.textContent='';
  rwPhotos.forEach((d,i)=>{ const li=el('li'), im=el('img'), x=el('button',null,'✕'); im.src=d; im.alt=`올린 사진 ${i+1}`; x.type='button'; x.dataset.rwOut=i; x.setAttribute('aria-label',`사진 ${i+1} 빼기`); li.append(im,x); ul.append(li); });
  ul.hidden=!rwPhotos.length;
  const full=rwPhotos.length>=RW_PHOTOS;
  const f=$w('#rwFile');
  if(full&&document.activeElement===f) ($w('#rwPics li:last-child [data-rw-out]')||$w('#rwText')).focus();   // 포커스가 있던 칸이 꺼지면 문서로 빠짐 → 마지막 사진 ✕로
  f.disabled=full; f.setAttribute('aria-disabled',String(full||rwBusy)); $w('.rw-add').classList.toggle('full',full||rwBusy);
  $w('[data-rw-n]').textContent=`${rwPhotos.length} / ${RW_PHOTOS}`;
  $w('[data-rw-hint]').textContent=rwBusy?'사진을 줄이는 중이에요…':`사진은 ${RW_PHOTOS}장까지 올릴 수 있어요`;
  $w('[data-rw-submit]').disabled=rwBusy;   // 줄이는 중에 등록하면 아직 안 끝난 사진이 빠짐
}
const setRadio=(nm,v)=>{ const r=rwForm.querySelector(`[name="${nm}"][value="${v}"]`); if(r) r.checked=true; };
function openWrite(){
  const p=byId(pdId);
  if(!p||!rwDlg||!rwDlg.showModal||rwDlg.open) return;
  rwSess++;
  const mine=reviews[p.base], img=$w('#rwImg');
  img.src=p.img; img.alt=''; $w('.rw-thumb').style.background=p.paper;
  $w('#rwName').textContent=p.name;
  $w('#rwSub').textContent=mine&&mine.day?`${mine.day.replace(/^(\d+)-(\d+)-(\d+)$/,'$1년 $2월 $3일')}에 쓴 리뷰 · 이 브라우저에만 있어요`:'아직 판매 전이라 미리 써 보는 리뷰예요';
  rwForm.reset();
  const sel=$w('#rwSku'); sel.textContent='';
  SKUS.filter(k=>k.base===p.base).forEach(k=>{ const o=el('option',null,k.name); o.value=k.id; sel.append(o); });
  sel.value=mine?mine.sku:p.id; sel.disabled=sel.options.length<2;   // 종류가 하나뿐이면 고를 것이 없음
  setRadio('star',mine?mine.star:5); setRadio('size',mine&&mine.size||'fit'); setRadio('quality',mine&&mine.quality||'great');   // 처음 값은 멘케트 시안처럼 '딱 맞아요 · 아주 좋아요' 자리
  $w('#rwText').value=mine?mine.text:'';
  rwPhotos=mine?mine.photos.slice():[]; rwBusy=false; rwDelArmed=false; rwCloseArmed='';
  $w('#rwErr').textContent='';
  $w('[data-rw-submit]').textContent=mine?'리뷰 고치기':'리뷰 등록';
  const del=$w('[data-rw-del]'); del.hidden=!mine; del.textContent='지우기';
  paintStars(); paintCount(); paintPhotos();
  rwStart=rwState();
  rwDlg.showModal(); rwForm.scrollTop=0; liftToast();
}
// 닫기(✕ · 취소 · Esc · 안드로이드 뒤로 가기): 쓰던 내용이 열 때와 다르면 한 번 더 눌러야 닫힘 (바깥 누르기로는 아예 안 닫힘)
function rwTryClose(){
  const now=rwState();
  if(now!==rwStart&&now!==rwCloseArmed){ rwCloseArmed=now; $w('#rwErr').textContent='쓰던 리뷰가 있어요 · 한 번 더 누르면 저장하지 않고 닫아요'; return; }   // 경고 뒤에 또 고쳤으면 다시 경고
  rwDlg.close();
}
// 사진 한 장 → 긴 변 RW_PX의 JPEG data URL, 못 읽거나 RW_PHOTO_LEN을 넘으면 null (이 브라우저 안에서만 — 어디에도 보내지 않음)
function shrinkPhoto(file){
  return new Promise(res=>{
    if(!file||!/^image\//.test(file.type)||file.size>RW_FILE_MAX) return res(null);
    const rd=new FileReader();
    rd.onerror=()=>res(null);
    rd.onload=()=>{
      const im=new Image();
      im.onerror=()=>res(null);
      im.onload=()=>{
        try{
          const k=Math.min(1,RW_PX/Math.max(im.naturalWidth,im.naturalHeight,1)), c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(im.naturalWidth*k)); c.height=Math.max(1,Math.round(im.naturalHeight*k));
          const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);   // 투명 PNG도 흰 바탕 JPEG로
          let d=c.toDataURL('image/jpeg',RW_Q); if(d.length>=RW_PHOTO_LEN) d=c.toDataURL('image/jpeg',RW_Q*.6);   // 잡음 많은 사진은 품질을 낮춰 한 번 더
          res(d.length<RW_PHOTO_LEN&&RW_PHOTO_RE.test(d)?d:null);
        }catch(e){ res(null); }
      };
      im.src=rd.result;
    };
    rd.readAsDataURL(file);
  });
}
if(rwDlg&&rwForm){
  rwForm.addEventListener('change',e=>{ if(e.target.name==='star') paintStars(); });
  $w('#rwText').addEventListener('input',()=>{ paintCount(); if($w('#rwText').value.trim().length>=RW_MIN) $w('#rwErr').textContent=''; });
  $w('#rwFile').addEventListener('change',async e=>{
    const inp=e.target, files=[...inp.files], s=rwSess, room=RW_PHOTOS-rwPhotos.length; inp.value='';   // 같은 사진을 다시 골라도 change가 오게
    if(rwBusy){ $w('#rwErr').textContent='사진을 줄이는 중이에요 · 끝난 뒤에 더 올려 주세요'; return; }
    if(!files.length||room<1) return;
    rwBusy=true; paintPhotos();
    let bad=0;
    for(const f of files.slice(0,room)){
      const d=await shrinkPhoto(f);
      if(s!==rwSess||!rwDlg.open) return;   // 기다리는 동안 창을 닫거나 다시 열었음 → 이 회차 일은 버림 (새 창은 openWrite가 이미 처음부터)
      if(!d) bad++; else if(rwPhotos.length<RW_PHOTOS) rwPhotos.push(d);
      paintPhotos();   // 한 장씩 바로 보이게
    }
    rwBusy=false; paintPhotos();
    $w('#rwErr').textContent=files.length>room?`사진은 ${RW_PHOTOS}장까지라 앞의 ${room}장만 올렸어요`:bad?'열 수 없거나 너무 큰 사진은 빼고 올렸어요':'';
  });
  rwDlg.addEventListener('click',e=>{
    const tp=e.target.closest('[data-tip]'); if(tp){ openTip(tp.dataset.tip); return; }   // '리뷰 운영 안내 보기' → 이 창 위에 겹쳐 엶
    const out=e.target.closest('[data-rw-out]');
    if(out){ rwPhotos.splice(Number(out.dataset.rwOut),1); paintPhotos(); const f=$w('#rwFile'); (f.disabled?($w('[data-rw-out]')||$w('#rwText')):f).focus(); return; }   // 누른 ✕는 사라짐 → 사진 올리기 칸으로 (꺼져 있으면 남은 사진 · 글 칸으로)
    if(e.target.closest('[data-rw-del]')){   // 두 번 눌러야 지움 (실수로 한 번 눌러 쓴 리뷰가 사라지지 않게)
      const b=e.target.closest('[data-rw-del]');
      if(!rwDelArmed){ rwDelArmed=true; b.textContent='한 번 더'; $w('#rwErr').textContent='지우기를 한 번 더 누르면 내 리뷰가 지워져요'; return; }
      const p=byId(pdId); if(!p) return;
      delete reviews[p.base]; saveReviews(); rwDlg.close(); paintReviews(); toast('🗑️ 내 리뷰를 지웠어요');
    }
  });
  rwDlg.addEventListener('cancel',e=>{ e.preventDefault(); if(performance.now()-rwEscAt>200) rwTryClose(); });   // 안드로이드 뒤로 가기 몸짓 (Esc는 아래 keydown이 먼저 받음 — 한 번 누름에 두 번 세지 않게)
  rwDlg.addEventListener('close',()=>{
    if(rwDlg.open) return;   // 늦게 온 지난 회차의 close
    rwDelArmed=false; rwCloseArmed='';
    if(rvStale&&dlg&&dlg.open){ rvStale=false; paintReviews(); }   // 쓰는 동안 다른 탭에서 리뷰가 바뀌었음
  });
  rwForm.addEventListener('submit',e=>{
    e.preventDefault();
    const p=byId(pdId); if(!p) return;
    if(rwBusy){ $w('#rwErr').textContent='사진을 줄이는 중이에요 · 잠시 뒤에 눌러 주세요'; return; }
    const text=$w('#rwText').value.trim();
    if(text.length<RW_MIN){ $w('#rwErr').textContent=`리뷰는 ${RW_MIN}자 이상 적어 주세요 (지금 ${text.length}자)`; $w('#rwText').focus(); return; }
    const pick=nm=>(rwForm.querySelector(`[name="${nm}"]:checked`)||{}).value||'', k=byId($w('#rwSku').value);
    const had=reviews[p.base], rec={star:Math.max(1,Math.min(5,Number(pick('star'))||5)), sku:k&&k.base===p.base?k.id:p.base, size:pick('size'), quality:pick('quality'), text:text.slice(0,RW_MAX), day:W.today(), photos:rwPhotos.slice(0,RW_PHOTOS)};
    reviews[p.base]=rec;
    let msg=had?'📝 리뷰를 고쳤어요 · 이 브라우저에만 저장돼요':'📝 리뷰를 남겼어요 · 이 브라우저에만 저장돼요';
    if(!saveReviews()){   // 저장 칸이 모자람 → 사진 빼고 한 번 더
      rec.photos=[];
      if(!saveReviews()){ if(had) reviews[p.base]=had; else delete reviews[p.base]; $w('#rwErr').textContent='이 브라우저 저장소가 가득 차서 저장하지 못했어요'; return; }
      msg='📝 저장 칸이 모자라 사진은 빼고 리뷰만 남겼어요';
    }
    if(!had) W.log(`📝 ${(SELL.find(x=>x.id===p.base)||p).name}에 리뷰를 남겼어요`);
    rwDlg.close(); paintReviews(); toast(msg);
  });
}
// 다른 탭에서 리뷰를 쓰거나 지우면 여기도 (리뷰 쓰기 창이 열려 있으면 닫힐 때 다시 그림)
addEventListener('storage',e=>{
  if(e.key!==REVIEW_KEY&&e.key!==null) return;
  loadReviews();
  if(rwDlg&&rwDlg.open) rvStale=true;
  else if(dlg&&dlg.open) paintReviews();
});

// 코브 몰: 오린 사진 · '자세히 · 구매' → 상품 창, '🛒 장바구니' → 주문서 (상품 창 안의 '장바구니 보기'도)
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-open]');
  if(o){ const k=o.closest('.kr[data-p]'); if(k&&byId(k.dataset.p)){ openProduct(k.dataset.p); return; } }
  if(e.target.closest('[data-cart]')) goCheckout('cart');
});

/* ══════════ 주문/결제 화면 ══════════ */
const root=document.getElementById('checkoutRoot');
let isOpen=false, useCoupon=true;
if(root){
root.innerHTML=`
  <div class="co-grid">
    <div class="co-main">
      <section class="co-box" aria-labelledby="coItemsTitle">
        <h3 id="coItemsTitle" tabindex="-1">주문 상품 <span class="co-sub" data-co-count></span></h3>
        <p class="co-mode" data-co-mode></p>
        <ul class="co-lines" data-co-lines></ul>
        <div class="co-empty" data-co-empty hidden>
          <p>주문할 상품이 없어요. 코브 몰에서 키링을 골라 주세요.</p>
          <button type="button" class="co-btn" data-go="mall">코브 몰 구경하기</button>
        </div>
      </section>
      <section class="co-box" aria-labelledby="coShipTitle">
        <h3 id="coShipTitle">배송지</h3>
        <div class="co-ship">
          <p><b>배송지는 아직 받지 않아요</b></p>
          <p class="fine">카카오 로그인과 개인정보 처리방침이 준비되면 받는 분 · 연락처 · 주소를 여기서 입력해요. 지금은 이름 · 연락처 · 주소를 저장하지 않아요.</p>
          <button type="button" class="co-btn ghost" disabled>배송지 입력 (준비 중)</button>
        </div>
      </section>
      <section class="co-box" aria-labelledby="coCouponTitle">
        <h3 id="coCouponTitle">할인</h3>
        <label class="co-check"><input type="checkbox" id="coUseCoupon" checked> 금화 쿠폰 쓰기 <span class="co-sub" data-co-have></span></label>
        <p class="fine" data-co-coupon-note></p>
      </section>
      <section class="co-box" aria-labelledby="coPayTitle">
        <h3 id="coPayTitle">결제 수단</h3>
        <div class="co-pays" role="radiogroup" aria-labelledby="coPayTitle">
          <label class="co-pay"><input type="radio" name="coPay" value="card" checked><span>신용·체크카드</span></label>
          <label class="co-pay"><input type="radio" name="coPay" value="bank"><span>계좌이체</span></label>
          <label class="co-pay"><input type="radio" name="coPay" value="easy"><span>간편결제</span></label>
        </div>
        <p class="fine">결제는 코브 몰이 문을 열면 시작해요. 지금은 눌러도 돈이 나가지 않아요.</p>
      </section>
    </div>
    <aside class="co-sum" data-co-sum aria-labelledby="coSumTitle">
      <h3 id="coSumTitle">최종 결제 금액</h3>
      <dl>
        <div><dt>상품 금액</dt><dd data-co-subtotal></dd></div>
        <div><dt>배송비</dt><dd data-co-ship></dd></div>
        <div class="off"><dt>금화 쿠폰 할인</dt><dd data-co-off></dd></div>
        <div class="total"><dt>총 결제 금액</dt><dd data-co-total></dd></div>
      </dl>
      <p class="fine" data-co-ship-note></p>
      <label class="co-check co-agree"><input type="checkbox" id="coAgree"> 주문 내용을 확인했고 결제에 동의해요</label>
      <p class="fine co-minor">만 19세 미만이 법정대리인(부모님 등)의 동의 없이 한 주문은 본인이나 법정대리인이 취소할 수 있어요</p>
      <button type="button" class="co-pay-btn" data-co-pay>결제하기</button>
      <p class="co-err" data-co-err role="alert"></p>
      <p class="co-note" data-co-note role="status"></p>
      <p class="sr-only" data-co-live aria-live="polite"></p>
    </aside>
  </div>
  <div class="co-bar" data-co-bar hidden><span>총 결제 금액 <b></b></span><button type="button" class="co-btn" data-co-jump>결제하러 가기 ↓</button></div>
`;
}
const $=s=>root.querySelector(s);

// 지금 주문서 금액 — 배송비는 상품 금액(쿠폰 할인 전)을 알아야 정해져서 두 번 계산
function quoteNow(){
  const items=lines(); if(!items.length) return null;
  const coins=useCoupon?W.get('coin'):0, q0=R.quote({items,coins},CATALOG,{shipping:0});
  return q0.ok?R.quote({items,coins},CATALOG,{shipping:R.shippingFor(q0.subtotal)}):q0;
}
function qtyBox(p,q){
  const box=el('div','qty'), minus=el('button',null,'−'), out=el('output',null,String(q)), plus=el('button',null,'+');
  minus.type=plus.type='button'; minus.dataset.step='-1'; plus.dataset.step='1'; minus.dataset.id=plus.dataset.id=p.id;
  minus.setAttribute('aria-label',`${p.name} 하나 빼기`); plus.setAttribute('aria-label',`${p.name} 하나 더하기`); out.setAttribute('aria-label','수량');
  minus.disabled=q<=1; plus.disabled=q>=R.QTY_MAX;
  box.append(minus,out,plus); return box;
}
function paint(){
  if(!root) return;
  const items=lines(), q=quoteNow(), coin=W.get('coin'), have=R.coupons(coin), cartMode=order.mode==='cart';
  $('[data-co-count]').textContent=items.length?`${items.reduce((n,x)=>n+x.qty,0)}개`:'';
  $('[data-co-mode]').textContent=items.length?(cartMode?'🛒 장바구니에 담은 상품 전부':'⚡ 바로 구매'):'';
  $('[data-co-empty]').hidden=!!items.length;
  // 주문 상품 줄
  const ul=$('[data-co-lines]'); ul.textContent='';
  items.forEach(it=>{
    const p=byId(it.id), ln=q&&q.ok?q.lines.find(x=>x.id===it.id):null, li=el('li','co-line');
    const th=el('div','co-thumb'), paper=el('span','kr-paper'), img=el('img');
    paper.style.background=p.paper; img.src=p.img; img.alt=''; img.width=img.height=300; img.decoding='async'; th.append(paper,img);
    const info=el('div','co-info'); info.append(el('b','co-name',p.name),el('span','co-unit',`${won(p.price)} × ${it.qty}개`),qtyBox(p,it.qty));
    const amt=el('div','co-amt'); amt.appendChild(el('b',null,won(ln?ln.pay:p.price*it.qty)));
    if(ln&&ln.discount) amt.appendChild(el('span','co-off',`쿠폰 −${won(ln.discount)}`));
    if(cartMode){ const del=el('button','co-del','✕'); del.type='button'; del.dataset.del=p.id; del.setAttribute('aria-label',`${p.name} 장바구니에서 빼기`); amt.appendChild(del); }
    li.append(th,info,amt); ul.appendChild(li);
  });
  // 할인 (금화 쿠폰)
  const use=$('#coUseCoupon'); use.disabled=!have; use.checked=useCoupon&&!!have;
  $('[data-co-have]').textContent=`보유 ${have}장 (금화 ${coin.toLocaleString('ko-KR')}개)`;
  $('[data-co-coupon-note]').textContent=!have?`금화 ${R.coinsToNext(coin)}개를 더 모으면 쿠폰 1장이 생겨요. 쿠폰 1장 = 키링 1개 ${R.COUPON_WON}원 할인`
    :q&&q.ok&&q.couponsUsed?`키링 ${q.couponsUsed}개에 ${R.COUPON_WON}원씩 할인 · 금화 ${q.coinsUsed}개는 결제가 끝난 뒤에 빠져요`
    :useCoupon?`키링 1개당 쿠폰 1장, ${R.COUPON_WON}원씩 할인돼요`:'쿠폰을 쓰지 않아요. 금화는 그대로예요';
  // 최종 결제 금액
  const ok=q&&q.ok;
  $('[data-co-subtotal]').textContent=ok?won(q.subtotal):'0원';
  $('[data-co-ship]').textContent=ok?(q.shipping?'+'+won(q.shipping):'무료'):'0원';
  $('[data-co-off]').textContent=ok&&q.discount?'−'+won(q.discount):'0원';
  $('[data-co-total]').textContent=ok?won(q.total):'0원';
  $('[data-co-ship-note]').textContent=!ok?'':q.subtotal<R.SHIP_FREE?`${won(R.SHIP_FREE-q.subtotal)} 더 담으면 배송비 무료`:'배송비 무료예요 🎉';
  const pay=$('[data-co-pay]'); pay.disabled=!ok; pay.textContent=ok?`${won(q.total)} 결제하기`:'결제하기';
  $('[data-co-note]').textContent='';
  const bar=$('[data-co-bar]'); if(bar){ bar.hidden=!ok; bar.querySelector('b').textContent=ok?won(q.total):''; }
}
function setQty(id,step){
  const it=lines().find(x=>x.id===id); if(!it) return;
  it.qty=Math.max(1,Math.min(R.QTY_MAX,it.qty+step));
  if(order.mode==='cart') saveCart(); else saveOrder();
  paint();
  const b=root.querySelector(`[data-step="${step>0?1:-1}"][data-id="${id}"]`), o=root.querySelector(`[data-step="${step>0?-1:1}"][data-id="${id}"]`);
  (b&&!b.disabled?b:o).focus();   // 다시 그려도 누르던 버튼에 (1·99에서 꺼졌으면 반대쪽) 포커스
  const q=quoteNow(); $('[data-co-live]').textContent=`${byId(id).name} ${it.qty}개`+(q&&q.ok?` · 총 결제 금액 ${won(q.total)}`:'');   // 다시 그린 칸은 화면낭독기가 안 읽어서
}
if(root){
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-co-jump]')){ const sum=$('[data-co-sum]'); sum.scrollIntoView({block:'start',behavior:RM.matches?'auto':'smooth'}); $('#coAgree').focus({preventScroll:true}); return; }   // 휴대폰 아래 띠 → 최종 결제 금액 칸으로
    const s=e.target.closest('[data-step]');
    if(s){ setQty(s.dataset.id,Number(s.dataset.step)); return; }
    const d=e.target.closest('[data-del]');
    if(d){ cart=cart.filter(x=>x.id!==d.dataset.del); saveCart(); paint(); $('#coItemsTitle').focus(); return; }
    if(e.target.closest('[data-co-pay]')){
      const err=$('[data-co-err]'), agree=$('#coAgree');
      if(!agree.checked){ err.textContent='주문 내용을 확인하고 동의에 체크해 주세요'; agree.focus(); return; }
      err.textContent='';
      $('[data-co-note]').textContent='🚧 아직 결제는 열리지 않았어요. 코브 몰이 문을 열면 여기서 결제해요 — 돈은 나가지 않았고 금화도 그대로예요';   // 토스트는 몇 초 뒤 사라져서 결제 버튼 밑에 남김
    }
  });
  root.addEventListener('change',e=>{
    if(e.target.id==='coUseCoupon'){ useCoupon=e.target.checked; paint(); }
    if(e.target.id==='coAgree'&&e.target.checked) $('[data-co-err]').textContent='';
  });
}

addEventListener('covv-screen',e=>{
  isOpen=e.detail==='checkout'; tips.forEach(t=>{ if(t.open) t.close(); }); closePd(); if(isOpen) paint();   // 뒤로·앞으로로 화면이 바뀌어도 상품 창과 그 위 안내 · 리뷰 쓰기 창은 닫음
  if(goneN&&!goneTold&&(e.detail==='mall'||isOpen)){ goneTold=true; toast(`🧺 진열대에서 내려간 상품 ${goneN}개는 장바구니에서 뺐어요`); }
});
// 휴대폰(한 줄 배치)에서 최종 결제 금액 칸이 화면에 보이면 아래 띠를 숨김 — 같은 금액이 두 번 보이지 않게 (넓은 화면은 style.css가 띠를 늘 숨김)
if(root&&'IntersectionObserver' in window){ const bar=$('[data-co-bar]'); new IntersectionObserver(es=>{ bar.classList.toggle('off',es[es.length-1].isIntersecting); }).observe($('[data-co-sum]')); }
W.on(()=>{ if(isOpen) paint(); });   // 들판·다른 탭에서 금화가 바뀌면 할인도 다시
addEventListener('storage',e=>{
  if(e.key!==CART_KEY) return;
  try{ cart=cleanLines(JSON.parse(e.newValue||'[]',noProto)); }catch(_){ cart=[]; }
  paintCartN(); if(isOpen&&order.mode==='cart') paint();
});
paintCartN();
})();
