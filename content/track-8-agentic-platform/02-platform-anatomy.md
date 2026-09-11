---
id: t8-l02
title: 에이전틱 테스트 플랫폼 해부 — 라이프사이클 4단계 × 유스케이스 지도
summary: 테스트 클라우드가 무엇으로 이루어졌는지 분해하고, 설계·자동화·실행·관리 단계별 AI 유스케이스와 산출물 연결 구조를 이해한다. 같은 원리를 Playwright Test Agents로 무료 재현한다.
minutes: 22
order: 2
tags: [테스트클라우드, Autopilot, 유스케이스, 추적성, PlaywrightAgents]
---

## 개념 설명

### 테스트 클라우드란 무엇으로 이루어졌나

UiPath가 정의하는 Test Cloud는 한 제품이 아니라 **묶음**이다.

```text
테스트 관리        요구사항 · 테스트 케이스 · 실행 결과 · 결함 (Test Manager)
테스트 작성        로우코드 · 코디드(C#) 자동화 (Studio / Studio Web)
AI 에이전트        Autopilot for Testers · 커스텀 에이전트 (Agent Builder)
실행               로봇 · 셀프힐링 · 라이브 스트리밍 · CI/CD 연동
성능 테스트        기능 테스트를 재사용한 부하·스트레스·내구성 테스트
엔터프라이즈 앱    SAP · Oracle · Salesforce 등 업무 시스템 지원
오케스트레이션      사람·로봇·에이전트 워크플로 (Maestro)
거버넌스           AI Trust Layer · 권한 · 감사
```

플랫폼을 평가할 때 **"AI 기능이 몇 개냐"보다 "이 조각들이 서로 연결돼 있느냐"** 를 본다. 연결이 끊긴 곳마다 사람이 복사·붙여넣기를 하고, 거기서 대기 시간이 생긴다(8-01).

### 공개 자료로 확인한 타임라인

| 시점 | 내용 |
|---|---|
| 2025-03-25 | Test Cloud 출시 발표 — Autopilot for Testers, Agent Builder 포함 |
| 2025-10 | 2025.10 릴리즈 — 성능 테스트, Studio Web 앱 테스트, Autopilot for Testers(BYOM·MCP 지원), 셀프힐링, 실행 스트리밍 GA. 온프레미스(Automation Suite·Private Test Cloud 2.2510)에도 Autopilot 도입 |
| 2025-10 | Gartner Magic Quadrant for AI-Augmented Software Testing Tools(첫 발행) Leader |
| 2025-12 | Forrester Wave: Autonomous Testing Platforms, Q4 2025 Leader |
| 2026-07 | "Dark Testing Factory" 백서·블로그 공개 |
| 2026-09 | 이 트랙의 출발점인 한국어 웨비나 |

### 단계별 유스케이스 지도

웨비나는 "20개 이상의 유스케이스가 네 단계 전부에 제품화돼 있다"고 설명했다. 문서로 확인되는 것과 웨비나 데모로만 본 것을 나눠 정리한다.

| 단계 | 유스케이스 | 근거 |
|---|---|---|
| **설계** | 요구사항 품질 평가 | 문서 |
| | 요구사항 → 수동 테스트 케이스 생성 | 문서 |
| | SAP 트랜잭션 기반 테스트 생성 | 문서 |
| | 엑셀 수동 테스트 가져오기 | 웨비나 |
| | 폐기·중복 수동 테스트 식별 | 문서 |
| **자동화** | 수동 테스트 → 로우코드·코디드 UI/API 자동화 변환 | 문서 |
| | 데이터 기반 테스트용 테스트 데이터 생성 | 문서 |
| | 코디드 자동화 리팩터링, 검증 오류 수정, 정규식 생성 | 문서 |
| | **퍼지(비결정적) 검증** — 문자열 완전 일치가 아닌 의미 수준 검증 | 문서 |
| | ScreenPlay — 자연어 지시로 화면을 읽고 조작하는 UI 에이전트 | 문서 |
| **실행** | 런타임 셀프힐링 — 셀렉터·타이밍·오버레이 문제 자동 보정 | 문서 |
| | 수동 테스트 자율 실행 (Run with Autopilot) | 문서 (8-05) |
| | 요구사항 기반 자율 탐색 | 웨비나 데모 (8-06) |
| | 실행 화면 라이브 스트리밍 · 원격 제어 | 문서 |
| **관리** | 실행 결과 요약·실패 원인 분석 | 문서 |
| | 자연어 프로젝트 검색, 리포트·차트 생성 | 문서 |
| | 야간 실행 실패의 결함 통합(Bug Consolidator 에이전트) | 문서 |

**"경쟁사는 테스트 생성 같은 특정 지점에만 AI가 있다"** 는 것은 웨비나의 주장이다. Tricentis도 에이전틱 테스트 자동화와 원격 MCP 서버를 내놓는 등 시장 전체가 라이프사이클 전반으로 넓히는 중이다. 비교는 8-08의 평가표로 직접 한다.

