---
id: t6-l03
title: HTML·DOM 구조와 셀렉터 — 자동화 로케이터의 기반
summary: DOM을 직접 읽고 CSS·XPath를 쓸 수 있게 된다. 트랙 3의 로케이터 판단이 왜 그런지 밑바닥부터 이해한다.
minutes: 20
order: 3
tags: [HTML, DOM, CSS셀렉터, XPath, 접근성]
---

## 개념 설명

### 이걸 알면 무엇을 판단할 수 있게 되는가

```text
□ AI가 만든 셀렉터가 왜 깨질지 예측할 수 있다
□ 개발자도구에서 직접 셀렉터를 만들고 검증할 수 있다
□ "이 요소는 왜 getByRole 로 안 잡히는가"를 설명할 수 있다
□ 셀프힐링의 후보 셀렉터를 직접 설계할 수 있다 (트랙 4)
□ 접근성 결함을 DOM 수준에서 지적할 수 있다
```

### HTML과 DOM은 다르다

이 구분이 자동화에서 결정적이다.

```text
HTML  — 서버가 보낸 원본 텍스트 (Network 탭의 Response)
DOM   — 브라우저가 파싱하고 JS 가 조작한 결과 (Elements 탭)
```

```html
<!-- 서버가 보낸 HTML -->
<div id="root"></div>

<!-- JS 실행 후 DOM -->
<div id="root">
  <div class="product-list">
    <article class="card">...</article>
  </div>
</div>
```

**자동화 도구는 DOM을 본다.** 그래서 "페이지 소스 보기"에 없는 요소도 잡을 수 있다. 반대로, 앞 레슨의 CSR 사이트는 원본 HTML에 아무것도 없다.

**개발자도구에서 확인하는 법**
- Elements 탭 = **DOM** (실시간, JS 조작 반영)
- Network → 문서 요청 → Response = **원본 HTML**

둘을 비교하면 렌더링 방식을 바로 알 수 있다 (앞 레슨 과제 1).

### DOM 트리 구조

```html
<body>
  <main>
    <section class="cart">
      <h2>장바구니</h2>
      <ul class="items">
        <li data-id="10023">
          <span class="name">무선 이어폰</span>
          <span class="price">45,000원</span>
          <button aria-label="삭제">×</button>
        </li>
      </ul>
    </section>
  </main>
</body>
```

```text
관계 용어 (셀렉터에서 그대로 쓴다)
  부모(parent)    li 의 부모는 ul
  자식(child)     ul 의 자식은 li
  자손(descendant) section 의 자손은 h2, ul, li, span, button 전부
  형제(sibling)   span.name 과 span.price 는 형제
```

### CSS 셀렉터 — 필수만

```css
/* 기본 */
button                    /* 태그 */
.card                     /* 클래스 */
#checkout                 /* id */
[data-id="10023"]         /* 속성 */
[aria-label="삭제"]        /* 속성 (접근성) */

/* 조합 */
li.item.selected          /* 두 클래스를 모두 가진 li */
button[type="submit"]     /* 태그 + 속성 */

/* 관계 */
ul li                     /* ul 의 모든 자손 li */
ul > li                   /* ul 의 직계 자식 li 만 */
h2 + ul                   /* h2 바로 다음 형제 ul */
h2 ~ ul                   /* h2 뒤의 모든 형제 ul */

/* 위치 */
li:first-child
li:last-child
li:nth-child(3)           /* 3번째 */
li:nth-of-type(2)         /* 같은 태그 중 2번째 */

/* 상태 */
input:disabled
input:checked
button:not(.hidden)

/* 부분 일치 (속성) */
[class^="Button_"]        /* 로 시작 */
[class$="__active"]       /* 로 끝 */
[class*="btn"]            /* 포함 */
[href^="/orders/"]        /* 실무에서 유용 */
```

