---
id: t2-l02
title: API 테스트 (1) — HTTP 기초와 Postman 응답 검증
summary: 화면 없이 서버를 직접 두드려 본다. 상태코드·헤더·바디를 무엇을 기준으로 검증할지 정하고 Postman 테스트 스크립트로 옮긴다.
minutes: 20
order: 2
tags: [API테스트, Postman, HTTP, 상태코드, Insomnia]
---

## 개념 설명

### 왜 UI가 아니라 API를 테스트하는가

같은 결함을 API에서 잡으면 UI에서 잡는 것보다 **빠르고, 안정적이고, 원인이 명확하다.**

| | UI 테스트 | API 테스트 |
|---|---|---|
| 실행 속도 | 수십 초 | 수십 밀리초 |
| 깨지는 원인 | 렌더링, 애니메이션, 셀렉터 변경 | 계약(스펙) 변경 |
| 결함 위치 | 프론트인지 백엔드인지 불명확 | 백엔드로 특정됨 |
| 만들 수 있는 상황 | 화면에서 가능한 것만 | **화면에서 불가능한 요청도 가능** |

마지막 행이 핵심이다. **UI는 잘못된 입력을 막는다. 그래서 UI로만 테스트하면 서버 검증이 없는 것을 발견할 수 없다.**

트랙 1의 상태전이 레슨에서 "불가 전이를 API로 직접 호출해 확인하라"고 했던 게 이것이다. 버튼을 숨겨놓고 서버 검증을 빼먹은 코드는 **UI 테스트를 아무리 돌려도 통과한다.** 그리고 운영에서 뚫린다.

### HTTP 요청의 구조

```http
POST /api/v1/orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 8f14e45f-ceea-467a-9e1e-3a2b1c0d9f77

{
  "productId": 10023,
  "quantity": 2,
  "couponCode": "WELCOME10"
}
```

| 구성 | QA가 봐야 할 것 |
|---|---|
| 메서드 | GET은 조회만(부수효과 없어야 함), POST는 생성, PUT/PATCH는 수정, DELETE는 삭제 |
| 경로 | 버전(`/v1/`), 리소스 이름, path 파라미터 |
| 헤더 | 인증, Content-Type, 그리고 **커스텀 헤더** |
| 바디 | 필드명·타입·필수 여부 |

`Idempotency-Key` 같은 헤더가 보이면 **"같은 요청을 두 번 보내면 어떻게 되는가"** 를 반드시 테스트해야 한다는 신호다. 결제 중복 방지 장치이므로, 이게 실제로 동작하는지 확인하는 건 QA의 일이다.

### 상태코드 — 외우지 말고 분류로 이해한다

```text
2xx 성공     200 OK / 201 Created / 204 No Content
3xx 리다이렉트 301 영구이동 / 302 임시 / 304 Not Modified(캐시)
4xx 클라이언트 잘못  ← 요청을 고쳐야 함
5xx 서버 잘못        ← 서버를 고쳐야 함
```

**4xx / 5xx 구분이 실무에서 가장 중요하다.** 잘못된 입력을 보냈는데 서버가 500을 주면 그 자체가 결함이다. "검증하지 않고 그냥 터진 것"이기 때문이다.

QA가 자주 마주치는 4xx들.

| 코드 | 의미 | 이 코드가 나와야 정상인 상황 |
|---|---|---|
| 400 Bad Request | 요청 형식이 잘못됨 | 필수 필드 누락, 타입 오류 |
| 401 Unauthorized | **인증 안 됨** | 토큰 없음, 만료된 토큰 |
| 403 Forbidden | **인증은 됐으나 권한 없음** | 남의 주문 조회 시도 |
| 404 Not Found | 리소스 없음 | 존재하지 않는 ID |
| 409 Conflict | 상태 충돌 | 이미 취소된 주문을 또 취소 |
| 422 Unprocessable | 형식은 맞으나 의미가 틀림 | 수량 -1, 과거 날짜 예약 |
| 429 Too Many Requests | 요청 과다 | 레이트 리밋 동작 확인 |

