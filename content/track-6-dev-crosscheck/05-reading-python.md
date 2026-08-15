---
id: t6-l05
title: Python 코드 읽기 — 백엔드와 데이터 스크립트 판단하기
summary: 서버 코드와 배치 스크립트를 읽는다. 가변 기본값·얕은 복사·예외 처리 등 Python 특유의 함정을 찾아낸다.
minutes: 18
order: 5
tags: [Python, 코드읽기, 백엔드, 배치, 결함예측]
---

## 개념 설명

### QA가 Python 코드를 만나는 곳

```text
□ 백엔드 API (Django, FastAPI, Flask)
□ 배치·정산 스크립트  ← 결함이 가장 치명적인 곳
□ 데이터 파이프라인
□ 자동화 테스트 (pytest, Playwright Python)
□ AI/ML 모델 서빙
```

**배치·정산 스크립트가 특히 중요하다.** 화면이 없어서 기능 테스트로 안 잡히고, 하루에 한 번 돌면서 조용히 데이터를 망가뜨린다. 트랙 2의 정합성 검증 쿼리가 이걸 잡는 수단이다.

### 읽기 위한 최소 문법

```python
# 함수 시그니처 — 타입 힌트가 있으면 계약을 알 수 있다
def calc_shipping(subtotal: int, is_vip: bool = False) -> int:
    ...

# 조건
if subtotal >= 30000:
    return 0
elif is_vip:
    return 0
else:
    return 3000

# 컴프리헨션 (JS 의 filter/map)
paid = [o for o in orders if o.status == 'PAID']
totals = [o.total for o in orders]
by_id = {o.id: o for o in orders}

# 딕셔너리 접근 — 이 차이가 결함을 만든다
d['key']            # 없으면 KeyError 예외
d.get('key')        # 없으면 None
d.get('key', 0)     # 없으면 0

# 예외
try:
    charge(order)
except PaymentError as e:
    logger.error(e)
finally:
    cleanup()

# 컨텍스트 매니저 (자동 정리)
with open('data.csv') as f:
    ...
```

**`d['key']` 와 `d.get('key')` 의 차이**가 QA에게 중요하다. 전자는 없으면 터지고, 후자는 조용히 `None` 을 준다. **조용히 넘어가는 쪽이 더 위험할 때가 많다.**

### 결함이 숨는 자리 1 — 가변 기본값

**Python 특유의 유명한 함정이다.**

```python
def add_item(item, cart=[]):        # ← 위험
    cart.append(item)
    return cart

add_item('A')    # ['A']
add_item('B')    # ['A', 'B']   ← 이전 호출의 결과가 남아있다!
```

기본값 `[]` 는 **함수 정의 시 딱 한 번 생성**되고 계속 재사용된다.

```python
def add_item(item, cart=None):      # 올바른 형태
    if cart is None:
        cart = []
    cart.append(item)
    return cart
```

**QA 관점**: 이런 코드를 보면 **"여러 번 호출했을 때 이전 데이터가 섞이는지"** 테스트한다. 사용자 A의 데이터가 사용자 B에게 보이는 사고가 이런 데서 나온다.

### 결함이 숨는 자리 2 — 얕은 복사와 참조

```python
a = {'items': [1, 2, 3]}
b = a.copy()              # 얕은 복사
b['items'].append(4)
print(a['items'])          # [1, 2, 3, 4]  ← 원본도 바뀐다

import copy
c = copy.deepcopy(a)       # 깊은 복사
```

JavaScript의 스프레드 연산자와 같은 문제다 (앞 레슨).

```python
# 리스트 순회 중 삭제 — 요소를 건너뛴다
for item in items:
    if item.expired:
        items.remove(item)     # ← 버그. 일부가 안 지워진다

# 올바름
items = [i for i in items if not i.expired]
```

**"일부만 처리됐다"는 증상**을 보면 이걸 의심한다. 배치 스크립트에서 자주 나온다.

### 결함이 숨는 자리 3 — 숫자와 나눗셈

