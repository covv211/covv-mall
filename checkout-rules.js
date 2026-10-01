/* ══════════════════════════════════════════════════════════
   코브 몰 결제 규칙 — 할인·결제 금액 계산은 전부 여기 한 곳에서
   - 브라우저(가게 화면)와 나중에 만들 결제 서버가 이 파일을 '그대로' 같이 씀
     → 화면에 보이는 금액과 실제 결제 금액이 어긋나지 않음 (DOM 안 씀, Node에서도 require로 불러짐)
   - 할인: 금화 100개 = 쿠폰 1장 = 키링 1개 100원 할인. 키링 1개에는 쿠폰 1장까지
   - 금화는 브라우저 안에 있어서 해킹할 수 있음 (환영 ㅋㅋ). 그래서 최악이어도 손해는 '100원 × 산 개수'.
     진짜 위험은 금화가 아니라 브라우저가 보낸 가격·수량·할인·금액을 믿는 것 → 서버는 아래 순서를 꼭 지킬 것

   결제 순서 (3단계 코브 몰 자체 결제에서 결제 서버를 만들 때 이대로):
   1) 브라우저 → 서버: 상품 번호 · 수량 · 금화 개수만 보냄 (가격 · 할인 · 결제 금액은 보내지도, 받지도 않음)
   2) 서버: 서버의 가격표로 quote() 계산 → 주문 번호와 금액을 먼저 저장한 뒤 결제창을 엶
   3) 결제가 끝나면 서버가 결제 회사에 '실제로 결제된 금액'을 조회 → 저장해 둔 금액과 같을 때만 주문 확정, 다르면 바로 결제 취소
      (같은 주문 번호가 두 번 확정되지 않게 — 새로고침·두 번 누르기)
   4) 확정된 뒤에만 가방에서 coinsUsed만큼 금화를 뺌 — 결제를 그만두거나 실패하면 금화는 그대로
   5) 반품은 refund()로 계산 — 할인받은 금액을 뺀 만큼 환불, 쓴 금화는 돌려주지 않음. 배송비 환불은 따로 정함
   ══════════════════════════════════════════════════════════ */