**401과 403의 구분**은 면접 단골이다. "너 누구야"(401)와 "너인 건 알겠는데 안 돼"(403)의 차이다.

**보안 관점의 함정**: 남의 데이터를 조회했을 때 404를 주는 게 나은가 403이 나은가? 403을 주면 **"그 ID는 존재한다"는 정보가 새어나간다.** 민감한 리소스는 일부러 404를 주기도 한다. 이런 판단이 있었는지 확인하는 것도 QA의 몫이다.

### 무엇을 검증할 것인가 — 4개 층

응답을 받았을 때 볼 것을 층으로 나눠 두면 빠뜨리지 않는다.

```text
1층 상태코드   기대한 코드가 왔는가
2층 헤더       Content-Type, 캐시 정책, 보안 헤더, 커스텀 헤더
3층 바디 구조  필드가 다 있는가, 타입이 맞는가, null 허용 여부
4층 바디 값    비즈니스 규칙대로 계산됐는가  ← 여기가 진짜 검증
```

**대부분의 사람이 1층에서 멈춘다.** `200 OK`가 왔다고 통과 처리하는 테스트는 사실상 "서버가 살아있다"만 확인한 것이다.

4층의 예를 들면 이렇다.

```text
주문 생성 응답에서 확인할 것
  □ status = "PENDING" (생성 직후 상태가 맞는가)
  □ totalAmount = 상품가격 × 수량 - 할인액   ← 직접 계산해서 비교
  □ couponApplied = true 이고 discountAmount > 0
  □ createdAt 이 현재 시각과 몇 초 이내인가
  □ orderId 형식이 규칙에 맞는가
  □ 응답에 내부 정보(내부 사용자 ID, SQL 오류, 스택 트레이스)가 새지 않는가
```

마지막 항목은 보안 검증이다. 에러 응답에 스택 트레이스가 그대로 나오는 서비스가 실제로 흔하다.

### Postman 사용 흐름

**컬렉션 → 폴더 → 요청** 구조로 정리한다. 폴더는 기능 단위로 나눈다.

```text
[컬렉션] 이커머스 API
 ├─ 00_auth
 │   └─ 로그인 (토큰 발급)
 ├─ 01_products
 │   ├─ 상품 목록 조회
 │   └─ 상품 상세 조회
 └─ 02_orders
     ├─ 주문 생성
     ├─ 주문 조회
     └─ 주문 취소
```

**환경(Environment) 변수**로 서버 주소와 토큰을 분리한다. 이걸 안 하면 스테이징과 운영을 오갈 때마다 URL을 다 고쳐야 한다.

```text
{{baseUrl}}   → https://staging-api.example.com
{{token}}     → (로그인 요청이 자동으로 채운다)
{{orderId}}   → (주문 생성이 자동으로 채운다)
```

로그인 응답에서 토큰을 꺼내 변수에 저장하는 스크립트를 **Scripts(Post-response)** 탭에 넣는다.

```javascript
// 로그인 요청의 응답 후 스크립트
const body = pm.response.json();
pm.environment.set("token", body.accessToken);
```

이후 요청들의 Authorization 헤더에 `Bearer {{token}}` 을 쓰면 토큰이 자동으로 흐른다.

### Postman 테스트 스크립트 — 4개 층을 코드로

