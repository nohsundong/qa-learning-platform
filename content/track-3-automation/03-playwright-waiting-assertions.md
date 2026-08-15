---
id: t3-l03
title: 대기와 어서션 — sleep 없이 안정적인 테스트 만들기
summary: 자동 대기가 무엇을 기다려주고 무엇을 안 기다려주는지. 그리고 실패했을 때 원인이 보이는 어서션을 쓰는 법.
minutes: 20
order: 3
tags: [Playwright, 대기, 어서션, 플래키, autowaiting]
---

## 개념 설명

### 고정 대기(sleep)가 왜 최악인가

```typescript
await page.click('#submit');
await page.waitForTimeout(3000);   // ← 이 한 줄이 모든 문제의 시작
expect(await page.textContent('.result')).toBe('완료');
```

이 코드의 문제는 두 가지이고, **둘 다 나쁘다.**

| 상황 | 결과 |
|---|---|
| 서버가 0.2초에 응답 | **2.8초를 낭비한다.** 테스트 500개면 23분 낭비 |
| 서버가 3.5초 걸림 | **실패한다.** 제품은 멀쩡한데 테스트만 깨진다 |

그리고 CI 서버는 로컬보다 느리다. 그래서 "내 PC에선 되는데 CI에선 실패"의 가장 흔한 원인이 고정 대기다.

**해결책은 시간을 기다리는 게 아니라 조건을 기다리는 것이다.**

### Playwright의 자동 대기 — 무엇을 기다려주나

`click()`, `fill()`, `check()` 같은 액션은 실행 전에 **actionability 검사**를 통과할 때까지 자동으로 기다린다.

| 검사 | 의미 |
|---|---|
| Attached | DOM에 존재하는가 |
| Visible | 보이는가 (`display:none`, 크기 0 아님) |
| Stable | **애니메이션이 끝나 위치가 고정됐는가** |
| Enabled | `disabled` 가 아닌가 |
| Receives events | **다른 요소에 가려지지 않았는가** |
| Editable | (입력 액션) 읽기 전용이 아닌가 |

3번과 5번이 특히 값지다. 다른 도구에서 흔히 겪는 문제들을 구조적으로 막아준다.

- 모달이 슬라이드하는 중에 클릭 → 엉뚱한 위치를 누름 → **Stable 검사가 막는다**
- 로딩 오버레이가 덮고 있는데 클릭 → 오버레이가 대신 눌림 → **Receives events 검사가 막는다**

**즉, 대부분의 경우 아무것도 안 해도 된다.**

```typescript
// 이걸로 충분하다. 버튼이 나타나고, 멈추고, 활성화될 때까지 기다린다.
await page.getByRole('button', { name: '결제하기' }).click();
```

### 자동 대기가 해주지 않는 것

여기서 실패가 발생한다. 자동 대기는 **요소의 상태**만 본다. 다음은 안 본다.

| 상황 | 왜 자동 대기로 안 되나 | 해결 |
|---|---|---|
| 클릭 후 목록이 갱신되기를 기다림 | 요소가 이미 화면에 있다 (내용만 바뀔 예정) | 어서션으로 기다린다 |
| API 응답이 끝나기를 기다림 | DOM과 무관 | `waitForResponse` |
| 페이지 이동 완료 | 액션이 아니다 | `expect(page).toHaveURL()` |
| 애니메이션 없는 즉시 렌더 후 데이터 채워짐 | 빈 상태로 요소가 존재 | 내용을 어서션 |

### 웹 우선 어서션(web-first assertions) — 대기와 검증을 동시에

Playwright의 `expect(locator)` 는 **조건이 만족될 때까지 자동으로 재시도한다.** 기본 5초.

```typescript
// ✓ 좋음 — 텍스트가 '완료'가 될 때까지 재시도하며 기다린다
await expect(page.getByTestId('order-status')).toHaveText('완료');

// ✗ 나쁨 — 지금 이 순간의 값을 한 번만 읽는다. 아직 '처리중'이면 실패
expect(await page.getByTestId('order-status').textContent()).toBe('완료');
```

**차이는 `await` 의 위치다.** `await expect(locator)` 이면 재시도하고, `expect(await ...)` 이면 한 번만 본다. 이 한 글자 차이가 플래키 테스트의 큰 원인이다.

**자주 쓰는 웹 우선 어서션**

