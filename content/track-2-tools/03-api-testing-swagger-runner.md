---
id: t2-l03
title: API 테스트 (2) — Swagger 읽기와 컬렉션 러너·CI 연동
summary: OpenAPI 명세를 TC의 근거로 삼는 법. 그리고 컬렉션을 Newman으로 CI에서 자동 실행해 리포트를 받는다.
minutes: 20
order: 3
tags: [Swagger, OpenAPI, Newman, 컬렉션러너, CI]
---

## 개념 설명

### Swagger / OpenAPI 는 QA에게 무엇인가

OpenAPI 명세(흔히 Swagger라고 부른다)는 **API의 계약서**다. QA 입장에서 이건 세 가지 의미를 갖는다.

1. **TC의 근거 문서** — 요구사항 명세가 부실해도 여기엔 필드·타입·필수 여부가 적혀 있다
2. **명세 결함을 찾는 대상** — 명세 자체가 틀렸거나 비어 있는 곳이 결함이다
3. **테스트 자동 생성의 입력** — AI에게 명세를 주면 TC 초안을 뽑을 수 있다 (트랙 4)

### 명세에서 무엇을 읽어야 하나

```yaml
paths:
  /orders:
    post:
      summary: 주문 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [productId, quantity]        # ← 필수 필드
              properties:
                productId:
                  type: integer
                quantity:
                  type: integer
                  minimum: 1
                  maximum: 10                        # ← 경계값이 여기 있다
                couponCode:
                  type: string
                  nullable: true                     # ← null 허용
      responses:
        '201': { description: 생성됨 }
        '400': { description: 잘못된 요청 }
        '409': { description: 재고 부족 }
        # '401' 없음 ← 인증 실패 시 동작이 정의되지 않았다
```

**QA가 이 명세에서 뽑아내는 것들**

| 명세의 항목 | 여기서 나오는 TC |
|---|---|
| `required: [productId, quantity]` | 각 필수 필드를 하나씩 뺀 요청 → 400 |
| `minimum: 1, maximum: 10` | 0, 1, 10, 11 → **경계값 4건** |
| `type: integer` | 문자열 `"2"`, 소수 `2.5`, null 투입 |
| `nullable: true` | null 을 넣었을 때와 필드를 아예 뺐을 때가 **같게 동작하는가** |
| 정의된 응답 코드 목록 | 각 코드가 실제로 그 상황에서 오는가 |
| **정의되지 않은 응답 코드** | 401은 어떻게 되나? 429는? → **명세 결함으로 제기** |

마지막 행이 QA의 부가가치다. **명세에 없는 것을 찾는 것**이 명세를 읽는 목적이다.

명세에서 자주 발견되는 결함들.

- 응답 예시(`example`)의 값이 실제 응답과 다르다
- `required` 로 표시됐는데 실제로는 없어도 통과한다 (또는 그 반대)
- 에러 응답의 스키마가 정의돼 있지 않다 → 프론트가 에러 처리를 못 한다
- 페이징 파라미터의 최대값이 없다 → `size=100000` 을 보내면 서버가 죽는다
- 날짜 형식이 명시되지 않았다 → 프론트와 백엔드가 다른 포맷을 가정한다

### Swagger UI 로 바로 실험하기

Swagger UI 화면의 **Try it out** 버튼으로 브라우저에서 즉시 호출할 수 있다. 별도 도구 없이 명세를 보면서 바로 찔러볼 수 있어서, **탐색적 API 테스트에 가장 빠른 경로**다.

여기서 유용한 습관 하나. Try it out 으로 요청을 보내면 Swagger UI가 **동등한 curl 명령**을 보여준다. 그걸 복사해 두면 결함 리포트의 재현 절차로 그대로 붙여넣을 수 있다.

```bash
curl -X POST "https://api.example.com/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ..." \
  -d '{"productId": 10023, "quantity": 11}'
```

