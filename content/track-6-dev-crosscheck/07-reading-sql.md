---
id: t6-l07
title: SQL 읽기와 결과 검증 — 남이 쓴 쿼리를 믿지 않기
summary: 트랙 2가 쿼리를 쓰는 법이었다면, 여기는 남과 AI가 쓴 쿼리를 읽고 "이 숫자가 맞는가"를 판단하는 법이다.
minutes: 20
order: 7
tags: [SQL, 쿼리읽기, 검증, 실행계획, AI검증]
---

## 개념 설명

### 트랙 2와 무엇이 다른가

```text
트랙 2: 내가 검증 쿼리를 작성한다
트랙 6: 남이 쓴 쿼리(개발자·AI·리포트 도구)를 읽고 결과를 신뢰할지 판단한다
```

**후자가 더 어렵고 더 위험하다.** 잘못된 쿼리는 **에러 없이 틀린 숫자**를 준다. 그리고 그 숫자로 릴리즈 판단을 하게 된다.

### 쿼리를 읽는 순서

긴 쿼리를 만나면 순서가 있다. 위에서 아래로 읽지 않는다.

```sql
SELECT u.grade, COUNT(DISTINCT o.order_id) AS cnt, SUM(oi.price * oi.quantity) AS amount
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE o.created_at >= '2026-08-01'
  AND o.status = 'PAID'
  AND r.refund_id IS NULL
GROUP BY u.grade
HAVING SUM(oi.price * oi.quantity) > 1000000
ORDER BY amount DESC;
```

**읽는 순서**

```text
1. FROM / JOIN  — 어떤 테이블을 어떻게 이었나. 행이 늘어나는가?
2. WHERE        — 무엇을 걸러냈나. 무엇이 빠졌나?
3. GROUP BY     — 무엇 단위로 묶었나
4. HAVING       — 묶은 뒤 무엇을 걸렀나
5. SELECT       — 무엇을 계산했나
6. ORDER BY / LIMIT
```

**SELECT를 마지막에 보는 게 핵심이다.** 대부분의 오류는 FROM/JOIN과 WHERE에서 발생하는데, SELECT부터 읽으면 그걸 놓친다.

### 검증 포인트 1 — JOIN이 행을 늘리는가

**가장 흔하고 가장 조용한 오류다.** 트랙 2에서 다룬 1:N 문제가 남의 쿼리에서 나타나는 형태다.

```sql
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id     -- 1:N !
```

주문 1건에 상품 3개가 있으면 **주문 행이 3번 반복**된다.

```sql
COUNT(o.order_id)           -- 3 (틀림)
COUNT(DISTINCT o.order_id)  -- 1 (맞음)
SUM(o.total_amount)         -- 총액이 3배 (틀림)
SUM(oi.price * oi.quantity) -- 상품 합계 (맞음)
```

**위 쿼리에서 `COUNT(DISTINCT ...)` 를 쓴 것은 올바르다.** 하지만 `SUM(oi.price * oi.quantity)` 는 order_items 레벨 값이라 괜찮고, 만약 `SUM(o.total_amount)` 였다면 **3배로 부풀려진다.**

**읽을 때 체크하는 법**

```text
□ JOIN 하는 테이블이 1:1 인가 1:N 인가
□ 집계 함수가 어느 테이블의 컬럼을 쓰는가
□ 1쪽 테이블 컬럼을 SUM 하는데 N쪽과 JOIN 했으면 → 부풀려짐
□ COUNT 에 DISTINCT 가 필요한 상황인가
```

**검증 방법**: 집계를 빼고 원시 행을 보면 바로 안다.

```sql
-- 같은 order_id 가 여러 번 나오는가?
SELECT o.order_id, COUNT(*) FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id HAVING COUNT(*) > 1 LIMIT 5;
```

### 검증 포인트 2 — LEFT JOIN이 INNER JOIN이 되는 함정

**위 쿼리에 실제로 이 문제가 있다.**

```sql
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE ...
  AND r.refund_id IS NULL      -- 이건 의도대로 (환불 없는 주문만)
```

이건 맞다. 하지만 이렇게 쓰면 다르다.

```sql
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE r.status = 'COMPLETED'    -- ← LEFT JOIN 이 무의미해진다
```

