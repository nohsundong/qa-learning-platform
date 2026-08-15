---
id: t6-l02
title: 클라이언트–서버 구조와 렌더링·비동기 처리
summary: 화면이 어떻게 그려지는지 알아야 무엇을 언제 검증할지 안다. SSR/CSR 차이와 비동기가 만드는 결함들.
minutes: 20
order: 2
tags: [SSR, CSR, 렌더링, 비동기, 경쟁조건, 캐시]
---

## 개념 설명

### 이걸 알면 무엇을 판단할 수 있게 되는가

```text
□ 이 화면은 왜 처음에 빈 상태로 보이는가 → 렌더링 방식
□ 이 테스트는 왜 가끔 실패하는가 → 비동기 타이밍
□ 새로고침하면 되는데 SPA 이동으로는 안 되는 이유 → 라우팅
□ 이 데이터는 어디서 오는가 (서버? 캐시? localStorage?)
□ AI가 "networkidle 로 기다리세요"라고 했는데 왜 위험한가
```

### 렌더링 방식 세 가지

같은 화면이라도 **누가 HTML을 만드느냐**에 따라 테스트 전략이 달라진다.

**CSR (Client-Side Rendering)** — React, Vue SPA 기본

```text
① 브라우저가 거의 빈 HTML 을 받는다
   <div id="root"></div>
② JS 번들 다운로드·실행
③ JS 가 API 호출
④ 응답이 오면 화면을 그린다
```

- **초기 화면이 비어 있다.** 로딩 스피너 구간이 존재
- 테스트에서 **데이터가 채워질 때까지 기다려야 한다**
- `page.goto()` 직후 어서션하면 실패한다
- SEO에 불리 (검색 엔진이 빈 HTML을 본다)

**SSR (Server-Side Rendering)** — Next.js 등

```text
① 서버가 API를 호출해 데이터를 채운 완성 HTML 을 만들어 보낸다
② 브라우저가 바로 내용을 보여준다
③ JS 가 로드되면 인터랙션이 붙는다 (하이드레이션)
```

- **첫 화면이 즉시 보인다**
- 테스트가 상대적으로 안정적
- **하이드레이션 구간이 함정**: 화면은 보이는데 버튼이 아직 안 눌린다

**SSG (Static Site Generation)** — 빌드 시점에 HTML 생성

- 가장 빠르다. 이 학습 플랫폼도 이 방식이다
- 데이터가 빌드 시점에 고정 → **최신 데이터가 아닐 수 있다**
- 재빌드 주기가 검증 대상

### 하이드레이션 — SSR의 대표적 함정

```text
0ms    서버가 준 HTML 표시 → 버튼이 화면에 보인다
       하지만 JS 가 아직 로드 안 됨 → 클릭해도 아무 일 없음
800ms  JS 로드·하이드레이션 완료 → 이제 클릭이 동작한다
```

**이 구간에서 자동화 테스트가 깨진다.** Playwright의 자동 대기(트랙 3)는 요소가 "보이고 활성화됐는지"만 보는데, **하이드레이션 여부는 모른다.**

```typescript
// 문제: 버튼은 보이지만 이벤트 핸들러가 아직 없다
await page.getByRole('button', { name: '담기' }).click();
await expect(page.getByTestId('cart-count')).toHaveText('1');   // 가끔 실패
```

**대응 방법**

```typescript
// 방법 1: 하이드레이션 완료 신호를 기다린다 (앱이 제공한다면)
await page.waitForFunction(() => window.__APP_READY__ === true);

// 방법 2: 결과를 어서션하며 재시도 (트랙 3의 웹 우선 어서션)
await expect(page.getByTestId('cart-count')).toHaveText('1', { timeout: 10000 });

// 방법 3: 상호작용 가능 상태를 나타내는 요소를 기다린다
await expect(page.getByRole('button', { name: '담기' })).toBeEnabled();
```

