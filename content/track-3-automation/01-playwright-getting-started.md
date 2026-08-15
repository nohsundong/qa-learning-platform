---
id: t3-l01
title: Playwright 시작하기 — 첫 테스트와 디버깅 도구
summary: 설치부터 첫 테스트 실행까지. 그리고 실패를 눈으로 보게 해주는 Trace Viewer·UI 모드·Codegen을 먼저 익힌다.
minutes: 20
order: 1
tags: [Playwright, 자동화, TraceViewer, Codegen, 디버깅]
---

## 개념 설명

### 왜 Playwright 인가

2026년 기준 웹 E2E 자동화의 사실상 표준이다. QA 채용공고에서 가장 많이 요구되는 도구이기도 하다. 이유는 세 가지다.

| | 의미 |
|---|---|
| **자동 대기(auto-waiting)** | 요소가 클릭 가능해질 때까지 알아서 기다린다. `sleep` 을 뿌릴 필요가 없다 |
| **디버깅 도구가 강하다** | Trace Viewer로 실패 순간을 타임머신처럼 되돌려 본다 |
| **브라우저 3종 + 모바일 에뮬레이션 무료** | Chromium·Firefox·WebKit, 별도 라이선스 없음 |

특히 첫 번째가 결정적이다. 자동화 테스트가 실패하는 이유의 대부분이 타이밍 문제인데, Playwright는 이걸 구조적으로 줄인다. 다음 레슨에서 자세히 다룬다.

### 설치

Node.js만 있으면 된다. 전부 무료다.

```bash
npm init playwright@latest
```

대화형으로 몇 가지를 묻는다.

```text
TypeScript / JavaScript?     → TypeScript 권장 (자동완성이 크게 도움된다)
테스트 폴더 이름?             → tests
GitHub Actions 워크플로 추가?  → Yes (나중에 9편에서 쓴다)
브라우저 설치?                → Yes
```

생성되는 구조는 이렇다.

```text
playwright.config.ts     설정 — 여기를 가장 많이 손댄다
tests/
  example.spec.ts        샘플 테스트
tests-examples/          더 많은 예제
.github/workflows/
  playwright.yml         CI 워크플로
```

### 첫 테스트

```typescript
import { test, expect } from '@playwright/test';

test('로그인에 성공하면 대시보드로 이동한다', async ({ page }) => {
  await page.goto('https://example.com/login');

  await page.getByLabel('이메일').fill('qa_user_01@test.com');
  await page.getByLabel('비밀번호').fill('Test1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});
```

여기서 이미 세 가지 원칙이 들어가 있다.

1. **테스트 이름이 검증 내용을 그대로 말한다.** `test('로그인 테스트')` 같은 이름은 실패했을 때 아무 정보를 주지 않는다. **"~하면 ~한다"** 형태로 쓴다
2. **사용자가 보는 것으로 요소를 찾는다.** `getByLabel`, `getByRole` — CSS 클래스가 아니다 (2편에서 자세히)
3. **`await expect(...)` 로 검증한다.** 이 어서션은 조건이 만족될 때까지 자동으로 재시도한다 (3편에서 자세히)

### 실행 방법

```bash
npx playwright test                       # 전체 실행 (헤드리스, 병렬)
npx playwright test login.spec.ts         # 특정 파일만
npx playwright test -g "로그인에 성공"      # 이름으로 필터
npx playwright test --headed              # 브라우저를 보면서 실행
npx playwright test --project=chromium    # 특정 브라우저만
npx playwright test --ui                  # UI 모드 ← 개발할 때 이걸 쓴다
npx playwright test --debug               # 한 줄씩 멈추며 디버깅
```

### 디버깅 도구 세 가지 — 이게 Playwright의 진짜 강점이다

**대부분의 사람이 테스트 작성법부터 배우는데, 도구를 먼저 익히는 게 훨씬 빠르다.**

#### 1. UI 모드 (`--ui`) — 개발할 때 쓴다

```bash
npx playwright test --ui
```

- 테스트 목록에서 골라 실행, 파일 저장하면 자동 재실행(watch)
- **각 단계의 스크린샷을 타임라인으로** 보여준다
- 단계를 클릭하면 그 시점의 DOM 스냅샷을 브라우저처럼 조작할 수 있다
- Locator 탭에서 셀렉터를 실시간으로 시험해 볼 수 있다

#### 2. Trace Viewer — CI에서 실패했을 때 쓴다

