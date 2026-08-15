---
id: t3-l08
title: 자동화용 언어 기초 — JavaScript/TypeScript와 Python
summary: 문법을 외우는 게 아니라 테스트 코드를 읽고 고칠 수 있게 되는 것이 목표. 비동기와 타입에서 막히는 지점을 뚫는다.
minutes: 20
order: 8
tags: [JavaScript, TypeScript, Python, 비동기, async]
---

## 개념 설명

### 목표를 정확히 하자

QA에게 필요한 것은 **개발자가 되는 것이 아니라**, 다음 세 가지를 할 수 있게 되는 것이다.

1. 남이 쓴(또는 AI가 쓴) 테스트 코드를 **읽고 무엇을 검증하는지 판단**한다
2. 기존 테스트를 **고치고 확장**한다
3. 에러 메시지를 읽고 **어디가 문제인지 특정**한다

문법을 처음부터 순서대로 배우는 건 비효율적이다. **테스트 코드에 실제로 나오는 것만** 다룬다.

### 어느 언어를 배울 것인가

| | JavaScript / TypeScript | Python |
|---|---|---|
| 주 용도 | Playwright, Cypress, WebdriverIO | Playwright(Python), pytest, Appium, 데이터 검증 |
| 장점 | 웹 자동화 생태계가 가장 크다 | 문법이 쉽다, 데이터 처리·스크립팅에 강하다 |
| 비동기 | **필수. 거의 모든 API가 async** | 대부분 동기 코드로 쓸 수 있다 |
| QA 채용 언급 빈도 | 높음 | 높음 |

**둘 다 조금씩 아는 게 현실적이다.** 웹 자동화는 TS, 데이터 검증·보조 스크립트는 Python 조합이 흔하다.

이 레슨은 **TypeScript를 중심**으로 하고 Python은 대응 문법을 함께 보여준다.

### 1. 비동기 — 여기서 대부분 막힌다

Playwright 코드가 온통 `async` / `await` 인 이유를 이해해야 한다.

브라우저를 제어하는 명령은 **결과가 즉시 오지 않는다.** 클릭하면 브라우저가 처리하고 응답이 돌아오기까지 시간이 걸린다. 그 동안 프로그램을 멈춰 세우지 않고 다른 일을 하게 하는 것이 비동기다.

```typescript
// await 를 빠뜨리면?
test('로그인', async ({ page }) => {
  page.goto('/login');                                  // ← await 없음
  page.getByLabel('이메일').fill('qa@test.com');         // ← await 없음
  await page.getByRole('button', { name: '로그인' }).click();
});
```

**이 코드는 페이지 로드가 끝나기 전에 입력을 시도한다.** 실행 순서가 보장되지 않아 무작위로 실패한다. 5편에서 다룬 플래키의 원인 중 하나다.

**규칙은 단순하다: Playwright API 호출 앞에는 거의 항상 `await` 를 붙인다.**

```typescript
// Promise 를 반환하는 함수는 async 로 선언하고 내부에서 await 를 쓴다
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(email);
  await page.getByRole('button', { name: '로그인' }).click();
}

// 호출할 때도 await
await login(page, 'qa@test.com');
```

**`await` 를 빠뜨렸는지 확인하는 법**

```typescript
// 값을 찍어보면 바로 안다
const text = page.getByTestId('total').textContent();
console.log(text);   // Promise { <pending> }  ← await 를 빠뜨렸다는 신호

const text2 = await page.getByTestId('total').textContent();
console.log(text2);  // '9,000원'
```

**`Promise { <pending> }` 이 로그에 보이면 100% `await` 누락이다.** 이 신호를 기억해 두면 디버깅 시간이 크게 준다.

**반복문에서의 함정**

```typescript
// ✗ forEach 는 async 를 기다려주지 않는다. 순서가 엉킨다.
items.forEach(async (item) => {
  await item.click();
});

// ✓ for...of 를 쓴다
for (const item of items) {
  await item.click();
}

// ✓ 병렬로 해도 되는 경우엔 Promise.all
const texts = await Promise.all(items.map(i => i.textContent()));
```

**`forEach` + `async` 는 조용히 잘못 동작한다.** 에러도 안 나고, 그냥 순서가 보장되지 않는다. 코드 리뷰에서 꼭 잡아야 할 패턴이다.

Python 대응:

```python
# Playwright Python 은 동기 API 가 있어서 await 없이 쓸 수 있다
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    page.get_by_role("button", name="로그인").click()
```

