---
id: t4-l09
title: 자연어 테스트 파이프라인 — 생성 → 실행 → 복구
summary: "이걸 테스트해줘"를 한국어로 쓰면 테스트가 만들어지고 실행되고 깨지면 복구되는 흐름. 앞의 4단계를 하나로 잇는다.
minutes: 22
order: 9
tags: [파이프라인, 자연어테스트, 통합, 아키텍처]
---

## 개념 설명

### 목표하는 흐름

4~8편에서 만든 조각들을 하나의 파이프라인으로 연결한다.

```text
입력: 자연어 시나리오 또는 PR
   ↓
[1] 범위 판단      ← 4편
   ↓
[2] 테스트 생성    ← 5편
   ↓
[3] 정적 검증      ← 5편 (안티패턴, 컴파일)
   ↓
[4] 실행           ← 트랙 3
   ↓
  통과 → 리포트
  실패 → [5] 원인 분류  ← 7편
            ↓
          제품 결함 → 결함 티켓 + 알림   (수정하지 않는다)
          셀렉터    → [6] 셀프힐링 ← 8편 → 재실행
          타이밍/데이터 → 수정 제안 → 검증 → PR
            ↓
        [7] 사람 검토
```

**핵심은 각 단계가 독립적으로 검증 가능하다는 것**이다. 하나의 거대한 "AI가 다 해줌"이 아니라, 단계마다 입출력이 명확하고 실패 지점을 특정할 수 있어야 한다.

### 자연어 입력의 두 층위

"자연어로 테스트를 쓴다"에는 성격이 다른 두 가지가 있다.

**층위 1 — 자연어를 코드로 변환 (한 번만)**

```text
입력: "장바구니에 3만원짜리 상품을 담고 결제하면 배송비가 0원이어야 한다"
   ↓ AI 변환 (1회)
출력: Playwright 테스트 코드 (저장소에 커밋)
   ↓
이후엔 일반 코드처럼 실행·유지보수
```

**층위 2 — 자연어를 매 실행마다 해석**

```text
입력: "장바구니에 3만원짜리 상품을 담고 결제하면 배송비가 0원이어야 한다"
   ↓ 매 실행마다 AI 가 화면을 보고 해석하며 진행
```

| | 층위 1 (변환) | 층위 2 (매번 해석) |
|---|---|---|
| 실행 비용 | 0원 (일반 코드) | 매 실행 API 비용 |
| 속도 | 빠름 | 느림 (스텝마다 AI 호출) |
| 결정성 | 높음 — 같은 코드는 같게 동작 | **낮음 — 실행마다 다를 수 있다** |
| 유지보수 | 코드를 고친다 | 문장을 고친다 |
| 적합한 곳 | 회귀 테스트 (반복 실행) | 탐색, 일회성 검증 |

**대부분의 경우 층위 1이 맞다.** 회귀 테스트는 결정적이어야 하고, 매일 수백 번 도는데 매번 AI를 호출하면 비용과 속도가 감당이 안 된다.

**층위 2는 6편의 자율 탐색**에 어울린다. 결정성이 필요 없고, 오히려 매번 다르게 시도하는 게 장점인 영역이다.

**혼동하지 않는 게 중요하다.** "자연어로 테스트를 쓴다"는 마케팅 문구를 보면 어느 층위인지 먼저 물어야 한다.

### 파이프라인 아키텍처 — 무료로 구성하기

서버 없이 GitHub Actions + BYOK 로 만든다.

```text
저장소 구조
  .github/
    workflows/
      qa-pipeline.yml          전체 오케스트레이션
    scripts/
      01-analyze-scope.mjs     PR diff → 범위 (4편)
      02-generate-tests.mjs    범위 → 테스트 코드 (5편)
      03-validate.mjs          안티패턴 + 컴파일 검사 (5편)
      05-classify-failure.mjs  실패 → 원인 분류 (7편)
      06-propose-fix.mjs       분류 → 수정안 (7편)
      lib/
        ai.mjs                 AI 호출 (제공자 어댑터)
        guardrails.mjs         금지 패턴 검사
  tests/
    generated/                 생성된 테스트 (커밋하지 않음, .gitignore)
    suite/                     사람이 승인해 편입한 테스트
  scenarios/
    checkout.md                자연어 시나리오 (사람이 작성)
```

