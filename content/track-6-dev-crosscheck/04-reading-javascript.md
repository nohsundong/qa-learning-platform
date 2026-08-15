---
id: t6-l04
title: JavaScript 코드 읽기 — 문법이 아니라 판단
summary: 제품 코드를 읽고 "여기 테스트가 필요하다"를 짚어낸다. 조건·경계·비동기·에러 처리에서 결함이 숨는 자리를 찾는다.
minutes: 20
order: 4
tags: [JavaScript, 코드읽기, 코드리뷰, 결함예측]
---

## 개념 설명

### 목표: 읽고 무엇을 테스트할지 판단하기

트랙 3의 8편은 **테스트 코드**를 쓰기 위한 문법이었다. 여기서는 **제품 코드**를 읽는다. 목적이 다르다.

```text
읽으면서 계속 물어야 할 것
  □ 이 조건의 경계는 어디인가
  □ 이 값이 null/undefined 면 어떻게 되는가
  □ 이 비동기가 실패하면 어떻게 되는가
  □ 여기서 예외가 나면 어디로 가는가
  □ 이 함수를 누가 호출하는가
```

**문법을 외우는 게 아니라 "여기가 위험하다"를 감지하는 것**이 목표다.

### 결함이 숨는 자리 1 — 조건문의 경계

트랙 1의 경계값 분석이 코드에서 이렇게 보인다.

```javascript
function canOrder(age, stock, amount) {
  if (age > 19) return false;              // ① > 인가 >= 인가?
  if (stock < 1) return false;             // ② 재고 0 은? 음수는?
  if (amount >= 30000) shippingFee = 0;    // ③ 정확히 30000 은?
  return true;
}
```

**읽으면서 즉시 TC가 나와야 한다.**

| 코드 | 확인할 값 | 왜 |
|---|---|---|
| `age > 19` | 18, 19, 20 | 19세가 되는가 안 되는가 |
| `stock < 1` | -1, 0, 1 | 음수 재고가 가능한 상태인가 |
| `amount >= 30000` | 29999, 30000, 30001 | 정확히 기준선 |

**부등호를 볼 때마다 ±1을 떠올리는 습관**이 이 레슨의 핵심 산출물이다.

**논리 연산자의 단축 평가**도 함정이다.

```javascript
if (user && user.isVip || amount >= 50000) { ... }
//  └──── && 가 먼저 ────┘
// = (user && user.isVip) || (amount >= 50000)
// user 가 null 이어도 amount 가 크면 통과한다 — 의도한 것인가?
```

**괄호가 없는 `&&` 와 `||` 혼용**은 리뷰에서 지적할 만한 지점이다. 의도와 다른 경우가 많다.

### 결함이 숨는 자리 2 — null / undefined

```javascript
const total = order.items.reduce((s, i) => s + i.price, 0);
```

**`order.items` 가 없으면 즉시 크래시**한다. 언제 없을 수 있나?

- 신규 주문에서 아직 아이템을 안 담았을 때
- API가 빈 응답을 줬을 때
- 이전 버전 데이터에 필드가 없을 때 (마이그레이션)

```javascript
// 방어된 코드
const total = (order?.items ?? []).reduce((s, i) => s + (i.price ?? 0), 0);
```

**QA가 볼 것**: `?.` 와 `??` 가 **있는 곳과 없는 곳의 차이**다. 어떤 필드는 방어하고 어떤 필드는 안 했다면, 안 한 쪽이 정말 항상 존재하는지 확인해야 한다.

**JavaScript의 falsy 함정**

```javascript
if (!discount) applyDefault();
// discount 가 0 이면? → falsy 라서 기본값이 적용된다
// "할인 0원"과 "할인 정보 없음"을 구분 못 한다   ← 결함

// 올바른 방어
if (discount === undefined || discount === null) applyDefault();
// 또는
const d = discount ?? getDefault();     // ?? 는 0 과 '' 를 통과시킨다
```

**falsy 값 목록**: `false`, `0`, `-0`, `''`, `null`, `undefined`, `NaN`

**`0` 과 빈 문자열이 falsy** 라는 게 실무 결함의 단골 원인이다. 수량 0, 금액 0, 검색어 빈 문자열에서 터진다.

```javascript
// 자주 보는 결함
if (!quantity) return;              // 수량 0 이면 그냥 리턴 — 의도한 것인가?
if (!searchKeyword) showAll();      // 빈 검색어 = 전체 보기? 아무것도 안 보기?
const name = user.name || '익명';    // name 이 '' 면 '익명' — 의도한 것인가?
```

