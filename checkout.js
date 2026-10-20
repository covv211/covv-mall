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
const SELL=A.PRODUCTS.filter(p=>p.img&&p.price>0);   // 진열대에서 살 수 있는 상품 = 사진 상품 (한정판 무지개는 아직)
// 실제로 주문하는 단위 = 상품마다 고르는 색상 · 캐릭터 종류(covvArt.OPTIONS). 종류가 없거나 첫 줄이 빠져도 진열대 상품 자체는 늘 하나로 들어가게
const SKUS=[];
SELL.forEach(p=>{
  const os=(A.OPTIONS&&Array.isArray(A.OPTIONS[p.id]))?A.OPTIONS[p.id]:[];
  (os.some(o=>o&&o.id===p.id)?os:[{id:p.id},...os]).forEach(o=>{
    if(!o||typeof o.id!=='string'||SKUS.some(x=>x.id===o.id)) return;   // 다른 상품과 겹친 id는 버림 (장바구니 줄이 섞이지 않게)
    SKUS.push({id:o.id, base:p.id, name:o.name||p.name, img:o.img||p.img, paper:o.paper||p.paper, price:o.price||p.price, desc:o.desc||p.desc, shots:o.shots||p.shots, story:o.story||p.story});
  });
});
const CATALOG={}; SKUS.forEach(k=>{ CATALOG[k.id]={price:k.price}; });   // quote()용 가격표 (화면 표시용 — 서버는 자기 가격표로 다시 계산)
const byId=id=>SKUS.find(k=>k.id===id)||null;
const won=n=>n.toLocaleString('ko-KR')+'원';
const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
const toast=t=>{ if(window.covvToast) window.covvToast(t); };
const noProto=(k,v)=>k==='__proto__'?undefined:v;

