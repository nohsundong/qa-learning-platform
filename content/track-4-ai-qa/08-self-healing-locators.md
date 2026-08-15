---
id: t4-l08
title: 셀프힐링 — 깨진 로케이터 자동 보정 구현
summary: 배포로 DOM이 바뀌어 테스트가 깨졌을 때 자동으로 요소를 다시 찾는다. 직접 구현하고, 이 기법의 진짜 위험까지 다룬다.
minutes: 22
order: 8
tags: [셀프힐링, 로케이터, 자동복구, Playwright, AI]
---

## 개념 설명

### 문제 상황

트랙 3에서 봤듯이 자동화 실패 원인의 절반이 셀렉터다.

```html
<!-- 배포 전 -->
<button class="btn-primary" data-testid="checkout">결제하기</button>

<!-- 배포 후: 디자인 시스템 교체 -->
<button class="Button_root__x7f2a">결제하기</button>
```

`data-testid` 가 사라지고 클래스가 바뀌었다. 하지만 **사람이 보면 여전히 같은 버튼**이다. 텍스트도 같고, 역할도 같고, 위치도 비슷하다.

**셀프힐링은 이 "사람의 판단"을 코드로 옮기는 것**이다.

### 두 가지 접근

| | 규칙 기반 | AI 기반 |
|---|---|---|
| 방법 | 후보 로케이터를 여러 개 두고 순차 시도 | 접근성 트리를 AI에게 주고 "이 요소를 찾아라" |
| 비용 | 0원 | API 호출 비용 |
| 속도 | 빠름 | 느림 (수 초) |
| 커버리지 | 예상한 변경만 | 예상 못 한 변경도 |
| 예측 가능성 | 높음 | 낮음 |

**실무 권장: 규칙 기반을 1차로, AI를 2차 폴백으로.** 대부분의 변경은 규칙 기반으로 잡히고, AI 호출은 드물게 일어나 비용이 거의 안 든다.

### 1단계 — 규칙 기반 셀프힐링

핵심 아이디어는 **하나의 논리적 요소에 여러 후보를 등록**하는 것이다.

```typescript
// utils/healing-locator.ts
import { Page, Locator } from '@playwright/test';

type Candidate = { name: string; build: (page: Page) => Locator };

export async function healingLocator(
  page: Page,
  key: string,
  candidates: Candidate[],
  opts: { timeout?: number } = {}
): Promise<Locator> {
  const timeout = opts.timeout ?? 2000;
  const tried: string[] = [];

  for (const c of candidates) {
    const locator = c.build(page);
    try {
      // 첫 번째 후보가 아니면 "치유됨" — 반드시 기록한다
      await locator.first().waitFor({ state: 'visible', timeout });
      const count = await locator.count();

      if (count === 0) { tried.push(`${c.name}(0건)`); continue; }
      if (count > 1)  { tried.push(`${c.name}(${count}건 모호)`); continue; }

      if (c !== candidates[0]) {
        reportHealing({
          key,
          failed: tried,
          healedBy: c.name,
          url: page.url(),
          at: new Date().toISOString(),
        });
      }
      return locator;
    } catch {
      tried.push(`${c.name}(타임아웃)`);
    }
  }

  throw new Error(
    `[셀프힐링 실패] "${key}" 를 찾지 못했습니다.\n시도한 후보: ${tried.join(', ')}`
  );
}
```

**사용**

```typescript
// pages/CheckoutPage.ts
const checkoutButton = () => healingLocator(page, 'checkout-button', [
  { name: 'testid',   build: p => p.getByTestId('checkout') },
  { name: 'role+name', build: p => p.getByRole('button', { name: '결제하기' }) },
  { name: 'text',     build: p => p.getByText('결제하기', { exact: true }) },
  { name: 'aria',     build: p => p.locator('[aria-label="결제하기"]') },
]);
```

**후보 순서가 설계다.** 트랙 3의 로케이터 우선순위를 그대로 따르되, 가장 안정적인 것을 앞에 둔다.

`count > 1` 일 때 그 후보를 건너뛰는 것도 중요하다. **모호한 로케이터로 "치유"하면 엉뚱한 요소를 클릭한다.** 트랙 3의 strict mode 원리와 같다.

### 절대 빠뜨리면 안 되는 것 — 치유 로그

```typescript
// utils/healing-report.ts
import { appendFileSync, mkdirSync } from 'node:fs';

export function reportHealing(event: {
  key: string; failed: string[]; healedBy: string; url: string; at: string;
}) {
  mkdirSync('healing-reports', { recursive: true });
  appendFileSync('healing-reports/healed.jsonl', JSON.stringify(event) + '\n');
  console.warn(
    `⚠️  [셀프힐링] "${event.key}" 의 1순위 로케이터가 실패했습니다.\n` +
    `   실패: ${event.failed.join(', ')}\n` +
    `   대체: ${event.healedBy}\n` +
    `   → 로케이터를 갱신하거나 개발팀에 data-testid 를 요청하세요.`
  );
}
```