**세 번째는 `??` 로 고쳐야 하는 대표 사례다.** `||` 는 falsy 전부를, `??` 는 null/undefined 만 잡는다.

### 결함이 숨는 자리 3 — 비동기와 에러 처리

```javascript
async function createOrder(data) {
  const order = await api.post('/orders', data);
  await api.post('/inventory/reserve', { id: order.id });
  await api.post('/payment', { orderId: order.id });
  return order;
}
```

**읽으면서 물어야 할 것**

```text
□ 두 번째 호출이 실패하면 첫 번째로 만든 주문은?  → 고아 데이터
□ 세 번째가 실패하면 예약된 재고는?              → 재고가 묶인다
□ 롤백(보상 트랜잭션)이 어디에도 없다
□ 예외가 나면 호출자에게 어떻게 전달되는가
```

**이게 트랙 2의 로그 분석 과제에서 다룬 바로 그 상황이다.** 코드를 읽으면 왜 그런 일이 생기는지 보인다.

**try/catch 의 위험 신호**

```javascript
// 위험 1: 조용히 삼킨다
try {
  await sendNotification(user);
} catch (e) {
  // 아무것도 안 함  ← 실패가 어디에도 안 남는다
}

// 위험 2: 로그만 찍고 계속 진행
try {
  await chargePayment(order);
} catch (e) {
  console.error(e);      // 결제 실패했는데 주문은 성공 처리된다
}
return { success: true };   // ← 거짓말

// 위험 3: 에러를 뭉갠다
catch (e) {
  throw new Error('처리 실패');   // 원본 에러 정보가 사라진다 → 디버깅 불가
}
```

**"실패했는데 성공으로 응답한다"** 가 위험 2다. 트랙 2에서 배운 **"HTTP 200인데 비즈니스 실패"** 의 코드 수준 원인이다.

**QA가 지적할 수 있는 형태**

> `chargePayment` 실패 시 catch 에서 로그만 남기고 `success: true` 를 반환합니다. 결제가 실패해도 사용자에게는 성공으로 보일 것 같은데, 의도된 동작인가요? 실패 시 응답과 주문 상태를 확인하고 싶습니다.

**질문 형태로 던지는 것**이 좋다. 단정하면 틀렸을 때 곤란하고, 질문하면 개발자가 스스로 확인한다.

**Promise 병렬 처리의 함정**

```javascript
// all: 하나라도 실패하면 전체 실패, 나머지 결과는 버려진다
const [a, b, c] = await Promise.all([getA(), getB(), getC()]);

// allSettled: 전부 기다리고 각각의 성공/실패를 준다
const results = await Promise.allSettled([getA(), getB(), getC()]);
```

**`Promise.all` 을 썼다면**: 하나가 실패했을 때 이미 성공한 것들의 부수효과(생성된 데이터)는 어떻게 되는지 물어야 한다.

### 결함이 숨는 자리 4 — 숫자와 날짜

```javascript
// 부동소수점
0.1 + 0.2                  // 0.30000000000000004
(0.1 + 0.2) === 0.3        // false  ← 금액 계산에서 사고
```

**금액을 소수로 다루는 코드를 보면 경계해야 한다.** 원 단위 정수로 다루거나 별도 라이브러리를 쓰는 게 정석이다.

```javascript
const total = price * 0.9;          // 10000 * 0.9 = 9000 (다행히 정확)
const total2 = price * 1.1;         // 10000 * 1.1 = 11000.000000000002  ← 위험
Math.floor(price * 1.1);            // 절사 규칙이 명세와 일치하는가?
```

**절사·반올림 규칙**은 트랙 4의 도메인 규칙에 넣어둘 항목이다. `Math.floor` / `Math.round` / `Math.ceil` 중 무엇을 쓰는지, 명세와 맞는지 확인한다.

```javascript
// 날짜
new Date('2026-08-15')              // UTC 자정으로 해석
new Date('2026-08-15T00:00:00')     // 로컬 시간으로 해석  ← 다르다!
new Date(2026, 7, 15)               // 월이 0부터 — 7 이 8월

d.getMonth() + 1                    // +1 을 빠뜨리는 실수가 흔하다
```