(function(g){
'use strict';

const COUPON_COINS=100;        // 쿠폰 1장 = 금화 100개
const COUPON_WON=100;          // 쿠폰 1장 = 키링 1개 100원 할인
const BAG_MAX=9999;            // 가방 아이템 최대 (해킹해도 여기까지) → 쿠폰은 최대 99장
const COUPON_MIN_PRICE=1000;   // 이보다 싼 상품은 할인에서 빠짐 (100원이 너무 큰 비율이 되지 않게)
const QTY_MAX=99;              // 한 주문에서 한 상품 최대 수량
const LINES_MAX=20;            // 한 주문에 담을 수 있는 상품 종류
const PRICE_MAX=10000000;      // 가격표 실수 방지 (천만 원)
const MIN_PAY=100;             // 결제 회사 최소 결제 금액

const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);   // '__proto__' 같은 이름으로 가격표 밖을 못 읽게
const isInt=(v,min,max)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;

// 금화 개수 정리: 글자 · 음수 · NaN → 0, 무한대 · 9,999 넘는 수 → 9,999 (가방과 똑같이)
// 숫자·글자가 아닌 값({} · 배열 · Symbol 등)은 Number()가 에러를 낼 수 있어서 바로 0
function coins(v){
  if(typeof v!=='number'&&typeof v!=='string') return 0;
  const n=Math.floor(Number(v)); return n>0?Math.min(n,BAG_MAX):0;
}
// 가진 쿠폰 수 (금화 100개마다 1장)
function coupons(v){ return Math.floor(coins(v)/COUPON_COINS); }
// 다음 쿠폰까지 모자란 금화 (가방이 가득이면 0 — 더 못 모음)
function coinsToNext(v){ const c=coins(v); return c+COUPON_COINS>BAG_MAX?0:COUPON_COINS-c%COUPON_COINS; }
// 할인받을 수 있는 상품인지 (가격표에 coupon:false로 빼 둔 상품, 1,000원 미만 상품은 제외)
function eligible(p){ return !!p&&p.coupon!==false&&p.price>=COUPON_MIN_PRICE; }

/* 주문 계산 (서버는 이 결과의 total만 결제 금액으로 씀)
   order   = {items:[{id:'pink', qty:2}, ...], coins: 브라우저가 말한 금화 개수}
   catalog = {pink:{price:5000}, sticker:{price:800, coupon:false}, ...} ← 서버의 가격표
   opt     = {shipping: 배송비(원) — 할인 안 됨}
   → {ok:true, lines, subtotal, discount, couponsUsed, coinsUsed, shipping, total} 또는 {ok:false, error, id?} */
function quote(order,catalog,opt){
  const fail=(error,id)=>id===undefined?{ok:false,error}:{ok:false,error,id};
  if(!order||typeof order!=='object'||!catalog||typeof catalog!=='object') return fail('BAD_ORDER');
  const items=order.items;
  if(!Array.isArray(items)||!items.length) return fail('EMPTY');
  if(items.length>LINES_MAX) return fail('TOO_MANY_LINES');
  const shipping=opt&&opt.shipping!==undefined?opt.shipping:0;
  if(!isInt(shipping,0,PRICE_MAX)) return fail('BAD_SHIPPING');

  const byId=new Map();   // 같은 상품이 두 줄로 오면 합침
  for(const it of items){
    if(!it||typeof it!=='object') return fail('BAD_ITEM');
    const id=it.id, qty=it.qty;   // 손님이 보낸 값은 한 번만 읽어서 그 값으로만 검사·계산
    if(typeof id!=='string'||!has(catalog,id)) return fail('UNKNOWN_ITEM',typeof id==='string'?id:undefined);
    const p=catalog[id];
    if(!p||typeof p!=='object'||!isInt(p.price,1,PRICE_MAX)) return fail('BAD_PRICE',id);
    if(!isInt(qty,1,QTY_MAX)) return fail('BAD_QTY',id);   // 0 · 음수 · 소수 · 글자('3') 모두 거절
    const q=(byId.has(id)?byId.get(id).qty:0)+qty;
    if(q>QTY_MAX) return fail('BAD_QTY',id);
    byId.set(id,{id,qty:q,price:p.price,ok:eligible(p)});
  }

  // 쿠폰은 비싼 상품부터 한 개씩 (금액은 어디에 써도 같고, 반품 계산이 늘 같게 나오도록 순서를 정해 둠)
  const lines=[...byId.values()];
  let left=coupons(order.coins);
  const order2=lines.filter(l=>l.ok).sort((a,b)=>b.price-a.price||(a.id<b.id?-1:1));
  for(const l of order2){ l.couponUnits=Math.min(l.qty,left); left-=l.couponUnits; }

  let subtotal=0, discount=0, used=0;
  const out=lines.map(l=>{
    const units=l.couponUnits||0, amount=l.price*l.qty, off=units*COUPON_WON;
    subtotal+=amount; discount+=off; used+=units;
    return {id:l.id, qty:l.qty, price:l.price, couponUnits:units, discount:off, pay:amount-off};
  });
  const total=subtotal-discount+shipping;
  if(total<MIN_PAY) return fail('TOO_SMALL');
  return {ok:true, lines:out, subtotal, discount, couponsUsed:used, coinsUsed:used*COUPON_COINS, shipping, total};
}

/* 반품 환불 계산 — 반품하는 키링은 '할인받은 키링'부터 셈 (할인받은 금액을 뺀 만큼 환불, 쓴 금화는 안 돌려줌)
   line = quote()가 돌려준 lines 중 하나, units = 이번에 반품하는 개수, returned = 이 상품을 전에 반품한 개수
   → 환불 금액(원), 잘못된 값이면 -1 */
function refund(line,units,returned){
  returned=returned===undefined?0:returned;
  if(!line||typeof line!=='object'||!isInt(line.qty,1,QTY_MAX)||!isInt(line.price,1,PRICE_MAX)) return -1;
  const cu=line.couponUnits===undefined?0:line.couponUnits;
  if(!isInt(cu,0,line.qty)||!isInt(returned,0,line.qty)||!isInt(units,1,line.qty-returned)) return -1;
  const offLeft=Math.max(0,cu-returned);
  return units*line.price-Math.min(units,offLeft)*COUPON_WON;
}

const R=Object.freeze({COUPON_COINS,COUPON_WON,BAG_MAX,COUPON_MIN_PRICE,QTY_MAX,LINES_MAX,MIN_PAY,
  coins,coupons,coinsToNext,eligible,quote,refund});
if(typeof module==='object'&&module&&module.exports) module.exports=R;
else g.covvRules=R;
})(typeof globalThis!=='undefined'?globalThis:this);