**`[class^="Button_"]` 이 실무에서 쓸모 있다.** CSS Modules 가 `Button_root__x7f2a` 처럼 해시를 붙일 때, 앞부분은 유지되는 경우가 많다. 다만 **여전히 취약하므로 최후의 수단**이다 (트랙 3).

**`:has()`** 도 최근 브라우저에서 쓸 수 있다.

```css
li:has(.badge-soldout)    /* 품절 배지를 포함한 li */
```

Playwright에서는 `filter({ has: ... })` 가 더 읽기 쉽다.

### 개발자도구에서 셀렉터 검증하기

**콘솔에서 바로 확인한다. 이게 가장 빠른 방법이다.**

```javascript
$$('button.delete')              // 모두 찾기 (배열)
$$('button.delete').length       // 몇 개인가  ← strict mode 위반 예방
$('button.delete')               // 첫 번째
$('button.delete').textContent   // 내용 확인

// XPath
$x('//button[text()="삭제"]')
```

**`$$` 로 개수를 먼저 확인하는 습관**을 들이면 트랙 3의 strict mode 위반을 미리 막을 수 있다.

Elements 탭에서 요소 우클릭 → Copy → Copy selector / Copy XPath 로 자동 생성도 되지만, **그 결과는 대체로 나쁘다.**

```text
Copy selector 결과:
  #root > div > div.sc-bdVaJa.hXBqmL > div:nth-child(3) > button
→ DOM 구조가 조금만 바뀌어도 깨진다. 참고용으로만 본다.
```

### XPath — 언제 필요한가

CSS로 안 되는 두 가지가 있다.

**1. 텍스트로 찾기**

```xpath
//button[text()="삭제"]
//button[contains(text(), "삭제")]
//span[normalize-space()="무선 이어폰"]
```

`normalize-space()` 는 앞뒤 공백과 줄바꿈을 정리한다. HTML에서 텍스트에 공백이 섞이는 경우가 많아 유용하다.

**2. 부모·조상으로 거슬러 올라가기**

```xpath
//span[text()="품절"]/ancestor::li
//span[text()="무선 이어폰"]/../..
//input[@id="email"]/preceding-sibling::label
```

**CSS에는 부모 선택자가 없다.** (`:has()` 로 우회 가능하지만 표현이 다르다)

**XPath 문법 요약**

```xpath
//div                       문서 어디든 div
/html/body/div              절대 경로 (매우 취약, 쓰지 말 것)
//div[@class="card"]        속성
//div[@class="card"][2]     2번째 (1부터 시작)
//div[contains(@class,"card")]
//ul/li                     직계 자식
//ul//span                  자손
//li[.//span[text()="품절"]] 조건: 안에 품절 span 이 있는 li
```

**XPath는 최후의 수단**이다 (트랙 3). 특히 모바일 자동화에서는 성능 문제가 심각하다 (트랙 3의 6편).

### 접근성 속성 — getByRole 의 근거

트랙 3에서 `getByRole` 을 1순위로 쓰라고 했다. **그 판정 기준이 여기 있다.**

```html
<!-- 암묵적 역할 (태그 자체가 역할을 갖는다) -->
<button>결제</button>              → role="button"
<a href="/cart">장바구니</a>        → role="link"
<h1>제목</h1>                      → role="heading", level=1
<input type="checkbox">            → role="checkbox"
<nav>, <main>, <table>             → navigation, main, table

<!-- 명시적 역할 -->
<div role="button" tabindex="0">결제</div>
```

**접근성 이름(accessible name)이 정해지는 우선순위**

```html
<!-- 1. aria-labelledby -->
<button aria-labelledby="lbl">×</button><span id="lbl">삭제</span>

<!-- 2. aria-label -->
<button aria-label="삭제">×</button>

<!-- 3. 요소 내부 텍스트 -->
<button>삭제</button>

<!-- 4. (input의 경우) 연결된 label -->
<label for="email">이메일</label><input id="email">

<!-- 5. placeholder, title (약함) -->
<input placeholder="이메일">
```