**사용자에게도 같은 문제다.** "버튼을 눌렀는데 반응이 없다"는 실제 사용성 결함이므로, **하이드레이션 시간이 얼마나 되는지 재보는 것**도 QA의 일이다.

### 사용자 눈에 보이는 것 vs 실제 상태

이 구분이 QA에게 핵심이다.

| 화면 상태 | 실제로는 |
|---|---|
| 목록이 비어 있음 | 로딩 중? 데이터 0건? API 실패? |
| 스피너가 돌고 있음 | 요청 중? 응답을 못 받고 있음? |
| 데이터가 보임 | 서버에서 온 것? 캐시? 낙관적 업데이트? |
| 버튼이 보임 | 눌리는가? |

**"낙관적 업데이트(optimistic update)"** 를 특히 조심한다.

```text
사용자가 "좋아요" 클릭
  → 화면에 즉시 하트가 채워진다 (서버 응답 전에)
  → 서버 요청 실패
  → 되돌려야 하는데 안 되돌리는 구현이 흔하다
```

**화면에는 좋아요가 눌린 것처럼 보이는데 서버에는 저장 안 됨.** 새로고침하면 사라진다. 이건 화면만 보는 테스트로는 절대 안 잡히고, **API 응답을 실패시켜야** 드러난다.

```typescript
// Playwright 로 API 실패를 인위적으로 만든다
await page.route('**/api/likes', route => route.fulfill({ status: 500 }));
await page.getByRole('button', { name: '좋아요' }).click();
// 화면이 원래대로 돌아가는가? 오류 메시지가 뜨는가?
await expect(page.getByRole('alert')).toBeVisible();
```

**이 테스트를 설계할 수 있게 되는 것**이 이 레슨의 목표다.

### 비동기가 만드는 결함들

**1. 경쟁 조건 (race condition)**

```text
사용자가 검색어를 빠르게 입력: "노" → "노트" → "노트북"
  요청 A ("노")    → 서버 응답 800ms
  요청 B ("노트")   → 서버 응답 300ms
  요청 C ("노트북") → 서버 응답 200ms

응답 도착 순서: C(200ms) → B(300ms) → A(800ms)
→ 마지막에 도착한 A 의 결과가 화면에 남는다
→ "노트북"을 검색했는데 "노"의 결과가 보인다
```

**테스트 방법**: 빠르게 연속 입력하고 최종 결과가 마지막 입력과 일치하는지 확인한다. 또는 `page.route` 로 응답을 지연시켜 순서를 뒤집는다.

```typescript
let callCount = 0;
await page.route('**/api/search*', async route => {
  callCount++;
  const delay = callCount === 1 ? 1000 : 100;   // 첫 요청만 느리게
  await new Promise(r => setTimeout(r, delay));
  await route.continue();
});
```

**2. 중복 제출**

```text
사용자가 "주문하기"를 빠르게 두 번 클릭
→ 요청이 두 번 나간다
→ 주문이 두 건 생성된다
```

트랙 2의 `Idempotency-Key`, 트랙 1의 상태전이 "중복 이벤트"와 같은 문제다.

```typescript
// 버튼 연타 테스트
const btn = page.getByRole('button', { name: '주문하기' });
await Promise.all([btn.click(), btn.click(), btn.click()]);
// 주문이 1건만 생성됐는가? (API 또는 DB로 확인 — 트랙 2)
```

**클라이언트에서 버튼을 disabled 처리하는 것만으로는 부족하다.** 네트워크 도구로 요청을 직접 보내면 뚫린다. **서버에도 방어가 있어야 한다.**

**3. 컴포넌트 언마운트 후 응답 도착**

```text
사용자가 상세 페이지 진입 → API 호출
응답 오기 전에 뒤로가기
응답 도착 → 이미 없는 화면을 갱신하려 함
→ 콘솔 에러 (React 의 "setState on unmounted component" 등)
```

