---
id: t3-l02
title: 로케이터 전략 — 깨지지 않는 셀렉터 고르기
summary: 자동화 유지보수 비용의 대부분은 셀렉터에서 나온다. 무엇이 안정적이고 무엇이 배포 한 번에 깨지는지 판단한다.
minutes: 20
order: 2
tags: [Playwright, 로케이터, 셀렉터, XPath, testid]
---

## 개념 설명

### 자동화가 깨지는 1순위 원인

자동화 테스트를 6개월 운영해 보면 실패 원인이 이렇게 나뉜다.

```text
셀렉터가 깨짐          ~50%   ← 이 레슨
타이밍/대기 문제        ~25%   ← 3편
테스트 데이터 문제      ~15%   ← 4편
진짜 제품 결함          ~10%   ← 우리가 원했던 것
```

**진짜 결함을 찾는 비율이 10%밖에 안 된다.** 나머지 90%는 유지보수 비용이다. 이 비율을 바꾸는 첫걸음이 로케이터 전략이다.

### 우선순위 — 사용자가 보는 것으로 찾는다

Playwright의 철학은 명확하다. **테스트는 사용자가 화면을 인식하는 방식과 같은 방식으로 요소를 찾아야 한다.**

```text
1순위  getByRole()          역할 + 접근성 이름     ← 가장 권장
2순위  getByLabel()         폼 요소의 라벨
       getByPlaceholder()   입력창 placeholder
       getByText()          화면에 보이는 텍스트
3순위  getByTestId()        개발자가 심어둔 테스트 전용 속성
4순위  CSS / XPath          위로 안 될 때만
```

```typescript
// 1순위 — 역할로 찾기
await page.getByRole('button', { name: '결제하기' }).click();
await page.getByRole('link', { name: '장바구니' }).click();
await page.getByRole('heading', { name: '주문 완료', level: 1 }).isVisible();
await page.getByRole('checkbox', { name: '약관 동의' }).check();

// 2순위 — 라벨/텍스트
await page.getByLabel('이메일').fill('qa@test.com');
await page.getByPlaceholder('검색어를 입력하세요').fill('무선 이어폰');
await page.getByText('재고가 부족합니다').isVisible();

// 3순위 — 테스트 전용 속성
await page.getByTestId('cart-item-10023').click();
```

### `getByRole` 이 왜 1순위인가

세 가지 이유가 있고, 세 번째가 QA에게 특히 중요하다.

1. **잘 안 깨진다.** 버튼의 CSS 클래스는 디자인 개편 때마다 바뀌지만, "버튼이고 이름이 결제하기"라는 사실은 잘 안 바뀐다
2. **의도가 드러난다.** 코드만 읽어도 무엇을 클릭하는지 안다
3. **접근성을 함께 검증한다.** `getByRole('button')` 으로 못 찾는다면, 그건 스크린 리더 사용자도 버튼으로 인식하지 못한다는 뜻이다 — **테스트가 접근성 결함을 자동으로 잡아낸다**

세 번째가 실전에서 이렇게 나타난다.

```html
<!-- 개발자가 div 로 버튼을 만들었다 -->
<div class="btn-primary" onclick="submit()">결제하기</div>
```

`getByRole('button', { name: '결제하기' })` 는 이걸 못 찾는다. 그래서 "왜 안 찾아지지?" → "아, 버튼이 아니라 div 네요" → **접근성 결함 리포트**로 이어진다. 키보드 Tab으로 접근 못 하고, 엔터로 실행 안 되고, 스크린 리더가 읽지 못하는 요소다.

### 좋은 셀렉터와 깨지기 쉬운 셀렉터

| 셀렉터 | 등급 | 이유 |
|---|---|---|
| `getByRole('button', {name:'결제'})` | 최상 | 역할과 이름은 잘 안 바뀐다 |
| `getByTestId('checkout-submit')` | 상 | 테스트 전용이라 변경 시 의도적 |
| `getByLabel('이메일')` | 상 | 라벨은 사용자에게 보이는 계약 |
| `#checkout-form` (id) | 중 | id는 비교적 안정적이나 자동 생성 id는 위험 |
| `.btn.btn-primary.mt-4` | 하 | **디자인 변경 한 번에 깨진다** |
| `div > div:nth-child(3) > span` | 최하 | DOM 구조 변경에 즉시 깨진다 |
| `//div[@class='x']/span[2]` | 최하 | 위와 동일 + 읽기 어렵다 |
| `text=결제하기` (전체 일치 가정) | 주의 | 문구 변경, 다국어 전환 시 깨진다 |

