---
id: t3-l04
title: 페이지 오브젝트 모델과 테스트 데이터 관리
summary: 테스트 100개가 됐을 때 무너지지 않는 구조. POM의 올바른 형태와, 테스트가 서로를 깨뜨리지 않게 데이터를 다루는 법.
minutes: 20
order: 4
tags: [POM, 페이지오브젝트, 테스트데이터, fixture, Playwright]
---

## 개념 설명

### 테스트 10개까지는 아무 문제가 없다

구조 이야기는 테스트가 적을 때는 와닿지 않는다. 문제는 이렇게 시작된다.

```typescript
// login.spec.ts
await page.getByLabel('이메일').fill('qa@test.com');
await page.getByLabel('비밀번호').fill('Test1234!');
await page.getByRole('button', { name: '로그인' }).click();

// order.spec.ts — 같은 코드
// cart.spec.ts — 같은 코드
// coupon.spec.ts — 같은 코드
// ... 30개 파일에 같은 코드
```

어느 날 로그인 버튼 문구가 "로그인" → "시작하기" 로 바뀐다. **30개 파일을 다 고쳐야 한다.**

### 페이지 오브젝트 모델 (POM)

화면 하나를 클래스 하나로 만들고, **그 화면의 로케이터와 동작을 한곳에 모은다.**

```typescript
// pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // 2편에서 배운 대로. 로케이터는 지연 평가되므로 여기 저장해도 안전하다.
    this.emailInput = page.getByLabel('이메일');
    this.passwordInput = page.getByLabel('비밀번호');
    this.submitButton = page.getByRole('button', { name: '로그인' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

```typescript
// tests/login.spec.ts
test('잘못된 비밀번호로 로그인하면 오류 메시지가 보인다', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('qa@test.com', 'wrong-password');

  await expect(loginPage.errorMessage).toContainText('비밀번호가 일치하지 않습니다');
});
```

**테스트 코드가 사람이 읽는 시나리오처럼 된다.** 이게 POM의 진짜 목적이다. 코드 재사용은 부수 효과다.

### POM에서 자주 하는 실수

**실수 1 — 페이지 오브젝트 안에 어서션을 넣는다**

```typescript
// ✗ 나쁨
async login(email: string, password: string) {
  await this.emailInput.fill(email);
  await this.submitButton.click();
  await expect(this.page).toHaveURL('/dashboard');   // ← 여기 있으면 안 된다
}
```

이러면 **로그인 실패를 테스트할 수 없다.** 페이지 오브젝트는 "무엇을 할 수 있는가"만 제공하고, **"무엇이 옳은가"는 테스트가 판단한다.**

예외적으로, 상태 확인용 헬퍼는 둘 수 있다.

```typescript
// ✓ 어서션이 아니라 상태를 반환한다
async isErrorVisible(): Promise<boolean> {
  return this.errorMessage.isVisible();
}
```

**실수 2 — 화면 하나에 모든 걸 넣어 거대 클래스가 된다**

500줄짜리 `MainPage.ts` 는 유지보수가 안 된다. **컴포넌트 단위로 쪼갠다.**

```typescript
// components/Header.ts — 모든 페이지에 공통
export class Header {
  constructor(private page: Page) {}
  readonly cartBadge = this.page.getByTestId('cart-count');
  async openCart() { await this.page.getByRole('link', { name: '장바구니' }).click(); }
}

// pages/ProductPage.ts
export class ProductPage {
  readonly header: Header;
  constructor(private page: Page) {
    this.header = new Header(page);
  }
  // ...
}
```

**실수 3 — 페이지 오브젝트에 테스트 로직을 넣는다**

`loginAndCreateOrderAndCheckTotal()` 같은 메서드가 생기기 시작하면 위험 신호다. 시나리오는 테스트 파일에 있어야 읽힌다.

### Fixture — POM보다 한 단계 나은 방법

Playwright는 자체 **fixture** 시스템이 있어서, POM 인스턴스 생성을 자동화할 수 있다.

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { CartPage } from './pages/CartPage';

type MyFixtures = {
  loginPage: LoginPage;
  cartPage: CartPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
});

export { expect } from '@playwright/test';
```