**결함 리포트에 curl 한 줄이 들어가면 개발자의 재현 시간이 0에 수렴한다.** 트랙 1의 결함 리포트 레슨과 이어지는 지점이다. (단, 토큰은 마스킹하거나 별도로 전달한다)

### OpenAPI 명세를 Postman 컬렉션으로 가져오기

Postman은 OpenAPI 파일(JSON/YAML)이나 URL을 **Import** 하면 모든 엔드포인트를 컬렉션으로 만들어 준다. 요청을 손으로 하나씩 만들 필요가 없다.

주의할 점: 자동 생성된 요청의 바디는 **명세의 example 값**이다. 실제로 동작하는 값이 아닐 수 있다. 그대로 실행하면 대부분 400이 난다. 이건 도구 문제가 아니라 **명세의 example이 최신이 아니라는 신호**이므로, 발견하면 결함으로 남긴다.

### 컬렉션 러너 — 순서와 의존성

컬렉션 전체를 순서대로 실행하는 기능이다. 여기서 실무의 핵심 문제가 나온다.

```text
로그인 → 주문 생성 → 주문 조회 → 주문 취소
  토큰      orderId      확인       정리
```

이 흐름은 **앞 요청이 실패하면 뒤가 전부 무너진다.** 자동화 테스트의 고질병인 **테스트 간 의존성**이다.

| 전략 | 장점 | 단점 |
|---|---|---|
| 순차 의존 (위 방식) | 실제 사용자 흐름과 같다 | 하나 깨지면 연쇄 실패, 원인 파악 어려움 |
| 각 테스트가 자기 데이터를 준비 | 독립 실행 가능, 병렬 가능 | 준비 코드 중복, 느림 |
| 사전 준비 데이터 고정 | 빠름 | 데이터가 오염되면 전부 실패 |

실무에서는 **시나리오 단위로 묶고, 시나리오끼리는 독립**시키는 절충을 쓴다. "주문 흐름"은 순차로 두되, "주문 흐름"과 "쿠폰 흐름"은 서로 의존하지 않게 한다.

**정리(cleanup)를 반드시 넣는다.** 테스트가 만든 주문을 취소하지 않으면 실행할 때마다 데이터가 쌓이고, 결국 다른 테스트가 깨진다.

Postman에서 흐름을 제어하는 함수도 있다.

```javascript
// 재고가 없으면 이후 요청을 건너뛴다
if (pm.response.code === 409) {
  postman.setNextRequest(null);   // 실행 중단
}

// 조건에 따라 특정 요청으로 점프
postman.setNextRequest("주문 취소");
```

### Newman — CI에서 컬렉션 자동 실행

Newman은 **Postman 컬렉션을 커맨드라인에서 실행**하는 공식 CLI다. 무료이고, 이게 있어야 API 테스트가 CI에 들어간다.

```bash
npm install -g newman newman-reporter-htmlextra

newman run collection.json \
  -e staging.postman_environment.json \
  --reporters cli,junit,htmlextra \
  --reporter-junit-export results/junit.xml \
  --reporter-htmlextra-export results/report.html
```

- `junit.xml` — CI 도구가 읽어서 테스트 결과 탭에 표시한다
- `htmlextra` — 사람이 보는 리포트. 실패한 요청의 request/response 원문이 다 들어있다

**GitHub Actions 에서 돌리기** (public 저장소는 무제한 무료)

```yaml
name: API Tests

on:
  pull_request:
  schedule:
    - cron: '0 22 * * 0-4'   # UTC 22시 = KST 평일 07시

jobs:
  api-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Newman 설치
        run: npm install -g newman newman-reporter-htmlextra

      - name: 컬렉션 실행
        run: |
          newman run tests/api/collection.json \
            -e tests/api/staging.env.json \
            --env-var "apiKey=$API_KEY" \
            --reporters cli,junit,htmlextra \
            --reporter-junit-export results/junit.xml \
            --reporter-htmlextra-export results/report.html
        env:
          API_KEY: ${{ secrets.API_KEY }}

      - name: 리포트 업로드
        if: always()          # 실패해도 리포트는 남긴다
        uses: actions/upload-artifact@v4
        with:
          name: newman-report
          path: results/
```

