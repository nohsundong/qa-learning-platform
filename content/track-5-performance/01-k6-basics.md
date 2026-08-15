---
id: t5-l01
title: 성능 테스트 기초와 k6 첫 스크립트
summary: VU·이터레이션·RPS의 관계부터 잡는다. 이걸 헷갈리면 부하를 잘못 걸고 결과를 잘못 읽는다.
minutes: 20
order: 1
tags: [k6, 성능테스트, VU, RPS, 부하]
---

## 개념 설명

### 성능 테스트가 답하는 질문

기능 테스트는 "되는가"를 묻고, 성능 테스트는 **"얼마나 견디는가"** 를 묻는다.

```text
□ 동시 사용자 1,000명일 때 응답시간이 얼마인가
□ 몇 명부터 에러가 나기 시작하는가
□ 프로모션 시작 순간의 트래픽 급증을 견디는가
□ 12시간 연속 운영하면 메모리가 새는가
□ 어느 구간이 병목인가 (DB? 외부 API? 애플리케이션?)
```

QA가 이걸 해야 하는 이유는 명확하다. **성능 문제는 기능 테스트로 절대 안 잡힌다.** 혼자 쓰면 다 잘 되기 때문이다. 그리고 성능 장애는 트랙 1의 리스크 표에서 **영향도 5점**짜리다 — 전체 사용자가 동시에 막힌다.

### k6 를 쓰는 이유

| | k6 | JMeter | Locust |
|---|---|---|---|
| 스크립트 | **JavaScript** | XML/GUI | Python |
| 리소스 사용 | 매우 효율적 (Go 기반) | 무거움 (JVM) | 보통 |
| 코드 관리 | git 친화적 | GUI 파일 관리 어려움 | git 친화적 |
| CI 연동 | 쉬움 | 가능하나 번거로움 | 쉬움 |
| 비용 | **오픈소스 무료** | 무료 | 무료 |

**JavaScript로 쓴다는 게 QA에게 결정적이다.** 트랙 3에서 Playwright로 익힌 언어를 그대로 쓴다. 그리고 스크립트가 코드라서 **PR 리뷰에 태울 수 있다.**

k6 자체는 **완전 무료 오픈소스**다. (Grafana Cloud k6 는 유료 SaaS지만 로컬 실행에는 필요 없다)

### 설치

```bash
# macOS
brew install k6

# Windows
winget install k6 --source winget

# Docker (설치 없이)
docker run --rm -i grafana/k6 run - < script.js
```

### 첫 스크립트

```javascript
// script.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,           // 가상 사용자 10명
  duration: '30s',   // 30초 동안
};

export default function () {
  const res = http.get('https://test.k6.io/');

  check(res, {
    '상태코드가 200이다': (r) => r.status === 200,
    '응답이 500ms 미만이다': (r) => r.timings.duration < 500,
  });

  sleep(1);          // 생각 시간 (think time)
}
```

```bash
k6 run script.js
```

**`export default function`** 이 각 가상 사용자가 반복 실행하는 코드다. k6는 이걸 **이터레이션(iteration)** 이라고 부른다.

### VU · 이터레이션 · RPS — 이 관계를 반드시 이해할 것

**여기서 대부분이 헷갈리고, 헷갈린 채로 부하를 걸면 결과가 무의미해진다.**

```text
VU (Virtual User)  — 동시에 돌아가는 가상 사용자 수
이터레이션          — default 함수가 한 번 실행되는 것
RPS (Requests/sec) — 초당 실제 요청 수
```

셋의 관계는 이렇다.

```text
RPS ≈ VU / (요청 처리 시간 + sleep 시간)
```

예를 들어 보자.

```text
VU = 10, sleep = 1초, 서버 응답 = 0.2초
→ 한 이터레이션에 1.2초
→ 초당 이터레이션 = 10 / 1.2 ≈ 8.3
→ 이터레이션당 요청 1개면 RPS ≈ 8.3
```

**중요한 함정**: 서버가 느려지면 RPS가 저절로 줄어든다.

```text
서버 응답이 0.2초 → 2초로 느려지면
→ 한 이터레이션에 3초
→ RPS ≈ 3.3 으로 떨어진다
```

**VU 를 고정하면 부하가 서버 성능에 따라 자동으로 줄어든다.** 이걸 **닫힌 모델(closed model)** 이라고 한다. 실제 사용자와 비슷하다 — 사람도 응답이 늦으면 다음 클릭을 늦게 한다.