**`WHERE` 에 오른쪽 테이블 조건을 걸면 NULL 행이 걸러져서 INNER JOIN 과 같아진다.** 환불이 없는 주문이 전부 빠진다.

```sql
-- 의도가 "환불 여부와 무관하게 모든 주문"이라면
LEFT JOIN refunds r ON o.order_id = r.order_id AND r.status = 'COMPLETED'
WHERE ...                        -- 조건을 ON 절로 옮긴다
```

**읽을 때**: `LEFT JOIN` 이 있으면 **`WHERE` 절에 그 테이블의 컬럼 조건이 있는지** 본다. 있으면 의도를 확인해야 한다.

### 검증 포인트 3 — WHERE에서 빠진 것

```sql
WHERE o.created_at >= '2026-08-01'
  AND o.status = 'PAID'
```

**무엇이 없는지**를 봐야 한다.

```text
□ 상한 날짜가 없다 → 미래 데이터, 테스트 데이터가 들어올 수 있다
□ 테스트 계정 제외가 없다 → qa_ 접두어 계정이 집계에 포함 (트랙 2)
□ 삭제 플래그(is_deleted) 필터가 없다 → 소프트 삭제된 데이터 포함
□ 취소/환불 상태 처리가 명확한가
□ 시간대 — created_at 이 UTC 면 KST 8월 1일 오전 9시 이전이 빠진다
```

**"테스트 계정 제외"가 특히 자주 빠진다.** 트랙 2에서 접두어 규칙을 만든 이유다.

```sql
AND u.email NOT LIKE 'qa_%@test.com'
AND o.order_id NOT LIKE 'ORD-TEST-%'
```

**날짜 경계**는 트랙 2에서 다룬 `BETWEEN` 함정과 같다.

```sql
-- 8월 전체를 조회하려면
WHERE created_at >= '2026-08-01' AND created_at < '2026-09-01'
```

### 검증 포인트 4 — NULL의 함정

```sql
-- 1. NOT IN + NULL → 전체가 0건
WHERE user_id NOT IN (SELECT user_id FROM blacklist)
-- blacklist 에 NULL 이 하나라도 있으면 결과가 0건. 에러도 안 난다.

-- 2. 집계 함수는 NULL 을 무시한다
SELECT AVG(discount) FROM orders;
-- discount 가 NULL 인 행은 분모에서도 빠진다
-- "할인 없음"을 0 으로 볼지 제외할지 의도가 다르다

SELECT COUNT(*), COUNT(discount) FROM orders;
-- 1000, 300  ← 700 건은 discount 가 NULL

-- 3. NULL 과의 비교
WHERE status != 'CANCELLED'
-- status 가 NULL 인 행은 결과에서 빠진다!  ← 의도인가?
WHERE (status != 'CANCELLED' OR status IS NULL)
```

**3번이 특히 조용하다.** 상태값이 NULL인 데이터가 집계에서 통째로 사라진다.

### 검증 포인트 5 — 결과를 신뢰할 수 있는가

쿼리를 읽었으면 **결과를 교차 검증**한다.

```text
1. 총합 대조
   세부 쿼리의 합계 == 전체 집계 쿼리의 값 인가

2. 샘플 추적
   결과 중 한 행을 골라 원본 데이터로 직접 확인
   "VIP 등급 매출 1,200만원" → VIP 주문 몇 건을 손으로 더해본다

3. 극단값 확인
   0 건, 1 건, 최대값이 나오는 조건에서도 맞는가

4. 다른 방법으로 같은 답 구하기
   서브쿼리 대신 JOIN, GROUP BY 대신 개별 조회
   → 두 결과가 다르면 하나는 틀렸다

5. 시간 축 비교
   지난달 대비 이번 달 값이 비상식적으로 변했는가
```

**4번이 가장 강력하다.** 트랙 4의 "다른 관점으로 검증"과 같은 원리다.

```sql
-- 방법 A: JOIN + GROUP BY
SELECT u.grade, SUM(o.total_amount)
FROM orders o JOIN users u ON o.user_id = u.user_id
WHERE o.status='PAID' GROUP BY u.grade;

-- 방법 B: 서브쿼리
SELECT grade, (SELECT SUM(total_amount) FROM orders
               WHERE user_id IN (SELECT user_id FROM users WHERE grade = g.grade)
                 AND status='PAID')
FROM (SELECT DISTINCT grade FROM users) g;

-- 두 결과가 다르면 → JOIN 중복이나 NULL 처리 차이를 의심
```

