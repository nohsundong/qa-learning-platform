---
id: t2-l04
title: SQL (1) — QA를 위한 조회와 JOIN 읽기
summary: 화면 뒤에 실제로 저장된 값을 확인한다. SELECT·WHERE·JOIN을 '검증 도구'로 쓰는 법과 MySQL/MSSQL 차이.
minutes: 20
order: 4
tags: [SQL, MySQL, MSSQL, DBeaver, 데이터검증]
---

## 개념 설명

### QA가 SQL을 쓰는 세 가지 이유

개발자처럼 쿼리를 짜기 위해서가 아니다. 목적이 다르다.

1. **화면과 실제 데이터가 일치하는지 확인** — 화면엔 9,000원인데 DB엔 10,000원이 저장됐다면 결함이다
2. **테스트 데이터를 만들고 상태를 세팅** — "재고 1개 남은 상품", "휴면 회원 계정"을 만들어야 테스트할 수 있다
3. **결함의 원인 범위를 좁힘** — "프론트가 잘못 보여주는 건가, 서버가 잘못 저장한 건가"를 스스로 판단

세 번째가 개발자와의 대화를 바꾼다. "결제 금액이 이상해요" 대신 **"orders 테이블엔 9,000원으로 맞게 들어갔는데 화면엔 10,000원이 뜹니다. 프론트 쪽으로 보입니다"** 라고 말할 수 있다.

### 읽어야 할 SQL, 쓸 수 있어야 할 SQL

QA에게 필요한 범위는 명확하다.

| 구분 | 범위 |
|---|---|
| **반드시 쓸 수 있어야** | SELECT, WHERE, ORDER BY, LIMIT, COUNT/SUM/AVG, GROUP BY, JOIN(INNER/LEFT) |
| **읽을 수 있어야** | 서브쿼리, HAVING, CASE WHEN, 윈도우 함수(있으면 알아보는 정도) |
| **알되 함부로 쓰면 안 됨** | INSERT, UPDATE, DELETE ← 뒤에서 다룬다 |

### SELECT — 검증의 출발점

```sql
-- 주문 한 건이 어떻게 저장됐는지 확인
SELECT order_id, user_id, status, total_amount, discount_amount, created_at
FROM orders
WHERE order_id = 'ORD-20260815-0001';
```

**QA가 조회할 때의 습관 세 가지**

1. **`SELECT *` 를 쓰지 않는다.** 필요한 컬럼만 적는다. 컬럼이 100개인 테이블에서 눈으로 찾는 건 시간 낭비이고, 개인정보 컬럼까지 불필요하게 화면에 띄우게 된다
2. **항상 LIMIT을 붙인다.** 운영 DB에서 `WHERE` 없는 조회를 날리면 서비스가 느려진다
3. **`created_at` 을 같이 본다.** 언제 만들어진 데이터인지 모르면 내가 방금 만든 것인지 남의 것인지 구분이 안 된다

```sql
-- 좋은 습관
SELECT order_id, status, total_amount, created_at
FROM orders
WHERE user_id = 12345
ORDER BY created_at DESC
LIMIT 20;
```

### WHERE — 조건에서 자주 틀리는 것들

```sql
-- NULL 은 = 로 비교되지 않는다. 이건 항상 0건이다
WHERE coupon_code = NULL          -- ✗
WHERE coupon_code IS NULL         -- ✓

-- NOT IN 에 NULL 이 섞이면 전체가 0건이 된다 (자주 당한다)
WHERE user_id NOT IN (SELECT user_id FROM blacklist)              -- blacklist 에 NULL 있으면 0건
WHERE user_id NOT IN (SELECT user_id FROM blacklist WHERE user_id IS NOT NULL)   -- ✓

-- 날짜 범위: BETWEEN 은 양끝을 포함한다. 시각이 있는 컬럼에선 위험하다
WHERE created_at BETWEEN '2026-08-01' AND '2026-08-31'
-- → 8/31 00:00:00 까지만 포함. 8/31 하루가 통째로 빠진다
WHERE created_at >= '2026-08-01' AND created_at < '2026-09-01'    -- ✓ 이렇게 쓴다
```

**세 번째가 실무에서 가장 자주 나오는 데이터 결함**이다. 월별 집계 리포트에서 매달 마지막 날이 빠지는 버그가 여기서 나온다. 트랙 1의 경계값 분석이 SQL에서도 그대로 적용된다.

문자열 비교의 함정도 있다.

```sql
-- 대소문자 구분 여부는 DB 설정(collation)에 따라 다르다
WHERE email = 'QA@Example.com'    -- MySQL 기본 설정에선 대소문자 무시, MSSQL은 설정에 따라 다름

-- 앞뒤 공백
WHERE name = '홍길동 '            -- 눈에 안 보이는 공백 때문에 0건
WHERE TRIM(name) = '홍길동'       -- 확인용으로는 이렇게
```