```javascript
// 주문 생성 요청의 Post-response 스크립트
const body = pm.response.json();

// 1층 — 상태코드
pm.test("201 Created 로 응답한다", () => {
  pm.response.to.have.status(201);
});

// 2층 — 헤더
pm.test("JSON 으로 응답한다", () => {
  pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});

// 3층 — 바디 구조와 타입
pm.test("응답에 필수 필드가 모두 있다", () => {
  pm.expect(body).to.have.property("orderId").that.is.a("string");
  pm.expect(body).to.have.property("status").that.is.a("string");
  pm.expect(body).to.have.property("totalAmount").that.is.a("number");
});

// 4층 — 비즈니스 규칙 (여기가 핵심)
pm.test("10% 쿠폰이 적용된 금액이 맞다", () => {
  const expected = Math.floor(body.unitPrice * body.quantity * 0.9);
  pm.expect(body.totalAmount).to.eql(expected);
});

pm.test("생성 직후 상태는 PENDING 이다", () => {
  pm.expect(body.status).to.eql("PENDING");
});

pm.test("응답에 내부 정보가 노출되지 않는다", () => {
  const raw = pm.response.text();
  pm.expect(raw).to.not.include("SQLException");
  pm.expect(raw).to.not.include("internalUserId");
});

// 다음 요청을 위해 orderId 를 넘긴다
pm.environment.set("orderId", body.orderId);
```

**가짜 통과를 만드는 안티패턴**을 조심한다. 트랙 6에서 다시 다룬다.

```javascript
// 나쁨 — 200 이든 400 이든 통과한다
pm.test("응답 받음", () => {
  pm.expect(pm.response.code).to.be.oneOf([200, 201, 400, 404]);
});

// 나쁨 — 아무것도 검증하지 않는다
pm.test("주문 생성", () => {
  pm.expect(body).to.be.an("object");
});
```

### Insomnia · Bruno — 대안

| 도구 | 특징 | 비용 |
|---|---|---|
| Postman | 사실상 표준. 팀 기능·모니터·목서버 풍부 | 개인 무료 티어 |
| Insomnia | 가볍고 UI가 단순. GraphQL 지원이 좋다 | 무료 티어 |
| Bruno | **컬렉션을 파일로 저장** → git 으로 버전관리·PR 리뷰 가능. 오프라인 우선 | 오픈소스 |

Bruno의 "컬렉션이 그냥 파일"이라는 점은 실무에서 꽤 큰 장점이다. **API 테스트를 코드 리뷰에 태울 수 있다.**

## 왜 채용시장이 요구하는가

- **API 테스트는 QA 채용공고에서 자동화 다음으로 자주 등장한다.** Postman 사용 경험은 거의 필수 항목이다.
- 면접에서 **"UI 테스트로는 못 잡고 API 테스트로만 잡을 수 있는 결함의 예를 들어보세요"** 가 나온다. 답은 "UI에서 막아둔 요청을 서버가 검증하지 않는 경우"다.
- **401 / 403 / 404 구분**, **4xx vs 5xx 판단**은 개발자와 대화하는 최소 어휘다. 이게 안 되면 "프론트 문제인지 백엔드 문제인지" 스스로 판단할 수 없다.
- **AI가 만든 API 테스트의 대부분이 1층에서 멈춘다.** 상태코드만 확인하고 통과시키는 테스트를 대량 생산한다. 4층 검증이 있는지 확인하는 게 사람의 일이다.

## 실습 과제

### 과제 1 — 공개 API로 4층 검증 연습 (15분)

무료 연습용 API를 쓴다. 회원가입도 필요 없다.

- `https://httpbin.org` — 요청을 그대로 되돌려준다. 헤더·상태코드 실험에 최적
- `https://jsonplaceholder.typicode.com` — 가짜 REST API (posts, users, comments)

Postman에 컬렉션을 만들고 다음을 수행한다.

1. `GET https://jsonplaceholder.typicode.com/posts/1` — 4개 층 각각에 테스트 1개씩 작성
2. `GET .../posts/9999` — 존재하지 않는 ID. **어떤 상태코드가 오는가?** 기대와 다르면 왜 그런지 적기
3. `POST .../posts` 로 생성 요청 후 응답 검증
4. `https://httpbin.org/status/500` 을 호출해 5xx 응답을 받아보고, 이런 응답이 왔을 때 QA가 무엇을 해야 하는지 메모에 적기

### 과제 2 — 환경 변수와 토큰 자동 흐름 (12분)

`https://httpbin.org/post` 를 로그인이라고 가정하고 연습한다.