**화면에는 아무 문제가 없어 보이지만 콘솔에 에러가 쌓인다.** 트랙 4의 자율 탐색에서 콘솔 에러를 수집해야 하는 이유다.

**4. 순서 의존 요청**

```text
장바구니 수량을 1 → 2 → 3 으로 빠르게 변경
각 변경이 개별 API 요청이라면
→ 응답 순서가 뒤바뀌면 최종 수량이 2가 될 수 있다
```

### 데이터가 어디서 오는가 — 캐시 계층

```text
브라우저 메모리 캐시
  ↓
브라우저 디스크 캐시 (HTTP Cache-Control)
  ↓
Service Worker 캐시
  ↓
localStorage / sessionStorage / IndexedDB
  ↓
CDN 캐시
  ↓
서버 애플리케이션 캐시 (Redis 등)
  ↓
DB
```

**"수정했는데 화면에 반영이 안 돼요"** 의 원인이 이 계층 어딘가다.

QA가 확인할 것.

```text
□ 강제 새로고침(Ctrl+Shift+R)하면 반영되는가 → 브라우저 캐시
□ 시크릿 창에서는 되는가 → localStorage / 쿠키
□ 다른 사용자에게도 안 보이는가 → 서버 캐시 또는 CDN
□ API 를 직접 호출하면 최신인가 → 프론트엔드 캐시
□ DB 에는 반영됐는가 (트랙 2의 SQL) → 서버 캐시
```

**이 순서로 좁혀가면 어느 계층 문제인지 특정된다.** 트랙 2의 로그 분석과 같은 접근이다.

개발자도구 Network 탭에서 `from disk cache`, `from memory cache`, `304 Not Modified` 를 확인할 수 있다.

### SPA 라우팅 — 새로고침과 링크 이동이 다르다

```text
① 링크 클릭 (SPA 내부 이동)
   → 페이지 전체를 다시 안 받는다. JS 가 화면만 바꾼다
   → 기존 상태(전역 스토어, 스크롤 위치)가 유지된다

② URL 직접 입력 / 새로고침
   → 서버에서 페이지를 새로 받는다
   → 모든 상태가 초기화된다
```

**두 경로가 다르게 동작하는 결함이 매우 흔하다.**

```text
□ 링크로 들어가면 되는데 URL 직접 입력하면 404 (서버 라우팅 설정 누락)
□ 새로고침하면 되는데 링크 이동으로는 데이터가 갱신 안 됨 (캐시)
□ 뒤로가기 시 이전 상태가 이상하게 남음
□ 링크 이동 시 이전 화면의 데이터가 잠깐 보임
```

**테스트 설계 원칙**: 중요한 화면은 **두 경로 모두로 진입해서 검증**한다.

```typescript
// 경로 1: 직접 진입
await page.goto('/orders/1001');
await expect(page.getByTestId('order-id')).toHaveText('1001');

// 경로 2: 링크 이동
await page.goto('/orders');
await page.getByRole('link', { name: '1001' }).click();
await expect(page.getByTestId('order-id')).toHaveText('1001');
```

### 이 지식으로 AI 코드를 검증하기

AI가 이런 조언을 자주 한다.

```typescript
// AI 제안
await page.goto('/products');
await page.waitForLoadState('networkidle');   // "모든 요청이 끝날 때까지"
await expect(page.getByTestId('product-card')).toHaveCount(20);
```

**`networkidle` 이 왜 위험한지 이제 설명할 수 있다.**

- 폴링(주기적 API 호출), 웹소켓, 분석 스크립트가 있으면 **네트워크가 절대 idle 이 안 된다**
- 반대로 요청이 순간적으로 끊긴 틈에 idle 로 판정돼 **너무 일찍 넘어갈 수도** 있다
- **화면 상태와 무관하다.** 요청이 끝나도 렌더링은 아직일 수 있다