트레이스는 **테스트 실행의 완전한 기록**이다. 스크린샷, DOM 스냅샷, 네트워크 요청, 콘솔 로그, 각 액션의 소요 시간이 전부 들어있다.

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',   // 재시도할 때만 기록 (용량 절약)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

```bash
npx playwright show-trace trace.zip
```

**CI에서 "내 PC에선 되는데 CI에선 실패"할 때 이걸 열면 원인이 대부분 보인다.** 트레이스 파일을 아티팩트로 남기는 설정은 9편에서 다룬다.

`trace: 'on'` 으로 하면 모든 실행을 기록해서 용량이 커진다. `on-first-retry` 가 실무 기본값이다.

#### 3. Codegen — 셀렉터를 찾을 때 쓴다

```bash
npx playwright codegen https://example.com
```

브라우저가 열리고, 내가 클릭·입력하는 대로 코드가 생성된다.

**중요한 건 이걸 그대로 쓰지 않는 것이다.** Codegen은 **"이 요소를 어떻게 부를 수 있는지" 후보를 보여주는 도구**로 쓴다. 생성된 코드는 대체로 이렇게 손봐야 한다.

```typescript
// Codegen 원본 — 화면 문구가 바뀌면 깨진다
await page.getByRole('row', { name: '무선 이어폰 45,000원 2개' })
  .getByRole('button', { name: '삭제' }).click();

// 다듬은 것 — 의도가 드러나고 덜 깨진다
const cartRow = page.getByRole('row').filter({ hasText: '무선 이어폰' });
await cartRow.getByRole('button', { name: '삭제' }).click();
```

### playwright.config.ts — 처음에 손볼 곳

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // CI 에서는 test.only 가 남아 있으면 실패시킨다 (실수로 커밋하는 사고 방지)
  forbidOnly: !!process.env.CI,

  // 로컬은 재시도 없음, CI 는 2회 재시도
  retries: process.env.CI ? 2 : 0,

  // 병렬 실행 (3편, 9편에서 다룬다)
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://staging.example.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 전역 타임아웃 — 무한정 기다리지 않게
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],
});
```

**`baseURL` 을 설정하면** 테스트에서 `page.goto('/login')` 처럼 경로만 쓸 수 있다. 스테이징/운영 전환이 환경변수 하나로 끝난다.

**`retries` 를 CI에서 2로 두는 것에 대해**: 재시도는 플래키 테스트를 숨기는 도구가 아니다. 재시도로 통과한 테스트는 리포트에 `flaky` 로 표시되고, **그 목록을 정기적으로 봐야 한다.** 5편에서 다룬다.

### 리포트 보기

```bash
npx playwright show-report
```

HTML 리포트에는 실패한 테스트의 에러 메시지, 스크린샷, 트레이스 링크가 모두 들어있다. CI에서 이걸 아티팩트로 올려두면 팀원 누구나 실패 원인을 확인할 수 있다.

## 왜 채용시장이 요구하는가

- **QA 자동화 공고에서 Playwright 언급 비율이 가장 높다.** Cypress·Selenium 경험만 있으면 서류에서 밀리는 경우가 생긴다.
- 면접에서 **"CI에서만 실패하는 테스트는 어떻게 디버깅하나요?"** 가 자주 나온다. Trace Viewer를 말할 수 있으면 실제로 써본 사람이라는 게 드러난다.
- **Codegen을 그대로 쓰지 않는다**는 것도 변별 포인트다. 생성 코드를 다듬을 줄 아는지가 유지보수 감각을 보여준다.
- **AI에게 Playwright 코드를 시키면 대부분 동작하는 코드를 준다.** 문제는 그게 **유지보수 가능한 코드인지**다. AI는 Codegen과 비슷한 수준의 취약한 셀렉터를 자주 만들고, 구버전 API(`page.click('css=...')`)를 섞어 쓴다. 최신 문법과 안티패턴을 알아야 걸러낼 수 있다.

## 실습 과제

### 과제 1 — 설치하고 첫 테스트 (15분)

```bash
mkdir pw-practice && cd pw-practice
npm init playwright@latest
```

연습 대상은 무료 공개 사이트를 쓴다.

- `https://demo.playwright.dev/todomvc` — Playwright 공식 데모
- `https://the-internet.herokuapp.com` — 로그인·알림·프레임 등 다양한 케이스
- 또는 이 플랫폼의 **실습 랩 → 결함이 숨겨진 샘플 앱** (로컬에서 열어 대상으로 삼기)

TodoMVC로 테스트 3개를 작성한다.