### 산출물 체인 — 진짜 가치는 연결에 있다

```text
요구사항 ──품질 평가──▶ 개선된 요구사항
    │
    └──생성──▶ 수동 테스트 케이스 ──변환──▶ 자동화 테스트
                     │                        │
                     └──자율 실행──┐           └──실행──┐
                                  ▼                    ▼
                               실행 결과 ◀──────────────┘
                                  │
                        결과 분석·결함 통합
                                  │
                   결함 ──▶ ALM(Jira 등) ──▶ 요구사항 커버리지
```

각 화살표가 **추적성 링크**다. 링크가 살아 있으면 "요구사항 A가 바뀌었을 때 영향받는 테스트", "이 결함이 막는 요구사항"을 자동으로 답할 수 있다. 에이전트가 만든 산출물이 이 링크를 **끊지 않고 이어 붙이는지**가 도입 품질을 가른다.

### 웨비나 데모 1 — Test Manager에서 Autopilot과 대화

```text
1. "소유자별로 요구사항이 몇 개인지 파이 차트로 보여줘"   → 담당자별 요구사항 차트
2. "○○ 소유 요구사항을 나열해줘"                     → 3건 검색
3. "이 요구사항의 품질을 평가해줘"                     → 정해진 품질 요소별 평가
4. "실행 결과를 분석해줘"                             → 5건 요약
     - TC 한 건: 반복 실패
     - TC 한 건: 검증 단계에서 기대 결과와 실제 결과가 다름
```

4번의 두 실패는 **성격이 다르다.** 반복 실패는 플래키·환경·결함 중 무엇인지 더 봐야 하고, 기대값 불일치는 제품 결함이거나 사양 변경이다(트랙 4-07의 분류). AI 요약이 이 둘을 **다른 조치로 안내하는지** 확인하는 것이 QA의 몫이다.

### 웨비나 데모 2 — Studio에서 바이브 코딩으로 자동화 생성

```text
1. "테스트 매니저의 모든 테스트 케이스를 가져와"
2. "TC-301 수동 테스트 단계를 보여줘"         → 11단계 (메뉴 선택 → 신청 → 데이터 입력…)
3. "코드를 생성해줘"                         → C# 코디드 테스트, Object Repository 요소 자동 매핑
4. Autopilot의 완료 요약: "화면 중간 검증(verification) 단계가 없습니다"
5. "실행해줘"                               → 값이 입력되는 화면 확인, 종료
```

**4번이 이 데모에서 가장 중요한 장면이다.** 입력만 하고 아무것도 확인하지 않는 테스트는 항상 통과한다. 트랙 6-08에서 본 **가짜 통과**다. 도구가 경고해 줬다는 점은 좋지만, 경고를 읽고 **검증을 채워 넣는 것은 사람의 일**이다.

### 같은 원리를 무료로 — Playwright Test Agents

Playwright 1.56부터 **planner · generator · healer** 세 에이전트 정의가 제공된다.

```bash
npx playwright init-agents --loop=claude    # vscode | claude | codex | opencode
```

```text
repo/
  specs/              ← planner 가 만든 마크다운 테스트 계획
  tests/
    seed.spec.ts      ← 환경을 준비하는 시드 테스트 (로그인, 픽스처 등)
```

| 에이전트 | 하는 일 | 플랫폼 기능과 대응 |
|---|---|---|
| planner | 앱을 탐색하고 마크다운 테스트 계획 작성 | 요구사항·탐색 기반 테스트 설계 |
| generator | 계획을 Playwright 테스트 코드로 변환, 셀렉터·어서션을 실제 화면에서 확인 | 수동 → 자동화 변환 |
| healer | 테스트를 돌려 실패를 고치고, **기능 자체가 망가졌다고 판단하면 수정 대신 skip** | 셀프힐링 |

healer의 마지막 동작은 트랙 4-08의 원칙("치유하면 안 되는 경우")을 도구가 구현한 것이다.

### 무료 재현이 채우지 못하는 것

정직하게 적어둔다. 도입 판단에 필요하다.

| 영역 | 무료 조합으로 가능 | 엔터프라이즈 플랫폼이 더하는 것 |
|---|---|---|
| 웹 E2E 생성·치유 | Playwright Agents | 로우코드 사용자, 중앙 저장소 |
| 테스트 관리·추적성 | 스프레드시트, Jira 링크 | 요구사항–TC–결과–결함 자동 연결 |
| 업무 시스템 | 제한적 | SAP·Oracle·Citrix·메인프레임 등 |
| 거버넌스 | 직접 구축 | 권한·감사·모델 정책 일원화 |
| 오케스트레이션 | GitHub Actions (8-04) | 장기 실행·사람 작업함·BPMN 모델링 |

## 왜 채용시장이 요구하는가