**치유가 조용히 일어나면 셀프힐링은 재앙이 된다.** 이유가 두 가지다.

1. **테스트가 통과하니까 아무도 모른다.** 6개월 뒤 모든 로케이터가 마지막 폴백으로 동작하고 있고, 그마저 깨지면 전부 죽는다
2. **`data-testid` 가 지워진 것이 실제로는 회귀일 수 있다.** 개발자가 실수로 지운 것을 셀프힐링이 덮어버린다

CI에서 치유 로그를 **경고로 표시**하고, 주간으로 집계한다.

```yaml
      - name: 셀프힐링 리포트
        if: always()
        run: |
          if [ -f healing-reports/healed.jsonl ]; then
            echo "::warning::셀프힐링이 $(wc -l < healing-reports/healed.jsonl)건 발생했습니다"
            cat healing-reports/healed.jsonl
          fi
```

### 2단계 — AI 기반 폴백

규칙 후보가 전부 실패했을 때만 호출한다.

```typescript
// utils/ai-heal.ts
export async function aiHeal(page: Page, description: string) {
  // 접근성 트리를 텍스트로 (6편)
  const snapshot = await page.accessibility.snapshot();

  const prompt = `
자동화 테스트가 요소를 찾지 못했다. 아래 접근성 트리에서 해당 요소를 찾아라.

## 찾는 요소
${description}

## 현재 화면 접근성 트리
${JSON.stringify(snapshot, null, 2)}

## 규칙
- Playwright 로케이터 우선순위를 따르라: getByRole > getByLabel > getByText.
- CSS 클래스 셀렉터는 제안하지 마라.
- 확실하지 않으면 confidence 를 낮추고 후보를 여러 개 제시하라.
- 해당하는 요소가 없다고 판단되면 candidates 를 빈 배열로 두어라.

## 출력 (JSON)
{
  "candidates": [
    { "locator": "getByRole('button', { name: '결제' })",
      "confidence": 0.0~1.0,
      "reason": "왜 이것이 찾는 요소라고 판단했는가" }
  ],
  "element_removed_possibility": "요소가 아예 제거됐을 가능성과 근거"
}
`;
  return await callAI(prompt);   // BYOK
}
```

**`element_removed_possibility` 를 요구하는 이유**: 요소가 없어진 것이 **기능이 제거된 결과**일 수 있다. 그건 치유할 대상이 아니라 **사양 변경 확인 대상**이다 (7편의 F 분류).

AI가 제안한 로케이터는 **반드시 검증한 뒤** 쓴다.

```typescript
const result = await aiHeal(page, '결제하기 버튼');
for (const c of result.candidates) {
  if (c.confidence < 0.7) continue;
  const loc = evalLocator(page, c.locator);       // 안전하게 파싱해 생성
  if (await loc.count() === 1 && await loc.isVisible()) {
    reportHealing({ key, healedBy: `ai:${c.locator}`, ... });
    return loc;
  }
}
throw new Error('AI 치유 실패');
```

**`count() === 1` 검증이 필수다.** AI가 제안한 로케이터가 3개를 잡으면 엉뚱한 것을 누른다.

### 셀프힐링의 진짜 위험

기술보다 이걸 아는 게 중요하다.

**위험 1 — 결함을 숨긴다**

```html
<!-- 배포 후: 버튼이 두 개가 됐다 (버그) -->
<button>결제하기</button>
<button>결제하기</button>   <!-- 렌더링 버그로 중복 -->
```

셀프힐링이 `first()` 로 하나를 잡아 통과시키면 **중복 렌더링 버그가 묻힌다.** 그래서 `count > 1` 이면 치유하지 않고 실패시키는 게 맞다.

**위험 2 — 잘못된 요소를 잡는다**

```html
<!-- 원래 -->
<button data-testid="delete-item">삭제</button>

<!-- 배포 후: testid 제거, 그리고 옆에 계정 삭제 버튼이 추가됨 -->
<button>삭제</button>          <!-- 상품 삭제 -->
<button>삭제</button>          <!-- 계정 삭제 -->
```

텍스트 기반 폴백이 두 번째를 잡으면 **테스트가 계정을 삭제한다.** 극단적이지만 실제로 가능한 시나리오다.

**대응**: 되돌릴 수 없는 액션(삭제, 결제, 전송)에는 **셀프힐링을 적용하지 않는다.** 명시적으로 제외한다.

```typescript
const NEVER_HEAL = ['delete-account', 'confirm-payment', 'send-message'];
if (NEVER_HEAL.includes(key)) {
  // 후보 1개만 사용. 실패하면 그냥 실패시킨다.
}
```