1. 할 일을 추가하면 목록에 나타난다
2. 할 일을 완료 처리하면 완료 개수가 1 증가한다
3. 할 일을 삭제하면 목록에서 사라진다

**테스트 이름을 "~하면 ~한다" 형태로** 쓸 것.

### 과제 2 — 디버깅 도구 3종 체험 (15분)

1. `npx playwright test --ui` 로 실행 → 타임라인에서 각 단계 스크린샷 확인
2. 테스트 하나를 **일부러 깨뜨린다** (존재하지 않는 텍스트로 어서션 변경)
3. 실패한 상태에서 트레이스를 연다 → **어느 단계에서 무엇이 화면에 있었는지** 확인
4. `npx playwright codegen https://demo.playwright.dev/todomvc` 로 코드 생성
5. 생성된 코드에서 **취약해 보이는 셀렉터 3개**를 찾아 메모에 적기

### 과제 3 — 설정 바꿔보기 (10분)

`playwright.config.ts` 를 수정하며 차이를 관찰한다.

| 바꿀 것 | 관찰할 것 |
|---|---|
| `trace: 'on'` | 통과한 테스트에도 트레이스가 생기는가, 용량은? |
| `retries: 2` + 불안정한 테스트 | 리포트에 `flaky` 표시가 뜨는가 |
| `projects` 에 `webkit` 추가 | 같은 테스트가 브라우저별로 다르게 동작하는가 |
| `use: { headless: false, slowMo: 500 }` | 동작을 눈으로 따라갈 수 있는가 |

마지막 조합은 **테스트가 실제로 무엇을 하는지 확인할 때** 유용하다.

### 과제 4 — AI가 만든 첫 테스트 검증 (12분)

AI 실습 도우미에 요청한다.

> TodoMVC 데모 사이트(https://demo.playwright.dev/todomvc)에서 할 일 추가·완료·삭제를 검증하는 Playwright 테스트를 TypeScript로 작성하라.

받은 코드를 **실행해 보고** 다음을 확인한다.

| 확인 항목 | 결과 |
|---|---|
| 실제로 통과하는가 | |
| `page.waitForTimeout()` 같은 고정 대기를 썼는가 | |
| `page.click('.todo-list li .toggle')` 같은 CSS 셀렉터에 의존하는가 | |
| 존재하지 않는 API·옵션을 쓰지 않았는가 (환각) | |
| 테스트 이름이 검증 내용을 설명하는가 | |
| **실패했을 때 원인을 알 수 있는 어서션인가** | |

마지막 항목이 핵심이다. `expect(items.length).toBe(1)` 이 실패하면 "1이 아니었다"만 알 수 있다. 무엇이 몇 개였는지 보여주는 어서션이 좋은 어서션이다.

## 자가 체크리스트

- [ ] `npm init playwright@latest` 로 프로젝트를 초기화할 수 있다
- [ ] Playwright가 자동 대기를 제공한다는 것과 그게 왜 중요한지 설명할 수 있다
- [ ] 테스트 이름을 "~하면 ~한다" 형태로 검증 내용이 드러나게 쓴다
- [ ] `--ui`, `--headed`, `--debug`, `-g` 옵션을 상황에 맞게 쓸 수 있다
- [ ] UI 모드에서 단계별 스냅샷을 확인하며 테스트를 개발할 수 있다
- [ ] Trace Viewer로 실패 시점의 DOM·네트워크·콘솔을 확인할 수 있다
- [ ] `trace: 'on-first-retry'` 가 실무 기본값인 이유(용량)를 안다
- [ ] Codegen을 셀렉터 후보 탐색 도구로 쓰고, 생성 코드를 그대로 쓰지 않는다
- [ ] `baseURL` 설정으로 환경 전환을 환경변수 하나로 처리할 수 있다
- [ ] `forbidOnly` 가 CI에서 `test.only` 커밋 사고를 막아준다는 걸 안다
- [ ] 재시도가 플래키를 숨기는 게 아니라 `flaky` 로 표시해 준다는 걸 이해한다
- [ ] AI가 만든 테스트에서 고정 대기·취약한 셀렉터·구버전 API를 걸러낼 수 있다

## 참고 링크

- [Playwright 공식 문서](https://playwright.dev/docs/intro) — 항상 여기서 API 존재 여부를 확인한다 (환각 검증)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) — 트레이스 읽는 법
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode) — 개발 워크플로
- [TodoMVC 데모](https://demo.playwright.dev/todomvc) — 공식 연습 대상
- [the-internet (Heroku)](https://the-internet.herokuapp.com) — 다양한 UI 패턴 연습 사이트