```python
# 정수 나눗셈
10 / 3      # 3.3333...  (float)
10 // 3     # 3          (정수, 버림)
-10 // 3    # -4         ← 음수는 내림! -3 이 아니다

# 반올림 — 은행가 반올림(banker's rounding)
round(0.5)     # 0    ← 1 이 아니다
round(1.5)     # 2
round(2.5)     # 2    ← 3 이 아니다
```

**`round()` 가 사사오입이 아니다.** 짝수로 반올림한다. **금액 계산에서 명세와 다를 수 있다.**

```python
# 부동소수점 — JS 와 같은 문제
0.1 + 0.2 == 0.3        # False

# 금액은 Decimal 로
from decimal import Decimal, ROUND_DOWN
price = Decimal('19900')
discounted = (price * Decimal('0.9')).quantize(Decimal('1'), rounding=ROUND_DOWN)
```

**금액 계산에 `float` 를 쓰는 코드를 보면 경계한다.** `Decimal` 을 쓰는지, 정수(원 단위)로 다루는지 확인한다.

**음수 정수 나눗셈**도 함정이다. 환불이나 차감 계산에서 `-10 // 3` 이 `-4` 가 되는 게 의도인지 물어야 한다.

### 결함이 숨는 자리 4 — 예외 처리

```python
# 위험 1: 모든 예외를 삼킨다
try:
    process(order)
except:                    # ← bare except. KeyboardInterrupt 까지 잡는다
    pass                   # ← 아무 흔적도 안 남는다

# 위험 2: 너무 넓게 잡는다
except Exception as e:
    logger.error(e)        # 어떤 에러든 로그만 찍고 진행

# 위험 3: 원본을 잃는다
except ValueError:
    raise RuntimeError("처리 실패")        # 원본 트레이스백 소실
    # 올바름: raise RuntimeError("처리 실패") from e
```

**`except: pass` 는 코드 리뷰에서 반드시 지적할 것**이다. 실패가 완전히 사라진다.

```python
# 위험 4: finally 의 return 이 예외를 삼킨다
def process():
    try:
        raise ValueError("실패")
    finally:
        return "성공"      # ← 예외가 사라지고 "성공"이 반환된다
```

**배치 스크립트에서 "매일 성공했다고 나오는데 데이터가 안 맞는" 상황**의 원인이 이런 코드다.

### 결함이 숨는 자리 5 — 배치·정산 스크립트

QA가 특히 주의해서 봐야 할 코드 유형이다.

```python
def daily_settlement(target_date):
    orders = db.query("""
        SELECT * FROM orders
        WHERE created_at BETWEEN %s AND %s
    """, (target_date, target_date + timedelta(days=1)))

    total = 0
    for o in orders:
        total += o.amount
    db.save_settlement(target_date, total)
```

**읽으면서 나오는 질문**

```text
□ BETWEEN 양끝 포함 → 다음날 00:00:00 주문이 이중 집계된다  (트랙 2)
□ 이 배치가 두 번 돌면? (멱등성) → 정산이 두 번 저장되나
□ 중간에 실패하면? → 부분 저장 상태로 남나
□ 취소된 주문이 포함되는가 → status 필터가 없다
□ 시간대는? target_date 가 UTC 인가 KST 인가
□ 주문이 100만 건이면? → 메모리에 다 올린다
□ 배치가 도는 동안 새 주문이 들어오면?
□ 실패했을 때 알림이 가는가
```

**멱등성(idempotency)** 이 배치의 핵심 검증 항목이다. **같은 배치를 두 번 돌려도 결과가 같아야 한다.** 재실행이 필요한 상황(장애 복구)이 반드시 오기 때문이다.

**테스트 방법**: 배치를 두 번 실행하고 트랙 2의 정합성 쿼리로 중복을 확인한다.

```sql
SELECT target_date, COUNT(*) FROM settlements
GROUP BY target_date HAVING COUNT(*) > 1;   -- 0건이어야 정상
```

### 결함이 숨는 자리 6 — 시간대와 날짜