**`tests/generated/` 를 gitignore 하는 이유**: 5편에서 다룬 대로, 검증되지 않은 생성 코드가 저장소에 쌓이면 안 된다. 사람이 승인한 것만 `tests/suite/` 로 옮긴다.

### 자연어 시나리오 파일

사람이 쓰는 입력이다. **완전한 자유 문장이 아니라 최소한의 구조**를 준다.

```markdown
<!-- scenarios/checkout.md -->
# 결제 흐름

## 시나리오: 무료배송 경계
전제: 로그인 상태, 장바구니 비어 있음
동작: 30,000원 상품 1개를 담고 결제 화면으로 이동한다
기대: 배송비가 0원으로 표시된다
      결제 예정 금액이 30,000원이다
검증 계층: api 우선
우선순위: High
근거: 이번 PR 에서 무료배송 기준 부등호가 변경됨

## 시나리오: 무료배송 경계 미달
전제: 로그인 상태
동작: 29,999원 상품 1개를 담는다
기대: 배송비 3,000원, 총액 32,999원
검증 계층: api
우선순위: High
```

**`전제 / 동작 / 기대` 3요소**만 강제한다. 이게 있으면 생성 품질이 크게 오른다. Gherkin(Given-When-Then)의 축약판이라고 봐도 된다.

**`기대` 를 사람이 쓴다는 게 핵심이다.** 6편에서 봤듯이 AI는 기대값을 모른다. 사람이 명시해야 진짜 검증이 된다.

### 오케스트레이션 워크플로

```yaml
name: QA 파이프라인

on:
  pull_request:
  workflow_dispatch:
    inputs:
      scenario_file:
        description: '실행할 시나리오 파일'
        required: false

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium

      # [1] 범위 판단
      - name: 범위 분석
        env: { API_KEY: '${{ secrets.AI_API_KEY }}' }
        run: node .github/scripts/01-analyze-scope.mjs > artifacts/scope.json

      # [2] 테스트 생성
      - name: 테스트 생성
        env: { API_KEY: '${{ secrets.AI_API_KEY }}' }
        run: node .github/scripts/02-generate-tests.mjs artifacts/scope.json

      # [3] 정적 검증 — 여기서 실패하면 실행하지 않는다
      - name: 생성 코드 검증
        run: |
          npx tsc --noEmit
          node .github/scripts/03-validate.mjs tests/generated/

      # [4] 실행
      - name: 테스트 실행
        id: run
        continue-on-error: true
        run: npx playwright test tests/generated/ --reporter=json > artifacts/results.json

      # [5] 실패 분류 (실패했을 때만)
      - name: 실패 원인 분류
        if: steps.run.outcome == 'failure'
        env: { API_KEY: '${{ secrets.AI_API_KEY }}' }
        run: node .github/scripts/05-classify-failure.mjs artifacts/results.json > artifacts/classification.json

      # [5-A] 제품 결함이면 티켓
      - name: 결함 티켓 생성
        if: steps.run.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const c = require('./artifacts/classification.json');
            for (const f of c.failures.filter(x => x.classification === 'A')) {
              await github.rest.issues.create({
                ...context.repo,
                title: `[자동탐지] ${f.test}`,
                body: `## 분류: 제품 결함 (신뢰도 ${f.confidence})\n\n` +
                      `### 근거\n${f.evidence.join('\n')}\n\n` +
                      `### 기대 / 실제\n${f.expected} / ${f.actual}\n\n` +
                      `_AI 분석 결과입니다. QA 검토 후 확정하세요._`,
                labels: ['bug', 'ai-detected', 'needs-triage'],
              });
            }

      # [6] 수정 제안 (B/C/D 만)
      - name: 수정안 생성과 검증
        if: steps.run.outcome == 'failure'
        env: { API_KEY: '${{ secrets.AI_API_KEY }}' }
        run: |
          node .github/scripts/06-propose-fix.mjs artifacts/classification.json > artifacts/fix.diff
          node .github/scripts/lib/guardrails.mjs artifacts/fix.diff   # 금지 패턴이면 종료 1

      - name: 아티팩트 업로드
        if: always()
        uses: actions/upload-artifact@v4
        with: { name: qa-pipeline, path: artifacts/ }