반대로 **초당 요청 수를 고정**하는 방식도 있다. **열린 모델(open model)** 이다. 서버가 느려져도 요청은 계속 쏟아진다. 프로모션 트래픽, 배치 작업, API 게이트웨이를 통한 유입이 이 모델에 가깝다.

| | 닫힌 모델 (VU 고정) | 열린 모델 (RPS 고정) |
|---|---|---|
| k6 executor | `constant-vus`, `ramping-vus` | `constant-arrival-rate`, `ramping-arrival-rate` |
| 서버가 느려지면 | 부하도 줄어든다 | **부하가 그대로 쌓인다** |
| 실제 상황 | 웹 사용자 | 프로모션 오픈, 외부 API 호출 |
| 위험 | 진짜 한계를 못 본다 | 서버가 죽을 수 있다 |

**"동시 사용자 1,000명을 견디는가"** 와 **"초당 500건을 처리하는가"** 는 완전히 다른 질문이다. 요구사항이 어느 쪽인지 먼저 확인해야 한다.

### 생각 시간(think time)을 반드시 넣는다

```javascript
sleep(1);   // 또는 랜덤: sleep(Math.random() * 3 + 1);
```

`sleep` 이 없으면 각 VU가 쉬지 않고 요청을 날린다. **VU 10명이 초당 수백 건을 만들어낸다.** 실제 사용자는 그렇게 행동하지 않는다.

```text
sleep 없음: VU 10 → RPS 50 (비현실적)
sleep 1초:  VU 10 → RPS 8   (현실적)
```

**생각 시간 없이 측정한 결과는 "동시 사용자 N명"이라고 부를 수 없다.** 실제 사용자 행동 데이터가 있으면 그걸 쓰고, 없으면 페이지당 1~5초 랜덤이 무난하다.

### check 와 threshold 는 다르다 — 초보가 반드시 틀리는 것

```javascript
check(res, { '200이다': (r) => r.status === 200 });
```

**`check` 는 실패해도 테스트를 실패시키지 않는다.** 통계로만 집계된다. 종료 코드는 0이다.

```text
✗ 200이다
 ↳  87% — ✓ 870 / ✗ 130      ← 130건이 실패했는데 k6 는 성공 종료
```

CI에서 실패로 처리하려면 **threshold** 를 써야 한다. 3편에서 자세히 다루지만, 지금 알아둘 것은 이것이다.

```javascript
export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],      // 에러율 1% 미만
    http_req_duration: ['p(95)<500'],    // 95%가 500ms 미만
  },
};
```

**threshold 를 넘으면 k6가 종료 코드 99로 끝난다.** CI가 빌드를 실패시킬 수 있다.

**`check` 는 "무엇이 잘못됐는지 알려주는 것", `threshold` 는 "합격/불합격을 정하는 것"** 이다. 둘 다 쓴다.

### 결과 읽기 — 첫 화면

```text
     ✓ 상태코드가 200이다
     ✗ 응답이 500ms 미만이다
      ↳  92% — ✓ 276 / ✗ 24

     checks.........................: 96.00%  ✓ 576  ✗ 24
     data_received..................: 4.2 MB  140 kB/s
     http_req_blocked...............: avg=1.2ms   p(95)=0.01ms
     http_req_connecting............: avg=0.8ms   p(95)=0s
     http_req_duration..............: avg=213ms   p(95)=487ms
       { expected_response:true }...: avg=213ms   p(95)=487ms
     http_req_failed................: 0.00%   ✓ 0    ✗ 300
     http_req_receiving.............: avg=2.1ms   p(95)=5.3ms
     http_req_sending...............: avg=0.1ms   p(95)=0.2ms
     http_req_waiting...............: avg=211ms   p(95)=483ms
     http_reqs......................: 300     9.98/s
     iterations.....................: 300     9.98/s
     vus............................: 10      min=10 max=10
```

**핵심 지표 다섯 개만 먼저 본다.**

| 지표 | 의미 |
|---|---|
| `http_req_duration` | **전체 응답시간.** 가장 중요. p(95)를 본다 |
| `http_req_failed` | **에러율.** 0%가 아니면 왜인지 봐야 한다 |
| `http_reqs` | 처리량 (RPS) |
| `checks` | 검증 통과율 |
| `vus` | 실제로 돌아간 VU 수 |

**`http_req_waiting` 이 진단에 유용하다.** 이건 요청을 보내고 첫 바이트를 받기까지의 시간(TTFB)이다.

```text
http_req_duration = blocked + connecting + tls + sending + waiting + receiving

waiting 이 대부분 → 서버 처리가 느리다 (백엔드 문제)
connecting 이 크다 → 네트워크 또는 커넥션 풀 문제
receiving 이 크다 → 응답 크기가 크거나 대역폭 문제
```

