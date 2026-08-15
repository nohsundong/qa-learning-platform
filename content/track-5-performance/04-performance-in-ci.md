---
id: t5-l04
title: 성능 테스트를 CI에 붙이고 회귀를 감지하기
summary: 릴리즈 직전 한 번 돌리는 성능 테스트는 늦다. 매일 자동으로 돌려 변화를 잡아내는 체계를 만든다.
minutes: 20
order: 4
tags: [k6, CI, 성능회귀, GitHubActions, 리포팅]
---

## 개념 설명

### 릴리즈 직전 성능 테스트가 늦은 이유

```text
릴리즈 3일 전에 성능 테스트를 처음 돌린다
  → p95 가 목표의 3배
  → 원인이 지난 2개월간 들어간 40개 PR 중 어딘가
  → 범인을 못 찾는다
  → 릴리즈를 미루거나 그냥 나간다
```

**변경 하나하나에 대해 측정하면 범인이 바로 보인다.** 트랙 3에서 기능 테스트를 CI에 붙인 것과 정확히 같은 논리다.

### 무엇을 언제 돌릴 것인가

성능 테스트는 무겁다. 전부 매번 돌릴 수 없다. **트리거별로 나눈다.**

| 트리거 | 유형 | 규모 | 목표 시간 |
|---|---|---|---|
| PR | 스모크 | VU 1~5, 1분 | **2분 이내** |
| main 머지 | 축소 부하 | VU 50, 5분 | 10분 |
| 매일 새벽 | 부하 | VU 목표치, 30분 | 40분 |
| 매주 | 스트레스 + 스파이크 | 한계까지 | 1~2시간 |
| 릴리즈 전 | 전체 + 내구성 | 목표치, 수 시간 | 반나절 |

**PR 단계의 목적은 "성능 측정"이 아니라 "명백한 회귀 차단"이다.** VU 5로 1분 돌려서 p95가 평소의 5배가 나오면, 뭔가 크게 잘못된 것이다. 그건 2분 만에 잡을 수 있다.

트랙 3의 "PR 피드백 10분 원칙"이 여기서도 적용된다.

### GitHub Actions 워크플로

public 저장소는 무료다. k6는 오픈소스라 러너에서 바로 쓸 수 있다.

```yaml
# .github/workflows/perf.yml
name: 성능 테스트

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 18 * * 0-4'      # UTC 18시 = KST 평일 새벽 3시
  workflow_dispatch:
    inputs:
      test_type:
        type: choice
        options: [smoke, load, stress, spike]
        default: smoke

permissions:
  contents: read
  pull-requests: write

jobs:
  perf:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4

      - name: 테스트 유형 결정
        id: cfg
        run: |
          if   [ "${{ github.event_name }}" = "pull_request" ]; then echo "type=smoke" >> $GITHUB_OUTPUT
          elif [ "${{ github.event_name }}" = "schedule" ];     then echo "type=load"  >> $GITHUB_OUTPUT
          elif [ "${{ github.event_name }}" = "push" ];         then echo "type=quick" >> $GITHUB_OUTPUT
          else echo "type=${{ inputs.test_type }}" >> $GITHUB_OUTPUT
          fi

      - name: k6 설치
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install -y k6

      - name: 실행
        id: run
        continue-on-error: true      # threshold 실패해도 리포트는 만든다
        env:
          BASE_URL: ${{ secrets.PERF_BASE_URL }}
          VERSION: ${{ github.sha }}
        run: |
          mkdir -p results
          k6 run tests/perf/${{ steps.cfg.outputs.type }}.js

      - name: 결과 업로드
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-results-${{ github.run_number }}
          path: results/
          retention-days: 90        # 추세 분석을 위해 길게

      - name: PR 코멘트
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const s = require('./results/summary.json');
            const d = s.metrics.http_req_duration.values;
            const f = s.metrics.http_req_failed.values;
            const pass = '${{ steps.run.outcome }}' === 'success';
            await github.rest.issues.createComment({
              ...context.repo, issue_number: context.issue.number,
              body: [
                `## ${pass ? '✅' : '❌'} 성능 스모크`,
                '',
                '| 지표 | 값 | 기준 |',
                '|---|---|---|',
                `| p(95) | ${Math.round(d['p(95)'])}ms | < 500ms |`,
                `| p(99) | ${Math.round(d['p(99)'])}ms | < 1500ms |`,
                `| 에러율 | ${(f.rate * 100).toFixed(2)}% | < 1% |`,
                '',
                pass ? '' : '⚠️ 기준을 초과했습니다. 변경 내용을 확인하세요.',
              ].join('\n'),
            });

      - name: 실패 시 잡 실패 처리
        if: steps.run.outcome == 'failure'
        run: exit 1