### 실행 계획 읽기 — 최소한만

성능 문제를 판단할 때 쓴다. 트랙 5와 이어진다.

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;
-- MySQL: EXPLAIN, PostgreSQL: EXPLAIN ANALYZE
```

**QA가 볼 것은 세 가지뿐이다.**

| 항목 | 나쁜 신호 |
|---|---|
| `type` (MySQL) | `ALL` = 풀 테이블 스캔. 인덱스를 못 탔다 |
| `rows` | 실제 결과보다 훨씬 큰 수 = 많이 읽고 버린다 |
| `Extra` | `Using filesort`, `Using temporary` = 정렬/임시 테이블 |

```text
type: ALL, rows: 2,400,000, Extra: Using where; Using filesort
→ 240만 행을 다 읽고 정렬한다. 데이터가 늘면 확실히 느려진다.
```

**QA가 이걸 보고 할 수 있는 말**

> 이 조회는 인덱스를 타지 않아 전체 스캔합니다. 현재 데이터 2만 건에서는 빠르지만, 운영 240만 건에서는 느려질 것 같습니다. 성능 테스트 대상에 넣고, 인덱스 추가를 검토해 주실 수 있을까요?

**스테이징과 운영의 데이터 양이 다르면 성능 문제가 안 보인다.** 실행 계획은 그걸 미리 잡는 수단이다.

### AI가 만든 쿼리 검증 — 이 레슨의 핵심

AI는 SQL을 **문법적으로 완벽하게, 의미적으로 틀리게** 만든다. 실행되고 숫자가 나오므로 검증하지 않으면 그대로 믿게 된다.

**AI 쿼리에서 가장 자주 나오는 오류 순서**

```text
1. JOIN 중복으로 집계 부풀림           ← 압도적 1위
2. 날짜 경계 (BETWEEN, 시간대)
3. NULL 처리 누락 (NOT IN, != 비교)
4. 취소·삭제·테스트 데이터 미제외
5. LEFT JOIN 을 WHERE 로 무력화
6. 존재하지 않는 컬럼·테이블 (환각)
7. DISTINCT 남발로 성능 저하 (또는 진짜 문제를 가림)
```

**7번이 교묘하다.** JOIN 중복을 `DISTINCT` 로 덮으면 건수는 맞아 보이지만 **합계는 여전히 틀린다.**

```sql
-- AI 가 자주 만드는 형태
SELECT DISTINCT o.order_id, o.total_amount   -- 건수는 맞다
FROM orders o JOIN order_items oi ON ...