"분명 데이터가 있는데 조회가 안 돼요"의 90%가 NULL, 공백, 대소문자, 날짜 경계 중 하나다.

### JOIN — 여러 테이블을 이어 검증하기

QA가 실제로 필요한 JOIN은 두 가지뿐이다.

```sql
-- INNER JOIN: 양쪽에 다 있는 것만
SELECT o.order_id, o.total_amount, u.email, p.name AS product_name
FROM orders o
INNER JOIN users u    ON o.user_id = u.user_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
WHERE o.order_id = 'ORD-20260815-0001';
```

```sql
-- LEFT JOIN: 왼쪽은 전부, 오른쪽은 있으면 붙인다
-- → 오른쪽이 NULL 인 행을 찾으면 "짝이 없는 데이터"를 발견할 수 있다
SELECT o.order_id, o.status, p.payment_id
FROM orders o
LEFT JOIN payments p ON o.order_id = p.order_id
WHERE o.status = 'PAID'
  AND p.payment_id IS NULL;      -- ← 결제완료인데 결제 기록이 없는 주문
```

**LEFT JOIN + IS NULL 패턴이 QA에게 가장 강력한 무기다.** "있어야 하는데 없는 것"을 찾는 방법이기 때문이다. 다음 레슨에서 이 패턴을 정합성 검증으로 확장한다.

JOIN에서 흔한 실수 하나.

```sql
-- 주문 1건인데 결과가 3행 나온다?
SELECT o.order_id, o.total_amount
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id;
-- → 주문에 상품이 3개 들어있으면 주문 행이 3번 반복된다 (1:N 관계)
```

이걸 모르고 `SUM(o.total_amount)` 을 하면 **금액이 3배로 부풀려진다.** 집계할 때 반드시 조심해야 할 지점이고, 다음 레슨의 검증 쿼리에서 다시 나온다.

### GROUP BY — 집계로 이상 징후 찾기

```sql
-- 상태별 주문 건수 (배포 전후 비교용)
SELECT status, COUNT(*) AS cnt
FROM orders
WHERE created_at >= '2026-08-15'
GROUP BY status
ORDER BY cnt DESC;
```

```sql
-- 중복 의심: 같은 사용자가 같은 상품을 1분 안에 여러 번 주문
SELECT user_id, product_id, COUNT(*) AS cnt
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
WHERE o.created_at >= '2026-08-15'
GROUP BY user_id, product_id
HAVING COUNT(*) > 1;
```

`WHERE` 는 그룹 짓기 **전** 필터, `HAVING` 은 그룹 지은 **후** 필터다. 이 순서를 기억하면 헷갈리지 않는다.

### MySQL vs MSSQL — QA가 마주치는 차이

같은 SQL이 아니다. 팀 DB가 무엇인지 확인하고 문법을 맞춰야 한다.

| 하는 일 | MySQL | MSSQL (SQL Server) |
|---|---|---|
| 상위 N건 | `... LIMIT 10` | `SELECT TOP 10 ...` |
| 문자열 연결 | `CONCAT(a, b)` | `a + b` 또는 `CONCAT(a, b)` |
| 현재 시각 | `NOW()` | `GETDATE()` |
| 날짜 더하기 | `DATE_ADD(d, INTERVAL 1 DAY)` | `DATEADD(day, 1, d)` |
| NULL 대체 | `IFNULL(a, 0)` / `COALESCE` | `ISNULL(a, 0)` / `COALESCE` |
| 문자열 자르기 | `SUBSTRING(s, 1, 5)` | 동일 |
| 식별자 감싸기 | `` `column` `` | `[column]` |

`COALESCE` 는 양쪽에서 다 되므로 이걸 쓰는 습관을 들이면 이식성이 좋다.

**날짜/시간 타입 주의**: MySQL의 `DATETIME` 은 시간대 정보가 없고, `TIMESTAMP` 는 UTC로 저장돼 세션 시간대로 변환된다. 이 차이 때문에 **"9시간 차이나는 데이터"** 결함이 자주 발생한다. 조회 결과의 시각이 이상하면 이걸 의심한다.

### DBeaver — 무료 DB 클라이언트

DBeaver Community Edition은 **오픈소스이고 무료**다. MySQL, PostgreSQL, MSSQL, Oracle, SQLite 등 대부분을 하나로 붙일 수 있다.

QA에게 유용한 기능들.

- **ER 다이어그램 자동 생성** — 테이블 간 관계를 그림으로 본다. 처음 보는 스키마를 파악할 때 가장 빠르다
- **결과를 CSV/Excel로 내보내기** — 결함 리포트 증거 첨부용
- **읽기 전용 연결 설정** — 실수로 UPDATE를 날리는 사고를 원천 차단한다
- **SQL 실행 기록** — 내가 뭘 실행했는지 남는다