```python
from datetime import datetime, timezone, timedelta

datetime.now()              # 로컬 시간, 시간대 정보 없음 (naive)
datetime.utcnow()           # UTC, 하지만 여전히 naive  ← 위험
datetime.now(timezone.utc)  # UTC, 시간대 정보 있음 (aware)

KST = timezone(timedelta(hours=9))
datetime.now(KST)
```

**naive 와 aware 를 섞으면 예외가 나거나 조용히 틀린다.**

```python
naive = datetime.now()
aware = datetime.now(timezone.utc)
naive < aware      # TypeError: can't compare offset-naive and offset-aware
```

**서버는 UTC, 사용자는 KST** 인 경우가 대부분이라 여기서 9시간 차이가 발생한다. 트랙 2에서 본 데이터 이상의 코드 수준 원인이다.

```python
# 날짜 경계
date.today()                          # 서버 시간대 기준 오늘
# 한국 시간 08:00 = UTC 전날 23:00 → 서버가 UTC 면 "어제"가 된다
```

**"자정 근처에 만든 데이터가 하루 전으로 집계되는" 결함**이 여기서 나온다.

### pytest 테스트 코드 읽기

QA가 개발팀의 테스트를 읽고 **"이건 뭘 검증하는가"** 를 판단할 일이 있다.

```python
import pytest

def test_shipping_free_over_30000():
    assert calc_shipping(30000) == 0

@pytest.mark.parametrize("subtotal,expected", [
    (29999, 3000),
    (30000, 0),
    (30001, 0),
])
def test_shipping_boundary(subtotal, expected):
    assert calc_shipping(subtotal) == expected

def test_raises_on_negative():
    with pytest.raises(ValueError):
        calc_shipping(-1)
```

**QA 관점의 검토**

```text
□ parametrize 에 경계값이 다 있는가 (트랙 1)
□ assert 가 실질적인 검증인가
   assert result is not None        ← 약한 검증
   assert result == 9000            ← 강한 검증
□ 예외 케이스가 있는가 (pytest.raises)
□ 픽스처가 테스트 간 상태를 공유하지 않는가 (트랙 3의 격리)
□ mock 을 과하게 써서 실제로는 아무것도 검증하지 않는가  ← 중요
```

**마지막 항목이 핵심이다.**

```python
def test_create_order(mocker):
    mocker.patch('app.db.save', return_value=True)
    mocker.patch('app.payment.charge', return_value=True)
    mocker.patch('app.inventory.reserve', return_value=True)

    result = create_order(data)
    assert result.success is True      # ← 전부 mock 인데 무엇을 검증한 건가?
```

**모든 의존성을 mock 하면 테스트는 통과하지만 아무것도 검증하지 않는다.** 트랙 4의 "가짜 통과"가 유닛 테스트에서 나타나는 형태다.

**개발팀에 물어볼 수 있는 질문**: "이 테스트는 mock 이 다 걸려 있는데, 실제 통합 동작은 어디서 검증되나요?"

### 코드를 읽고 TC 뽑기 — 종합 예제

```python
def refund(order_id: str, amount: int = None):
    order = db.get_order(order_id)

    if order.status != 'PAID':
        raise ValueError('결제 완료 상태가 아닙니다')

    refund_amount = amount or order.total

    if refund_amount > order.total:
        raise ValueError('결제 금액을 초과합니다')

    try:
        pg.refund(order.payment_id, refund_amount)
        order.status = 'REFUNDED'
        db.save(order)
    except Exception as e:
        logger.error(f'환불 실패: {e}')
        return {'success': False}

    return {'success': True, 'amount': refund_amount}
```

**나오는 TC와 질문**