```typescript
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toBeEnabled();
await expect(locator).toBeChecked();
await expect(locator).toHaveText('정확히 이 텍스트');
await expect(locator).toContainText('일부만 포함');
await expect(locator).toHaveValue('입력값');
await expect(locator).toHaveCount(3);              // 목록 개수
await expect(locator).toHaveAttribute('href', /\/orders\//);
await expect(locator).toHaveClass(/active/);
await expect(page).toHaveURL(/\/dashboard/);
await expect(page).toHaveTitle('주문 완료');

// 타임아웃 개별 조정 (느린 배치 처리 등)
await expect(locator).toHaveText('완료', { timeout: 30_000 });
```

`toHaveCount()` 가 특히 유용하다. **목록이 다 렌더링될 때까지 기다리는 가장 깔끔한 방법**이다.

```typescript
// 클릭 후 목록이 3개가 될 때까지 기다린다 — sleep 불필요
await page.getByRole('button', { name: '더 보기' }).click();
await expect(page.getByTestId('product-card')).toHaveCount(30);
```

### 실패했을 때 원인이 보이는 어서션

같은 것을 검증해도 실패 메시지의 품질이 다르다.

```typescript
// ✗ 실패하면 "expected 1, received 3" 만 나온다. 무엇이 3개였는지 모른다
const count = await page.getByTestId('cart-item').count();
expect(count).toBe(1);

// ✓ 실패하면 실제 요소들의 스냅샷과 함께 나온다
await expect(page.getByTestId('cart-item')).toHaveCount(1);

// ✗ true/false 만 알려준다
expect(await page.getByText('오류').isVisible()).toBe(false);

// ✓ 어떤 상태였는지 알려주고, 사라질 때까지 기다려준다
await expect(page.getByText('오류')).toBeHidden();
```

**어서션에 설명을 붙이는 것**도 유용하다.

```typescript
await expect(page.getByTestId('total'), '쿠폰 적용 후 총액이 9,000원이어야 함')
  .toHaveText('9,000원');
```

### 네트워크 대기 — API 응답을 기다려야 할 때

```typescript
// 클릭과 응답 대기를 동시에 건다 (순서 주의: 대기를 먼저 걸고 액션)
const responsePromise = page.waitForResponse(
  res => res.url().includes('/api/v1/orders') && res.status() === 201
);
await page.getByRole('button', { name: '주문하기' }).click();
const response = await responsePromise;

// 응답 내용까지 검증할 수 있다
const body = await response.json();
expect(body.status).toBe('PENDING');
```

**`waitForResponse` 를 액션보다 먼저 선언하는 이유**: 클릭이 너무 빨라 응답이 이미 와버리면 놓친다. 먼저 귀를 열어두고 액션한다.

다만 **네트워크 대기는 남용하지 않는다.** 대부분은 화면 결과를 어서션하는 것으로 충분하고, 그게 사용자 관점에 더 가깝다. API 응답 자체를 검증해야 할 때만 쓴다.

### 피해야 할 안티패턴 정리

```typescript
// ✗ 1. 고정 대기
await page.waitForTimeout(3000);

// ✗ 2. networkidle 로 때우기 — 폴링/웹소켓이 있으면 영원히 안 끝난다
await page.waitForLoadState('networkidle');

// ✗ 3. try/catch 로 실패를 삼키기 — 테스트가 항상 통과한다
try {
  await expect(page.getByText('완료')).toBeVisible();
} catch (e) {
  console.log('없네요');   // ← 실패가 사라졌다
}

// ✗ 4. 조건부 분기 — 무엇을 검증했는지 알 수 없다
if (await page.getByText('쿠폰 적용됨').isVisible()) {
  await expect(page.getByTestId('total')).toHaveText('9,000원');
}

// ✗ 5. 타임아웃을 무작정 늘리기 — 느린 테스트를 만들 뿐 원인은 그대로
await expect(locator).toBeVisible({ timeout: 120_000 });
```

3번과 4번이 **"가짜 통과"** 의 대표적인 형태다. 트랙 6의 AI 산출물 검증에서 다시 나온다. **테스트가 초록불인데 아무것도 검증하지 않는 상태**가 가장 위험하다. 결함이 있어도 아무도 모른다.

4번의 올바른 형태는 이렇다.