**Python의 동기 API가 진입 장벽이 낮은 이유**다. 비동기 개념 없이 시작할 수 있다.

### 2. 타입 — TypeScript가 QA에게 주는 실익

타입은 개발자를 위한 것 같지만, **QA에게는 자동완성과 오타 방지**라는 매우 실용적인 이득을 준다.

```typescript
await page.getByRole('buton', { name: '로그인' });
//                    ~~~~~~ 에디터가 즉시 빨간 줄을 긋는다
//                    'buton' is not assignable to type AriaRole
```

이 오타를 JavaScript에서는 **실행해야 알 수 있다.** TypeScript는 저장하는 순간 알려준다.

QA가 알아야 할 타입 문법은 이 정도다.

```typescript
// 기본 타입
let name: string = '홍길동';
let count: number = 3;
let isDone: boolean = false;
let tags: string[] = ['smoke', 'regression'];

// 객체 모양 정의
type TestUser = {
  email: string;
  password: string;
  grade?: 'NORMAL' | 'VIP';   // ? = 선택, | = 이것 중 하나
};

const user: TestUser = { email: 'qa@test.com', password: 'Test1234!' };

// 함수
async function login(page: Page, user: TestUser): Promise<void> {
  // Promise<void> = 비동기이고 반환값 없음
}

// null 가능성
const text: string | null = await locator.textContent();
if (text !== null) {
  expect(text.trim()).toBe('완료');   // 이 안에서는 안전하게 쓸 수 있다
}
```

마지막 예시가 중요하다. `textContent()` 는 요소가 없으면 `null` 을 반환할 수 있어서 TypeScript가 경고한다. **이 경고가 실제 런타임 에러를 막아준다.**

### 3. 테스트 코드에 실제로 나오는 문법

**구조 분해 (destructuring)** — Playwright fixture에서 항상 쓴다

```typescript
test('...', async ({ page, request, browserName }) => { });
//                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 객체에서 필요한 것만 꺼내기

const { orderId, totalAmount } = await response.json();
```

**화살표 함수**

```typescript
const double = (x: number) => x * 2;
items.filter(i => i.price > 10000);
```

**배열 메서드** — 자동화에서 자주 쓴다

```typescript
const prices = [15000, 8000, 22000];

prices.filter(p => p > 10000);            // [15000, 22000]  조건에 맞는 것만
prices.map(p => p * 0.9);                 // [13500, 7200, 19800]  변환
prices.find(p => p > 10000);              // 15000  첫 번째 하나
prices.some(p => p > 20000);              // true   하나라도 있는가
prices.every(p => p > 5000);              // true   전부 만족하는가
prices.reduce((sum, p) => sum + p, 0);    // 45000  누적
```

```python
# Python 대응
[p for p in prices if p > 10000]          # filter
[p * 0.9 for p in prices]                 # map
next((p for p in prices if p > 10000), None)   # find
any(p > 20000 for p in prices)            # some
all(p > 5000 for p in prices)             # every
sum(prices)                               # reduce
```

**옵셔널 체이닝과 기본값**

```typescript
const grade = user?.profile?.grade ?? 'NORMAL';
// user 나 profile 이 없어도 에러 안 나고, 없으면 'NORMAL'
```

**템플릿 문자열**

```typescript
const email = `qa_${Date.now()}@test.com`;
console.log(`총액이 ${expected}원이어야 하는데 ${actual}원입니다`);
```

### 4. 에러 메시지 읽는 법

에러를 읽을 줄 아는 것이 문법을 아는 것보다 실용적이다.

```text
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '결제하기' })
  - locator resolved to <button disabled>결제하기</button>
  - element is not enabled
```

**Call log 를 읽는 게 핵심이다.**
- 요소는 **찾았다** (`locator resolved to`)
- `disabled` 상태라서 클릭 못 했다
- → 셀렉터 문제가 아니라 **전제조건 문제**. 왜 버튼이 비활성인지 확인해야 한다

```text
Error: strict mode violation: getByRole('button', { name: '삭제' })
resolved to 3 elements
```
→ 2편의 필터/스코핑 필요

```text
TypeError: Cannot read properties of null (reading 'trim')
```
→ `null` 인 값에 메서드를 호출했다. `textContent()` 결과를 확인 없이 썼을 가능성

```text
ReferenceError: expect is not defined
```
→ import 누락

```text
UnhandledPromiseRejection
```
→ `await` 누락 가능성이 높다

### 5. AI 생성 코드를 읽을 때 볼 것