### 안전 수칙 — 이건 지키지 않으면 사고가 난다

운영 DB 접근 권한을 받았다면 다음을 반드시 지킨다.

1. **읽기 전용 계정을 쓴다.** 권한 자체를 SELECT만 받는 게 가장 안전하다
2. **UPDATE / DELETE 는 운영에서 실행하지 않는다.** 데이터 수정이 필요하면 개발자에게 요청하고 기록을 남긴다
3. 테스트 환경에서 UPDATE/DELETE를 쓸 때도 **먼저 SELECT로 대상을 확인**한다

```sql
-- 1단계: 지울 대상을 먼저 눈으로 본다
SELECT COUNT(*) FROM orders WHERE user_id = 12345 AND status = 'DRAFT';

-- 2단계: 건수가 예상과 맞으면 그때 실행
DELETE FROM orders WHERE user_id = 12345 AND status = 'DRAFT';
```

4. **트랜잭션을 쓸 수 있으면 쓴다.**

```sql
BEGIN;
UPDATE orders SET status = 'CANCELLED' WHERE order_id = 'ORD-...';
SELECT status FROM orders WHERE order_id = 'ORD-...';   -- 확인
-- 맞으면 COMMIT; 아니면 ROLLBACK;
ROLLBACK;
```

5. **WHERE 없는 UPDATE/DELETE는 절대 실행하지 않는다.** DBeaver에는 이를 막는 안전장치 설정이 있다. 켜둔다

## 왜 채용시장이 요구하는가

- **QA 채용공고에 SQL이 들어가는 비율이 계속 높아지고 있다.** "SQL을 활용한 데이터 검증 가능자"는 이제 흔한 문구다.
- 면접 실기로 **간단한 조회·JOIN 쿼리를 직접 쓰게 하는 경우**가 있다. 화이트보드에 LEFT JOIN을 그릴 수 있어야 한다.
- **결함의 원인 범위를 스스로 좁히는 능력**이 협업 비용을 크게 줄인다. 개발자 입장에서 "DB 확인해 봤더니 이렇더라"까지 해오는 QA는 완전히 다른 대우를 받는다.
- **AI가 만든 SQL을 검증하려면 SQL을 읽을 줄 알아야 한다.** AI는 그럴듯하지만 틀린 쿼리를 잘 만든다. 특히 JOIN으로 행이 뻥튀기되는 것, `NOT IN` + NULL 함정, 날짜 경계 처리를 자주 틀린다. 이건 실행해도 에러가 안 나고 **숫자만 조용히 틀린다.** 가장 위험한 종류의 결함이다.

## 실습 과제

### 과제 1 — 무료 환경 준비 (10분)

설치가 부담되면 브라우저에서 바로 되는 것을 쓴다.

- **DB Fiddle** (`https://www.db-fiddle.com`) — MySQL/PostgreSQL을 브라우저에서. 설치 불필요
- **SQLite Online** (`https://sqliteonline.com`) — 즉시 실행
- 로컬 설치를 원하면 **DBeaver Community + SQLite** 조합이 가장 가볍다

아래 스키마를 만들고 데이터를 넣는다.

```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  email VARCHAR(100),
  grade VARCHAR(20)
);

CREATE TABLE orders (
  order_id VARCHAR(30) PRIMARY KEY,
  user_id INT,
  status VARCHAR(20),
  total_amount INT,
  discount_amount INT,
  created_at DATETIME
);

CREATE TABLE payments (
  payment_id INT PRIMARY KEY,
  order_id VARCHAR(30),
  amount INT,
  paid_at DATETIME
);

INSERT INTO users VALUES
  (1, 'a@test.com', 'VIP'), (2, 'b@test.com', 'NORMAL'), (3, NULL, 'DORMANT');

INSERT INTO orders VALUES
  ('ORD-001', 1, 'PAID',      9000,  1000, '2026-08-31 23:30:00'),
  ('ORD-002', 2, 'PAID',     20000,     0, '2026-08-15 10:00:00'),
  ('ORD-003', 2, 'CANCELLED', 5000,     0, '2026-08-16 11:00:00'),
  ('ORD-004', 3, 'PAID',     15000,     0, '2026-08-17 12:00:00');

INSERT INTO payments VALUES
  (100, 'ORD-001', 9000,  '2026-08-31 23:31:00'),
  (101, 'ORD-002', 20000, '2026-08-15 10:01:00');
```

### 과제 2 — 검증 쿼리 6개 작성 (15분)

