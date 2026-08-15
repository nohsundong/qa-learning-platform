---
id: t2-l05
title: SQL (2) — 데이터 정합성 검증 쿼리 패턴
summary: 화면으로는 절대 안 보이는 결함을 찾는 6가지 쿼리 패턴. 그리고 테스트 데이터를 안전하게 만드는 법.
minutes: 20
order: 5
tags: [SQL, 데이터정합성, 테스트데이터, 검증쿼리]
---

## 개념 설명

### 화면으로는 안 보이는 결함이 있다

앞 레슨에서 LEFT JOIN + IS NULL 로 "결제완료인데 결제 기록이 없는 주문"을 찾았다. 이런 결함의 공통점은 **화면에서는 정상으로 보인다**는 것이다.

- 주문 목록 화면은 orders 테이블만 읽으므로 payments 가 비어 있어도 "결제완료"로 표시된다
- 사용자는 아무 이상을 못 느낀다
- **월말 정산에서 금액이 안 맞을 때 비로소 발견된다**

QA가 SQL을 쓰는 진짜 이유가 여기 있다. **기능 테스트를 아무리 잘해도 데이터 정합성 결함은 안 잡힌다.**

아래 6가지 패턴을 익혀두면 어떤 도메인에서도 응용할 수 있다.

### 패턴 1 — 고아 레코드 (있어야 할 짝이 없다)

```sql
-- 결제완료 주문인데 결제 기록이 없다
SELECT o.order_id, o.status, o.total_amount, o.created_at
FROM orders o
LEFT JOIN payments p ON o.order_id = p.order_id
WHERE o.status = 'PAID'
  AND p.payment_id IS NULL;
```

```sql
-- 반대 방향: 결제 기록은 있는데 주문이 사라졌다 (더 심각하다)
SELECT p.payment_id, p.order_id, p.amount
FROM payments p
LEFT JOIN orders o ON p.order_id = o.order_id
WHERE o.order_id IS NULL;
```

**두 방향을 다 봐야 한다.** 한쪽만 보면 절반만 찾는다.

### 패턴 2 — 금액·수량 불일치 (계산이 안 맞는다)

```sql
-- 주문의 총액이 상품 금액 합계 - 할인액과 다르다
SELECT
  o.order_id,
  o.total_amount                                    AS 저장된_총액,
  SUM(oi.unit_price * oi.quantity)                  AS 상품합계,
  o.discount_amount                                 AS 할인액,
  SUM(oi.unit_price * oi.quantity) - o.discount_amount AS 계산된_총액
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, o.total_amount, o.discount_amount
HAVING o.total_amount <> SUM(oi.unit_price * oi.quantity) - o.discount_amount;
```

```sql
-- 결제 금액과 주문 금액이 다르다 (돈이 새는 지점)
SELECT o.order_id, o.total_amount, p.amount, o.total_amount - p.amount AS 차액
FROM orders o
JOIN payments p ON o.order_id = p.order_id
WHERE o.total_amount <> p.amount;
```

이 쿼리들의 결과가 **0건이어야 정상**이다. 배포 후에 한 번씩 돌려보면 조용히 새는 돈을 잡아낼 수 있다.

### 패턴 3 — 중복 (한 번만 있어야 하는 게 여러 개)

```sql
-- 같은 주문에 결제가 두 번 기록됨 (중복 결제)
SELECT order_id, COUNT(*) AS cnt, SUM(amount) AS 총결제액
FROM payments
GROUP BY order_id
HAVING COUNT(*) > 1;
```

```sql
-- 이메일 중복 가입 (unique 제약이 없는 경우)
SELECT LOWER(TRIM(email)) AS normalized, COUNT(*) AS cnt
FROM users
WHERE email IS NOT NULL
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;
```

두 번째 쿼리에서 `LOWER(TRIM(...))` 을 쓴 이유가 중요하다. **`A@test.com` 과 `a@test.com ` 은 DB 입장에서 다른 값이지만 사용자 입장에서는 같은 계정**이다. 정규화해서 비교하지 않으면 중복을 못 찾는다.

앞 레슨의 Idempotency-Key 이야기와 이어진다. 결제 API를 두 번 호출했을 때 이 쿼리가 1건을 반환해야 정상이다.

### 패턴 4 — 상태 모순 (있을 수 없는 조합)