```typescript
// tests/cart.spec.ts
import { test, expect } from '../fixtures';

test('장바구니에 담으면 배지 수가 증가한다', async ({ cartPage }) => {
  await cartPage.goto();
  // new 를 쓸 필요가 없다
});
```

fixture의 더 큰 가치는 **준비와 정리를 한 곳에 묶을 수 있다**는 것이다.

```typescript
// 테스트용 주문을 만들고, 테스트가 끝나면 자동으로 정리한다
export const test = base.extend<{ testOrder: Order }>({
  testOrder: async ({ request }, use) => {
    // 준비 — API 로 주문 생성 (UI 보다 빠르고 안정적이다)
    const res = await request.post('/api/v1/orders', {
      data: { productId: 10023, quantity: 1 },
    });
    const order = await res.json();

    await use(order);          // 테스트가 이 데이터를 쓴다

    // 정리 — 테스트 성공/실패와 무관하게 항상 실행된다
    await request.delete(`/api/v1/orders/${order.orderId}`);
  },
});
```

**정리 코드가 항상 실행된다는 게 핵심이다.** `afterEach` 에 넣으면 테스트가 중간에 죽었을 때 안 돌 수 있다.

### 로그인 상태 재사용 — 실행 시간을 크게 줄인다

테스트 100개가 각각 로그인하면 100번 로그인한다. 한 번만 하고 상태를 재사용한다.

```typescript
// auth.setup.ts
import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('로그인 상태 저장', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(process.env.TEST_USER!);
  await page.getByLabel('비밀번호').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('/dashboard');

  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],     // setup 이 먼저 돈다
  },
],
```

**주의 두 가지.**

- `playwright/.auth/` 를 **`.gitignore` 에 반드시 넣는다.** 세션 토큰이 커밋되는 사고가 실제로 자주 난다
- 계정 정보는 환경변수/Secrets 로. 코드에 하드코딩하지 않는다

### 테스트 데이터 — 테스트가 서로를 깨뜨리는 문제

자동화가 커지면 반드시 만나는 문제다.

```typescript
// ✗ 공유 계정을 쓰는 두 테스트
test('장바구니를 비우면 0개가 된다', async () => { /* 전체 삭제 */ });
test('담긴 상품이 1개 표시된다',    async () => { /* 1개 기대 */ });
```

병렬 실행하면 앞 테스트가 뒤 테스트의 데이터를 지운다. **재실행하면 통과할 때도 있고 실패할 때도 있다** — 전형적인 플래키다.

**원칙: 각 테스트는 자기가 쓸 데이터를 스스로 만들고, 남의 데이터를 건드리지 않는다.**

| 전략 | 방법 | 적합한 경우 |
|---|---|---|
| **격리된 데이터 생성** | 테스트마다 고유 계정·주문 생성 | 가장 안전. 기본으로 삼는다 |
| **읽기 전용 고정 데이터** | 절대 수정하지 않는 상품/카테고리 | 조회 테스트 |
| **직렬 실행** | `test.describe.configure({ mode: 'serial' })` | 어쩔 수 없을 때만 |

**고유 데이터 만들기**

```typescript
// 실행마다 겹치지 않는 값
const unique = `${Date.now()}-${process.env.TEST_WORKER_INDEX ?? 0}`;
const email = `qa_${unique}@test.com`;
const orderName = `ORD-TEST-${unique}`;
```

`TEST_WORKER_INDEX` 를 섞는 이유는 **병렬 워커가 같은 밀리초에 실행될 수 있기** 때문이다. 트랙 2에서 만든 `qa_` / `ORD-TEST-` 접두어 규칙도 여기서 그대로 쓴다.

**데이터 준비는 UI 대신 API로**