| # | 뽑을 것 |
|---|---|
| 1 | 8월에 생성된 주문 전체 — **8/31 데이터가 빠지지 않게** |
| 2 | 사용자 이메일과 함께 주문 목록 조회 (JOIN) |
| 3 | 상태가 PAID 인데 payments 에 기록이 없는 주문 (LEFT JOIN + IS NULL) |
| 4 | 이메일이 NULL 인 사용자 |
| 5 | 사용자별 총 결제금액 (CANCELLED 제외) |
| 6 | 상태별 주문 건수와 금액 합계 |

3번이 **실제 결함 하나를 잡아낸다.** 어떤 주문인지 확인하고, 이게 왜 문제인지 한 줄로 적는다.

### 과제 3 — 함정 직접 겪어보기 (10분)

아래를 실행하고 **결과가 왜 그런지** 설명을 메모에 적는다.

```sql
-- (1) 이건 왜 0건인가?
SELECT * FROM users WHERE email = NULL;

-- (2) BETWEEN 으로 8월을 조회하면 몇 건이 나오는가? 위 1번 답과 비교
SELECT COUNT(*) FROM orders WHERE created_at BETWEEN '2026-08-01' AND '2026-08-31';

-- (3) 이 합계가 맞는가? 왜 그런가?
SELECT SUM(o.total_amount)
FROM orders o
LEFT JOIN payments p ON o.order_id = p.order_id;
```

### 과제 4 — AI가 만든 SQL 검증 (12분)

AI 실습 도우미에 위 스키마를 그대로 주고 요청한다.

> 이 스키마에서 "2026년 8월에 결제 완료된 주문의 사용자별 총 결제금액"을 구하는 쿼리를 작성하라.

받은 쿼리를 **실행하기 전에 눈으로 검증**한다.

| 확인 항목 | 결과 |
|---|---|
| 8/31 데이터가 포함되는 날짜 조건인가 (`BETWEEN` 함정) | |
| CANCELLED 를 제외했는가 | |
| JOIN으로 행이 중복되어 금액이 부풀려지지 않는가 | |
| NULL 처리(사용자 정보 없는 주문)를 고려했는가 | |
| 실제 존재하는 컬럼명만 썼는가 (환각) | |

그다음 실행해서 **손으로 계산한 값과 비교**한다. 에러 없이 실행됐다고 맞는 게 아니다 — 이게 이 과제의 교훈이다.

## 자가 체크리스트

- [ ] QA가 SQL을 쓰는 세 가지 목적을 설명할 수 있다
- [ ] "프론트 문제인지 백엔드 문제인지"를 DB 조회로 스스로 판단할 수 있다
- [ ] `SELECT *` 대신 필요한 컬럼만 조회하고 LIMIT을 붙이는 습관이 있다
- [ ] `= NULL` 이 동작하지 않는 이유와 `IS NULL` 을 안다
- [ ] `NOT IN` 서브쿼리에 NULL이 섞이면 전체가 0건이 되는 함정을 안다
- [ ] `BETWEEN` 으로 날짜 범위를 잡으면 마지막 날이 누락되는 이유를 설명할 수 있다
- [ ] INNER JOIN과 LEFT JOIN의 차이를 설명하고 상황에 맞게 고를 수 있다
- [ ] **LEFT JOIN + IS NULL** 로 "있어야 하는데 없는 데이터"를 찾을 수 있다
- [ ] 1:N JOIN 후 SUM을 하면 금액이 부풀려지는 문제를 알고 있다
- [ ] WHERE와 HAVING의 적용 시점 차이를 설명할 수 있다
- [ ] MySQL과 MSSQL의 주요 문법 차이(LIMIT/TOP, NOW/GETDATE 등)를 안다
- [ ] 운영 DB에서 읽기 전용 계정을 쓰고 UPDATE/DELETE를 실행하지 않는다
- [ ] UPDATE/DELETE 전에 SELECT로 대상을 먼저 확인하는 절차를 지킨다
- [ ] AI가 만든 SQL이 "에러 없이 실행되지만 숫자가 틀린" 경우를 검증할 수 있다

## 참고 링크

- [DB Fiddle](https://www.db-fiddle.com) — 브라우저에서 MySQL/PostgreSQL 즉시 실행. 무료
- [SQLite Online](https://sqliteonline.com) — 설치 없이 SQL 연습
- [DBeaver Community](https://dbeaver.io/) — 오픈소스 무료 DB 클라이언트
- [MySQL 8.0 레퍼런스 — 함수](https://dev.mysql.com/doc/refman/8.0/en/functions.html) — 함수 존재 여부 확인용 (AI 환각 검증)
- [SQL Server T-SQL 레퍼런스](https://learn.microsoft.com/ko-kr/sql/t-sql/language-reference) — MSSQL 문법 확인
- [SQLBolt](https://sqlbolt.com/) — 브라우저에서 하는 무료 SQL 인터랙티브 튜토리얼