**타임존 문제**는 트랙 2에서 "9시간 차이나는 데이터"로 다뤘다. 코드에서 `new Date(문자열)` 을 보면 **문자열 형식에 따라 해석이 달라진다**는 것을 기억한다.

```javascript
// 월말 처리
const d = new Date(2026, 0, 31);    // 1월 31일
d.setMonth(1);                       // 2월로 → 2월 31일은 없으므로 3월 3일이 된다
```

**"매월 같은 날 결제" 같은 기능에서 31일 가입자가 어떻게 되는지** 물어야 한다.

### 결함이 숨는 자리 5 — 배열과 참조

```javascript
// 얕은 복사
const copy = { ...original };
copy.items.push(newItem);      // original.items 도 바뀐다!  ← 중첩 객체는 공유

// 정렬은 원본을 바꾼다
const sorted = items.sort((a,b) => a.price - b.price);
// items 도 정렬됐다. 원본 순서에 의존하는 다른 코드가 깨질 수 있다

// 숫자 정렬 함정
[10, 9, 100].sort()            // [10, 100, 9] — 문자열로 비교한다
[10, 9, 100].sort((a,b)=>a-b)  // [9, 10, 100]
```

**정렬 결과가 이상한 화면**을 봤다면 이걸 의심한다.

```javascript
// 배열 메서드의 반환값 혼동
const found = items.find(i => i.id === 10);      // 요소 또는 undefined
const idx = items.findIndex(i => i.id === 10);   // 인덱스 또는 -1

if (idx) { ... }    // idx 가 0 이면 falsy!  ← 첫 번째 요소를 못 찾은 것으로 처리
if (idx !== -1) { ... }   // 올바름
```

**`findIndex` 결과를 `if (idx)` 로 검사하는 것**은 실제로 자주 보이는 버그다.

### 코드를 읽고 TC를 뽑는 연습

```javascript
export function calculateShipping(order, user) {
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (user.grade === 'VIP') return 0;
  if (subtotal >= 30000) return 0;
  if (order.address.isRemote) return 6000;
  return 3000;
}
```

**읽으면서 나오는 TC와 질문**

```text
경계값
  □ subtotal 이 정확히 30000
  □ 29999 / 30001
  □ items 가 빈 배열 (subtotal = 0)

조건 조합 (트랙 1의 결정테이블)
  □ VIP + 도서산간          → 0? 6000?  ← 코드상 0. 명세와 맞는가?
  □ 3만원 이상 + 도서산간    → 0.  ← 도서산간 추가금이 적용 안 된다!
  □ 일반 + 3만원 미만 + 도서산간 → 6000

null 안전성
  □ order.items 가 없으면 → 크래시
  □ order.address 가 없으면 → 크래시
  □ user.grade 가 없으면 → 'VIP' 아님으로 처리 (의도?)
  □ i.quantity 가 undefined 면 → NaN 전파

수치
  □ price 나 quantity 가 소수면 부동소수점 오차
  □ quantity 가 음수면 subtotal 이 줄어든다  ← 검증이 없다
```

**두 번째 그룹의 두 번째 항목이 진짜 결함 후보다.** 트랙 1의 결정테이블 예제에서 "도서산간은 무료 대상이라도 추가 3,000원"이라고 했는데, 이 코드는 **3만원 이상이면 도서산간 추가금을 안 받는다.**

**이게 코드를 읽는 이유다.** 화면 테스트로 이 조합을 우연히 시도하지 않으면 못 찾는다.

### 읽는 순서 — 실전 방법

큰 파일을 만나면 순서가 있다.

```text
1. 함수 이름과 시그니처만 훑는다 (무엇을 하는 파일인가)
2. export 된 것부터 본다 (외부에서 쓰는 진입점)
3. 조건문·반복문에 표시한다 (분기 = 테스트 대상)
4. 외부 호출(API, DB)을 찾는다 (실패 지점)
5. try/catch 와 에러 처리를 본다
6. 그 함수를 누가 호출하는지 역추적한다 (영향 범위 — 트랙 4)
```

**모든 줄을 이해하려 하지 않는다.** 3~5번만 봐도 TC의 80%가 나온다.

**AI 도구를 쓰는 방법** (트랙 4의 3편)

```text
이 함수를 읽고 다음을 정리해줘. 코드는 고치지 마.
1. 이 함수가 하는 일 (2문장)
2. 모든 분기 조건과 각각의 경계값
3. null/undefined 가 들어올 수 있는 지점
4. 실패할 수 있는 외부 호출과 그때의 동작
5. 명세를 확인해야 할 애매한 지점
```