1. Environment를 만들고 `baseUrl` 변수 설정
2. 요청 A의 응답에서 값을 꺼내 `pm.environment.set()` 으로 저장
3. 요청 B에서 `{{변수}}` 로 그 값을 사용
4. **요청 순서를 바꿔서 실행**해 보고 무엇이 깨지는지 확인 — 이게 다음 레슨의 "테스트 간 의존성" 문제다

### 과제 3 — 서버 검증 뚫기 시나리오 설계 (10분)

본인이 아는 서비스의 기능 하나를 골라, **UI로는 불가능하지만 API로는 가능한 요청 5개**를 설계한다.

| # | UI 제약 | API로 우회하는 요청 | 서버가 막아야 할 것 |
|---|---|---|---|
| 1 | 수량 입력이 1~10으로 제한됨 | `quantity: 9999` 또는 `-1` | 422 반환 |
| 2 | 배송중 주문은 취소 버튼이 없음 | 취소 API 직접 호출 | 409 반환 |
| 3 | | | |

이 표가 곧 **보안·무결성 TC 목록**이 된다.

### 과제 4 — AI가 만든 API 테스트 채점 (10분)

AI 실습 도우미에 아래를 요청한다.

> 주문 생성 API(`POST /api/v1/orders`, 요청 필드 productId·quantity·couponCode, 응답 필드 orderId·status·unitPrice·quantity·discountAmount·totalAmount)에 대한 Postman 테스트 스크립트를 작성하라.

받은 코드를 **4개 층 기준으로 채점**한다.

| 층 | 있는가 | 비고 |
|---|---|---|
| 1층 상태코드 | | |
| 2층 헤더 | | |
| 3층 구조·타입 | | |
| 4층 비즈니스 계산 | | ← 여기가 대체로 비어 있다 |
| 가짜 통과 안티패턴 | | `oneOf([200,400])` 같은 것 |
| 존재하지 않는 pm API 사용 | | 환각 점검 |

## 자가 체크리스트

- [ ] UI 테스트로는 잡을 수 없고 API 테스트로만 잡히는 결함의 유형을 설명할 수 있다
- [ ] HTTP 요청의 4요소(메서드·경로·헤더·바디)를 구분하고 각각에서 볼 것을 안다
- [ ] 4xx와 5xx의 의미 차이와, 잘못된 입력에 5xx가 오면 그 자체가 결함인 이유를 안다
- [ ] 401과 403의 차이를 설명할 수 있다
- [ ] 민감 리소스에서 403 대신 404를 주는 이유(존재 여부 노출 방지)를 설명할 수 있다
- [ ] 409와 422가 나와야 정상인 상황을 각각 예로 들 수 있다
- [ ] 응답 검증을 상태코드·헤더·구조·값 4개 층으로 나눠 설계할 수 있다
- [ ] 4층(비즈니스 값) 검증을 직접 계산해서 비교하는 코드로 쓸 수 있다
- [ ] 에러 응답에 스택 트레이스·내부 ID가 노출되는지 확인한다
- [ ] Postman 환경 변수로 baseUrl·토큰을 분리하고 응답값을 다음 요청에 넘길 수 있다
- [ ] `oneOf([200, 400])` 같은 가짜 통과 패턴을 알아보고 거부할 수 있다
- [ ] Idempotency-Key 헤더를 보면 중복 요청 테스트가 필요하다고 판단할 수 있다

## 참고 링크

- [Postman Learning Center — Writing Tests](https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/) — pm API 공식 문서. 환각 검증할 때 여기서 확인한다
- [MDN — HTTP 상태 코드](https://developer.mozilla.org/ko/docs/Web/HTTP/Status) — 한국어. 코드별 정확한 의미
- [httpbin.org](https://httpbin.org) — 무료 HTTP 요청 테스트 서버
- [JSONPlaceholder](https://jsonplaceholder.typicode.com) — 무료 가짜 REST API
- [Bruno](https://www.usebruno.com/) — 컬렉션을 파일로 관리하는 오픈소스 API 클라이언트