```sql
-- 취소됐는데 환불 기록이 없다
SELECT o.order_id, o.status, o.cancelled_at
FROM orders o
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE o.status = 'CANCELLED'
  AND o.total_amount > 0
  AND r.refund_id IS NULL;
```

```sql
-- 배송 시작 시각이 주문 시각보다 빠르다 (시간 역전)
SELECT order_id, created_at, shipped_at
FROM orders
WHERE shipped_at < created_at;
```

```sql
-- 상태는 PAID 인데 결제 시각이 NULL
SELECT order_id, status, paid_at
FROM orders
WHERE status = 'PAID' AND paid_at IS NULL;
```

**시간 역전 검사**는 어느 도메인에서나 유용하다. 타임존 처리 버그, 배치 처리 순서 오류, 서버 간 시계 불일치를 한 번에 잡아낸다.

### 패턴 5 — 배포 전후 대조 (변화량 확인)

트랙 1의 배포 후 검증에서 쓴다. **배포 전에 기준값을 찍어두는 게 핵심**이다.

```sql
-- 배포 직전에 실행해 결과를 캡처해 둔다
SELECT
  status,
  COUNT(*)          AS 건수,
  SUM(total_amount) AS 금액합계
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY status;
```

배포 후 같은 쿼리를 돌려 **비율이 급변한 상태가 있는지** 본다. 특히 이런 신호를 찾는다.

| 신호 | 의심할 것 |
|---|---|
| `FAILED` 비율 급증 | 결제 연동 문제 |
| `PENDING` 이 쌓이고 안 줄어듦 | 후속 처리 배치가 안 도는 중 |
| 전체 건수 급감 | 주문 자체가 안 들어옴 — 프론트가 깨졌을 가능성 |
| 금액 합계만 이상 | 계산 로직 변경의 부작용 |

세 번째가 트랙 1에서 말한 **"에러는 없는데 전환율이 떨어진"** 상황이다. 에러 로그로는 안 잡히고 이 쿼리로 잡힌다.

### 패턴 6 — 기대값 대조 (내가 방금 한 행동의 결과 확인)

기능 테스트를 하면서 **화면 확인과 DB 확인을 세트로** 하는 습관이다.

```sql
-- 방금 만든 주문이 의도대로 저장됐는가
SELECT
  order_id,
  status,                                    -- PENDING 이어야 함
  total_amount,                              -- 9000 이어야 함
  discount_amount,                           -- 1000 이어야 함
  coupon_code,                               -- 'WELCOME10' 이어야 함
  created_at,
  TIMESTAMPDIFF(SECOND, created_at, NOW()) AS 경과초   -- 방금 것이 맞는지
FROM orders
WHERE user_id = 12345
ORDER BY created_at DESC
LIMIT 1;
```

**마지막 컬럼이 실무 팁이다.** 여러 사람이 같은 테스트 계정을 쓰는 환경에서, 조회된 게 내가 방금 만든 것인지 확인할 수 있다.

### 테스트 데이터 만들기 — 안전하게

특정 상태를 만들어야 테스트가 가능한 경우가 많다. "재고 1개", "휴면 회원", "쿠폰 만료 직전". 세 가지 방법이 있고 우선순위가 있다.

| 방법 | 안전도 | 권장 |
|---|---|---|
| **1. API/UI로 정상 경로를 통해 만든다** | 높음 | **1순위.** 실제 흐름을 그대로 타므로 부수 데이터도 다 생긴다 |
| 2. 관리자 기능으로 만든다 | 중간 | 2순위. 있으면 쓴다 |
| 3. SQL로 직접 INSERT/UPDATE | 낮음 | **최후의 수단** |

3번이 위험한 이유는 **부수 데이터가 안 생기기 때문**이다. UPDATE로 주문 상태만 CANCELLED로 바꾸면 환불 기록도, 재고 복구도, 이력 로그도 없다. 그 상태로 테스트하면 **실제와 다른 조건**을 테스트하게 되고, 최악의 경우 "테스트에선 됐는데 운영에선 안 되는" 상황을 만든다.

그래도 3번을 써야 한다면 규칙을 지킨다.

```sql
-- 1. 트랜잭션으로 감싼다
BEGIN;

-- 2. 대상을 먼저 확인 (건수가 예상과 맞는가)
SELECT order_id, status FROM orders WHERE order_id = 'ORD-TEST-001';

-- 3. WHERE 를 반드시 PK 로 좁힌다
UPDATE orders SET status = 'SHIPPED', shipped_at = NOW()
WHERE order_id = 'ORD-TEST-001';

-- 4. 결과 확인
SELECT order_id, status, shipped_at FROM orders WHERE order_id = 'ORD-TEST-001';

-- 5. 맞으면 COMMIT, 아니면 ROLLBACK
COMMIT;
```