**자동 생성 클래스명은 최악이다.**

```html
<!-- CSS-in-JS, Tailwind JIT, 빌드 해시 -->
<button class="css-1x2y3z4">결제</button>
<button class="sc-bdVaJa hXBqmL">결제</button>
```

이런 클래스는 **빌드할 때마다 바뀐다.** 코드를 한 줄도 안 고쳐도 테스트가 깨진다.

### data-testid — 언제 쓰고 언제 안 쓰는가

`data-testid` 는 만능이 아니다. 트레이드오프가 있다.

**장점**
- 가장 안정적이다. 이 속성을 지우려면 개발자가 의도적으로 지워야 한다
- 다국어 서비스에서 텍스트 기반 셀렉터가 안 통할 때 유일한 답이 되기도 한다

**단점**
- **제품 코드에 테스트용 코드가 섞인다.** 개발팀 합의가 필요하다
- `getByRole` 로 찾을 수 없는 상태(위의 div 버튼)를 **가려버린다.** 접근성 결함을 놓치게 된다

**실무 기준**: 기본은 `getByRole`, 다음이 상황에 맞는 것들이고, **동적 목록의 특정 항목**이나 **텍스트가 없는 아이콘 버튼** 같은 곳에 `data-testid` 를 쓴다.

```typescript
// 설정 커스터마이즈 — 회사 컨벤션이 data-qa 라면
export default defineConfig({
  use: { testIdAttribute: 'data-qa' },
});
```

### 여러 개가 잡힐 때 — 필터와 체이닝

목록에서 특정 항목을 찾는 게 실무의 절반이다.

```typescript
// ✗ 잘못된 방법 — 목록 순서가 바뀌면 깨진다
await page.getByRole('button', { name: '삭제' }).nth(2).click();

// ✓ 내용으로 좁힌다
const row = page.getByRole('row').filter({ hasText: '무선 이어폰' });
await row.getByRole('button', { name: '삭제' }).click();

// ✓ 다른 요소를 포함하는 것으로 좁힌다
const card = page.getByTestId('product-card')
  .filter({ has: page.getByText('품절') });

// ✓ 특정 영역 안에서만 찾는다 (스코핑)
const modal = page.getByRole('dialog', { name: '주문 취소' });
await modal.getByRole('button', { name: '확인' }).click();
```

**마지막 패턴이 매우 중요하다.** 화면에 "확인" 버튼이 여러 개 있을 때, 모달 안의 것을 정확히 지목한다. `nth()` 나 `first()` 로 때우면 나중에 반드시 깨진다.

### `strict mode` — Playwright가 강제하는 안전장치

Playwright는 로케이터가 **2개 이상 매칭되면 에러를 낸다.**

```text
Error: strict mode violation: getByRole('button', { name: '삭제' })
resolved to 3 elements
```

처음엔 성가시지만 이건 **선물이다.** 다른 도구들은 조용히 첫 번째 요소를 클릭하고, 나중에 "왜 엉뚱한 게 지워졌지?"를 겪게 된다. 이 에러가 뜨면 **필터나 스코핑으로 의도를 명확히 하라는 신호**다.

### 로케이터는 지연 평가된다

이걸 모르면 헷갈리는 동작을 만난다.

```typescript
const button = page.getByRole('button', { name: '저장' });
// 이 시점에 DOM 을 찾지 않는다. "찾는 방법"만 저장된다.

await button.click();   // 여기서 비로소 찾는다 (그리고 자동 대기)
await button.click();   // 다시 찾는다 — 페이지가 바뀌었어도 동작한다
```

Selenium의 WebElement 와 다른 점이다. Selenium에서는 요소를 찾아둔 뒤 페이지가 갱신되면 `StaleElementReferenceException` 이 난다. **Playwright 로케이터는 재사용해도 안전하다.** 그래서 페이지 오브젝트에 로케이터를 필드로 저장해 둘 수 있다 (4편).

### XPath — 언제 필요한가