```typescript
// ✗ 느리고 깨지기 쉽다 — 로그인 UI가 바뀌면 모든 테스트가 죽는다
await loginPage.login(email, password);
await productPage.addToCart(10023);

// ✓ 준비는 API, 검증만 UI
await request.post('/api/v1/cart', { data: { productId: 10023, quantity: 1 } });
await cartPage.goto();
await expect(cartPage.items).toHaveCount(1);
```

**"검증하려는 것만 UI로 하고 나머지는 API로 준비한다."** 이 원칙 하나로 실행 시간과 플래키가 동시에 줄어든다.

단, **로그인 자체를 테스트하는 테스트는 당연히 UI로 한다.** 준비와 검증을 구분하는 게 핵심이다.

### 폴더 구조 예시

```text
tests/
  auth.setup.ts
  login.spec.ts
  cart.spec.ts
  checkout.spec.ts
pages/
  LoginPage.ts
  CartPage.ts
  CheckoutPage.ts
components/
  Header.ts
  ProductCard.ts
fixtures/
  index.ts            테스트 fixture 정의
  testData.ts         고유 데이터 생성 헬퍼
utils/
  api.ts              API 준비/정리 헬퍼
playwright/.auth/     (gitignore)
```

## 왜 채용시장이 요구하는가

- **"페이지 오브젝트 모델을 아는가"** 는 자동화 면접의 기본 질문이다. 하지만 아는 것만으로는 부족하고, **어서션을 넣으면 안 되는 이유**를 설명할 수 있어야 실제 경험자로 보인다.
- **테스트 데이터 격리**를 말할 수 있는 사람은 훨씬 적다. "테스트를 병렬로 돌렸더니 깨졌어요"를 겪고 해결해 본 경험은 강한 신호다.
- **"준비는 API, 검증은 UI"** 원칙은 실무에서 실행 시간을 절반 이하로 줄이는 기법이라 즉시 가치를 인정받는다.
- **AI는 POM을 곧잘 만들지만 어서션을 페이지 오브젝트 안에 넣는다.** 그리고 테스트 데이터 격리는 거의 고려하지 않는다. 하드코딩된 `qa@test.com` 을 모든 테스트에 쓰는 코드를 만든다. 구조 결함은 실행해서는 안 보이고, 테스트가 수십 개로 늘어난 뒤에야 터진다.

## 실습 과제

### 과제 1 — POM 리팩터링 (18분)

앞 레슨들에서 만든 TodoMVC 테스트 3개를 POM 구조로 바꾼다.

```text
pages/TodoPage.ts
  - 로케이터: newTodoInput, todoItems, toggleAll, clearCompleted, counter
  - 동작: goto(), addTodo(text), toggleTodo(text), removeTodo(text), filterBy(status)
tests/todo.spec.ts
  - 어서션은 전부 여기에
```

체크 포인트:
- 페이지 오브젝트에 `expect` 가 하나도 없는가
- `removeTodo('우유 사기')` 처럼 **내용으로 지목**하는가 (2편의 filter 활용)
- 테스트 파일만 읽고 시나리오를 이해할 수 있는가

### 과제 2 — Fixture 로 전환 (12분)

1. `fixtures.ts` 를 만들어 `todoPage` fixture 정의
2. 테스트에서 `new TodoPage(page)` 제거
3. fixture 에 **정리 로직 추가** — 테스트 후 할 일을 모두 삭제
4. 테스트를 일부러 실패시키고 **정리가 여전히 실행되는지** 확인

4번이 이 과제의 핵심이다.

### 과제 3 — 테스트 간 충돌 만들고 고치기 (15분)

일부러 충돌하는 테스트 2개를 만든다.

```typescript
test('A: 할 일 3개를 추가한다',    async () => { /* 3개 추가 후 count 3 기대 */ });
test('B: 전체를 삭제하면 0개가 된다', async () => { /* 전체 삭제 */ });
```