**올바른 대안은 결과를 어서션하는 것**이다 (트랙 3).

```typescript
await page.goto('/products');
await expect(page.getByTestId('product-card')).toHaveCount(20);   // 이것으로 충분
```

## 왜 채용시장이 요구하는가

- **"클라이언트-서버 구조 이해"** 는 공고에 자주 나오지만 모호한 표현이다. 실제로는 **"결함의 위치를 판단할 수 있는가"** 를 묻는다.
- 면접 질문: **"프론트엔드 문제인지 백엔드 문제인지 어떻게 판단하세요?"** — Network 탭, API 직접 호출, DB 확인의 3단계로 답할 수 있어야 한다.
- **낙관적 업데이트의 롤백 실패**나 **검색 경쟁 조건** 같은 결함을 설계할 수 있으면 실력이 드러난다.
- **SPA에서 링크 이동과 직접 진입을 나눠 테스트한다**는 관점은 실무에서 바로 쓰이는 것이다.
- **AI는 타이밍 문제에 `networkidle` 이나 `sleep` 을 제안한다.** 왜 안 되는지 설명하고 대안을 제시할 수 있어야 한다.

## 실습 과제

### 과제 1 — 렌더링 방식 판별 (12분)

서로 다른 웹사이트 3개를 골라 렌더링 방식을 판별한다.

**방법**: 개발자도구 → Network → 첫 문서 요청(HTML) 클릭 → Response 탭에서 **원본 HTML에 콘텐츠가 들어있는지** 확인.

| 사이트 | 원본 HTML에 콘텐츠 | 판정 | 테스트 시 주의점 |
|---|---|---|---|
| | | CSR/SSR/SSG | |

JS를 끄고 접속해 보는 것도 좋은 방법이다. (개발자도구 설정 → Disable JavaScript)

### 과제 2 — 낙관적 업데이트 테스트 (15분)

`page.route` 로 API를 실패시키는 테스트를 작성한다.

1. 좋아요·북마크·수량 변경 같은 기능이 있는 연습 대상 선정 (실습 랩 샘플 앱 가능)
2. 정상 동작 확인
3. `route.fulfill({ status: 500 })` 로 API 실패
4. **화면이 원래대로 돌아가는가?** 오류 메시지가 뜨는가?
5. 결과 기록

**돌아가지 않는다면 그게 결함이다.** 트랙 1 형식으로 리포트를 써본다.

### 과제 3 — 경쟁 조건 재현 (15분)

검색 자동완성이 있는 사이트에서:

1. `page.route` 로 첫 요청만 1초 지연시킨다
2. 빠르게 두 번 다른 검색어를 입력
3. **최종 화면에 어느 결과가 남는가** 확인
4. 결함이면 재현 절차를 기록

지연 없이 사람 손으로도 시도해 본다 — 실제 사용자가 겪는 상황인지 확인.

### 과제 4 — 중복 제출 (12분)

```typescript
const btn = page.getByRole('button', { name: '제출' });
await Promise.all([btn.click(), btn.click(), btn.click()]);
```

1. 요청이 몇 번 나갔는지 Network 탭 또는 `page.on('request')` 로 센다
2. 결과가 몇 건 생성됐는지 확인 (API 또는 DB)
3. 버튼이 disabled 되는가
4. **개발자도구에서 disabled 속성을 제거하고** 다시 시도 → 서버가 막는가

4번이 핵심이다. **클라이언트 방어만 있는지 서버 방어도 있는지**를 가른다.

### 과제 5 — 캐시 계층 좁히기 (12분)

데이터를 수정한 뒤 반영이 안 되는 상황을 가정하고, **판별 순서를 실제로 수행**한다.

| 단계 | 결과 | 이 결과가 의미하는 것 |
|---|---|---|
| 일반 새로고침 | | |
| 강제 새로고침 | | |
| 시크릿 창 | | |
| API 직접 호출 | | |
| DB 조회 (가능하면) | | |