```

**설계에서 지킨 것들**

| 항목 | 이유 |
|---|---|
| `continue-on-error: true` (실행 단계) | 실패해도 뒤의 분석 단계가 돌아야 한다 |
| 정적 검증 실패 시 중단 | 컴파일도 안 되는 코드를 실행할 이유가 없다 |
| 제품 결함은 이슈, 나머지는 수정안 | 7편의 분기 원칙 |
| 가드레일을 별도 스텝으로 | 프롬프트가 아니라 기계적 차단 |
| `if: always()` 아티팩트 | 실패 시에도 증거를 남긴다 |
| `permissions` 최소화 | 에이전트가 저장소를 못 고치게 |

### AI 호출 레이어 — 제공자 교체 가능하게

비용과 가용성 때문에 제공자를 바꿀 수 있어야 한다.

```javascript
// .github/scripts/lib/ai.mjs
const PROVIDER = process.env.AI_PROVIDER || 'gemini';   // 무료 티어 기본

const ADAPTERS = {
  gemini: async (system, user) => { /* generateContent */ },
  anthropic: async (system, user) => { /* /v1/messages */ },
  openai: async (system, user) => { /* /v1/chat/completions */ },
};

export async function ask(system, user, { json = true, retries = 2 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      const text = await ADAPTERS[PROVIDER](system, user);
      if (!json) return text;
      return JSON.parse(stripCodeFence(text));   // ```json 감싸기 제거
    } catch (e) {
      if (i === retries) throw e;
      await sleep(2000 * (i + 1));               // 지수 백오프
    }
  }
}
```

**`stripCodeFence` 가 실무적으로 필요하다.** "JSON만 출력하라"고 해도 모델이 ` ```json ` 으로 감싸는 경우가 흔하다. 파싱 실패의 가장 흔한 원인이다.

**재시도와 백오프**도 필수다. 무료 티어는 rate limit 이 있다.

### 비용 통제

```text
□ AI 호출은 필요할 때만
  - 실패했을 때만 분류 호출
  - 규칙 기반으로 되는 것은 AI 안 씀 (안티패턴 검사, 셀프힐링 1차)
□ 컨텍스트 크기 제한
  - diff 가 너무 크면 요약하거나 파일 단위로 나눔
  - 접근성 트리는 관련 영역만 잘라서
□ 캐싱
  - 같은 diff 에 대한 분석 결과 재사용
□ 실행 상한
  - 워크플로 timeout-minutes
  - 하루 호출 횟수 상한 (초과 시 스킵하고 알림)
□ 무료 티어 활용
  - Gemini 무료 티어를 기본 제공자로
  - 실패 분류처럼 정확도가 중요한 곳만 상위 모델
```

**"규칙으로 되는 것은 AI를 쓰지 않는다"** 가 가장 큰 절감이다. 안티패턴 검사, 셀렉터 후보 시도, 컴파일 검사는 전부 규칙으로 된다.

### 파이프라인 자체를 검증하기

**파이프라인도 소프트웨어다. 테스트가 필요하다.**

```text
□ 골든 케이스 세트
  - 알려진 PR 5개와 그에 대한 정답 범위/분류를 고정해 둔다
  - 프롬프트를 바꿀 때마다 이 세트로 회귀 확인

□ 프롬프트 버전 관리
  - 프롬프트를 파일로 관리하고 git 에 커밋
  - 변경 시 골든 케이스 결과 비교

□ 출력 스키마 검증
  - AI 응답이 기대한 JSON 스키마를 만족하는지 검사
  - 실패하면 재시도, 계속 실패하면 사람에게

□ 회로 차단기
  - 연속 N회 실패하면 파이프라인 비활성화 + 알림
```