```typescript
// ✓ 쿠폰이 적용되어야 한다는 것 자체를 단언한다
await expect(page.getByText('쿠폰 적용됨')).toBeVisible();
await expect(page.getByTestId('total')).toHaveText('9,000원');
```

"화면 상태에 따라 다를 수 있어서"라는 이유로 조건 분기를 넣는다면, **그건 테스트 전제조건이 통제되지 않았다는 뜻이다.** 4편의 테스트 데이터 관리에서 해결할 문제다.

### 예외적으로 대기가 정당한 경우

드물지만 있다. 이럴 때도 **왜 필요한지 주석을 남긴다.**

```typescript
// 스크롤 이벤트 디바운스가 300ms 라서, 그 이후 상태를 확인해야 함
await page.mouse.wheel(0, 500);
await page.waitForTimeout(400);   // 디바운스 대기 (설계상 불가피)
await expect(page.getByTestId('sticky-header')).toBeVisible();
```

주석 없는 `waitForTimeout` 은 코드 리뷰에서 반려 대상으로 두는 팀이 많다.

### 타임아웃 계층

Playwright에는 여러 타임아웃이 있다. 어디를 조정해야 하는지 알아야 한다.

```typescript
export default defineConfig({
  timeout: 30_000,              // 테스트 하나의 전체 제한
  expect: { timeout: 5_000 },   // 어서션 재시도 제한
  use: {
    actionTimeout: 10_000,      // click/fill 등 액션 하나
    navigationTimeout: 30_000,  // goto, 페이지 이동
  },
});
```

**타임아웃 에러 메시지를 읽고 어느 계층인지 구분할 줄 알아야** 올바른 곳을 고칠 수 있다. 무조건 전역 timeout을 늘리는 건 문제를 감추는 것이다.

## 왜 채용시장이 요구하는가

- **"플래키 테스트를 어떻게 다루셨나요?"** 는 자동화 면접의 핵심 질문이고, 답의 절반이 이 레슨 내용이다.
- `await expect(locator)` 와 `expect(await locator...)` 의 차이를 아는지가 **실제로 Playwright를 써봤는지**를 가른다.
- **`try/catch` 로 감싼 테스트, 조건 분기 테스트를 코드 리뷰에서 잡아내는 것**은 시니어의 일이다. 이런 코드는 팀 전체의 테스트 신뢰도를 무너뜨린다.
- **AI가 만든 테스트에서 가장 흔한 두 가지 결함이 고정 대기와 가짜 통과다.** AI는 "안정적으로 만들어줘"라고 하면 `waitForTimeout` 을 넣거나 `try/catch` 로 감싼다. 겉보기엔 개선처럼 보이지만 실제로는 검증을 없앤 것이다. 이걸 알아보는 게 트랙 6의 핵심 역량이다.

## 실습 과제

### 과제 1 — sleep 제거하기 (15분)

아래 코드를 고정 대기 없이 다시 작성한다. (TodoMVC 또는 실습 랩 샘플 앱 대상)

```typescript
test('할 일을 추가하면 목록에 나타난다', async ({ page }) => {
  await page.goto('/');
  await page.locator('.new-todo').fill('우유 사기');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const items = await page.locator('.todo-list li').count();
  expect(items).toBe(1);
  const text = await page.locator('.todo-list li').first().textContent();
  expect(text).toContain('우유 사기');
});
```

고칠 것: 고정 대기 제거 / 웹 우선 어서션으로 전환 / 로케이터를 2편 기준으로 개선 / 실패 시 원인이 보이게

### 과제 2 — 자동 대기의 한계 체험 (12분)

개발자도구 콘솔에서 아래를 실행해 인위적으로 상황을 만든다. 각각에 대해 **자동 대기만으로 되는지, 어서션이 필요한지** 확인한다.

```javascript
// 1. 2초 뒤에 버튼을 활성화
setTimeout(() => document.querySelector('button').disabled = false, 2000);

// 2. 2초 뒤에 텍스트를 변경 (요소는 처음부터 존재)
setTimeout(() => document.querySelector('h1').textContent = '완료', 2000);

// 3. 투명한 오버레이로 버튼을 덮었다가 2초 뒤 제거
```

1번과 3번은 자동 대기가 처리한다. **2번이 어서션이 필요한 경우**다. 왜 그런지 메모에 적는다.