```text
경계·조건
  □ amount 가 정확히 order.total
  □ amount 가 order.total + 1 → 예외
  □ amount 가 0  ← `amount or order.total` 이므로 0 이면 전액 환불된다!  ★결함
  □ amount 가 음수 → 검증이 없다  ★결함
  □ status 가 PAID 가 아닌 각 상태 (PENDING, CANCELLED, REFUNDED)

부분 환불
  □ 부분 환불 후 status 가 REFUNDED 가 된다 → 두 번째 부분 환불이 막힌다  ★결함
  □ 부분 환불 누적 합계가 총액을 넘지 않는지 검증이 없다

에러 처리
  □ PG 환불은 성공했는데 db.save 가 실패하면?
    → 돈은 나갔는데 상태는 PAID  ★심각
  □ except 가 모든 예외를 잡아 success: False 만 반환 → 원인을 알 수 없다

null 안전성
  □ order 가 없으면 (잘못된 order_id) → AttributeError

멱등성
  □ 같은 환불 요청을 두 번 보내면 두 번 환불되는가
```

**★ 표시 4개가 진짜 결함 후보다.** 특히 `amount or order.total` 은 앞 레슨의 falsy 함정과 같은 문제다 — Python도 `0` 이 falsy 다.

## 왜 채용시장이 요구하는가

- 백엔드가 Python인 회사에서 **QA가 서버 코드를 읽을 수 있는 것**은 큰 차별점이다.
- **배치·정산 스크립트 검증**은 도메인에 따라 매우 중요한데, 할 수 있는 QA가 드물다. 금융·커머스에서 특히 그렇다.
- **멱등성 개념**을 알고 배치 재실행을 테스트할 수 있으면 시니어로 읽힌다.
- **mock 과다 사용 테스트를 지적**할 수 있으면 개발팀과 대등하게 대화한다.
- **AI가 만든 Python 코드**에서 가변 기본값, `round()` 동작, naive/aware datetime 혼용은 자주 나오는 실수다.

## 실습 과제

### 과제 1 — 함정 직접 확인 (12분)

Python이 없으면 브라우저 기반 실행 환경(온라인 REPL)을 써도 된다.

```python
# 1. 가변 기본값
def f(x, acc=[]):
    acc.append(x); return acc
print(f(1)); print(f(2)); print(f(3))

# 2. round
print(round(0.5), round(1.5), round(2.5), round(3.5))

# 3. 정수 나눗셈
print(10 // 3, -10 // 3, 10 % 3, -10 % 3)

# 4. 얕은 복사
a = {'x': [1,2]}; b = a.copy(); b['x'].append(3); print(a)

# 5. 순회 중 삭제
items = [1,2,3,4,5]
for i in items:
    if i % 2 == 0: items.remove(i)
print(items)

# 6. finally return
def g():
    try: raise ValueError('실패')
    finally: return '성공'
print(g())
```

각 결과가 **왜 그런지**와 **어떤 실제 결함을 만들 수 있는지** 적는다.

### 과제 2 — 환불 함수 결함 찾기 (18분)

위 종합 예제의 `refund` 함수에서 **찾은 결함마다 TC를 작성**한다.

| # | 결함 | 재현 입력 | 기대 동작 | 실제 동작 | 심각도 |
|---|---|---|---|---|---|
| | | | | | |

**`amount=0` 케이스**를 반드시 포함한다. 그리고 왜 그렇게 되는지 코드 라인으로 설명한다.

### 과제 3 — 배치 스크립트 검증 설계 (15분)

위의 `daily_settlement` 함수에 대해:

1. 8가지 질문에 대한 **검증 방법**을 각각 적는다
2. **멱등성 테스트** 절차를 구체적으로 작성
   - 어떻게 두 번 실행할 것인가
   - 무엇으로 중복을 확인할 것인가 (트랙 2의 SQL)
3. 실패 시나리오 3개와 각각의 기대 동작

### 과제 4 — 시간대 실험 (12분)

```python
from datetime import datetime, timezone, timedelta
KST = timezone(timedelta(hours=9))

print(datetime.now())
print(datetime.utcnow())
print(datetime.now(timezone.utc))
print(datetime.now(KST))
print(datetime.now(timezone.utc).date(), datetime.now(KST).date())
```