SELECT SUM(o.total_amount)                    -- 하지만 이건 여전히 3배
FROM orders o JOIN order_items oi ON ...
```

**검증 절차 (실행 전)**

```text
□ FROM/JOIN 을 먼저 읽고 1:N 관계를 표시한다
□ 집계 함수가 어느 테이블 컬럼을 쓰는지 확인
□ WHERE 에서 빠진 필터 5가지 점검 (날짜 상한/테스트/삭제/취소/시간대)
□ NULL 이 있을 수 있는 컬럼에 = 나 != 를 쓰지 않았는지
□ LEFT JOIN 의 조건이 WHERE 에 있지 않은지
□ 실제 존재하는 컬럼명인지 (스키마와 대조)
```

**검증 절차 (실행 후)**

```text
□ 원시 행을 LIMIT 20 으로 눈으로 본다
□ 총합을 다른 방법으로 구해 대조
□ 샘플 한 건을 손으로 계산
□ 0건/1건이 나와야 할 조건으로도 돌려본다
```

**"실행됐고 숫자가 나왔다"는 검증이 아니다.** 이게 이 레슨의 결론이다.

### 리포트 쿼리를 검증하는 실전 예

경영 리포트나 정산 쿼리는 **틀리면 사업 판단이 틀어진다.**

```sql
-- 개발자가 준 "월간 활성 사용자(MAU)" 쿼리
SELECT COUNT(DISTINCT user_id) AS mau
FROM access_logs
WHERE created_at BETWEEN '2026-08-01' AND '2026-08-31';
```

**QA가 던질 질문**

```text
□ BETWEEN 이라 8/31 하루가 빠진다 (트랙 2)
□ 시간대가 UTC 면 KST 기준 월초/월말이 어긋난다
□ 봇·크롤러 트래픽이 포함되는가
□ 내부 직원·테스트 계정이 포함되는가
□ 비로그인 사용자의 user_id 는 NULL 인가, 그러면 COUNT(DISTINCT) 에서 제외되는가
□ "활성"의 정의가 무엇인가 — 접속만? 특정 행동?
□ 같은 사람이 여러 계정을 쓰면?
```

**마지막 두 개는 SQL 문제가 아니라 정의 문제다.** 트랙 1의 명세 결함 발견과 같다. **쿼리를 읽다가 정의의 모호함을 발견하는 것**이 QA의 부가가치다.

## 왜 채용시장이 요구하는가

- **"SQL 쿼리 읽기와 결과 검증"** 은 데이터 도메인(금융·커머스·물류) QA의 필수 역량이다.
- 면접 질문: **"이 쿼리에 문제가 있나요?"** 라며 JOIN 중복이 있는 쿼리를 주는 경우가 있다. 즉시 알아봐야 한다.
- **"실행됐다고 맞는 게 아니다"** 라는 관점은 QA의 본질이고, SQL에서 특히 잘 드러난다.
- **실행 계획을 보고 미래의 성능 문제를 예측**할 수 있으면 시니어로 읽힌다.
- **AI가 만든 쿼리를 검증하는 절차**를 가진 사람은 아직 드물다. 트랙 6 전체의 핵심 역량이다.

## 실습 과제

트랙 2의 실습 스키마(users / orders / order_items / payments)를 그대로 쓴다.

### 과제 1 — 쿼리 읽는 순서 연습 (12분)

레슨 앞부분의 긴 쿼리를 **6단계 순서대로** 읽고 각 단계에서 발견한 것을 적는다.

| 단계 | 발견 |
|---|---|
| FROM/JOIN | |
| WHERE | |
| GROUP BY | |
| HAVING | |
| SELECT | |
| ORDER BY | |

**JOIN 중복 가능성**과 **WHERE에서 빠진 것**을 반드시 짚는다.

### 과제 2 — JOIN 중복 실증 (15분)

```sql
-- A: JOIN 없이
SELECT SUM(total_amount) FROM orders WHERE status = 'PAID';

-- B: order_items 와 JOIN 후
SELECT SUM(o.total_amount) FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.status = 'PAID';

-- C: 원시 행 확인
SELECT o.order_id, o.total_amount, oi.item_id
FROM orders o JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.status = 'PAID';
```

1. A와 B의 결과 차이를 기록
2. C로 **왜 그런지** 눈으로 확인
3. B를 올바르게 고치는 방법을 **2가지** 작성 (서브쿼리, DISTINCT 집계 등)
4. 두 방법의 결과가 A와 같은지 확인

### 과제 3 — 함정 쿼리 5개 만들기 (15분)

**의도적으로 틀린 쿼리 5개**를 만들고, 각각 "그럴듯하게 실행되지만 결과가 틀린" 상태로 만든다.

| # | 함정 유형 | 쿼리 | 왜 틀렸나 | 올바른 버전 |
|---|---|---|---|---|
| 1 | JOIN 중복 | | | |
| 2 | 날짜 경계 | | | |
| 3 | NOT IN + NULL | | | |
| 4 | LEFT JOIN 무력화 | | | |
| 5 | `!=` 로 NULL 누락 | | | |

**직접 만들어 봐야 남의 쿼리에서 알아본다.**

### 과제 4 — 교차 검증 (12분)

"사용자 등급별 총 결제 금액"을 **세 가지 다른 방법**으로 구한다.

1. JOIN + GROUP BY
2. 서브쿼리
3. 수동 계산 (데이터가 적으므로 손으로)

세 결과가 일치하는가? 다르면 어느 것이 틀렸고 왜인지 분석한다.

### 과제 5 — 실행 계획 (12분)

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 2;
EXPLAIN SELECT * FROM orders WHERE total_amount > 10000;
-- 인덱스를 추가한 뒤 다시
CREATE INDEX idx_orders_user ON orders(user_id);
EXPLAIN SELECT * FROM orders WHERE user_id = 2;
```

| 쿼리 | type | rows | Extra | 판정 |
|---|---|---|---|---|
| | | | | |