트랙 6에서 본격적으로 다루지만, 언어 관점에서 미리 짚어둔다.

| 체크 | 왜 |
|---|---|
| `await` 가 빠진 곳은 없는가 | 무작위 실패의 원인 |
| `forEach` 안에서 `async` 를 쓰지 않았는가 | 순서 보장 안 됨 |
| `try/catch` 로 에러를 삼키지 않았는가 | 가짜 통과 |
| 존재하지 않는 메서드를 쓰지 않았는가 | 환각 — 공식 문서에서 확인 |
| 타입 에러가 나지 않는가 | `npx tsc --noEmit` 로 확인 |
| 변수명이 무엇을 담는지 드러나는가 | `data`, `result`, `temp` 는 나쁜 신호 |

**마지막 항목**: 코드가 동작하는 것과 6개월 뒤 읽히는 것은 다르다. AI는 종종 `const data = await res.json()` 같은 이름을 쓴다. `const order = ...` 로 바꾸는 게 사람의 일이다.

### 6. 어디까지 배우면 되는가

**여기까지면 충분하다.**

```text
✓ async/await 와 Promise 개념
✓ 변수, 함수, 화살표 함수
✓ 객체와 배열, 구조 분해
✓ 배열 메서드 6개 (filter, map, find, some, every, reduce)
✓ 조건문, for...of 반복
✓ 기본 타입과 옵셔널
✓ import / export
✓ 에러 메시지 읽기
```

**당장 필요 없는 것**: 클래스 상속, 제네릭 심화, 데코레이터, 프로토타입, 클로저 심화, 이벤트 루프 내부 동작.

필요해지는 순간이 오면 그때 배우는 게 효율적이다. **지금은 테스트 코드를 읽고 고칠 수 있으면 된다.**

## 왜 채용시장이 요구하는가

- 채용공고의 **"JavaScript 또는 Python 기초"** 는 개발자 수준을 요구하는 게 아니라 **자동화 스크립트를 다룰 수 있는지**를 묻는 것이다.
- 면접에서 **코드를 보여주고 "이 테스트는 무엇을 검증하나요?"** 라고 묻는 경우가 늘고 있다. 작성보다 **읽기**를 본다.
- **`await` 누락, `forEach` + async 같은 실수를 코드 리뷰에서 잡을 수 있으면** 팀에서 신뢰를 받는다.
- **AI가 코드를 대신 써주는 시대일수록 읽는 능력이 더 중요해졌다.** 못 읽으면 검증을 못 하고, 검증을 못 하면 AI 출력을 그대로 커밋하게 된다. 트랙 6 전체가 이 능력 위에 세워진다.

## 실습 과제

### 과제 1 — await 누락 찾기 (12분)

아래 코드에서 **문제가 있는 곳 5군데**를 찾아 고친다.

```typescript
test('장바구니 총액이 올바르게 계산된다', async ({ page }) => {
  page.goto('/products');

  const items = await page.getByTestId('product-card').all();
  items.forEach(async (item) => {
    await item.getByRole('button', { name: '담기' }).click();
  });

  await page.goto('/cart');

  const totalText = page.getByTestId('total').textContent();
  const total = parseInt(totalText.replace(/[^0-9]/g, ''));

  try {
    expect(total).toBe(30000);
  } catch (e) {
    console.log('총액이 다릅니다');
  }
});
```

찾을 것: `await` 누락 2곳 / `forEach` + async / `null` 미처리 / `try-catch` 로 삼킴

고친 뒤 **어떤 문제가 어떤 증상으로 나타나는지** 각각 한 줄로 적는다.

### 과제 2 — 배열 메서드 연습 (12분)

아래 데이터로 각 문항을 배열 메서드로 푼다. (반복문 사용 금지)

```typescript
const orders = [
  { id: 'ORD-001', amount: 9000,  status: 'PAID',      grade: 'VIP' },
  { id: 'ORD-002', amount: 20000, status: 'PAID',      grade: 'NORMAL' },
  { id: 'ORD-003', amount: 5000,  status: 'CANCELLED', grade: 'NORMAL' },
  { id: 'ORD-004', amount: 15000, status: 'PAID',      grade: 'VIP' },
];
```

1. PAID 상태인 주문만 추출
2. 전체 주문의 총액 합계
3. **PAID 상태인 VIP 주문의 총액 합계** (트랙 2의 SQL과 같은 일을 코드로)
4. 10,000원 이상인 주문이 하나라도 있는가
5. 모든 주문이 5,000원 이상인가
6. 주문 ID만 뽑아 배열로
7. 가장 비싼 주문 하나 찾기