거의 필요 없지만, 두 경우엔 쓴다.

```typescript
// 1. 텍스트로 부모/형제를 거슬러 올라가야 할 때
page.locator("//span[text()='품절']/ancestor::div[@class='product-card']")

// 2. 레거시 시스템에서 접근성 속성이 전혀 없을 때
```

1번은 Playwright에서 대체 가능한 경우가 많다.

```typescript
// XPath 없이 같은 일을 한다
page.getByTestId('product-card').filter({ hasText: '품절' })
```

**XPath를 쓰기 전에 항상 "필터로 될까?"를 먼저 물어본다.**

### 실무 판단 흐름

새 요소의 셀렉터를 정할 때 순서대로 물어본다.

```text
1. 이 요소는 사용자에게 어떤 역할로 보이는가?  → getByRole
2. 폼 요소인가? 라벨이 있는가?                → getByLabel
3. 고유한 텍스트가 있는가?                    → getByText / filter({hasText})
4. 부모 영역으로 좁힐 수 있는가?               → 스코핑 후 위 방법
5. 위 방법이 다 안 되면
   → 개발자에게 data-testid 를 요청한다        ← 셀렉터를 억지로 만들지 말 것
6. 그래도 안 되면 CSS/XPath (주석으로 이유를 남긴다)
```

5번이 핵심이다. **"셀렉터를 짜내는 것"이 아니라 "테스트하기 좋은 코드를 요청하는 것"** 이 시니어의 접근이다. 이런 요청을 PR 리뷰에서 자연스럽게 하는 QA가 팀의 자동화 성숙도를 끌어올린다.

## 왜 채용시장이 요구하는가

- 면접에서 **"자동화 테스트가 자주 깨지는데 어떻게 하시겠어요?"** 는 단골 질문이다. 로케이터 전략을 말할 수 있어야 한다.
- **유지보수 비용을 이해하는지**를 보는 질문이기도 하다. 테스트를 만드는 건 누구나 하지만, 6개월 뒤에도 살아있게 만드는 건 다르다.
- **접근성 관점**을 함께 말하면 크게 가산점이다. `getByRole` 이 접근성 결함을 잡아준다는 걸 아는 QA는 흔하지 않다.
- **AI가 만든 셀렉터가 가장 위험한 지점이다.** AI는 DOM 구조를 보고 `.container > div:nth-child(2) .btn` 같은 셀렉터를 자연스럽게 만든다. 지금 당장은 통과하지만 **다음 배포에 깨진다.** 그리고 그 유지보수는 사람이 한다. 이게 트랙 4 셀프힐링의 배경이기도 하다.

## 실습 과제

### 과제 1 — 같은 요소를 5가지 방법으로 (12분)

`https://demo.playwright.dev/todomvc` 또는 실습 랩의 샘플 앱에서 요소 하나를 고른다.
그 요소를 찾는 로케이터를 **5가지 방식**으로 작성하고 등급을 매긴다.

| 방식 | 코드 | 등급 | 언제 깨지는가 |
|---|---|---|---|
| getByRole | | | |
| getByText | | | |
| getByTestId | | | |
| CSS | | | |
| XPath | | | |

"언제 깨지는가"를 구체적으로 쓰는 게 이 과제의 핵심이다.

### 과제 2 — 일부러 깨뜨려 보기 (12분)

브라우저 개발자도구에서 DOM을 직접 수정해 각 셀렉터가 어떻게 반응하는지 확인한다.

1. 요소의 **class를 바꾼다** → 어떤 셀렉터가 깨지는가
2. 요소를 **다른 div로 한 번 더 감싼다** → 어떤 셀렉터가 깨지는가
3. **버튼 텍스트를 "삭제" → "제거"로 바꾼다** → 어떤 셀렉터가 깨지는가
4. `<button>` 을 `<div onclick>` 으로 바꾼다 → `getByRole` 이 어떻게 되는가

4번에서 얻는 교훈을 메모에 적는다.

### 과제 3 — 목록에서 특정 항목 다루기 (12분)

TodoMVC에 할 일 5개를 추가한 뒤 다음을 작성한다.

