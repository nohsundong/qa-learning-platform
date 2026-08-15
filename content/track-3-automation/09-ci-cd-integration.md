---
id: t3-l09
title: CI/CD 연동 — GitHub Actions와 Jenkins에서 테스트 돌리기
summary: 자동화는 CI에서 자동으로 돌아야 비로소 자동화다. 워크플로 작성부터 병렬 샤딩, 리포트, 실패 알림까지.
minutes: 20
order: 9
tags: [CI, GitHubActions, Jenkins, 샤딩, 리포트]
---

## 개념 설명

### 로컬에서만 도는 자동화는 자동화가 아니다

테스트를 만들어 놓고 **사람이 기억해서 실행해야 한다면**, 그건 결국 안 돌게 된다. 자동화의 가치는 다음 세 가지에서 나오는데 전부 CI가 있어야 성립한다.

1. **모든 PR에서 자동 실행** → 결함이 머지되기 전에 잡힌다
2. **매일 정해진 시각에 실행** → 회귀를 매일 확인한다
3. **결과가 팀에 자동 공유** → 아무도 리포트를 찾아다니지 않는다

### 어디에서 무엇을 돌릴 것인가

전부를 매번 돌리면 PR 피드백이 30분 걸린다. **트리거별로 범위를 나눈다.**

| 트리거 | 실행 대상 | 목표 시간 |
|---|---|---|
| PR 생성/갱신 | 스모크 + 변경 영역 관련 테스트 | **10분 이내** |
| main 머지 | 전체 회귀 (Chromium) | 30분 |
| 매일 새벽 | 전체 회귀 × 브라우저 3종 + 모바일 뷰포트 | 시간 무관 |
| 릴리즈 태그 | 전체 + 성능 스모크 | 시간 무관 |
| 수동 실행 | 임의 지정 | — |

**PR에서 10분을 넘기면 개발자가 결과를 안 기다리고 머지한다.** 이 숫자를 지키는 게 CI 설계의 첫 번째 목표다.

### GitHub Actions — 기본 워크플로

public 저장소는 **무료 무제한**이다. (private은 월 무료 분량이 있다)

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 20 * * 0-4'      # UTC 20시 = KST 평일 05시
  workflow_dispatch:            # 수동 실행 버튼

jobs:
  test:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'          # 의존성 캐시로 설치 시간 단축

      - name: 의존성 설치
        run: npm ci             # install 이 아니라 ci — 락파일 그대로 재현 설치

      - name: 브라우저 설치
        run: npx playwright install --with-deps chromium

      - name: 테스트 실행
        run: npx playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}

      - name: 리포트 업로드
        if: always()            # ← 실패해도 리포트를 남긴다. 절대 빠뜨리면 안 된다
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

**놓치면 안 되는 세 가지**

| 항목 | 이유 |
|---|---|
| `if: always()` | 없으면 **테스트 실패 시 리포트가 안 올라간다.** 정작 필요할 때 못 본다 |
| `npm ci` | `npm install` 은 락파일을 갱신할 수 있어 CI 재현성이 깨진다 |
| `secrets.*` | 계정·URL을 코드에 넣으면 public 저장소에 그대로 노출된다 |
| `timeout-minutes` | 무한 대기로 러너가 묶이는 것을 막는다 |

**`--with-deps`** 는 브라우저 실행에 필요한 OS 라이브러리까지 설치한다. Linux 러너에서 이게 없으면 "libnss3.so 를 찾을 수 없음" 같은 에러가 난다.

### 병렬 실행과 샤딩 — 시간 줄이기

**1단계: 워커 병렬** (한 머신 안에서)

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
});
```

CI 러너는 대개 2코어라 워커를 많이 늘리면 오히려 느려지고 플래키가 는다. **2~4가 현실적**이다.

**2단계: 샤딩** (여러 머신에 나눠서)

```yaml
jobs:
  test:
    strategy:
      fail-fast: false          # 한 샤드가 실패해도 나머지는 계속
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      # ...
      - run: npx playwright test --shard=${{ matrix.shard }}/4

      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: blob-report-${{ matrix.shard }}     # 샤드마다 다른 이름
          path: blob-report/