1. `fullyParallel: true` 로 여러 번 실행 → **때때로 실패하는지** 확인
2. 실패 원인을 트레이스로 확인
3. **세 가지 방법으로 각각 고쳐본다**
   - `test.describe.configure({ mode: 'serial' })`
   - 각 테스트가 자기 데이터를 만들고 정리 (fixture)
   - 테스트마다 고유 식별자를 붙인 데이터 사용
4. 세 방법의 장단점을 표로 정리

### 과제 4 — 로그인 상태 재사용 (12분)

로그인이 있는 사이트(`https://the-internet.herokuapp.com/login`, 계정은 페이지에 공개돼 있다)로:

1. `auth.setup.ts` 작성, `storageState` 저장
2. config 에 `dependencies: ['setup']` 설정
3. 로그인이 필요한 테스트 2개를 작성해 **로그인 단계 없이** 통과시키기
4. `.gitignore` 에 `playwright/.auth/` 추가하고, `git status` 로 실제로 제외됐는지 확인
5. **실행 시간을 로그인 반복 버전과 비교**해 메모에 적기

### 과제 5 — AI가 만든 POM 구조 감사 (12분)

AI 실습 도우미에 요청한다.

> 쇼핑몰의 로그인·장바구니·결제 화면에 대한 Playwright 페이지 오브젝트 모델과 테스트를 작성하라.

| 확인 항목 | 결과 |
|---|---|
| 페이지 오브젝트 안에 `expect` 가 들어갔는가 | |
| 로케이터가 2편 기준으로 적절한가 | |
| 테스트 데이터가 하드코딩(`qa@test.com`)돼 있는가 | |
| 테스트 간 격리를 고려했는가 | |
| 정리(cleanup) 로직이 있는가 | |
| 준비 단계까지 전부 UI 로 하고 있는가 | |
| `page.waitForTimeout` 이 섞였는가 | |

**대부분의 항목에서 문제가 나온다.** 각각을 어떻게 고칠지 적고, 그중 두 개를 실제로 고쳐 본다.

## 자가 체크리스트

- [ ] POM의 목적이 코드 재사용이 아니라 "테스트가 시나리오처럼 읽히게" 하는 것임을 안다
- [ ] 페이지 오브젝트에 어서션을 넣으면 안 되는 이유를 설명할 수 있다
- [ ] 거대 페이지 오브젝트를 컴포넌트 단위로 쪼갤 수 있다
- [ ] 페이지 오브젝트에 시나리오 로직이 들어가는 것을 위험 신호로 인식한다
- [ ] Playwright fixture 로 POM 인스턴스 생성을 자동화할 수 있다
- [ ] fixture 의 정리 로직이 `afterEach` 보다 안전한 이유를 안다
- [ ] `storageState` 로 로그인 상태를 재사용할 수 있다
- [ ] `.auth` 디렉터리를 gitignore 하지 않으면 세션 토큰이 커밋된다는 걸 안다
- [ ] 병렬 실행 시 테스트가 서로 데이터를 깨뜨리는 문제를 설명할 수 있다
- [ ] 고유 데이터 생성 시 타임스탬프에 워커 인덱스를 섞는 이유를 안다
- [ ] "준비는 API, 검증은 UI" 원칙을 적용할 수 있다
- [ ] 로그인 테스트 자체는 UI로 해야 한다는 구분을 할 수 있다
- [ ] 직렬 실행(`mode: 'serial'`)은 최후의 수단이라는 것을 안다
- [ ] AI가 만든 POM에서 어서션 위치·데이터 격리 문제를 짚어낼 수 있다

## 참고 링크

- [Playwright — Page Object Models](https://playwright.dev/docs/pom) — 공식 예제
- [Playwright — Fixtures](https://playwright.dev/docs/test-fixtures) — fixture 정의와 스코프
- [Playwright — Authentication](https://playwright.dev/docs/auth) — storageState 패턴
- [Playwright — Parallelism](https://playwright.dev/docs/test-parallel) — 병렬 실행과 격리
- [Martin Fowler — Page Object](https://martinfowler.com/bliki/PageObject.html) — 원 개념. "어서션을 넣지 말라"의 출처