그리고 **무엇을 왜 바꿨는지 기록으로 남긴다.** 나중에 "이 데이터 왜 이래요?"라는 질문이 반드시 나온다.

**테스트 데이터 식별 규칙**을 팀에 만들어두면 좋다. `qa_` 접두어 계정, `ORD-TEST-` 접두어 주문번호 같은 것이다. 그러면 통계에서 제외하기도 쉽고, 정리하기도 쉽다.

### 이 쿼리들을 자동화하기

정합성 검증 쿼리는 **한 번 만들면 계속 쓴다.** 파일로 모아두고 배포 때마다 돌린다.

```text
sql/integrity/
  01_orphan_payments.sql
  02_amount_mismatch.sql
  03_duplicate_payments.sql
  04_status_contradiction.sql
  05_time_reversal.sql
```

각 쿼리가 **0건을 반환해야 정상**이 되도록 통일해 두면, 나중에 "전부 실행해서 0건이 아닌 게 있으면 실패"로 자동화하기 쉽다. 트랙 3의 CI 연동에서 이걸 실제로 붙인다.

## 왜 채용시장이 요구하는가

- **"SQL로 데이터 정합성 검증 경험"** 은 시니어 QA 공고에 자주 등장한다. 조회할 줄 아는 것과 검증 쿼리를 설계할 줄 아는 것은 다른 수준으로 평가된다.
- 면접 질문: **"기능 테스트로는 못 잡는 결함의 예를 들어보세요."** 여기서 고아 레코드나 금액 불일치를 말하면 강한 답이 된다.
- **정산·데이터 도메인(금융, 커머스, 물류)에서는 이 능력이 사실상 필수**다. 화면 테스트만 하는 QA는 그 도메인에서 역할이 제한된다.
- **AI가 만든 검증 쿼리는 실행되지만 조용히 틀린다.** JOIN 중복으로 금액이 부풀려지거나, 한쪽 방향의 고아 레코드만 찾거나, NULL을 고려하지 않는다. 에러가 안 나기 때문에 **눈으로 검증할 줄 모르면 잘못된 "0건 정상"을 믿게 된다.** 이게 SQL 영역에서 AI 교차검증이 특히 중요한 이유다.

## 실습 과제

앞 레슨 과제 1의 스키마를 그대로 쓴다. 아래 데이터를 추가한다.

```sql
CREATE TABLE order_items (
  item_id INT PRIMARY KEY,
  order_id VARCHAR(30),
  product_id INT,
  unit_price INT,
  quantity INT
);

INSERT INTO order_items VALUES
  (1, 'ORD-001', 501, 5000, 2),
  (2, 'ORD-002', 502, 10000, 2),
  (3, 'ORD-003', 503, 5000, 1),
  (4, 'ORD-004', 504, 7000, 2);

-- 중복 결제와 시간 역전을 일부러 심어둔다
INSERT INTO payments VALUES (102, 'ORD-002', 20000, '2026-08-15 10:02:00');
INSERT INTO payments VALUES (103, 'ORD-999', 30000, '2026-08-18 09:00:00');
```

### 과제 1 — 6가지 패턴 전부 실행 (20분)

각 패턴의 쿼리를 직접 작성해 실행하고, **발견한 이상 데이터를 표로 정리**한다.

| 패턴 | 발견 건수 | 어떤 데이터인가 | 왜 문제인가 |
|---|---|---|---|
| 고아 레코드 (주문→결제) | | | |
| 고아 레코드 (결제→주문) | | | |
| 금액 불일치 | | | |
| 중복 결제 | | | |
| 상태 모순 | | | |
| 시간 역전 | | | |

**심어둔 결함이 최소 4개 있다.** 몇 개를 찾았는지 세어본다. (`ORD-001` 의 금액도 확인해 볼 것)

### 과제 2 — 결함 리포트로 옮기기 (10분)

과제 1에서 찾은 것 중 **가장 심각한 하나**를 골라 트랙 1의 형식으로 결함 리포트를 작성한다.