**3번을 SQL로도 써본다.** 같은 검증을 두 방식으로 표현할 수 있으면 좋다.

### 과제 3 — 타입 오류 체험 (10분)

TypeScript 프로젝트에서:

1. 일부러 `getByRole('buton', ...)` 처럼 오타를 낸다 → 에디터가 잡아주는지 확인
2. `const text: string = await locator.textContent();` → **왜 에러가 나는지** 이해하고 고치기
3. `npx tsc --noEmit` 실행 → 전체 타입 오류 확인
4. `TestUser` 타입을 정의하고 잘못된 값을 넣어본다

### 과제 4 — 에러 메시지 해석 (10분)

일부러 에러를 5가지 발생시키고, 각각 **Call log 를 읽어 원인을 특정**한다.

| 만드는 방법 | 에러 | 원인 |
|---|---|---|
| 존재하지 않는 요소 클릭 | | |
| 여러 개 매칭되는 로케이터 | | |
| `disabled` 버튼 클릭 | | |
| `await` 없이 `textContent()` 결과 사용 | | |
| import 없이 `expect` 사용 | | |

### 과제 5 — AI 코드 언어 관점 감사 (12분)

AI 실습 도우미에 요청한다.

> 상품 목록에서 모든 상품의 가격을 수집하고, 10,000원 이상인 상품만 장바구니에 담은 뒤, 총액이 맞는지 검증하는 Playwright 테스트를 작성하라.

**이 요청은 반복문 + 비동기 + 배열 처리를 모두 요구해서 실수가 나오기 쉽다.**

| 확인 항목 | 결과 |
|---|---|
| `forEach` 안에서 `async` 를 썼는가 | |
| `await` 가 빠진 곳이 있는가 | |
| `textContent()` 의 `null` 가능성을 처리했는가 | |
| 가격 파싱(`'15,000원'` → `15000`)이 올바른가 | |
| 총액 검증이 실제 계산과 비교하는가 | |
| `npx tsc --noEmit` 를 통과하는가 | |
| 변수명이 내용을 드러내는가 | |

`tsc --noEmit` 로 **실제 검증까지 해보는 것**이 이 과제의 핵심이다. 읽어서 넘어간 문제를 컴파일러가 잡아준다.

## 자가 체크리스트

- [ ] QA에게 필요한 언어 역량의 목표 3가지(읽기·고치기·에러 해석)를 안다
- [ ] Playwright API 앞에 `await` 가 필요한 이유를 설명할 수 있다
- [ ] `Promise { <pending> }` 로그를 보면 `await` 누락을 의심한다
- [ ] `forEach` + `async` 가 순서를 보장하지 않는 이유를 안다
- [ ] `for...of` 와 `Promise.all` 을 상황에 맞게 선택할 수 있다
- [ ] TypeScript의 실익(자동완성, 오타 방지, null 경고)을 설명할 수 있다
- [ ] `string | null` 타입을 만났을 때 안전하게 처리할 수 있다
- [ ] 구조 분해, 화살표 함수, 템플릿 문자열을 읽고 쓸 수 있다
- [ ] 배열 메서드 6개(filter/map/find/some/every/reduce)를 용도별로 쓸 수 있다
- [ ] 옵셔널 체이닝(`?.`)과 기본값(`??`)을 쓸 수 있다
- [ ] Playwright 에러의 Call log 를 읽고 셀렉터 문제인지 전제조건 문제인지 구분한다
- [ ] `Cannot read properties of null` 의 전형적 원인을 안다
- [ ] `npx tsc --noEmit` 로 타입 오류를 사전 검증할 수 있다
- [ ] Python의 동기 API가 진입 장벽이 낮은 이유를 안다
- [ ] AI 코드에서 await 누락·forEach async·에러 삼킴을 찾아낼 수 있다

## 참고 링크

- [MDN — JavaScript 가이드 (한국어)](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide) — 문법 확인의 기준
- [MDN — 비동기 JavaScript](https://developer.mozilla.org/ko/docs/Learn_web_development/Extensions/Async_JS) — Promise, async/await
- [TypeScript 핸드북 (한국어)](https://www.typescriptlang.org/ko/docs/handbook/intro.html) — 타입 문법
- [Playwright Python 문서](https://playwright.dev/python/docs/intro) — 동기 API
- [점프 투 파이썬](https://wikidocs.net/book/1) — 무료 한국어 Python 입문서