인덱스 추가 전후의 차이를 기록하고, **개발팀에 전달할 문장**을 작성한다.

(SQLite를 쓴다면 `EXPLAIN QUERY PLAN` 을 사용한다)

### 과제 6 — MAU 쿼리 검증 (12분)

레슨의 MAU 쿼리에 대해:

1. 7가지 질문 각각에 대해 **어떻게 확인할지** 적는다
2. 문제를 고친 쿼리를 작성한다
3. **"활성의 정의"** 를 기획자에게 물을 질문 문장을 작성한다

**3번이 이 과제의 핵심 산출물이다.** SQL을 읽다가 명세 결함을 발견하는 훈련이다.

### 과제 7 — AI 쿼리 검증 (15분)

AI 실습 도우미에 스키마를 주고 요청한다.

> 2026년 8월에 결제를 완료한 사용자의 등급별 주문 건수와 총 결제 금액을 구하는 쿼리를 작성하라. 취소된 주문과 테스트 계정은 제외한다.

**실행하기 전에** 검증 체크리스트 6가지로 검토한다.

| 확인 항목 | 결과 |
|---|---|
| JOIN 중복으로 금액이 부풀려지는가 | |
| 8/31 데이터가 포함되는 날짜 조건인가 | |
| 취소 주문을 제외했는가 | |
| **테스트 계정 제외를 실제로 넣었는가** (요청했는데도 빠뜨리는지) | |
| NULL 처리를 고려했는가 | |
| 존재하는 컬럼만 썼는가 | |

그다음 실행하고 **손으로 계산한 값과 대조**한다.

**"테스트 계정 제외"를 명시적으로 요청했는데도 빠뜨리는 경우가 있다.** 지시를 다 반영했는지 확인하는 것도 검증이다.

## 자가 체크리스트

- [ ] 쿼리를 FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT 순으로 읽는다
- [ ] SELECT를 마지막에 읽는 이유를 설명할 수 있다
- [ ] JOIN이 1:N일 때 집계가 부풀려지는 것을 알아본다
- [ ] `COUNT(DISTINCT)` 가 필요한 상황을 판단할 수 있다
- [ ] 집계 함수가 어느 테이블 컬럼을 쓰는지 확인한다
- [ ] 원시 행을 조회해 JOIN 중복을 눈으로 검증할 수 있다
- [ ] **LEFT JOIN 조건을 WHERE에 쓰면 INNER JOIN이 되는 것**을 안다
- [ ] WHERE에서 빠지기 쉬운 5가지(날짜 상한·테스트·삭제·취소·시간대)를 점검한다
- [ ] `NOT IN` + NULL이 전체를 0건으로 만드는 함정을 안다
- [ ] 집계 함수가 NULL을 무시하는 것과 그 의미를 안다
- [ ] `!=` 비교에서 NULL 행이 빠지는 것을 안다
- [ ] 결과 교차 검증 5가지 방법을 적용할 수 있다
- [ ] **다른 방법으로 같은 답을 구해 대조**할 수 있다
- [ ] 실행 계획에서 `type: ALL`, `rows`, `Extra` 를 읽을 수 있다
- [ ] 스테이징 데이터 양이 적어 성능 문제가 숨는다는 것을 안다
- [ ] AI 쿼리의 흔한 오류 7가지를 순서대로 안다
- [ ] `DISTINCT` 로 중복을 덮으면 합계는 여전히 틀린다는 것을 안다
- [ ] 실행 전·후 검증 절차를 각각 수행한다
- [ ] **"실행됐고 숫자가 나왔다"가 검증이 아님**을 안다
- [ ] 쿼리를 읽다가 정의의 모호함(MAU의 "활성")을 명세 질문으로 만들 수 있다

## 참고 링크

- [MySQL — EXPLAIN 출력 형식](https://dev.mysql.com/doc/refman/8.0/en/explain-output.html) — type, rows, Extra 의미
- [PostgreSQL — EXPLAIN 사용법](https://www.postgresql.org/docs/current/using-explain.html)
- [Use The Index, Luke! (한국어)](https://use-the-index-luke.com/ko) — 인덱스와 실행 계획
- [SQL Style Guide](https://www.sqlstyle.guide/) — 읽기 좋은 쿼리 규칙
- [DB Fiddle](https://www.db-fiddle.com) — 실습 환경