두 가지를 눈여겨본다.

- **`env` 와 `secrets`** — API 키를 컬렉션 파일에 넣으면 저장소에 커밋된다. 반드시 Secrets 로 분리하고 `--env-var` 로 주입한다
- **`if: always()`** — 이게 없으면 테스트 실패 시 리포트 업로드 단계가 건너뛰어져서 **정작 실패했을 때 원인을 볼 수 없다.** 실무에서 자주 하는 실수다

### API 테스트를 어디까지 자동화할 것인가

전부 자동화하는 게 답은 아니다. 판단 기준은 트랙 3에서 자세히 다루지만, API 한정으로 보면 이렇다.

| 자동화 우선순위 | 대상 |
|---|---|
| 높음 | 인증, 핵심 트랜잭션(주문·결제), 권한 검증, 계약(스키마) 검증 |
| 중간 | 경계값·유효성 검증 (변경이 잦지 않은 것) |
| 낮음 | 자주 바뀌는 신규 기능, 외부 연동에 강하게 의존하는 흐름 |

**권한 검증은 반드시 자동화한다.** 사람이 매번 "남의 주문 조회해 보기"를 손으로 하지 않게 되고, 그러면 언젠가 뚫린다.

## 왜 채용시장이 요구하는가

- 채용공고에 "Swagger 기반 API 테스트", "API 문서 이해" 가 자주 등장한다. **명세를 읽고 TC를 뽑는 능력**을 묻는 것이다.
- **Newman + CI 연동 경험은 변별력이 크다.** Postman으로 수동 호출만 해본 사람과, CI에 붙여 매일 자동 실행되게 만든 사람은 다른 등급으로 평가된다. 트랙 3의 CI/CD 연동과 이어진다.
- **API 명세는 AI 테스트 생성의 가장 좋은 입력**이다. 트랙 4에서 명세와 PR diff를 넣어 TC를 생성하는 실습을 하는데, 그때 "명세의 어디가 비어 있는지" 알아야 AI 출력의 빈틈이 보인다.
- AI에게 OpenAPI 명세를 주면 TC를 잘 만든다. 다만 **명세에 없는 응답 코드나 제약을 물어보는 일은 하지 않는다.** 그 질문이 사람의 몫이다.

## 실습 과제

### 과제 1 — Swagger 명세에서 TC 뽑기 (15분)

무료 공개 명세로 연습한다. **Swagger Petstore** (`https://petstore3.swagger.io`) 는 Try it out 까지 되는 공식 데모다.

1. `POST /pet` 의 요청 스키마를 열어 필수 필드와 타입을 확인
2. 명세만 보고 TC 12건을 설계 — 필수 필드 누락, 타입 오류, 경계값, 정의된 응답 코드별로
3. **명세에 정의되지 않은 상황 3개**를 찾아 질문 목록으로 정리
   (예: 인증 실패 시 응답은? 같은 pet을 두 번 등록하면? 이름에 이모지를 넣으면?)
4. Try it out 으로 3개를 실제 호출해 보고, **명세와 실제 동작이 다른 곳**을 찾는다

### 과제 2 — OpenAPI → Postman 컬렉션 (10분)

1. Petstore 명세 URL을 Postman에 Import
2. 자동 생성된 요청 하나를 그대로 실행해 보고 결과 기록
3. 실패했다면 **왜 실패했는지** 분석 (example 값이 최신이 아닌가? 인증이 필요한가?)
4. 4층 검증 스크립트를 붙여 통과시키기

### 과제 3 — 흐름 컬렉션 만들고 러너로 실행 (15분)

`https://jsonplaceholder.typicode.com` 로 3단계 흐름을 만든다.

```text
1. POST /posts        → 생성, 응답의 id 를 변수에 저장
2. GET  /posts/{{id}} → 저장한 id 로 조회
3. DELETE /posts/{{id}} → 정리
```