**골든 케이스가 특히 중요하다.** 프롬프트를 조금 고쳤는데 다른 케이스에서 성능이 떨어지는 일이 흔하다. 이걸 잡으려면 고정된 평가 세트가 있어야 한다.

**이것 자체가 QA 업무다.** AI 시스템을 테스트하는 것 — 트랙 6의 관점과 이어진다.

### 현실적인 도입 순서

```text
1주차   [1] 범위 분석만 — PR 코멘트로 제안만 (실행 없음)
        → 정확도를 눈으로 확인. 신뢰가 쌓인다.

3주차   [2][3] 생성 + 정적 검증 — 코드를 만들되 실행은 수동
        → 생성 품질 확인

6주차   [4] 실행 추가 — 실패해도 아무것도 자동으로 안 고침
        → 실패 패턴 파악

10주차  [5] 실패 분류 — 분류만 하고 리포트
        → 혼동 행렬로 정확도 측정 (7편)

14주차  [6] B/C/D 자동 수정 — 가드레일 + 사람 리뷰 필수
```

**한 번에 전부 만들면 어디가 문제인지 모른다.** 그리고 초기 오탐으로 팀이 불신하게 된다. 트랙 3의 "자동화 1단계에서 신뢰 확보"와 같은 원리다.

## 왜 채용시장이 요구하는가

- **"AI 기반 테스트 파이프라인 구축"** 은 2026년 QA 리드·시니어 공고의 상위 요구사항이다. 조각을 아는 것과 **엮어서 운영해 본 것**은 다르다.
- 면접 질문: **"자연어로 테스트를 작성한다는 게 무슨 의미인가요?"** — 두 층위를 구분해 답하면 마케팅 문구에 휘둘리지 않는 사람으로 보인다.
- **단계적 도입 계획**을 말할 수 있으면 실행력을 보여준다. "다 만들었습니다"보다 "1주차엔 제안만 했습니다"가 더 신뢰를 준다.
- **파이프라인 자체를 테스트한다**(골든 케이스, 프롬프트 버전 관리)는 관점은 매우 드물고, QA다운 발상이다.
- **비용 통제**를 설계에 넣는 것도 실무 감각의 지표다.

## 실습 과제

### 과제 1 — 두 층위 비교 (15분)

같은 시나리오를 두 방식으로 실행한다.

```text
시나리오: TodoMVC 에서 할 일 3개를 추가하고, 하나를 완료 처리한 뒤,
         남은 개수가 2로 표시되는지 확인한다
```

- **층위 1**: AI에게 코드를 생성시켜 5번 실행
- **층위 2**: (MCP 환경이 있으면) 자연어를 매번 해석하며 5번 실행
  - MCP가 없으면: 접근성 트리를 주고 "다음 행동"을 물어 수동으로 5회 반복

| 비교 | 층위 1 | 층위 2 |
|---|---|---|
| 5회 결과가 동일한가 | | |
| 총 소요 시간 | | |
| AI 호출 횟수 | | |
| 실패 시 원인 파악 난이도 | | |

**결정성 차이**를 직접 확인하는 것이 이 과제의 목적이다.

### 과제 2 — 시나리오 파일 작성 (12분)

본인 도메인의 시나리오 5개를 `전제 / 동작 / 기대 / 계층 / 우선순위 / 근거` 형식으로 작성한다.

체크 포인트:
- **기대를 검증 가능한 값**으로 썼는가 ("정상 동작한다" 금지)
- 계층 선택에 근거가 있는가 (5편)
- 경계값 시나리오가 포함됐는가

### 과제 3 — 최소 파이프라인 구현 (25분)

**[1] → [2] → [3] 만** 먼저 만든다. 실행은 수동.

1. `01-analyze-scope.mjs` — 4편에서 만든 것 재사용
2. `02-generate-tests.mjs` — 시나리오 파일 + 범위 → 테스트 코드
3. `03-validate.mjs` — 5편의 안티패턴 검사기 + `tsc --noEmit`
4. 워크플로로 엮고 PR에 결과 코멘트

**여기까지만 해도 실무에서 가치가 있다.** 무리하게 [5][6]까지 만들지 않는다.