```

**샤드별 리포트를 하나로 합치기**

```yaml
  merge-report:
    needs: [test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci

      - uses: actions/download-artifact@v4
        with:
          pattern: blob-report-*
          path: all-blob-reports
          merge-multiple: true

      - run: npx playwright merge-reports --reporter html ./all-blob-reports

      - uses: actions/upload-artifact@v4
        with:
          name: html-report
          path: playwright-report/
```

이 구성으로 **40분짜리 스위트가 10분**이 된다. `blob` 리포터가 샤드 결과를 합칠 수 있는 형태로 저장해 준다.

```typescript
// config — CI 에서는 blob 리포터를 쓴다
reporter: process.env.CI ? [['blob'], ['list']] : [['html'], ['list']],
```

### 변경 영역만 실행하기

PR 시간을 줄이는 또 하나의 방법이다. **트랙 1의 회귀 범위 산정을 CI로 옮긴 것**이다.

```yaml
      - name: 변경된 파일 확인
        id: changes
        run: |
          echo "files=$(git diff --name-only origin/main...HEAD | tr '\n' ' ')" >> $GITHUB_OUTPUT

      - name: 결제 관련 변경이면 결제 테스트 실행
        if: contains(steps.changes.outputs.files, 'src/payment/')
        run: npx playwright test tests/payment/
```

간단한 형태이고, 실제로는 태그 기반이 관리하기 쉽다.

```typescript
test('결제 흐름 @smoke @payment', async () => { ... });
```

```bash
npx playwright test --grep @smoke              # PR
npx playwright test --grep-invert @flaky       # 전체 회귀 (5편의 격리 규칙)
```

### 실패 알림 — Slack

```yaml
      - name: 실패 시 Slack 알림
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🔴 *Playwright 테스트 실패*\n브랜치: `${{ github.ref_name }}`\n커밋: ${{ github.event.head_commit.message }}\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|리포트 보기>"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**알림에 리포트 링크를 반드시 넣는다.** "실패했습니다"만 오면 아무도 안 본다. 트랙 2의 Slack 메시지 원칙과 같다 — **받는 사람이 바로 행동할 수 있어야 한다.**

`if: failure()` 대신 항상 알림을 보내면 알림 피로가 생긴다. **실패했을 때만** 보낸다.

### GitHub Pages 로 리포트 공개하기

아티팩트는 다운로드해서 압축을 풀어야 볼 수 있어 번거롭다. public 저장소라면 **Pages에 올려 링크로 공유**할 수 있다. 무료다.

```yaml
      - name: 리포트를 Pages 로 배포
        if: always()
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./playwright-report
          destination_dir: reports/${{ github.run_number }}
```

`https://<사용자>.github.io/<저장소>/reports/42/` 로 바로 열린다.

### Jenkins — 사내 CI를 쓰는 경우

많은 기업이 아직 Jenkins를 쓴다. 개념은 같고 문법만 다르다.

```groovy
pipeline {
  agent {
    docker { image 'mcr.microsoft.com/playwright:v1.50.0-noble' }
  }
  triggers { cron('H 20 * * 0-4') }   // UTC

  environment {
    BASE_URL = credentials('staging-url')
  }

  stages {
    stage('설치') { steps { sh 'npm ci' } }
    stage('테스트') {
      steps { sh 'npx playwright test --reporter=junit,html' }
    }
  }

  post {
    always {
      junit 'results.xml'
      publishHTML(target: [
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Playwright Report'
      ])
    }
    failure {
      slackSend(color: 'danger', message: "테스트 실패: ${env.BUILD_URL}")
    }
  }
}
```

**Playwright 공식 Docker 이미지**를 쓰면 브라우저와 OS 의존성이 이미 들어있어 셋업이 간단해진다. GitHub Actions에서도 쓸 수 있다.

**`post { always { ... } }`** 가 GitHub Actions의 `if: always()` 에 해당한다. 개념은 완전히 같다.

### cron 시간대 — 자주 틀리는 것

**CI의 cron은 거의 항상 UTC다.** KST는 UTC+9이므로 9시간을 빼야 한다.

```text
KST 평일 09:00  →  UTC 00:00, 요일도 그대로  →  '0 0 * * 1-5'
KST 평일 08:00  →  UTC 전날 23:00, 요일 하루 앞  →  '0 23 * * 0-4'
KST 평일 05:00  →  UTC 20:00 전날            →  '0 20 * * 0-4'
```

**KST 09시 이전이면 UTC 기준으로 전날이 되므로 요일 지정도 하루 당겨야 한다.** 이걸 놓치면 월요일 아침에 실행돼야 할 것이 일요일에 돌거나, 금요일 아침 것이 안 돈다.

```text
'0 23 * * 1-5'  ← 흔한 실수. UTC 월~금 23시 = KST 화~토 08시 (토요일에 돌고 월요일엔 안 돔)
'0 23 * * 0-4'  ← 올바름. UTC 일~목 23시 = KST 월~금 08시
```

또 하나: **GitHub Actions의 schedule은 정확한 시각을 보장하지 않는다.** 부하에 따라 수 분~수십 분 지연될 수 있다. 정시성이 중요하면 다른 방법을 써야 한다.

### CI에서만 실패할 때 — 원인 체크리스트

```text
□ 타임아웃 — CI 머신이 느리다. actionTimeout, expect timeout 확인
□ 화면 크기 — 헤드리스 기본 뷰포트가 로컬과 다르다
□ 폰트 — Linux 러너에 한글 폰트가 없어 레이아웃이 다르다
□ 시간대 — 러너는 UTC. 날짜 표시 테스트가 깨진다  → TZ=Asia/Seoul 설정
□ 환경변수 누락 — Secrets 이름 오타
□ 병렬 워커 수 — CI 코어 수보다 많으면 경합
□ 테스트 데이터 — CI 전용 계정이 다른 상태일 수 있다
```

시간대 문제는 이렇게 해결한다.

```yaml
env:
  TZ: Asia/Seoul
```

**그리고 무조건 트레이스를 본다.** 1편에서 배운 대로, CI 실패 디버깅의 90%는 Trace Viewer로 끝난다.

```bash
# 아티팩트를 내려받아 로컬에서 연다
npx playwright show-trace trace.zip
```

## 왜 채용시장이 요구하는가

- **"CI/CD에 테스트를 연동해 본 경험"** 은 자동화 공고의 단골 요구사항이다. 테스트를 짤 줄 아는 사람과 파이프라인을 구축해 본 사람은 다른 등급으로 평가된다.
- 면접 질문: **"로컬에선 되는데 CI에선 실패합니다. 어떻게 접근하시겠어요?"** — 위 체크리스트가 그대로 답이다.
- **PR 피드백 10분 원칙**, **샤딩으로 시간 단축**, **실패 알림에 링크 포함** 같은 실무 감각은 운영해 본 사람만 안다.
- **AI에게 워크플로 YAML을 시키면 대체로 동작한다. 문제는 빠뜨리는 것들이다.** `if: always()`, `npm ci` vs `install`, Secrets 분리, cron 시간대 — 이 네 가지를 거의 매번 놓친다. 그리고 **YAML은 실행해 보기 전에는 틀렸는지 모른다.**

## 실습 과제

### 과제 1 — 첫 워크플로 (20분)

앞 레슨들에서 만든 Playwright 프로젝트를 GitHub public 저장소에 올린다. (무료 무제한)

1. `.github/workflows/playwright.yml` 작성 — 위 기본 워크플로 참고
2. push 해서 Actions 탭에서 실행 확인
3. 테스트 하나를 **일부러 실패시켜** push
4. **실패했는데 리포트가 업로드됐는지 확인**
5. `if: always()` 를 지우고 다시 실패시켜 → 리포트가 안 올라오는 것 확인
6. 되돌리기

5번을 직접 해보는 게 이 과제의 핵심이다.

### 과제 2 — 샤딩으로 시간 줄이기 (15분)

테스트를 최소 8개 이상으로 늘린 뒤:

1. 샤딩 없이 실행 → 소요 시간 기록
2. `matrix.shard: [1,2,3,4]` 로 샤딩 → 소요 시간 기록
3. `merge-reports` 로 리포트 병합
4. **시간이 4배로 줄지 않는 이유**를 분석해 메모에 적기 (설치·브라우저 다운로드 오버헤드)

### 과제 3 — cron 시간대 계산 (10분)

아래를 UTC cron 표현식으로 변환한다.

| 원하는 시각 (KST) | cron (UTC) |
|---|---|
| 평일 매일 08:00 | |
| 평일 매일 09:30 | |
| 매주 월요일 07:00 | |
| 매일 자정 00:00 | |
| 평일 18:00 | |

**두 번째와 세 번째가 함정이다.** 날짜가 넘어가는지 확인한다.

작성한 뒤 [crontab.guru](https://crontab.guru) 로 검증한다.

### 과제 4 — Secrets 와 환경 분리 (12분)

1. 저장소 Settings → Secrets → `BASE_URL`, `TEST_USER`, `TEST_PASSWORD` 등록
2. 워크플로에서 `env:` 로 주입
3. 테스트 코드에서 `process.env.BASE_URL` 사용
4. **일부러 Secrets 이름을 틀리게** 하고 실행 → 에러 메시지 확인
5. 로그에 Secret 값이 노출되는지 확인 (GitHub이 자동 마스킹하지만, `echo` 로 우회 가능한지 실험)

5번에서 얻는 교훈: **Secrets는 마스킹되지만 완벽하지 않다.** 로그에 찍지 않는 습관이 중요하다.

### 과제 5 — AI 워크플로 감사 (12분)

AI 실습 도우미에 요청한다.

> Playwright 테스트를 GitHub Actions에서 PR마다 실행하고, 매일 한국시간 아침 7시에 전체 회귀를 돌리며, 실패 시 Slack으로 알리는 워크플로를 작성하라.

| 확인 항목 | 결과 |
|---|---|
| `if: always()` 로 실패 시에도 리포트를 남기는가 | |
| `npm ci` 를 썼는가, `npm install` 을 썼는가 | |
| **cron이 UTC 기준으로 변환됐는가** (KST 07시 → `0 22 * * 0-4`) | |
| Slack Webhook 을 Secrets 로 분리했는가 | |
| `npx playwright install --with-deps` 가 있는가 | |
| `timeout-minutes` 를 설정했는가 | |
| 액션 버전이 실제로 존재하는가 (`@v4` 등, 환각 점검) | |
| PR과 스케줄의 실행 범위를 구분했는가 | |

**cron 항목을 꼭 확인한다.** AI는 "한국시간 아침 7시"를 `0 7 * * *` 로 그대로 쓰는 실수를 매우 자주 한다. 그러면 실제로는 **KST 16시**에 돈다.

그리고 **실제로 push해서 돌려본다.** YAML은 눈으로 봐서는 검증이 안 된다.

## 자가 체크리스트

- [ ] CI 없는 자동화가 결국 안 돌게 되는 이유를 설명할 수 있다
- [ ] 트리거별(PR/머지/야간/릴리즈) 실행 범위를 나눠 설계할 수 있다
- [ ] PR 피드백 10분 원칙과 그 이유를 안다
- [ ] `if: always()` 가 없으면 실패 시 리포트를 못 받는다는 것을 안다
- [ ] `npm ci` 와 `npm install` 의 차이와 CI에서 `ci` 를 쓰는 이유를 안다
- [ ] `playwright install --with-deps` 가 필요한 이유를 안다
- [ ] 계정·URL을 Secrets로 분리하고 코드에 넣지 않는다
- [ ] 워커 병렬과 샤딩의 차이를 설명하고 둘 다 설정할 수 있다
- [ ] `blob` 리포터와 `merge-reports` 로 샤드 결과를 합칠 수 있다
- [ ] 태그(`@smoke`, `@flaky`)로 실행 범위를 제어할 수 있다
- [ ] 실패 알림에 리포트 링크를 포함시키고, 실패 시에만 보낸다
- [ ] **CI cron이 UTC 기준이고, KST 09시 이전이면 요일도 당겨야 함**을 안다
- [ ] GitHub Actions schedule이 정시 실행을 보장하지 않는다는 것을 안다
- [ ] CI에서만 실패할 때의 원인 체크리스트 7가지를 안다
- [ ] `TZ` 환경변수로 러너 시간대를 맞출 수 있다
- [ ] CI 실패 시 트레이스를 내려받아 로컬에서 분석할 수 있다
- [ ] AI가 만든 워크플로에서 cron 시간대·`if: always()`·Secrets 누락을 잡아낼 수 있다

## 참고 링크

- [Playwright — CI 설정](https://playwright.dev/docs/ci-intro) — 공식 GitHub Actions 예제
- [Playwright — Sharding](https://playwright.dev/docs/test-sharding) — 샤딩과 리포트 병합
- [GitHub Actions 문서](https://docs.github.com/en/actions) — public 저장소 무료 무제한
- [crontab.guru](https://crontab.guru) — cron 표현식 검증
- [Playwright Docker 이미지](https://playwright.dev/docs/docker) — Jenkins·컨테이너 환경용
- [Jenkins Pipeline 문법](https://www.jenkins.io/doc/book/pipeline/syntax/) — 선언형 파이프라인