각 단계에서 "반영됨/안 됨"에 따라 **어느 계층이 범인인지** 결론을 적는다.

### 과제 6 — SPA 두 경로 테스트 (12분)

SPA 사이트에서 같은 화면에 두 경로로 진입하는 테스트를 작성한다.

1. URL 직접 진입
2. 링크 클릭 이동

**차이가 나는 것을 하나라도 찾는다.** (로딩 시간, 표시되는 데이터, 스크롤 위치, 콘솔 에러)

찾은 차이가 결함인지 사양인지 판단하고 근거를 적는다.

### 과제 7 — AI 대기 전략 반박 (12분)

AI 실습 도우미에 요청한다.

> 상품 목록이 비동기로 로드되는 페이지에서, 목록이 다 뜬 다음에 첫 번째 상품을 클릭하는 Playwright 테스트를 작성하라. 타이밍이 불안정하다.

| 확인 항목 | 결과 |
|---|---|
| `waitForLoadState('networkidle')` 를 제안했는가 | |
| `waitForTimeout` 을 썼는가 | |
| `toHaveCount()` 같은 결과 어서션을 썼는가 | |
| 하이드레이션을 언급했는가 | |
| `first()` 로 첫 항목을 잡았는가 (트랙 3의 순서 의존) | |

**`networkidle` 이 나오면 왜 위험한지 반박문을 작성**하고, 올바른 버전으로 고친다. 이 반박문을 메모에 남겨두면 팀 리뷰에서 그대로 쓸 수 있다.

## 자가 체크리스트

- [ ] CSR·SSR·SSG의 차이와 각각의 테스트 시 주의점을 안다
- [ ] 원본 HTML을 확인해 렌더링 방식을 판별할 수 있다
- [ ] 하이드레이션 구간에서 "보이는데 안 눌리는" 문제가 생기는 이유를 안다
- [ ] 하이드레이션 대응 방법 3가지를 안다
- [ ] "화면에 보이는 것"과 "실제 상태"가 다를 수 있음을 항상 의심한다
- [ ] 낙관적 업데이트의 롤백 실패를 `page.route` 로 검증할 수 있다
- [ ] 경쟁 조건이 검색 자동완성에서 어떻게 나타나는지 설명할 수 있다
- [ ] 응답 지연을 인위적으로 만들어 경쟁 조건을 재현할 수 있다
- [ ] 중복 제출을 클라이언트뿐 아니라 **서버가 막는지** 확인한다
- [ ] 컴포넌트 언마운트 후 응답 도착이 콘솔 에러로 나타남을 안다
- [ ] 캐시 계층 6단계를 알고 순서대로 좁혀갈 수 있다
- [ ] Network 탭에서 `from cache`, `304` 를 읽을 수 있다
- [ ] SPA에서 링크 이동과 직접 진입이 다르게 동작할 수 있음을 안다
- [ ] 중요한 화면은 두 경로 모두로 진입해 검증한다
- [ ] **`networkidle` 대기가 위험한 세 가지 이유**를 설명할 수 있다
- [ ] 타이밍 문제의 올바른 해법이 결과 어서션임을 안다

## 참고 링크

- [MDN — 클라이언트-서버 개요](https://developer.mozilla.org/ko/docs/Learn_web_development/Extensions/Server-side/First_steps/Client-Server_overview) — 한국어
- [MDN — HTTP 캐싱](https://developer.mozilla.org/ko/docs/Web/HTTP/Caching) — 캐시 계층
- [web.dev — Rendering on the Web](https://web.dev/articles/rendering-on-the-web) — CSR/SSR/SSG 비교
- [Playwright — Network mocking](https://playwright.dev/docs/mock) — route 로 응답 조작
- [MDN — 이벤트 루프와 비동기](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Statements/async_function) — 다음 레슨과 이어짐