**위험 3 — 근본 원인이 방치된다**

셀프힐링은 **증상 완화**다 (7편과 같은 결론). 로케이터가 계속 깨진다는 건:

- 개발팀이 `data-testid` 를 유지하지 않고 있다 → **합의가 필요하다**
- 테스트가 구현 세부사항에 의존하고 있다 → **로케이터 전략을 고쳐야 한다**

**치유 로그를 근거로 개발팀과 대화하는 것**이 셀프힐링의 진짜 가치다. "지난달 셀프힐링 47건 중 32건이 결제 화면입니다. 이 화면에 `data-testid` 를 넣어주실 수 있을까요?" — 데이터가 있으면 요청이 통한다.

### 운영 규칙

```text
□ 치유는 반드시 로그로 남긴다 (조용한 치유 금지)
□ count > 1 이면 치유하지 않고 실패시킨다
□ 되돌릴 수 없는 액션에는 셀프힐링을 쓰지 않는다
□ AI 폴백 결과는 count === 1 검증 후 사용한다
□ 치유 로그를 주간 집계해 로케이터를 실제로 갱신한다
□ 같은 key 가 3주 연속 치유되면 → 코드 수정 또는 개발팀 요청
□ 치유율이 급증하면(예: 한 배포에 20건) → 배포 자체를 의심한다
□ 셀프힐링을 켰다고 로케이터 품질 관리를 멈추지 않는다
```

**마지막 항목이 가장 중요하다.** 셀프힐링은 트랙 3의 로케이터 전략을 **대체하지 않는다.** 좋은 로케이터를 쓰되, 그래도 깨질 때를 위한 안전망이다.

### 상용 도구와의 관계

Testim, Mabl, Functionize 같은 상용 도구들이 셀프힐링을 핵심 기능으로 내세운다. 유료이므로 이 플랫폼의 0원 제약에는 맞지 않지만, **평가할 때 물어볼 것**은 알아둔다.

```text
□ 치유 이력을 볼 수 있는가, 아니면 조용히 처리하는가
□ 치유 기준(무엇을 근거로 같은 요소라고 판단하는가)이 공개돼 있는가
□ 치유를 거부할 요소를 지정할 수 있는가
□ 잘못 치유했을 때 롤백이 되는가
□ 치유 데이터가 외부로 전송되는가 (보안)
```

**"치유 이력을 볼 수 있는가"** 가 첫 질문이어야 한다. 볼 수 없다면 위험 1·2를 통제할 수 없다.

## 왜 채용시장이 요구하는가

- **셀프힐링은 채용공고에 직접 등장하는 키워드**다. 특히 AI 기반 QA를 도입하려는 조직에서 묻는다.
- 면접에서 **"셀프힐링의 위험은 무엇인가요?"** 에 답할 수 있으면 큰 차이가 난다. 대부분은 장점만 말한다.
- **`count > 1` 이면 치유하지 않는다**, **되돌릴 수 없는 액션은 제외한다** 같은 구체적 설계는 실제로 만들어 본 사람의 언어다.
- **치유 로그를 근거로 개발팀에 `data-testid` 를 요청한다**는 접근은 QA가 조직을 움직이는 방식이다. 강한 인상을 준다.
- 상용 도구를 평가할 때 **올바른 질문**을 할 수 있는 것도 실무 역량이다.

## 실습 과제

### 과제 1 — 실습 랩 셀프힐링 시뮬레이터 (12분)

이 플랫폼의 **실습 랩 → 셀프힐링 시뮬레이터**를 먼저 해본다.

DOM 변경 전/후를 보고 **어떤 전략으로 복구할지** 선택하는 훈련이다. 코드를 쓰기 전에 판단 감각을 잡는다.

각 케이스에서 **"치유하면 안 되는 경우"** 를 골라내는 것에 집중한다.

### 과제 2 — 규칙 기반 셀프힐링 구현 (20분)

트랙 3 프로젝트에 `healingLocator` 를 구현한다.

1. 위 코드를 참고해 `utils/healing-locator.ts` 작성
2. 페이지 오브젝트 하나의 로케이터 3개를 셀프힐링으로 전환
3. **HTML을 직접 수정해** `data-testid` 를 지운다
4. 테스트를 실행 → 치유되고 경고가 뜨는지 확인
5. `healing-reports/healed.jsonl` 내용 확인

### 과제 3 — 위험 상황 재현 (15분)

**위험 1 (중복 요소)**

1. 같은 텍스트의 버튼을 2개로 만든다
2. `count > 1` 검사가 있을 때: 치유하지 않고 실패하는가
3. 검사를 제거했을 때: 조용히 통과하는가

**위험 2 (잘못된 요소)**