### 과제 3 — 가짜 통과 만들어 보기 (10분)

일부러 **항상 통과하는 테스트**를 3가지 방식으로 만들어 본다.

1. `try/catch` 로 어서션을 감싸기
2. 조건 분기로 어서션을 건너뛰기
3. `expect(true).toBe(true)` 수준의 의미 없는 어서션

그다음 **제품을 완전히 깨뜨린 상태**(예: 페이지 URL을 존재하지 않는 곳으로)에서 실행해 보고, 3개가 다 통과하는지 확인한다.

**직접 만들어 봐야 코드 리뷰에서 알아본다.** 이게 이 과제의 목적이다.

### 과제 4 — 네트워크 대기 (10분)

`https://jsonplaceholder.typicode.com` 을 호출하는 간단한 페이지를 만들거나, 실습 랩 샘플 앱에서:

1. `waitForResponse` 로 특정 API 응답을 기다리는 테스트 작성
2. **`waitForResponse` 를 액션 뒤에 선언**하도록 순서를 바꿔보고 어떻게 되는지 확인
3. 응답 바디까지 검증하는 코드 추가

### 과제 5 — AI 테스트의 대기 전략 감사 (12분)

AI 실습 도우미에 요청한다.

> 다음 시나리오의 Playwright 테스트를 작성하라: 상품을 장바구니에 담고, 수량을 2로 변경하고, 총액이 올바르게 갱신되는지 확인한다. 비동기 갱신이 있어 타이밍에 민감하다.

**"타이밍에 민감하다"는 말이 함정이다.** 이 문구를 보면 AI는 대체로 `waitForTimeout` 을 넣는다.

| 확인 항목 | 결과 |
|---|---|
| `waitForTimeout` 을 썼는가 | |
| `waitForLoadState('networkidle')` 로 때웠는가 | |
| `await expect()` 를 썼는가, `expect(await ...)` 를 썼는가 | |
| `try/catch` 나 조건 분기로 감쌌는가 | |
| 총액 검증이 실제 계산 결과와 비교하는가, 아니면 존재만 확인하는가 | |
| 존재하지 않는 API를 쓰지 않았는가 | |

그다음 **직접 고쳐서** 안티패턴 없는 버전을 만든다. 두 버전을 나란히 메모에 남긴다.

## 자가 체크리스트

- [ ] 고정 대기가 느려지거나 깨지거나 둘 중 하나라는 것을 설명할 수 있다
- [ ] Playwright actionability 검사 6가지를 나열할 수 있다
- [ ] Stable·Receives events 검사가 어떤 실패를 막아주는지 예로 들 수 있다
- [ ] 자동 대기가 해주지 않는 상황 4가지를 알고 각각의 해결책을 안다
- [ ] `await expect(locator)` 와 `expect(await locator...)` 의 차이를 설명할 수 있다
- [ ] 웹 우선 어서션 8종 이상을 상황에 맞게 쓸 수 있다
- [ ] `toHaveCount()` 로 목록 렌더링 완료를 기다릴 수 있다
- [ ] 실패 메시지에 원인이 드러나는 어서션을 고를 수 있다
- [ ] `waitForResponse` 를 액션보다 먼저 선언해야 하는 이유를 안다
- [ ] `networkidle` 대기가 왜 위험한지 설명할 수 있다
- [ ] `try/catch` 와 조건 분기가 "가짜 통과"를 만드는 과정을 설명할 수 있다
- [ ] 조건 분기가 필요하다고 느끼면 전제조건 통제 문제임을 의심한다
- [ ] 불가피한 `waitForTimeout` 에는 이유를 주석으로 남긴다
- [ ] 타임아웃 계층(test/expect/action/navigation)을 구분하고 올바른 곳을 조정한다
- [ ] AI가 "안정적으로 만들어줘"에 반응해 넣는 sleep과 try/catch를 걸러낼 수 있다

## 참고 링크

- [Playwright — Auto-waiting](https://playwright.dev/docs/actionability) — actionability 검사 목록
- [Playwright — Assertions](https://playwright.dev/docs/test-assertions) — 웹 우선 어서션 전체
- [Playwright — Timeouts](https://playwright.dev/docs/test-timeouts) — 타임아웃 계층 정리
- [Playwright — Network](https://playwright.dev/docs/network) — 요청/응답 대기와 목킹