**그리고 그 답을 코드와 대조한다.** AI가 놓친 것이 있는지 보는 게 이 레슨의 능력이다.

## 왜 채용시장이 요구하는가

- 채용공고의 **"코드 이해 능력"**, **"개발자와 소통 가능한 QA"** 가 이것이다. 코드를 못 읽으면 회귀 범위도 못 정하고 AI 검증도 못 한다.
- **PR 리뷰에 QA가 참여하는 조직**이 늘고 있다. 거기서 경계값과 null 처리를 지적할 수 있으면 위치가 완전히 달라진다.
- 면접에서 **코드를 주고 "여기서 어떤 테스트가 필요한가요?"** 를 묻는 경우가 늘었다. 위의 5가지 자리를 훑으면 답이 나온다.
- **falsy 함정, `Promise.all` 부수효과, 부동소수점** 같은 것을 아는 QA는 개발자에게 신뢰받는다.
- **AI가 만든 코드를 읽고 검증하는 것**이 트랙 6 전체의 목적이고, 그 기반이 이 레슨이다.

## 실습 과제

### 과제 1 — 결함 찾기 (18분)

아래 코드를 읽고 **문제 있는 곳을 최대한 많이** 찾는다. (최소 8개 있다)

```javascript
async function applyCoupon(orderId, couponCode) {
  const order = await db.getOrder(orderId);
  const coupon = await db.getCoupon(couponCode);

  if (coupon.expiresAt < new Date()) {
    return { success: false, message: '만료된 쿠폰' };
  }

  let discount;
  if (coupon.type === 'FIXED') {
    discount = coupon.amount;
  } else {
    discount = order.total * coupon.rate;
  }

  if (!discount) {
    return { success: false, message: '할인 금액 오류' };
  }

  order.discount = discount;
  order.total = order.total - discount;

  try {
    await db.updateOrder(order);
  } catch (e) {
    console.error(e);
  }

  return { success: true, total: order.total };
}
```

**힌트**: null 안전성 / falsy / 상한 미적용 / 에러 삼킴 / 음수 가능성 / 중복 적용 / 만료 비교 / 트랜잭션

찾은 것마다 **"어떤 TC로 확인할 수 있는가"** 를 함께 적는다.

### 과제 2 — 코드에서 TC 뽑기 (15분)

과제 1의 코드로 **완전한 TC 표**를 만든다.

| TC ID | 구분 | 기법 | 입력 | 기대 결과 | 근거 코드 라인 |
|---|---|---|---|---|---|
| | | | | | |

**"근거 코드 라인"** 열이 이 과제의 핵심이다. 코드를 근거로 TC를 만드는 훈련이다.

### 과제 3 — 실제 오픈소스 읽기 (15분)

GitHub에서 관심 있는 JS 프로젝트를 열고 **함수 하나**를 고른다.

읽는 순서 6단계를 그대로 적용하고:

| 단계 | 발견한 것 |
|---|---|
| 1. 무엇을 하는 파일인가 | |
| 2. export 된 진입점 | |
| 3. 분기 조건과 경계 | |
| 4. 외부 호출과 실패 지점 | |
| 5. 에러 처리 | |
| 6. 호출처 (grep) | |

**소요 시간을 기록한다.** 처음엔 오래 걸리지만 빨라진다.

### 과제 4 — falsy 함정 실험 (10분)

브라우저 콘솔에서 직접 확인한다.

```javascript
[0, '', null, undefined, NaN, false, '0', [], {}].forEach(v =>
  console.log(JSON.stringify(v), '→', v ? 'truthy' : 'falsy')
);

// || 와 ?? 의 차이
console.log(0 || 100, 0 ?? 100);        // ?
console.log('' || '기본', '' ?? '기본');  // ?
```

**`'0'`, `[]`, `{}` 가 truthy 라는 것**을 확인하고, 이게 어떤 결함을 만들 수 있을지 예를 하나 적는다.

### 과제 5 — 부동소수점과 날짜 (12분)

```javascript
// 금액
console.log(0.1 + 0.2);
console.log(10000 * 1.1);
console.log(19900 * 0.9);
console.log(Math.floor(19900 * 0.9), Math.round(19900 * 0.9));

// 날짜
console.log(new Date('2026-08-15'));
console.log(new Date('2026-08-15T00:00:00'));
console.log(new Date(2026, 7, 15));

const d = new Date(2026, 0, 31);
d.setMonth(1);
console.log(d);
```