/* ══════════ 장바구니 ══════════ */
// 줄 모양 맞추기 — 저장소는 손님이 바꿀 수 있으니 아는 상품 · 1~99개 · 최대 20줄만 (같은 상품 두 줄은 합침)
function cleanLines(v){
  const out=[];
  if(!Array.isArray(v)) return out;
  for(const it of v.slice(0,50)){
    if(!it||typeof it!=='object'||typeof it.id!=='string'||!byId(it.id)||typeof it.qty!=='number'||!(it.qty>=1)) continue;
    const q=Math.min(R.QTY_MAX,Math.floor(it.qty)), have=out.find(x=>x.id===it.id);
    if(have) have.qty=Math.min(R.QTY_MAX,have.qty+q);
    else if(out.length<R.LINES_MAX) out.push({id:it.id,qty:q});
  }
  return out;
}
let cart=[];
try{ cart=cleanLines(JSON.parse(localStorage.getItem(CART_KEY)||'[]',noProto)); }catch(e){}
function saveCart(){
  try{ if(cart.length) localStorage.setItem(CART_KEY,JSON.stringify(cart)); else localStorage.removeItem(CART_KEY); }catch(e){}
  paintCartN();
}
const cartCount=()=>cart.reduce((n,x)=>n+x.qty,0);
function paintCartN(){ document.querySelectorAll('[data-cart-n]').forEach(b=>{ b.textContent=cartCount(); }); }
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
let pdId=null, pdQty=1, pdDownOut=false;
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
// 큰 사진 아래: 사진 몇 장 · 상품 소개 (mall.js PRODUCTS의 shots · story, 종류마다 따로 줘도 됨). 아직 없으면 빈 사진 자리 · 짧은 소개(desc) + 채울 곳 안내
const SHOT_HOLES=3;   // 사진이 없을 때 보여 줄 빈 사진 자리 수
function paintMore(p){
  const box=$d('#pdShots'), st=$d('#pdStory'); if(!box||!st) return;
  const shots=Array.isArray(p.shots)?p.shots.filter(s=>typeof s==='string'&&s):[];
  box.textContent='';
  shots.forEach((s,i)=>{ const f=el('figure','pd-shot'), im=el('img'); im.src=s; im.alt=`${p.name} 사진 ${i+2}`; im.loading='lazy'; im.decoding='async'; im.width=im.height=560; f.append(im); box.append(f); });
  // ↑ width·height = 불러오기 전에도 네모 자리를 잡아 둠(아래 소개가 덜 밀림), 불러오면 사진 비율대로
  if(!shots.length) for(let i=0;i<SHOT_HOLES;i++){ const h=el('div','pd-shot hole','사진 자리'); h.setAttribute('aria-hidden','true'); box.append(h); }
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
  const list=REVIEW_SAMPLES, dots=$d('[data-rv-dots]');
  const card=(r,clone)=>{
    const n=Math.max(1,Math.min(5,Math.round(r.star)||5)), li=el('li',clone?'pd-rv-card clone':'pd-rv-card'), s=el('span','pd-rv-stars','★'.repeat(n)+'☆'.repeat(5-n)), who=el('p','pd-rv-who');
    s.setAttribute('role','img'); s.setAttribute('aria-label',`별 5개 중 ${n}개`);
    who.append(el('span',null,r.who),el('span','pd-rv-tag','예시'));
    li.append(s,el('p','pd-rv-text',r.text),who);
    if(clone) li.setAttribute('aria-hidden','true');   // 화면낭독기엔 진짜 카드만
    return li;
  };
  rvN=list.length; rvH=rvN>1?Math.min(RV_CLONES,rvN):0; rvTrack.textContent=''; dots.textContent='';
  list.forEach((r,j)=>{ const c=card(r); if(!j) c.classList.add('on'); rvTrack.append(c); dots.append(el('span',j?null:'on')); });   // 첫 카드 · 점은 처음부터 켬 → 동작 줄이기에서 창을 열 때 빈 칸에서 페이드로 시작하지 않음
  if(rvH){ rvTrack.prepend(...list.slice(-rvH).map(r=>card(r,true))); list.slice(0,rvH).forEach(r=>rvTrack.append(card(r,true))); }   // 앞엔 끝 카드들, 뒤엔 처음 카드들 (Swiper loop처럼 양 끝이 이어짐)
  rvTrack.style.setProperty('--h',rvH);
  $d('[data-rv-count]').textContent=rvN||'';
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
  $d('[data-pd-added]').hidden=true; $d('[data-pd-live]').textContent='';
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
  if(!dlg.open) dlg.showModal();
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
  dlg.addEventListener('pointerdown',e=>{ pdDownOut=e.target===dlg; });   // 소개 글자를 끌어 고르다 배경에서 놓으면 click이 창으로 와서 닫혀 버림 → 배경에서 누른 것만
  dlg.addEventListener('click',e=>{
    if((e.target===dlg&&pdDownOut)||e.target.closest('[data-pd-close]')){ closePd(); return; }   // 바깥(배경)이나 ✕를 누르면 닫힘
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
  addEventListener('keydown',e=>{ if(e.key==='Escape'&&!e.isComposing&&dlg.open){ e.preventDefault(); closePd(); } });
}

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
    <aside class="co-sum" aria-labelledby="coSumTitle">
      <h3 id="coSumTitle">최종 결제 금액</h3>
      <dl>
        <div><dt>상품 금액</dt><dd data-co-subtotal></dd></div>
        <div><dt>배송비</dt><dd data-co-ship></dd></div>
        <div class="off"><dt>금화 쿠폰 할인</dt><dd data-co-off></dd></div>
        <div class="total"><dt>총 결제 금액</dt><dd data-co-total></dd></div>
      </dl>
      <p class="fine" data-co-ship-note></p>
      <label class="co-check co-agree"><input type="checkbox" id="coAgree"> 주문 내용을 확인했고 결제에 동의해요</label>
      <button type="button" class="co-pay-btn" data-co-pay>결제하기</button>
      <p class="co-err" data-co-err role="alert"></p>
      <p class="sr-only" data-co-live aria-live="polite"></p>
    </aside>
  </div>
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
    const s=e.target.closest('[data-step]');
    if(s){ setQty(s.dataset.id,Number(s.dataset.step)); return; }
    const d=e.target.closest('[data-del]');
    if(d){ cart=cart.filter(x=>x.id!==d.dataset.del); saveCart(); paint(); $('#coItemsTitle').focus(); return; }
    if(e.target.closest('[data-co-pay]')){
      const err=$('[data-co-err]'), agree=$('#coAgree');
      if(!agree.checked){ err.textContent='주문 내용을 확인하고 동의에 체크해 주세요'; agree.focus(); return; }
      err.textContent='';
      toast('🚧 아직 결제는 열리지 않았어요. 코브 몰이 문을 열면 여기서 결제해요 (금화는 그대로예요)');
    }
  });
  root.addEventListener('change',e=>{
    if(e.target.id==='coUseCoupon'){ useCoupon=e.target.checked; paint(); }
    if(e.target.id==='coAgree'&&e.target.checked) $('[data-co-err]').textContent='';
  });
}

addEventListener('covv-screen',e=>{ isOpen=e.detail==='checkout'; closePd(); if(isOpen) paint(); });   // 뒤로·앞으로로 화면이 바뀌어도 상품 창은 닫음
W.on(()=>{ if(isOpen) paint(); });   // 들판·다른 탭에서 금화가 바뀌면 할인도 다시
addEventListener('storage',e=>{
  if(e.key!==CART_KEY) return;
  try{ cart=cleanLines(JSON.parse(e.newValue||'[]',noProto)); }catch(_){ cart=[]; }
  paintCartN(); if(isOpen&&order.mode==='cart') paint();
});
paintCartN();
})();