**한국 시간 오전 8시에 실행하면 UTC 날짜와 KST 날짜가 다르다.** 이 차이가 만들 수 있는 결함 시나리오 3개를 적는다.

(실행 시각이 다르면 시간을 조작해서라도 확인해 본다)

### 과제 5 — pytest 코드 검토 (12분)

오픈소스 프로젝트의 `tests/` 디렉터리에서 테스트 파일 하나를 골라 검토한다.

| 확인 항목 | 결과 |
|---|---|
| 경계값 테스트가 있는가 | |
| assert 가 실질적인가 (`is not None` 만 있지 않은가) | |
| 예외 케이스가 있는가 | |
| mock 이 과도한 테스트가 있는가 | |
| 테스트 간 상태 공유가 있는가 | |

**mock 과도 사례를 찾으면** 개발팀에 물어볼 질문 문장을 작성한다.

### 과제 6 — AI Python 코드 검증 (12분)

AI 실습 도우미에 요청한다.

> 주문 목록을 받아 일별 매출을 집계하는 Python 함수를 작성하라. 취소된 주문은 제외한다.

| 확인 항목 | 결과 |
|---|---|
| 가변 기본값을 썼는가 | |
| 금액을 float 로 다루는가 | |
| 날짜 경계 처리 (BETWEEN 함정) | |
| 시간대를 고려했는가 (naive/aware) | |
| 예외 처리가 삼키는 형태인가 | |
| 멱등성을 언급했는가 | |
| 대용량 데이터를 고려했는가 | |

그다음 **AI에게 이 함수의 TC를 만들게** 하고, 본인이 만든 것과 비교한다.

## 자가 체크리스트

- [ ] QA가 Python 코드를 만나는 5가지 상황을 안다
- [ ] 배치·정산 스크립트가 왜 특히 위험한지 설명할 수 있다
- [ ] `d['key']` 와 `d.get('key')` 의 차이와 각각의 위험을 안다
- [ ] **가변 기본값 함정**을 알아보고 테스트로 확인할 수 있다
- [ ] 얕은 복사와 `copy.deepcopy` 의 차이를 안다
- [ ] 순회 중 삭제가 요소를 건너뛰는 문제를 안다
- [ ] `//` 의 음수 처리와 `round()` 의 은행가 반올림을 안다
- [ ] 금액 계산에 `float` 대신 `Decimal` 이나 정수를 써야 함을 안다
- [ ] `except: pass` 를 코드 리뷰에서 지적할 수 있다
- [ ] `finally` 의 return 이 예외를 삼키는 것을 안다
- [ ] 배치 스크립트에서 확인할 8가지 질문을 던질 수 있다
- [ ] **멱등성**의 의미와 배치 재실행 테스트 방법을 안다
- [ ] naive와 aware datetime의 차이와 혼용 시 문제를 안다
- [ ] 서버 UTC / 사용자 KST 차이가 만드는 날짜 경계 결함을 안다
- [ ] pytest 코드에서 경계값·실질적 assert·예외 케이스를 검토할 수 있다
- [ ] **mock 과다로 아무것도 검증하지 않는 테스트**를 지적할 수 있다
- [ ] 코드를 읽고 결함 후보에 ★를 붙여 우선순위를 매길 수 있다
- [ ] AI Python 코드에서 가변 기본값·float 금액·시간대 문제를 잡아낼 수 있다

## 참고 링크

- [Python 공식 문서 (한국어)](https://docs.python.org/ko/3/) — 표준 라이브러리 확인
- [Common Gotchas (The Hitchhiker's Guide to Python)](https://docs.python-guide.org/writing/gotchas/) — 가변 기본값 등 함정 모음
- [Python — decimal 모듈](https://docs.python.org/ko/3/library/decimal.html) — 금액 계산
- [Python — datetime 시간대](https://docs.python.org/ko/3/library/datetime.html#aware-and-naive-objects) — naive/aware
- [pytest 문서](https://docs.pytest.org/) — parametrize, fixture, raises
- [점프 투 파이썬](https://wikidocs.net/book/1) — 무료 한국어 입문서