**`getByRole('button', { name: '삭제' })` 의 `name` 이 바로 이 접근성 이름이다.** 어떻게 정해지는지 알면 왜 안 잡히는지도 안다.

**자주 만나는 문제**

```html
<!-- 문제 1: div 버튼 → role=button 이 아니다 -->
<div class="btn" onclick="submit()">결제</div>
→ getByRole('button') 으로 안 잡힌다
→ 키보드 접근 불가, 스크린리더가 버튼으로 안 읽음 = 접근성 결함

<!-- 문제 2: 아이콘 버튼에 이름이 없다 -->
<button><svg>...</svg></button>
→ 접근성 이름이 비어 있다
→ getByRole('button', { name: ... }) 로 못 찾는다
→ 스크린리더 사용자는 무슨 버튼인지 모른다 = 접근성 결함

<!-- 문제 3: label 이 연결 안 됨 -->
<span>이메일</span><input type="text">
→ getByLabel('이메일') 로 안 잡힌다
→ 라벨 클릭해도 입력창에 포커스 안 감 = 사용성 결함
```

**세 경우 모두 "자동화가 어렵다"와 "접근성이 나쁘다"가 같은 원인**이다. 트랙 3에서 말한 대로, `getByRole` 로 못 찾으면 그건 대체로 결함 신호다.

### 개발자도구 접근성 패널

Elements 탭 → 우측 **Accessibility** 패널에서 선택한 요소의 role과 접근성 이름을 볼 수 있다.

```text
Computed Properties
  role: button
  name: "삭제"          ← 이게 getByRole 의 name
  focusable: true
  disabled: false
```

**여기서 `name` 이 비어 있으면 자동화도 어렵고 접근성도 나쁘다.** 5초면 확인된다.

### 그림자 DOM — 가끔 만나는 벽

웹 컴포넌트가 쓰는 구조다. 일반 CSS 셀렉터가 뚫지 못한다.

```html
<my-widget>
  #shadow-root
    <button>클릭</button>     ← document.querySelector('button') 으로 안 잡힘
</my-widget>
```

**Playwright는 기본적으로 그림자 DOM을 뚫는다.** 이건 Playwright의 장점 중 하나다.

```typescript
await page.getByRole('button', { name: '클릭' }).click();   // 동작한다
```

하지만 **콘솔의 `$$()` 나 XPath 는 못 뚫는다.** 개발자도구에서 셀렉터를 검증할 때 안 잡히는데 Playwright에서는 되는 경우, 그림자 DOM일 가능성이 있다.

```javascript
// 콘솔에서 그림자 DOM 접근
document.querySelector('my-widget').shadowRoot.querySelector('button')
```

### iframe — 별도의 문서

```html
<iframe src="/payment-widget"></iframe>
```

**iframe 안은 완전히 다른 문서다.** 바깥 셀렉터로 안 잡힌다. 결제 위젯, 지도, 광고에서 자주 만난다.

```typescript
// Playwright
const frame = page.frameLocator('iframe[title="결제"]');
await frame.getByRole('button', { name: '결제하기' }).click();
```

```javascript
// 콘솔에서 (같은 출처일 때만)
document.querySelector('iframe').contentDocument.querySelector('button')
```

**다른 출처(cross-origin) iframe 은 JS로 접근할 수 없다.** 결제 PG 위젯이 대표적이다. 이 경우 Playwright의 `frameLocator` 는 동작하지만 콘솔 검증은 안 된다.

### 셀렉터 안정성 판단 — 트랙 3의 근거

이제 왜 그 순서인지 설명할 수 있다.

| 셀렉터 | 무엇에 의존하는가 | 언제 깨지는가 |
|---|---|---|
| `getByRole` | **의미(semantics)** | 요소의 역할이 바뀔 때 (드묾) |
| `getByLabel` | 사용자에게 보이는 라벨 | 문구 변경, 다국어 |
| `getByTestId` | 개발자가 심은 계약 | 의도적으로 지울 때 |
| `#id` | id 속성 | 자동 생성 id면 매번 |
| `.class` | **스타일** | 디자인 변경 시 |
| `nth-child` | **DOM 구조** | 요소 하나만 추가돼도 |
| 절대 XPath | 전체 트리 구조 | 거의 항상 |