```

**설계 포인트**

| 항목 | 이유 |
|---|---|
| `continue-on-error` + 마지막 `exit 1` | threshold 실패해도 리포트를 만든 뒤 실패시킨다 |
| `retention-days: 90` | 추세 분석에는 긴 보관이 필요 |
| PR 코멘트에 표 | 아무도 아티팩트를 다운로드하지 않는다 |
| cron UTC 변환 | 트랙 3에서 다룬 함정 |
| `PERF_BASE_URL` 을 Secrets 로 | 스테이징 주소 노출 방지 |

### 결과를 파일로 남기기

3편의 `handleSummary` 를 CI용으로 정리한다.

```javascript
// tests/perf/lib/summary.js
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export function makeSummary(data) {
  const d = data.metrics.http_req_duration?.values ?? {};
  const f = data.metrics.http_req_failed?.values ?? {};
  const r = data.metrics.http_reqs?.values ?? {};

  const row = [
    __ENV.VERSION || 'local',
    new Date().toISOString(),
    Math.round(d['p(95)'] ?? 0),
    Math.round(d['p(99)'] ?? 0),
    ((f.rate ?? 0) * 100).toFixed(3),
    Math.round(r.rate ?? 0),
  ].join(',') + '\n';

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'results/summary.json': JSON.stringify(data, null, 2),
    'results/trend.csv': row,
  };
}
```

```javascript
// tests/perf/load.js
import { makeSummary } from './lib/summary.js';
export function handleSummary(data) { return makeSummary(data); }
```

**`jslib.k6.io` 는 k6가 제공하는 무료 CDN**이다. npm 설치 없이 유틸리티를 쓸 수 있다.

### 성능 회귀 감지 — 기준선 비교

절대 threshold만으로는 **서서히 나빠지는 것**을 못 잡는다. 3편에서 본 문제다.

```javascript
// scripts/check-regression.mjs
import { readFileSync } from 'node:fs';

const current = JSON.parse(readFileSync('results/summary.json', 'utf8'));
const baseline = JSON.parse(readFileSync('baseline/summary.json', 'utf8'));

const METRICS = [
  { key: 'http_req_duration', stat: 'p(95)', tolerance: 0.20, label: 'p95' },
  { key: 'http_req_duration', stat: 'p(99)', tolerance: 0.30, label: 'p99' },
  { key: 'http_reqs',         stat: 'rate',  tolerance: -0.15, label: 'RPS' },
];