포함할 것:
- 재현 절차에 **검증 쿼리를 그대로** 넣기
- 실제 결과에 쿼리 결과 표를 붙이기
- **심각도 판단 근거** — 돈이 걸렸는가, 데이터가 유실되는가
- 이 결함이 화면에서는 왜 안 보이는지 설명

### 과제 3 — 정합성 쿼리 세트 만들기 (12분)

본인이 아는 서비스 도메인 하나를 골라 **그 도메인의 정합성 검증 쿼리 5개**를 설계한다. (실행 못 해도 되고, 의사 쿼리여도 된다)

예시 도메인과 검증 포인트:
- 예약 서비스 → 같은 시간대 중복 예약, 취소됐는데 좌석이 안 풀린 것
- 포인트 시스템 → 적립 합계 - 사용 합계 ≠ 현재 잔액
- 구독 서비스 → 결제 실패했는데 이용 권한이 살아있는 계정

**"이 쿼리는 0건이어야 정상"** 형태로 통일해서 쓴다.

### 과제 4 — AI 생성 검증 쿼리 교차검증 (12분)

AI 실습 도우미에 스키마 전체를 주고 요청한다.

> 이 스키마에서 데이터 정합성을 검증하는 쿼리를 5개 작성하라. 각 쿼리는 문제가 없으면 0건을 반환해야 한다.

받은 쿼리를 **실행 전에 손으로 검토**한다.

| 확인 항목 | 결과 |
|---|---|
| 고아 레코드를 **양방향** 모두 확인했는가 | |
| JOIN 중복으로 금액이 부풀려지지 않는가 | |
| NULL 값을 고려했는가 (`NOT IN`, 비교 연산) | |
| 날짜 비교에서 경계가 정확한가 | |
| 존재하지 않는 컬럼·테이블·함수를 쓰지 않았는가 | |
| "0건이면 정상" 규칙을 실제로 지켰는가 (반대로 짠 것은 없는가) | |

마지막 항목을 꼭 본다. **AI가 "정상 데이터를 찾는 쿼리"를 만들어 놓고 0건 기준이라고 설명하는 경우가 있다.** 그대로 자동화에 넣으면 항상 실패하거나 항상 통과한다.

그다음 실행해서, 내가 과제 1에서 찾은 4개 결함 중 **AI 쿼리가 몇 개를 잡아내는지** 센다.

## 자가 체크리스트

- [ ] 기능 테스트로는 잡히지 않는 데이터 정합성 결함의 예를 들 수 있다
- [ ] 고아 레코드를 **양방향**으로 검사해야 하는 이유를 설명할 수 있다
- [ ] 금액 불일치 검증 쿼리를 GROUP BY + HAVING 으로 작성할 수 있다
- [ ] 중복 검사 시 `LOWER(TRIM())` 등으로 정규화해야 하는 이유를 안다
- [ ] 상태 모순과 시간 역전 검사 쿼리를 작성할 수 있다
- [ ] 배포 전에 기준값을 캡처해 두고 배포 후 대조하는 절차를 수행할 수 있다
- [ ] 상태별 건수 급변에서 무엇을 의심해야 하는지 4가지 이상 안다
- [ ] 기능 테스트 중 화면 확인과 DB 확인을 세트로 하는 습관이 있다
- [ ] 테스트 데이터는 API/UI 정상 경로로 만드는 것이 1순위인 이유를 설명할 수 있다
- [ ] SQL로 직접 데이터를 조작하면 부수 데이터가 누락된다는 위험을 안다
- [ ] UPDATE 시 트랜잭션 + PK 조건 + 전후 확인 절차를 지킨다
- [ ] 테스트 데이터에 식별 접두어를 붙여 통계에서 분리한다
- [ ] 정합성 쿼리를 "0건이면 정상" 형태로 통일해 자동화 가능하게 만든다
- [ ] AI가 만든 검증 쿼리가 조용히 틀리는 지점(JOIN 중복, 단방향 검사, NULL)을 짚어낼 수 있다

## 참고 링크

- [Use The Index, Luke!](https://use-the-index-luke.com/ko) — SQL 성능과 실행 계획. 한국어 번역 있음
- [PostgreSQL 문서 — 조인 유형](https://www.postgresql.org/docs/current/queries-table-expressions.html) — JOIN 동작의 정확한 정의
- [SQL Style Guide](https://www.sqlstyle.guide/) — 팀에서 공유할 쿼리를 읽기 좋게 쓰는 규칙
- [DB Fiddle](https://www.db-fiddle.com) — 실습 환경