그다음 **일부러 깨뜨려 본다.**

- 1번 요청의 변수 저장 코드를 지우고 러너 실행 → 2번이 어떻게 실패하는가
- 2번을 먼저 실행되게 순서를 바꾸면 어떻게 되는가
- 이 실패 메시지만 보고 원인을 알 수 있는가?

**여기서 느끼는 불편함이 "테스트 간 의존성" 문제의 실체**다. 무엇을 개선하면 좋을지 메모에 적는다.

### 과제 4 — Newman 로컬 실행 (10분)

과제 3의 컬렉션을 export 하고 로컬에서 실행한다.

```bash
npm install -g newman
newman run collection.json --reporters cli,json --reporter-json-export result.json
```

- 종료 코드(`echo $?`)를 확인한다 — 실패 시 0이 아니어야 CI가 빌드를 실패시킬 수 있다
- `result.json` 을 열어 어떤 정보가 담기는지 본다

### 과제 5 — AI가 만든 워크플로 검증 (10분)

AI 실습 도우미에 요청한다.

> Postman 컬렉션을 GitHub Actions에서 Newman으로 매일 실행하고 리포트를 아티팩트로 남기는 워크플로 YAML을 작성하라.

받은 YAML을 **다음 기준으로 검증**한다.

| 확인 항목 | 결과 |
|---|---|
| API 키를 Secrets 로 분리했는가, 아니면 하드코딩했는가 | |
| 실패 시에도 리포트를 업로드하는가 (`if: always()`) | |
| cron 시간대가 UTC 기준임을 반영했는가 | |
| 존재하지 않는 액션 버전이나 옵션을 쓰지 않았는가 | |
| `actions/upload-artifact` 버전이 유효한가 | |

**AI는 `if: always()` 를 자주 빠뜨리고, cron을 KST로 착각한다.** 실제로 돌려보기 전에는 알 수 없는 종류의 결함이다.

## 자가 체크리스트

- [ ] OpenAPI 명세에서 필수 필드·타입·경계값을 읽어 TC로 옮길 수 있다
- [ ] 명세에 **정의되지 않은 상황**을 찾아 명세 결함으로 제기할 수 있다
- [ ] `nullable: true` 와 필드 누락이 다르게 동작할 수 있음을 알고 둘 다 테스트한다
- [ ] Swagger UI의 Try it out 으로 탐색적 API 테스트를 수행할 수 있다
- [ ] Swagger가 생성한 curl을 결함 리포트의 재현 절차로 활용할 수 있다 (토큰 마스킹 포함)
- [ ] OpenAPI 명세를 Postman 컬렉션으로 가져올 수 있고, example 불일치를 결함으로 인식한다
- [ ] 테스트 간 의존성의 세 가지 전략과 각각의 트레이드오프를 설명할 수 있다
- [ ] 컬렉션에 정리(cleanup) 단계를 넣어야 하는 이유를 안다
- [ ] Newman으로 컬렉션을 CLI 실행하고 junit/html 리포트를 생성할 수 있다
- [ ] CI에서 API 키를 Secrets로 주입하고 컬렉션 파일에 넣지 않는다
- [ ] `if: always()` 가 없으면 실패 시 리포트를 못 받는다는 걸 안다
- [ ] 권한 검증 API 테스트를 자동화 우선순위 상위에 두는 이유를 설명할 수 있다

## 참고 링크

- [Swagger Petstore (공식 데모)](https://petstore3.swagger.io) — Try it out 가능한 무료 연습 대상
- [OpenAPI 명세 3.1](https://spec.openapis.org/oas/latest.html) — 스키마 키워드의 정확한 의미
- [Newman 공식 문서](https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/) — CLI 옵션 전체
- [newman-reporter-htmlextra](https://github.com/DannyDainton/newman-reporter-htmlextra) — 실무에서 가장 많이 쓰는 리포터
- [GitHub Actions 문서](https://docs.github.com/en/actions) — public 저장소는 무료 무제한