1. `nth(2)` 로 세 번째 항목을 완료 처리 — 통과시킨다
2. 할 일 순서를 바꾸는 코드를 앞에 추가 → **1번 테스트가 깨지는지 확인**
3. `filter({ hasText: '...' })` 로 다시 작성 → 순서가 바뀌어도 통과하는지 확인
4. 완료된 항목만 대상으로 하는 로케이터 작성 (`filter({ has: ... })` 활용)

### 과제 4 — 실습 랩 셀렉터 연습기 (10분)

이 플랫폼의 **실습 랩 → 셀렉터 연습기**에서 요소를 클릭해 셀렉터 후보를 비교한다.
좋은 셀렉터와 깨지기 쉬운 셀렉터가 나란히 표시되니, 앞 과제의 판단과 일치하는지 확인한다.

### 과제 5 — AI 셀렉터 감사 (12분)

AI 실습 도우미에 아래 HTML을 주고 요청한다.

```html
<div class="css-1x2y3z4 product-card" data-id="10023">
  <span class="sc-bdVaJa">무선 이어폰</span>
  <span class="price">45,000원</span>
  <div class="btn-group">
    <div class="btn btn-sm" onclick="addCart(10023)">담기</div>
    <button aria-label="찜하기"><svg>...</svg></button>
  </div>
</div>
```

> 이 카드에서 "담기"를 클릭하는 Playwright 로케이터를 작성하라.

**검증 항목**

| 확인 | 결과 |
|---|---|
| 자동 생성 클래스(`css-1x2y3z4`, `sc-bdVaJa`)에 의존했는가 | |
| `담기` 가 `<button>` 이 아니라 `<div>` 라는 점을 지적했는가 | |
| 접근성 문제로 제기했는가, 아니면 CSS 셀렉터로 우회했는가 | |
| 아이콘 버튼(`aria-label="찜하기"`)은 `getByRole` 로 잡았는가 | |
| `data-testid` 추가를 제안했는가 | |

**두 번째 항목이 이 과제의 핵심이다.** 대부분의 AI는 `div` 를 클릭하는 CSS 셀렉터를 만들어 주고 끝낸다. **"이건 버튼이어야 합니다"라고 말하는 건 사람의 몫이다.**

## 자가 체크리스트

- [ ] 자동화 실패 원인 중 셀렉터 문제가 가장 큰 비중임을 알고 있다
- [ ] 로케이터 우선순위(role → label/text → testid → CSS/XPath)를 순서대로 말할 수 있다
- [ ] `getByRole` 이 1순위인 세 가지 이유를 설명할 수 있다
- [ ] `getByRole` 로 못 찾는 요소가 접근성 결함일 수 있음을 알고 리포트할 수 있다
- [ ] 자동 생성 클래스명(CSS-in-JS, 빌드 해시)에 의존하면 안 되는 이유를 안다
- [ ] `data-testid` 의 장점과 단점(접근성 결함을 가린다)을 함께 설명할 수 있다
- [ ] `filter({ hasText })`, `filter({ has })` 로 목록에서 항목을 특정할 수 있다
- [ ] 모달·섹션으로 스코핑해서 동명의 요소를 구분할 수 있다
- [ ] `nth()` / `first()` 로 때우면 왜 나중에 깨지는지 설명할 수 있다
- [ ] strict mode 위반 에러가 안전장치라는 것을 이해한다
- [ ] Playwright 로케이터가 지연 평가되어 재사용 가능하다는 것을 안다
- [ ] XPath를 쓰기 전에 filter로 대체 가능한지 먼저 검토한다
- [ ] 셀렉터를 짜내는 대신 개발자에게 `data-testid` 를 요청할 줄 안다
- [ ] AI가 만든 셀렉터에서 취약한 의존과 놓친 접근성 문제를 짚어낼 수 있다

## 참고 링크

- [Playwright — Locators](https://playwright.dev/docs/locators) — 공식 우선순위 가이드
- [Playwright — Other locators](https://playwright.dev/docs/other-locators) — CSS/XPath를 써야 할 때
- [ARIA Roles 목록 (MDN)](https://developer.mozilla.org/ko/docs/Web/Accessibility/ARIA/Roles) — `getByRole` 에 쓸 수 있는 역할들
- [Testing Library — Priority 가이드](https://testing-library.com/docs/queries/about/#priority) — Playwright 로케이터 철학의 뿌리
