---
id: t8-l04
title: 에이전트 오케스트레이션 — 사람·로봇·에이전트를 하나의 테스트 파이프라인으로
summary: 커밋부터 환경 구성·데이터 생성·Sanity·병렬 회귀·실패 분석·사람 검토·환경 해제·리포트까지 이어지는 야간 파이프라인을 설계한다. 노드마다 행위자·계약·실패 경로를 정하고, GitHub Actions 승인 게이트로 무료 재현한다.
minutes: 22
order: 4
tags: [오케스트레이션, Maestro, BPMN, 사람승인, 파이프라인, GitHubActions]
---

## 개념 설명

### 가치는 조각이 아니라 연결에서 나온다

8-01에서 리드타임의 큰 몫이 **단계 사이 대기**였다. 에이전트를 아무리 잘 만들어도 사람이 결과를 복사해 다음 도구에 붙여넣는 한 대기는 그대로다.

웨비나의 요약: **"개별 활동이 아니라 연결하는 데서 가치가 나온다."** 6개월 후 9배 목표의 원천도 오케스트레이션이었다.

### Maestro — 확인된 기능

UiPath Maestro는 에이전트 오케스트레이션 계층이다.

- **BPMN 2.0**으로 프로세스를, **DMN**으로 결정 로직을 모델링
- AI 에이전트 · 로봇 · 사람 · API를 한 흐름에서 조율, 장기 실행 프로세스 지원
- 예외 처리, 사람 개입(Human-in-the-loop), 실시간 분석
- UiPath 에이전트뿐 아니라 Claude·OpenAI·Gemini·Microsoft Copilot·LangChain·CrewAI·자체 코딩 에이전트도 같은 흐름에서 호출
- 에이전트를 카탈로그로 관리하고 버전·일시정지·롤백

테스트에서는 여러 에이전트·자동화·테스터를 묶어 **환경 준비와 해제, 이해관계자 알림, 웹·API·모바일·데스크톱 회귀**를 하나의 흐름으로 돌리는 데 쓴다.

### 웨비나의 야간 파이프라인 — 화살표를 따라가기

```text
[야간 코드 커밋]
      │
      ▼
① 요구사항 동기화 ─────────────── 에이전트
      ▼
② 테스트 환경 구성 ────────────── 로봇 / 인프라 자동화
      ▼
③ 테스트 데이터 생성·프로비저닝 ─── 에이전트 + 로봇
      ▼
④ Sanity 테스트 ─────────────── 자동화          ◀ 게이트: 통과해야 다음으로
      ▼
⑤ 회귀 테스트 (병렬)
     ├─ API        (Postman 컬렉션 등)
     ├─ 웹 UI
     ├─ 모바일
     └─ 업무 시스템  (SAP · Oracle 등)
      ▼
⑥ 결과 취합 ─────────────────── 에이전트
      ▼
⑦ 실패 원인 조사 + 수정 제안 ───── 에이전트
      ▼
⑧ 검토·승인 ─────────────────── 사람           ◀ 필요 시 데이터 재생성 후 ⑤ 재실행
      ▼
⑨ 환경 해제·정리 ─────────────── 로봇
      ▼
⑩ 이해관계자 리포트 ───────────── 에이전트
```

웨비나가 강조한 오해 방지 문장: **AI가 통제 없이 실행되는 구조가 아니다. AI·테스터·테스트 로봇이 명시적 규칙으로 협업하도록 설계된 구조다.**

### 행위자 배정 원칙

| 작업의 성격 | 행위자 | 이유 |
|---|---|---|
| 결정적이고 반복적 (환경 생성, 실행, 해제) | 로봇 · 스크립트 | 같은 입력 → 같은 결과. 싸고 감사하기 쉽다 |
| 해석·요약·분류가 필요 (요구사항 변화 해석, 실패 원인 추정) | 에이전트 | 규칙으로 다 적을 수 없다 |
| 결과에 책임이 따름 (배포 판단, 기대값 변경, 리스크 수용) | 사람 | 책임을 위임할 수 없다 |

**가장 흔한 설계 실수는 게이트 판정을 에이전트에게 맡기는 것**이다. ④의 Sanity 통과 여부는 테스트 결과(결정적)로 판정한다. 에이전트는 "왜 실패했나"를 설명할 뿐 "통과로 칠까"를 결정하지 않는다.

### 노드 계약 — 모든 노드에 적는다

```text
노드       ⑦ 실패 원인 조사
행위자     에이전트 (failure-analyst)
입력       ⑥의 results.json (스키마 v2), 최근 커밋 diff, 트레이스 링크
출력       triage.json — 실패별 { category, evidence[], suggested_action, confidence }
타임아웃    20분 (초과 시 전체를 category=unknown 으로 ⑧에 넘김)
재시도     1회 (모델 오류일 때만)
실패 경로   출력 스키마 위반 → ⑧에 원본 결과만 전달, 알림에 "분석 실패" 표시
비용 한도   실행당 토큰 ○○ / 초과 시 상위 N건만 분석
증거       프롬프트 버전, 모델 ID, 입력 해시, 출력 원문 보관
```