트랙 2에서 배운 로그·모니터링과 결합하면 **어느 구간이 병목인지** 좁힐 수 있다.

### 실전에 가까운 스크립트

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // 30초에 걸쳐 20 VU 까지 증가
    { duration: '1m',  target: 20 },   // 1분 유지
    { duration: '30s', target: 0 },    // 30초에 걸쳐 감소
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE = __ENV.BASE_URL || 'https://test.k6.io';

export default function () {
  group('메인 페이지', () => {
    const res = http.get(`${BASE}/`);
    check(res, { '200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  group('로그인', () => {
    const res = http.post(`${BASE}/login`, {
      login: 'testuser',
      password: 'testpass',
    });
    check(res, {
      '로그인 성공': (r) => r.status === 200,
      '세션 쿠키 발급': (r) => r.cookies['session'] !== undefined,
    });
  });

  sleep(Math.random() * 3 + 2);
}
```

**`group`** 으로 묶으면 결과가 구간별로 집계된다. 어느 화면이 느린지 바로 보인다.

**`__ENV.BASE_URL`** 로 환경을 분리한다. 트랙 3의 `baseURL` 과 같은 원리다.

### 시작 전에 반드시 확인할 것

성능 테스트는 **서비스를 죽일 수 있다.** 기능 테스트와 위험도가 다르다.

```text
□ 운영 환경에 부하를 걸지 않는다 (허가 없이는 절대)
□ 스테이징이 운영과 비슷한 사양인가 확인 — 다르면 결과를 그대로 못 쓴다
□ 부하를 거는 시간대를 팀에 공지 (다른 사람이 테스트 중일 수 있다)
□ 외부 연동(결제 PG, SMS)이 실제로 호출되는지 확인 — 비용이 나갈 수 있다
□ 테스트 데이터가 운영 데이터를 오염시키지 않는지 (트랙 2의 접두어 규칙)
□ 모니터링 대시보드를 함께 열어둔다 (트랙 2)
□ 중단 방법을 미리 확인 (Ctrl+C, 또는 CI 취소)
```

**"외부 연동 실제 호출"** 은 실제로 사고가 난다. 부하 테스트로 SMS를 10만 건 발송하면 비용이 청구된다. 목킹하거나 스텁 환경을 쓴다.

## 왜 채용시장이 요구하는가

- **"성능 테스트 경험"** 은 QA 공고에서 자동화 다음으로 자주 요구된다. 특히 트래픽이 큰 서비스는 필수로 본다.
- 면접 질문: **"동시 사용자 1,000명 테스트를 어떻게 설계하시겠어요?"** — VU와 RPS의 관계, 생각 시간, 열린/닫힌 모델을 말할 수 있어야 한다.
- **`check` 와 `threshold` 의 차이**를 모르면 "성능 테스트를 CI에 붙였는데 항상 통과한다"는 상황이 된다. 실제로 흔한 실수다.
- **성능 문제는 기능 테스트로 안 잡힌다**는 것을 이해하고, 별도 활동으로 계획할 수 있는지가 시니어 판별 기준이다.
- **AI에게 k6 스크립트를 시키면 `sleep` 을 빠뜨리고 `threshold` 없이 `check` 만 넣는다.** 그러면 비현실적인 부하로 항상 통과하는 테스트가 된다.

## 실습 과제

### 과제 1 — 설치하고 첫 실행 (12분)

k6를 설치하고 공식 테스트 사이트로 실행한다. **`https://test.k6.io` 는 k6 팀이 부하 테스트 연습용으로 제공하는 무료 사이트다.**

1. 위의 첫 스크립트를 그대로 실행
2. 결과에서 5개 핵심 지표를 찾아 적기
3. `http_req_duration` 과 `http_req_waiting` 의 차이를 확인

### 과제 2 — VU와 RPS 관계 실증 (15분)

같은 스크립트를 조건만 바꿔 4번 실행하고 표를 채운다.

| 조건 | 예상 RPS | 실제 RPS | 이터레이션 수 |
|---|---|---|---|
| VU 10, sleep 1초 | | | |
| VU 10, sleep 없음 | | | |
| VU 20, sleep 1초 | | | |
| VU 10, sleep 3초 | | | |

**"예상"을 먼저 계산하고 실행한다.** 공식 `RPS ≈ VU / (응답시간 + sleep)` 이 맞는지 확인한다.

`sleep` 없는 경우의 RPS를 보고 **왜 이게 비현실적인지** 메모에 적는다.

### 과제 3 — check vs threshold (12분)

1. `check` 만 있는 스크립트를 만들고, **일부러 실패하게** 한다 (응답시간 기준을 1ms로)
2. 실행 후 종료 코드 확인: `echo $?` → **0이 나온다**
3. `thresholds` 를 추가하고 다시 실행
4. 종료 코드 확인 → **99가 나온다**
5. CI에서 이 차이가 무엇을 의미하는지 메모에 적기

**직접 종료 코드를 확인하는 것**이 이 과제의 핵심이다.

### 과제 4 — 구간별 병목 찾기 (15분)

여러 엔드포인트를 `group` 으로 묶어 호출하는 스크립트를 작성한다.

```javascript
group('빠른 API', () => { http.get(`${BASE}/`); });
group('느린 API', () => { http.get(`${BASE}/contacts.php`); });
```

`test.k6.io` 에는 의도적으로 느린 엔드포인트들이 있다. 결과에서:

| group | p(95) | waiting | 병목 추정 |
|---|---|---|---|
| | | | |

**`http_req_waiting` 비중이 큰 것**을 찾아 서버 처리가 느린 구간을 특정한다.

### 과제 5 — 안전 점검표 작성 (10분)

본인 팀 환경에 맞춘 **성능 테스트 사전 점검표**를 작성한다.

- 어느 환경에서 돌릴 것인가 (운영과 사양 차이는?)
- 외부 연동 중 실제 호출되면 안 되는 것 목록
- 공지 대상과 방법
- 중단 절차
- 테스트 데이터 정리 방법

### 과제 6 — AI k6 스크립트 검증 (12분)

AI 실습 도우미에 요청한다.

> 쇼핑몰 로그인 → 상품 조회 → 장바구니 담기 흐름을 동시 사용자 50명으로 테스트하는 k6 스크립트를 작성하라.

| 확인 항목 | 결과 |
|---|---|
| `sleep`(생각 시간)이 있는가 | |
| `thresholds` 가 있는가, `check` 만 있는가 | |
| VU 50 + sleep 없음이면 실제 RPS가 얼마가 되는지 계산해 보기 | |
| 환경 URL을 하드코딩했는가 | |
| 실제로 존재하는 k6 API를 썼는가 (환각) | |
| 외부 연동 목킹을 언급했는가 | |

**`sleep` 누락과 `threshold` 누락이 거의 항상 나온다.** 두 개를 고쳐서 실행 결과가 어떻게 달라지는지 비교한다.

## 자가 체크리스트

- [ ] 성능 문제가 기능 테스트로 잡히지 않는 이유를 설명할 수 있다
- [ ] k6가 JavaScript 기반이고 오픈소스 무료라는 것을 안다
- [ ] VU·이터레이션·RPS의 관계를 공식으로 설명할 수 있다
- [ ] 서버가 느려지면 VU 고정 시 RPS가 줄어든다는 것을 안다
- [ ] 닫힌 모델과 열린 모델의 차이와 각각의 실제 상황을 구분할 수 있다
- [ ] "동시 사용자 N명"과 "초당 N건"이 다른 요구사항임을 안다
- [ ] 생각 시간(sleep)이 없으면 결과가 비현실적이 되는 이유를 설명할 수 있다
- [ ] **`check` 는 테스트를 실패시키지 않고 `threshold` 가 실패시킨다**는 것을 안다
- [ ] threshold 초과 시 k6가 종료 코드 99를 반환한다는 것을 안다
- [ ] 핵심 지표 5개(duration, failed, reqs, checks, vus)를 읽을 수 있다
- [ ] `http_req_duration` 의 구성 요소를 알고 `waiting` 으로 서버 병목을 판단한다
- [ ] `stages` 로 램프업·유지·램프다운을 구성할 수 있다
- [ ] `group` 으로 구간별 성능을 분리 측정할 수 있다
- [ ] `__ENV` 로 환경을 분리할 수 있다
- [ ] 성능 테스트 사전 점검 7가지를 확인한 뒤 실행한다
- [ ] 외부 연동이 실제 호출되어 비용이 발생할 수 있음을 안다
- [ ] AI가 만든 k6 스크립트에서 sleep·threshold 누락을 잡아낼 수 있다

## 참고 링크

- [k6 공식 문서](https://grafana.com/docs/k6/latest/) — API 존재 확인 (환각 검증)
- [test.k6.io](https://test.k6.io) — k6 팀이 제공하는 무료 연습 사이트
- [k6 — Metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/) — 내장 지표 전체 목록
- [k6 — Open vs closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) — 열린/닫힌 모델
- [k6 — Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) — 3편에서 자세히 다룬다