let failed = false;
for (const m of METRICS) {
  const cur  = current.metrics[m.key].values[m.stat];
  const base = baseline.metrics[m.key].values[m.stat];
  const change = (cur - base) / base;

  // RPS 는 낮아지는 게 나쁘므로 부호를 반대로 본다
  const bad = m.tolerance > 0 ? change > m.tolerance : change < m.tolerance;
  const sign = change >= 0 ? '+' : '';

  console.log(`${m.label}: ${base.toFixed(0)} → ${cur.toFixed(0)} (${sign}${(change*100).toFixed(1)}%)`);
  if (bad) {
    console.error(`  ❌ 허용 범위(${(Math.abs(m.tolerance)*100)}%)를 초과했습니다`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
```

**허용 범위(tolerance)를 두는 이유**: 성능 측정에는 노이즈가 있다. CI 러너의 상태에 따라 10% 정도는 흔들린다. **너무 빡빡하면 매번 실패하고 아무도 안 본다.** 트랙 3의 플래키 문제와 같다.

**기준선을 무엇으로 할 것인가**

| 방식 | 장점 | 단점 |
|---|---|---|
| 직전 릴리즈 | 변화를 바로 감지 | 서서히 나빠지면 못 잡음 |
| 고정 기준선 (분기별 갱신) | 누적 저하 감지 | 갱신 시점 판단 필요 |
| **최근 N회 이동 평균** | 노이즈에 강함 | 구현이 조금 복잡 |

**실무에서는 둘을 함께 쓴다.** 직전 대비 20% 악화 → 경고, 분기 기준선 대비 50% 악화 → 실패.

### 측정 환경을 통제하지 않으면 전부 무의미하다

**이게 CI 성능 테스트의 가장 큰 함정이다.**

```text
GitHub Actions 러너는 실행마다 사양·부하가 다르다
  → 같은 코드인데 p95 가 200ms ~ 400ms 사이에서 흔들린다
  → 회귀 감지가 불가능해진다
```

**대응 방법**

```text
□ 부하 생성기가 아니라 대상 서버를 측정한다
  - CI 러너에서 원격 스테이징을 때린다 (러너 성능 영향 최소화)
  - 러너에서 앱을 함께 띄우면 러너 성능이 결과를 지배한다  ← 흔한 실수

□ 같은 시간대에 실행한다
  - 스테이징에 다른 작업이 도는 시간을 피한다

□ 워밍업을 충분히
  - 초반 데이터를 버린다 (2편의 램프업)

□ 여러 번 실행해 중앙값을 쓴다
  - 3회 실행 후 중앙값 (시간이 허용하면)

□ 러너 정보를 결과에 기록
  - 나중에 이상치의 원인을 추적할 수 있다

□ 노이즈 수준을 먼저 측정한다
  - 코드 변경 없이 5회 돌려 편차를 확인
  - 그 편차보다 큰 tolerance 를 설정한다
```

**마지막이 가장 중요하다.** 노이즈가 ±15%인데 tolerance를 10%로 잡으면 절반은 거짓 실패다.

```text
기준선 노이즈 측정 (같은 커밋 5회)
  p95: 210, 195, 230, 205, 218  →  편차 약 ±9%
  → tolerance 는 최소 20% 로 설정
```

### 결과를 팀에 보이게 하기

아티팩트에만 두면 아무도 안 본다.

```text
□ PR 코멘트로 요약 (위 워크플로)
□ 실패 시 Slack 알림 + 리포트 링크 (트랙 3)
□ GitHub Pages 에 추세 그래프 배포 (public 저장소면 무료)
□ 주간 요약: 이번 주 p95 추이, 회귀 발생 건수
```

**GitHub Pages 로 추세 그래프**를 만드는 게 비용 0원으로 가장 효과적이다. `trend.csv` 를 누적하고 간단한 차트 페이지를 올린다. 트랙 3의 리포트 배포와 같은 방식이다.

### 성능 테스트에서 QA의 역할

혼자 하는 일이 아니다. **경계를 명확히 하면 협업이 쉬워진다.**

| 역할 | 담당 |
|---|---|
| 요구사항 정의 (목표 트래픽, 응답시간) | **QA 주도** + 기획·비즈니스 |
| 워크로드 모델링 (사용 비율) | **QA** (트랙 2의 로그 분석) |
| 스크립트 작성·유지 | **QA** |
| 실행과 결과 정리 | **QA** |
| 서버 리소스 모니터링 | 인프라·SRE (QA는 함께 본다) |
| 병목 원인 분석 | 개발 + QA (QA가 범위를 좁혀 전달) |
| 튜닝·최적화 | 개발 |
| 릴리즈 판단 | **QA가 근거 제공**, 결정은 팀 |

**"병목 원인 분석"에서 QA의 몫은 범위를 좁혀 전달하는 것**이다. "느립니다"가 아니라 "결제 API의 `http_req_waiting`이 95%를 차지하고, 부하와 무관하게 일정한 걸 보면 외부 PG 호출로 보입니다"까지 하면 개발자가 바로 들어간다.

### 자주 하는 실수

| 실수 | 결과 |
|---|---|
| CI 러너에서 앱과 부하를 함께 실행 | 러너 성능을 측정하게 된다 |
| `check` 만 쓰고 `threshold` 없음 | 항상 통과 (1편) |
| 생각 시간 없음 | 비현실적 부하 (1편) |
| 에러율 무시하고 응답시간만 봄 | 잘못된 결론 (3편) |
| tolerance 를 너무 빡빡하게 | 거짓 실패로 신뢰 상실 |
| 기준선 갱신 안 함 | 실제 개선을 회귀로 오인 |
| 결과를 아티팩트에만 둠 | 아무도 안 봄 |
| 운영 환경에 무단 부하 | **사고** |

## 왜 채용시장이 요구하는가

- **"성능 테스트를 CI에 통합한 경험"** 은 성능 테스트 경험 중에서도 상위 역량이다. 대부분은 수동으로 한두 번 돌려본 수준이다.
- 면접 질문: **"성능 회귀를 어떻게 감지하셨나요?"** — 기준선 비교와 tolerance 설정을 말할 수 있으면 강하다.
- **CI 환경 노이즈를 먼저 측정하고 tolerance를 정한다**는 접근은 측정의 신뢰성을 아는 사람의 언어다.
- **역할 경계를 명확히 하고 범위를 좁혀 전달하는 것**은 협업 역량이고, 성능 테스트에서 특히 중요하다.
- **AI에게 성능 CI 워크플로를 시키면** 러너에서 앱과 부하를 함께 돌리는 구성을 자주 만든다. 그리고 tolerance 개념 없이 절대 threshold만 넣는다.

## 실습 과제

### 과제 1 — 노이즈 측정 (15분)

**tolerance를 정하기 전에 반드시 해야 할 일이다.**

같은 스크립트를 **코드 변경 없이 5회** 실행한다. (로컬 또는 CI)

| 회차 | p(95) | p(99) | RPS |
|---|---|---|---|
| 1 | | | |
| ... | | | |
| **편차** | ±__% | ±__% | ±__% |

측정한 편차를 근거로 **tolerance 값을 정하고 이유를 적는다.**

로컬과 CI에서 각각 측정해 **어느 쪽 노이즈가 큰지** 비교하면 더 좋다.

### 과제 2 — 스모크 워크플로 구현 (20분)

연습 저장소에 성능 스모크를 붙인다.

1. `tests/perf/smoke.js` 작성 (VU 3, 1분, threshold 포함)
2. `handleSummary` 로 `results/summary.json` 생성
3. 워크플로 작성 — PR 트리거
4. PR 코멘트로 결과 표시
5. **threshold 를 일부러 초과**시켜 PR 코멘트와 잡 실패를 확인
6. `continue-on-error` 를 제거하고 다시 실행 → **코멘트가 안 달리는 것** 확인

6번이 이 과제의 핵심이다. 트랙 3의 `if: always()` 와 같은 교훈이다.

### 과제 3 — 회귀 감지 스크립트 (18분)

`check-regression.mjs` 를 구현한다.

1. 기준선 파일을 만든다 (첫 실행 결과를 `baseline/` 에 저장)
2. 비교 스크립트 작성
3. **의도적으로 느려지게** 만든다 (스크립트에 `sleep` 을 추가하거나 더 무거운 엔드포인트 호출)
4. 회귀가 감지되는지 확인
5. tolerance 를 과제 1의 값으로 조정하고, **정상 변동은 통과하는지** 확인

4번과 5번 사이의 균형이 실무의 어려움이다.

### 과제 4 — 트리거별 구성 (15분)

하나의 워크플로에서 트리거에 따라 다른 테스트를 돌리도록 구성한다.

| 트리거 | 유형 | 파일 | 예상 소요 |
|---|---|---|---|
| pull_request | | | |
| push (main) | | | |
| schedule | | | |
| workflow_dispatch | 선택 가능 | | |

**cron 을 KST 기준으로 변환**해서 넣고, [crontab.guru](https://crontab.guru)로 검증한다. (트랙 3의 함정)

### 과제 5 — 추세 그래프 (15분)

`trend.csv` 를 누적해 간단한 추세 페이지를 만든다.

1. 여러 번 실행해 CSV 행을 쌓는다
2. CSV를 읽어 차트로 그리는 정적 HTML 작성 (CDN 차트 라이브러리 사용, 무료)
3. GitHub Pages 로 배포 (public 저장소는 무료)
4. **p95가 서서히 오르는 데이터를 인위적으로 넣어** 그래프에서 보이는지 확인

### 과제 6 — 역할 분담표 (10분)

본인 팀 상황에 맞춰 성능 테스트 역할 분담표를 작성한다.

각 항목에 **담당자와 산출물**을 적는다. 특히:
- QA가 개발팀에 전달할 때의 **형식**을 정한다
- "느립니다" 대신 무엇을 담을 것인가

### 과제 7 — AI 워크플로 검증 (12분)

AI 실습 도우미에 요청한다.

> k6 성능 테스트를 GitHub Actions에서 매일 실행하고, 이전 결과와 비교해 성능 회귀를 감지하는 워크플로를 작성하라.

| 확인 항목 | 결과 |
|---|---|
| **러너에서 앱과 부하를 함께 실행하려 하는가** | |
| 측정 환경 노이즈를 언급했는가 | |
| tolerance(허용 범위) 개념이 있는가, 절대값만 쓰는가 | |
| 기준선을 어떻게 관리할지 제시했는가 | |
| threshold 실패 시에도 리포트를 남기는가 | |
| cron이 UTC 기준으로 변환됐는가 | |
| 아티팩트 보관 기간을 추세 분석에 맞게 설정했는가 | |

**첫 두 항목이 핵심이다.** 측정 환경을 통제하지 않으면 나머지가 다 무의미해진다는 것을 AI는 대체로 언급하지 않는다.

## 자가 체크리스트

- [ ] 릴리즈 직전 한 번 돌리는 성능 테스트가 늦은 이유를 설명할 수 있다
- [ ] 트리거별로 성능 테스트 유형과 규모를 나눌 수 있다
- [ ] PR 단계의 목적이 측정이 아니라 명백한 회귀 차단임을 안다
- [ ] `handleSummary` 로 CI용 결과 파일을 생성할 수 있다
- [ ] `continue-on-error` + `exit 1` 로 리포트를 남기고 실패시킬 수 있다
- [ ] 절대 threshold만으로는 서서히 나빠지는 것을 못 잡는다는 것을 안다
- [ ] 기준선 대비 변화율로 회귀를 감지하는 스크립트를 만들 수 있다
- [ ] **tolerance 를 두는 이유**(측정 노이즈)를 설명할 수 있다
- [ ] 기준선 관리 방식 3가지의 장단점을 안다
- [ ] **CI 러너에서 앱과 부하를 함께 실행하면 안 되는 이유**를 안다
- [ ] 코드 변경 없이 여러 번 실행해 노이즈 수준을 먼저 측정한다
- [ ] 측정한 노이즈보다 큰 tolerance 를 설정한다
- [ ] 결과를 PR 코멘트·Slack·Pages 로 보이게 만들 수 있다
- [ ] 성능 테스트의 역할 분담을 정의하고 QA의 몫을 안다
- [ ] 병목 분석에서 QA가 범위를 좁혀 전달하는 형식을 쓸 수 있다
- [ ] 자주 하는 실수 8가지를 알고 피할 수 있다
- [ ] AI 성능 워크플로에서 환경 통제 누락과 tolerance 부재를 잡아낼 수 있다

## 참고 링크

- [k6 — CI/CD 통합](https://grafana.com/docs/k6/latest/misc/integrations/#continuous-integration-and-continuous-delivery) — 도구별 예제
- [k6 GitHub Action](https://github.com/grafana/setup-k6-action) — 공식 설치 액션
- [k6 — Results output](https://grafana.com/docs/k6/latest/results-output/) — 결과 내보내기 옵션
- [k6 jslib](https://jslib.k6.io/) — 무료 유틸리티 CDN (k6-summary 등)
- [crontab.guru](https://crontab.guru) — cron 검증