- 기업이 테스트 플랫폼을 고를 때 QA가 **"기능 목록"이 아니라 "산출물 연결"로 평가**할 수 있어야 한다. 도입 후 가장 큰 불만은 대부분 연결이 끊긴 곳에서 나온다.
- AI가 자동화 코드를 생성하는 시대에 **어서션 없는 테스트를 알아보는 눈**은 필수 역량이다. 면접에서 "AI가 만든 테스트를 어떻게 리뷰하나요?"로 자주 나온다.
- 엔터프라이즈 도구와 오픈소스 에이전트 **양쪽의 동작 원리를 대응시켜 설명**할 수 있으면, 어느 회사의 스택에도 빠르게 적응한다.

## 실습 과제

### 과제 1 — 우리 팀 유스케이스 지도 (15분)

위 표를 복사해 우리 팀 상황으로 채운다.

| 단계 | 유스케이스 | 지금 누가 하나 | 에이전트 후보? | 사람 승인 필요? | 기대 효과 |
|---|---|---|---|---|---|
| | | | | | |

**효과는 크고 승인 부담은 작은 것** 두 개에 동그라미를 친다.

### 과제 2 — Playwright Agents로 설계·생성 재현 (25분, Node 필요)

```bash
npm init playwright@latest agents-lab
cd agents-lab
npx playwright init-agents --loop=claude     # 쓰는 도구에 맞게
```

1. 대상: `https://demo.playwright.dev/todomvc`
2. planner에게 "할 일 추가·완료·필터의 핵심 흐름과 경계 조건 테스트 계획"을 요청한다
3. `specs/` 의 계획을 **사람이 먼저 검토**하고 한 항목을 지우거나 고친다
4. generator로 코드를 만든다

AI 도구가 없다면 planner 역할 프롬프트를 AI 실습 도우미에서 복사해 쓰고, 계획만 받아 검토한다.

### 과제 3 — 생성된 테스트 어서션 감사 (10분)

과제 2의 결과(또는 아무 AI 생성 테스트)에서 테스트마다 센다.

| 테스트 | 동작(click/fill) 수 | 어서션(expect) 수 | 어서션이 사용자 관점 결과를 확인하나 |
|---|---|---|---|
| | | | |

어서션 0개 또는 "요소가 보인다"만 확인하는 테스트를 표시하고, 요구사항에 맞는 검증을 한 줄씩 추가한다.

### 과제 4 — 추적성 매트릭스 (10분)

요구사항 3개로 매트릭스를 만든다.

| 요구사항 | 테스트 케이스 | 자동화 여부 | 최근 결과 | 연결된 결함 |
|---|---|---|---|---|
| | | | | |

**빈칸이 생기는 곳**이 도구 연결이 끊긴 곳이다. 어떤 연동이 있어야 빈칸이 자동으로 채워질지 적는다.

## 자가 체크리스트

- [ ] 테스트 클라우드를 이루는 구성 요소를 6가지 이상 말할 수 있다
- [ ] 플랫폼 평가 시 기능 개수보다 산출물 연결을 봐야 하는 이유를 설명할 수 있다
- [ ] Test Cloud 출시(2025-03)와 2025.10 릴리즈의 주요 GA 기능을 말할 수 있다
- [ ] 설계·자동화·실행·관리 단계별 AI 유스케이스를 각 2개 이상 말할 수 있다
- [ ] 문서로 확인된 기능과 웨비나 데모로만 본 기능을 구분할 수 있다
- [ ] 퍼지(비결정적) 검증이 무엇이고 언제 쓰는지 설명할 수 있다
- [ ] 요구사항–TC–자동화–결과–결함의 추적성 체인을 그릴 수 있다
- [ ] "반복 실패"와 "기대값 불일치"가 다른 조치로 이어져야 함을 안다
- [ ] AI가 생성한 자동화에서 검증 단계 누락(가짜 통과)을 찾아낼 수 있다
- [ ] Playwright Test Agents의 planner·generator·healer 역할을 설명할 수 있다
- [ ] healer가 기능 결함으로 판단하면 수정 대신 skip하는 이유를 안다
- [ ] 무료 도구 조합이 엔터프라이즈 플랫폼 대비 채우지 못하는 영역을 말할 수 있다

## 참고 링크

- [UiPath — Agentic testing with Test Cloud](https://www.uipath.com/platform/agentic-testing) — 제품 개요
- [UiPath — Test Cloud 출시 보도자료 (2025-03-25)](https://ir.uipath.com/news/detail/384/uipath-launches-test-cloud-to-bring-ai-agents-to-software-testing)
- [UiPath — Test Cloud 2025.10 release updates](https://www.uipath.com/blog/product-and-updates/uipath-test-cloud-2025-10-release-updates)
- [UiPath Docs — Autopilot for Testers](https://docs.uipath.com/test-cloud/automation-cloud/latest/user-guide/ai-powered-testing) — 유스케이스 목록
- [UiPath — ScreenPlay](https://www.uipath.com/platform/agentic-automation/rpa/ui-automation/screenplay) — 자연어 UI 에이전트
- [Playwright — Test Agents](https://playwright.dev/docs/test-agents) — planner · generator · healer
- [Tricentis — Agentic Test Automation](https://www.tricentis.com/blog/agentic-test-automation-tosca) — 비교 대상