**"무엇에 의존하는가"가 안정성을 결정한다.** 의미 → 라벨 → 계약 → 구조 → 스타일 순으로 잘 안 바뀐다.

## 왜 채용시장이 요구하는가

- **"HTML/CSS/DOM 이해"** 는 자동화 QA 공고의 기본 요구사항이다. 셀렉터를 못 쓰면 자동화를 못 한다.
- 면접에서 **화면을 보여주고 "이 버튼의 셀렉터를 만들어 보세요"** 라고 하는 경우가 있다. 여러 방법과 안정성 비교를 말할 수 있어야 한다.
- **`getByRole` 로 안 잡히는 것이 접근성 결함**이라는 연결을 아는 QA는 드물다. 강한 차별점이다.
- **iframe·그림자 DOM 경험**은 실제로 자동화를 해본 사람만 안다.
- **AI가 만든 셀렉터의 취약성을 예측**할 수 있으려면 무엇에 의존하는지 볼 줄 알아야 한다.

## 실습 과제

### 과제 1 — 콘솔에서 셀렉터 만들기 (15분)

아무 웹사이트에서 콘솔을 열고 요소 5개를 골라 셀렉터를 직접 작성한다.

| 대상 요소 | 내가 만든 CSS | `$$()` 개수 | 안정성 등급 |
|---|---|---|---|
| | | | |

**개수가 1이 되도록** 다듬는 것이 연습의 핵심이다. 여러 개가 잡히면 조건을 추가한다.

그다음 같은 요소를 **Copy selector 로 자동 생성**해 비교한다. 어느 쪽이 안정적인가?

### 과제 2 — HTML vs DOM 차이 확인 (10분)

CSR 사이트 하나를 골라:

1. Network → 문서 요청 → Response 에서 **원본 HTML** 확인
2. Elements 탭에서 **DOM** 확인
3. 원본에 없는데 DOM에 있는 요소를 3개 찾아 적기
4. **원본 HTML만 보는 도구(curl)로는 왜 테스트가 안 되는지** 설명

```bash
curl -s https://example.com | head -50
```

### 과제 3 — 접근성 패널 점검 (15분)

한 페이지에서 인터랙티브 요소 10개를 골라 접근성 패널로 확인한다.

| 요소 | role | name | getByRole 로 잡히는가 | 문제 |
|---|---|---|---|---|
| | | | | |

**`name` 이 비어 있거나 role이 이상한 것**을 찾는다. 최소 하나는 나온다.

찾은 것을 **접근성 결함 리포트**로 작성한다 (트랙 1 형식). 개발자에게 제안할 수정안(`aria-label` 추가 등)도 함께.

### 과제 4 — XPath가 필요한 경우 (12분)

CSS로는 안 되고 XPath로만 되는 상황을 3개 만든다.

1. 텍스트로 요소 찾기
2. 자식으로부터 부모 찾기
3. 특정 내용을 포함한 조상 찾기

각각에 대해:
- XPath 작성
- **Playwright 의 `filter()` 로 대체 가능한지** 확인 (트랙 3)
- 대체 가능하면 그쪽을 쓴다

**"XPath 없이 되는가?"를 먼저 묻는 습관**을 들이는 것이 목적이다.

### 과제 5 — 셀렉터 깨뜨리기 (15분)

개발자도구에서 DOM을 직접 편집해 각 셀렉터가 언제 깨지는지 확인한다.

| 변경 | `getByRole` | `getByTestId` | `.class` | `nth-child` |
|---|---|---|---|---|
| class 변경 | | | | |
| 부모 div 추가 | | | | |
| 형제 요소 추가 | | | | |
| 버튼 텍스트 변경 | | | | |
| `<button>` → `<div>` | | | | |
| `data-testid` 제거 | | | | |