### 과제 4 — AI 호출 레이어와 재시도 (15분)

`lib/ai.mjs` 를 구현한다.

요구사항:
- 제공자 2개 이상 지원 (Gemini 무료 티어 + 하나)
- 코드 펜스 제거
- JSON 파싱 실패 시 재시도
- 지수 백오프
- 호출 횟수와 토큰을 로그로 집계

**일부러 잘못된 프롬프트**(JSON이 아닌 응답이 오게)로 재시도 동작을 확인한다.

### 과제 5 — 골든 케이스 세트 (15분)

과제 3의 파이프라인에 대해 평가 세트를 만든다.

1. 서로 다른 성격의 PR 5개 선정 (문서/스타일/버그수정/신규기능/공통모듈)
2. 각각에 대한 **정답 범위**를 사람이 작성
3. 파이프라인 실행 결과와 비교하는 스크립트 작성
4. 프롬프트를 한 군데 수정하고 **다시 평가** → 점수가 어떻게 변하는지 확인

4번이 핵심이다. **프롬프트 변경이 회귀를 일으킬 수 있다**는 것을 체감한다.

### 과제 6 — 도입 계획서 (12분)

본인 팀 상황에 맞춘 **단계적 도입 계획**을 작성한다.

```text
단계별로:
  - 무엇을 켜는가
  - 무엇을 측정해 다음 단계로 갈지 판단하는가 (정량 기준)
  - 실패하면 어떻게 되돌리는가
  - 예상 비용
```

**"다음 단계로 갈 정량 기준"** 을 반드시 넣는다. 예: "범위 분석 정확도가 4주 연속 85% 이상이면 [2]단계 진행".

## 자가 체크리스트

- [ ] 4~8편의 조각을 하나의 파이프라인으로 연결한 흐름을 그릴 수 있다
- [ ] 각 단계가 독립적으로 검증 가능해야 하는 이유를 안다
- [ ] 자연어 테스트의 두 층위(변환 vs 매번 해석)를 구분할 수 있다
- [ ] 회귀 테스트에는 층위 1(결정적)이 맞는 이유를 설명할 수 있다
- [ ] 층위 2가 자율 탐색에 어울리는 이유를 안다
- [ ] `전제 / 동작 / 기대` 구조를 강제하면 생성 품질이 오르는 이유를 안다
- [ ] **기대값은 사람이 써야 진짜 검증이 된다**는 것을 이해한다
- [ ] 생성된 테스트를 gitignore 하고 승인된 것만 편입하는 구조를 만들 수 있다
- [ ] `continue-on-error` 로 실패 후 분석 단계를 이어갈 수 있다
- [ ] 제품 결함은 티켓, 나머지는 수정안으로 분기시킬 수 있다
- [ ] 가드레일을 프롬프트가 아니라 별도 검증 스텝으로 둔다
- [ ] AI 호출 레이어에 제공자 어댑터·코드펜스 제거·재시도를 구현할 수 있다
- [ ] 비용 통제 5가지 방법을 적용할 수 있다
- [ ] "규칙으로 되는 것은 AI를 쓰지 않는다"가 최대 절감임을 안다
- [ ] 골든 케이스 세트로 프롬프트 변경의 회귀를 검증할 수 있다
- [ ] 프롬프트를 파일로 관리하고 버전을 추적한다
- [ ] 회로 차단기로 연속 실패 시 파이프라인을 멈출 수 있다
- [ ] 한 번에 전부 만들지 않고 단계적으로 도입하는 이유를 설명할 수 있다
- [ ] 각 단계 진행을 정량 기준으로 판단할 수 있다

## 참고 링크

- [GitHub Actions — 워크플로 문법](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions) — `continue-on-error`, `if`, `permissions`
- [Playwright — JSON reporter](https://playwright.dev/docs/test-reporters#json-reporter) — 실패 결과를 프로그램으로 처리
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — 워크플로 vs 에이전트 구분
- [Cucumber / Gherkin](https://cucumber.io/docs/gherkin/reference/) — Given-When-Then 구조의 원형