1. "삭제" 버튼 옆에 다른 "삭제" 버튼을 추가
2. `data-testid` 제거
3. 텍스트 폴백이 어느 것을 잡는지 확인

두 실험 결과를 메모에 적고, **`NEVER_HEAL` 목록에 무엇을 넣을지** 정한다.

### 과제 4 — AI 폴백 구현 (18분)

1. 접근성 트리 스냅샷을 뜨는 함수 작성
2. 규칙 후보가 전부 실패했을 때만 AI를 호출하도록 연결
3. **DOM을 크게 바꾼다** (구조 변경, 텍스트 변경: "결제하기" → "주문 완료하기")
4. AI가 올바른 요소를 찾는지 확인
5. `confidence` 와 `count === 1` 검증이 동작하는지 확인
6. **요소를 아예 삭제**하고 실행 → `element_removed_possibility` 를 제대로 지적하는가

6번이 중요하다. **없어진 요소를 억지로 찾아내면** 그게 더 위험하다.

### 과제 5 — 치유 로그 분석 (12분)

가상의 치유 로그를 만들어 분석 리포트를 작성한다.

```jsonl
{"key":"checkout-button","healedBy":"role+name","at":"2026-08-01"}
{"key":"checkout-button","healedBy":"role+name","at":"2026-08-08"}
{"key":"checkout-button","healedBy":"text","at":"2026-08-15"}
{"key":"cart-item","healedBy":"role+name","at":"2026-08-15"}
{"key":"coupon-input","healedBy":"aria","at":"2026-08-15"}
```

작성할 것:
- 어느 key 가 문제인가
- **폴백이 점점 뒤로 밀리는 패턴**이 보이는가 (checkout-button 주목)
- 개발팀에 보낼 요청 문장 (데이터 근거 포함)
- 언제 코드를 직접 고쳐야 하는가

**`checkout-button` 이 role+name → text 로 밀린 것**은 위험 신호다. 다음엔 아예 못 찾을 수 있다.

### 과제 6 — 도입 판단 문서 (12분)

본인 팀에 셀프힐링을 도입할지 판단하는 1페이지 문서를 쓴다.

```text
1. 현재 셀렉터 문제의 규모 (트랙 3의 실패 원인 분류 데이터)
2. 셀프힐링으로 얻는 것 / 잃는 것
3. 적용할 범위 / 절대 적용하지 않을 범위
4. 치유 로그 운영 방법
5. 근본 해결(개발팀과의 testid 합의)과 병행 계획
6. 도입하지 않는 선택지도 검토 — 로케이터 전략 개선만으로 될 수도 있다
```

**6번을 진지하게 검토한다.** 트랙 3에서 배운 대로, 로케이터가 자주 깨지는 것은 도구 문제가 아니라 전략 문제일 수 있다.

## 자가 체크리스트

- [ ] 셀프힐링이 무엇을 자동화하는 것인지 한 문장으로 설명할 수 있다
- [ ] 규칙 기반과 AI 기반의 차이와 조합 방식을 설명할 수 있다
- [ ] 후보 로케이터를 우선순위대로 등록하는 구조를 구현할 수 있다
- [ ] `count > 1` 일 때 치유하지 않고 실패시켜야 하는 이유를 안다
- [ ] **조용한 치유가 왜 재앙인지** 두 가지 이유로 설명할 수 있다
- [ ] 치유 이벤트를 로그로 남기고 CI 경고로 노출할 수 있다
- [ ] AI 폴백을 규칙 실패 시에만 호출해 비용을 통제할 수 있다
- [ ] AI 제안 로케이터를 `count === 1` 로 검증한 뒤 사용한다
- [ ] `element_removed_possibility` 를 물어 사양 변경 가능성을 확인한다
- [ ] 셀프힐링이 중복 렌더링 버그를 숨길 수 있음을 안다
- [ ] 되돌릴 수 없는 액션에는 셀프힐링을 적용하지 않는다
- [ ] 셀프힐링이 증상 완화이지 치료가 아니라는 것을 안다
- [ ] 치유 로그를 근거로 개발팀에 `data-testid` 를 요청할 수 있다
- [ ] 폴백이 점점 뒤로 밀리는 패턴을 위험 신호로 읽을 수 있다
- [ ] 상용 셀프힐링 도구를 평가할 때 물어볼 5가지 질문을 안다
- [ ] 셀프힐링을 켰다고 로케이터 품질 관리를 멈추지 않는다

## 참고 링크

- [Playwright — Locators](https://playwright.dev/docs/locators) — 후보 로케이터 설계의 기준
- [Playwright — Accessibility snapshot](https://playwright.dev/docs/api/class-accessibility) — AI 폴백의 입력
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — 접근성 트리 기반 요소 식별
- [Testing Library — Priority](https://testing-library.com/docs/queries/about/#priority) — 폴백 순서의 근거