**표를 다 채우면 트랙 3의 우선순위가 왜 그런지 몸으로 이해된다.**

### 과제 6 — iframe / 그림자 DOM (12분)

1. iframe이 있는 페이지를 찾는다 (유튜브 임베드, 지도 등)
2. 콘솔에서 iframe 내부 요소에 접근해 본다
3. cross-origin이면 어떤 에러가 나는지 기록
4. Playwright의 `frameLocator` 로 접근하는 코드를 작성

그림자 DOM을 쓰는 사이트를 찾으면 같은 방식으로 확인한다. (많은 최신 웹 컴포넌트 라이브러리가 사용)

### 과제 7 — AI 셀렉터 취약성 예측 (12분)

AI 실습 도우미에 실제 페이지의 HTML 일부를 주고 셀렉터를 요청한다.

받은 셀렉터마다 **무엇에 의존하는지, 언제 깨질지** 표로 예측한다.

| AI 셀렉터 | 의존 대상 | 예상 수명 | 더 나은 대안 |
|---|---|---|---|
| | 스타일/구조/의미 | | |

그다음 **DOM을 실제로 수정해 예측이 맞는지 확인**한다.

## 자가 체크리스트

- [ ] HTML(원본)과 DOM(파싱·조작 결과)의 차이를 설명할 수 있다
- [ ] 개발자도구에서 원본 HTML과 DOM을 각각 확인할 수 있다
- [ ] 부모·자식·자손·형제 관계를 셀렉터로 표현할 수 있다
- [ ] CSS 셀렉터의 기본·조합·관계·위치·상태 문법을 쓸 수 있다
- [ ] `[class^=]`, `[class*=]` 부분 일치를 알고, 여전히 취약함을 안다
- [ ] 콘솔의 `$$()` 로 개수를 먼저 확인하는 습관이 있다
- [ ] Copy selector 결과가 대체로 나쁜 이유를 설명할 수 있다
- [ ] XPath가 필요한 두 경우(텍스트, 조상 탐색)를 안다
- [ ] `normalize-space()` 의 용도를 안다
- [ ] XPath 전에 `filter()` 로 대체 가능한지 먼저 검토한다
- [ ] 암묵적 role과 명시적 role을 구분할 수 있다
- [ ] **접근성 이름이 정해지는 우선순위 5단계**를 안다
- [ ] div 버튼·이름 없는 아이콘 버튼·미연결 label을 접근성 결함으로 판단한다
- [ ] 개발자도구 접근성 패널에서 role과 name을 확인할 수 있다
- [ ] 그림자 DOM을 Playwright는 뚫지만 콘솔 `$$()` 는 못 뚫는 것을 안다
- [ ] iframe이 별도 문서이고 `frameLocator` 가 필요함을 안다
- [ ] cross-origin iframe은 JS로 접근할 수 없음을 안다
- [ ] 셀렉터가 **무엇에 의존하는가**로 안정성을 판단할 수 있다
- [ ] AI가 만든 셀렉터의 수명을 예측할 수 있다

## 참고 링크

- [MDN — CSS 선택자](https://developer.mozilla.org/ko/docs/Web/CSS/CSS_selectors) — 한국어 전체 목록
- [MDN — DOM 소개](https://developer.mozilla.org/ko/docs/Web/API/Document_Object_Model/Introduction) — HTML과 DOM의 차이
- [MDN — ARIA roles](https://developer.mozilla.org/ko/docs/Web/Accessibility/ARIA/Roles) — role 목록
- [Accessible Name 계산 규칙 (W3C)](https://www.w3.org/TR/accname/) — 이름 우선순위 표준
- [Chrome DevTools — 접근성 검사](https://developer.chrome.com/docs/devtools/accessibility/reference) — 패널 사용법
- [Playwright — Frames](https://playwright.dev/docs/frames) — iframe 다루기