각 결과가 왜 그런지 설명하고, **각각이 만들 수 있는 실제 결함 시나리오**를 하나씩 적는다.

### 과제 6 — PR 리뷰 코멘트 작성 (12분)

과제 1에서 찾은 문제 중 **3개를 골라 PR 리뷰 코멘트**를 작성한다.

좋은 코멘트의 형식:
```text
[질문/제안] 짧은 요약

현상: 어떤 입력에서 어떻게 되는가
근거: 코드의 어느 부분 때문인가
확인 요청: 의도된 동작인지, 아니면 수정이 필요한지
(있으면) 제안: 이렇게 하면 어떨까요
```

**단정하지 않고 질문으로 던지는 연습**이 목적이다.

### 과제 7 — AI 코드 분석 검증 (12분)

과제 1의 코드를 AI 실습 도우미에 주고 분석을 요청한다.

> 이 함수를 읽고 문제점과 필요한 테스트 케이스를 정리하라. 코드는 고치지 마라.

| 확인 항목 | 결과 |
|---|---|
| 내가 찾은 8개 중 몇 개를 찾았는가 | |
| **AI만 찾은 것** | |
| **내가 찾았는데 AI가 놓친 것** | |
| 없는 문제를 지어냈는가 | |
| 명세 확인이 필요한 지점을 질문으로 남겼는가 | |
| 코드를 고치지 말라는 지시를 지켰는가 | |

**"내가 찾았는데 AI가 놓친 것"** 이 무엇인지 분석한다. 대체로 **도메인 판단이 필요한 것**(정률 쿠폰 상한, 할인 후 음수 가능성)이 그렇다.

## 자가 체크리스트

- [ ] 제품 코드를 읽는 목적이 "무엇을 테스트할지 판단"임을 안다
- [ ] 부등호를 볼 때마다 ±1 경계값을 떠올린다
- [ ] `&&` 와 `||` 혼용 시 우선순위 문제를 지적할 수 있다
- [ ] `?.` 와 `??` 가 있는 곳과 없는 곳의 차이를 검증 대상으로 본다
- [ ] falsy 값 7가지를 나열할 수 있다
- [ ] `0` 과 `''` 이 falsy 라서 생기는 결함 사례를 들 수 있다
- [ ] `||` 와 `??` 의 차이를 알고 적절한 쪽을 판단할 수 있다
- [ ] 여러 비동기 호출 중 중간 실패 시 고아 데이터가 생김을 안다
- [ ] try/catch 의 세 가지 위험 신호(삼킴·로그만·뭉갬)를 알아본다
- [ ] "실패했는데 success: true 반환"을 코드에서 찾아낼 수 있다
- [ ] `Promise.all` 실패 시 성공한 것들의 부수효과를 물을 수 있다
- [ ] 부동소수점 오차가 금액 계산에서 문제가 됨을 안다
- [ ] 절사·반올림 규칙이 명세와 일치하는지 확인한다
- [ ] `new Date()` 가 문자열 형식에 따라 다르게 해석됨을 안다
- [ ] 월이 0부터 시작하는 것과 월말 처리 문제를 안다
- [ ] 얕은 복사, `sort` 의 원본 변경, 숫자 정렬 함정을 안다
- [ ] `findIndex` 결과를 `if (idx)` 로 검사하면 안 되는 이유를 안다
- [ ] 코드 읽는 순서 6단계를 적용할 수 있다
- [ ] 모든 줄을 이해하지 않고도 TC의 대부분을 뽑을 수 있다
- [ ] 단정 대신 질문 형태로 PR 리뷰 코멘트를 쓸 수 있다
- [ ] AI 코드 분석에서 도메인 판단이 필요한 누락을 찾아낼 수 있다

## 참고 링크

- [MDN — JavaScript 참고서 (한국어)](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference) — 문법 확인
- [MDN — Falsy](https://developer.mozilla.org/ko/docs/Glossary/Falsy) — falsy 값 목록
- [MDN — Nullish 병합 연산자](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing) — `??` 와 `||` 차이
- [0.30000000000000004.com](https://0.30000000000000004.com/) — 부동소수점 오차를 언어별로 정리
- [You Don't Know JS (한국어 번역)](https://github.com/getify/You-Dont-Know-JS) — 깊이 파고들 때