**타임아웃과 실패 경로가 없는 노드는 파이프라인 전체를 멈춘다.** 에이전트 노드일수록 더 그렇다.

### 결정 테이블 — 분석 결과를 어디로 보낼까 (DMN 방식)

| category | confidence | 다음 행동 | 사람 개입 |
|---|---|---|---|
| product_defect | ≥ 0.8 | 결함 티켓 **초안** 생성, 담당 개발팀 지정 | 티켓 발행 전 QA 확인 |
| test_defect | ≥ 0.8 | 자가 복구 **PR** 생성 | PR 리뷰 필수 |
| environment | any | ③부터 1회 재실행 | 재실패 시 인프라 담당 알림 |
| flaky | ≥ 0.95 | 격리 큐로 이동, 원 테스트 유지 | 주간 격리 큐 리뷰 |
| **기대값 변경 제안** | any | **자동 적용 금지** | 요구사항 대조 후 사람 승인 |
| unknown / 미달 | — | ⑧ 검토 큐 | 필수 |

이 표를 **코드나 설정으로** 둔다. 프롬프트 안에 "이럴 땐 이렇게 해"라고 적어두는 것은 결정 테이블이 아니다. 모델이 바뀌면 조용히 달라진다.

### 사람 승인 게이트 설계

사람을 넣는 것보다 **사람이 병목이 되지 않게** 넣는 것이 어렵다.

```text
□ 무엇을 보여주나   증거 묶음 — 실패 요약 · 스크린샷 · 에이전트 판단과 근거 · 결정 선택지
□ 누가 승인하나    역할 기반 (당번 QA), 개인 이름 아님
□ 언제까지        SLA (예: 다음 날 10시)
□ 응답이 없으면    안전한 기본값 — 배포 보류. 절대 "자동 승인" 아님
□ 무엇을 묻지 않나  결정적으로 판정 가능한 것은 묻지 않는다 (승인 피로 방지)
```

### 무료 재현 — GitHub Actions로 만드는 오케스트레이션

GitHub **Environments의 Required reviewers**를 쓰면 사람 승인 게이트를 흉내 낼 수 있다.

```yaml
# .github/workflows/nightly-agentic-regression.yml
name: 야간 회귀 (오케스트레이션 실습)
on:
  schedule:
    - cron: '0 16 * * *'        # KST 01:00
  workflow_dispatch:

jobs:
  provision:                    # ② 로봇: 환경 구성
    runs-on: ubuntu-latest
    outputs:
      base_url: ${{ steps.up.outputs.base_url }}
    steps:
      - id: up
        run: echo "base_url=https://staging.example.com" >> "$GITHUB_OUTPUT"

  sanity:                       # ④ 결정적 게이트
    needs: provision
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx playwright test --grep @sanity
        env:
          BASE_URL: ${{ needs.provision.outputs.base_url }}

  regression:                   # ⑤ 병렬 회귀
    needs: [provision, sanity]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        suite: [api, web, mobile]
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/run-suite.sh ${{ matrix.suite }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: results-${{ matrix.suite }}
          path: results/

  analyze:                      # ⑥⑦ 취합 + 원인 분석 (결정 테이블은 코드로)
    needs: [sanity, regression]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: results-*
          merge-multiple: true
          path: results/
      - run: node scripts/triage.mjs results/ > triage.json
      - uses: actions/upload-artifact@v4
        with:
          name: triage
          path: triage.json

  human-review:                 # ⑧ 사람 승인 게이트
    needs: analyze
    runs-on: ubuntu-latest
    environment: qa-approval    # Settings → Environments → Required reviewers 지정
    steps:
      - run: echo "승인됨 — 결함 티켓 초안 발행, 자가 복구 PR 리뷰 요청"

  teardown:                     # ⑨ 무슨 일이 있어도 정리
    needs: [provision, human-review]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: echo "환경 해제"

  report:                       # ⑩ 리포트
    needs: [analyze, teardown]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: echo "요약 알림 발송"
```

읽을 포인트:

- `if: always()` 가 붙은 `teardown` — **실패해도 정리한다.** 빠지면 환경 비용이 계속 나간다
- `sanity` 가 실패하면 `regression` 은 건너뛴다 — 게이트는 결정적
- `human-review` 가 승인을 기다리는 동안 환경이 살아 있다 — 실제 운영에서는 **승인 대기 타임아웃과 환경 선해제 정책**을 따로 둔다
- 무료 재현에 없는 것: 사람 작업함 UI, BPMN 모델, 장기 실행 상태 관리, 에이전트 카탈로그. **원리를 익히는 용도**다

### 안티패턴

| 안티패턴 | 증상 | 처방 |
|---|---|---|
| 에이전트가 게이트 판정 | 실패인데 "사소함"으로 통과 | 게이트는 테스트 결과로만 |
| 모든 것을 사람 승인 | 승인 요청 수십 건, 아무도 안 봄 | 결정 테이블로 자동 처리 범위 확대 |
| 조용한 재실행 반복 | 초록불인데 실제로는 3번째 통과 | 재실행 횟수를 리포트에 노출 |
| 해제 누락 | 클라우드 비용 급증 | `always` 정리 단계 |
| 프롬프트 속 라우팅 규칙 | 모델 교체 후 동작이 조용히 바뀜 | 결정 테이블을 코드·설정으로 |

### 다크 테스팅 팩토리와의 관계

웨비나는 **"다크 테스팅 팩토리"** 를 다음 해 1분기 제품 개념으로 예고했다(로드맵). 공장처럼 24시간 테스트가 도는 운영 체계다. 그 뼈대가 바로 이 레슨의 오케스트레이션이다. **노드 계약·결정 테이블·승인 게이트가 없는 24시간 자동 실행은 공장이 아니라 사고 발생기다.** 자세한 성숙도는 8-08에서 다룬다.

## 왜 채용시장이 요구하는가

- QA 리드에게 **"테스트 파이프라인 설계"** 가 요구된다. 스크립트를 짜는 사람보다 **흐름·게이트·실패 경로를 설계하는 사람**이 부족하다.
- 면접 질문: **"AI 에이전트를 CI에 넣는다면 어디에, 어떻게 넣겠습니까?"** — 행위자 배정 원칙, 결정적 게이트, 승인 기본값(보류)을 말하면 실무 경험이 드러난다.
- BPMN·DMN은 업무 자동화 조직의 공용어다. 엔터프라이즈 QA가 **프로세스 담당자와 같은 언어로 대화**하게 해 준다.

## 실습 과제

### 과제 1 — 우리 팀 파이프라인 스케치 (20분)

위 ①~⑩을 참고해 우리 팀 야간(또는 릴리즈) 테스트 흐름을 그린다. 종이, draw.io, 텍스트 모두 좋다.
노드마다 **행위자(로봇/에이전트/사람)** 를 표시하고, 에이전트 노드 2개는 **노드 계약 양식**을 모두 채운다.

### 과제 2 — 결정 테이블 (10분)

실패 분석 결과를 라우팅하는 결정 테이블을 만든다. 반드시 넣을 행:

- 기대값 변경 제안
- confidence 미달
- 같은 테스트가 3일 연속 flaky 판정

### 과제 3 — 승인 게이트 재현 (20분, GitHub 계정 필요)

1. 개인 저장소의 Settings → Environments → `qa-approval` 생성 → Required reviewers에 본인 지정
2. 위 YAML에서 `provision`·`sanity`·`human-review`·`teardown` 네 잡만 남겨 `workflow_dispatch` 로 실행
3. 승인 대기 화면을 확인하고 승인한다
4. **일부러 `sanity` 를 실패시켜**(`exit 1`) `teardown` 이 여전히 도는지 확인한다

### 과제 4 — 대기 시간 비교 (10분)

8-01 과제 1의 리드타임 표에서, 과제 1의 설계가 도입되면 **어느 대기가 사라지고 어느 대기가 새로 생기는지**(승인 대기 등) 적는다. 새로 생긴 대기의 SLA와 기본값을 정한다.

## 자가 체크리스트

- [ ] 오케스트레이션이 없으면 에이전트를 도입해도 대기 시간이 남는 이유를 설명할 수 있다
- [ ] Maestro의 핵심 기능(BPMN·DMN, 사람·로봇·에이전트 조율, 타사 에이전트 호출)을 말할 수 있다
- [ ] 웨비나의 야간 파이프라인 10단계를 순서대로 설명할 수 있다
- [ ] 결정적 작업·해석 작업·책임 작업에 각각 로봇·에이전트·사람을 배정할 수 있다
- [ ] 게이트 판정을 에이전트에게 맡기면 안 되는 이유를 설명할 수 있다
- [ ] 노드 계약(입력·출력·타임아웃·재시도·실패 경로·비용·증거)을 작성할 수 있다
- [ ] 실패 분석 결과를 라우팅하는 결정 테이블을 만들 수 있다
- [ ] 결정 테이블을 프롬프트가 아니라 코드·설정으로 두어야 하는 이유를 안다
- [ ] 사람 승인 게이트의 증거 묶음·SLA·무응답 기본값을 설계할 수 있다
- [ ] 무응답 기본값이 자동 승인이 아니라 보류여야 하는 이유를 안다
- [ ] GitHub Environments의 Required reviewers로 승인 게이트를 재현할 수 있다
- [ ] `if: always()` 정리 단계가 빠졌을 때의 비용 문제를 안다
- [ ] 오케스트레이션 안티패턴 5가지와 처방을 말할 수 있다

## 참고 링크

- [UiPath — Maestro](https://www.uipath.com/product/maestro) — BPMN·에이전트 오케스트레이션
- [UiPath — 3 ways Test Cloud is paving the way for agentic, autonomous QA](https://www.uipath.com/blog/product-and-updates/how-uipath-test-cloud-paves-way-for-agentic-autonomous-qa) — 테스트에서의 Maestro
- [OMG — BPMN 2.0](https://www.omg.org/spec/BPMN/2.0/) · [OMG — DMN](https://www.omg.org/dmn/) — 표준 명세
- [GitHub Docs — Deployments and environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) — Required reviewers
- [GitHub Docs — Workflow syntax: jobs.needs / if](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions) — 의존과 조건
