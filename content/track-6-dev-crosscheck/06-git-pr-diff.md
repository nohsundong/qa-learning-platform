---
id: t6-l06
title: Git 기본과 PR diff 읽는 법
summary: 변경 이력을 스스로 조회하고 diff를 읽어 회귀 범위를 정한다. 트랙 1의 범위 산정과 트랙 4의 에이전트가 이 능력 위에 선다.
minutes: 20
order: 6
tags: [Git, PR, diff, 회귀범위, 코드리뷰]
---

## 개념 설명

### QA에게 Git이 필요한 이유

```text
□ 이번 릴리즈에 무엇이 바뀌었는지 스스로 확인 → 회귀 범위 (트랙 1)
□ 이 결함이 언제 들어왔는지 추적 → 원인 커밋 찾기
□ PR 리뷰에 참여해 경계값·null 처리 지적 (트랙 6의 4·5편)
□ 자동화 테스트 코드를 직접 관리 (트랙 3)
□ AI 에이전트에게 diff 를 입력으로 주기 (트랙 4)
```

**"개발자에게 물어봐야만 알 수 있는" 상태에서 벗어나는 것**이 목표다.

### 필요한 명령어만

```bash
# 현재 상태
git status
git log --oneline -20
git log --oneline --graph --all -20      # 브랜치 구조까지

# 변경 내용 보기
git diff                                  # 아직 스테이징 안 한 변경
git diff --staged                         # 스테이징된 변경
git diff main...feature/coupon            # 브랜치 간 (PR 과 같은 범위)
git diff HEAD~3                           # 3커밋 전과 비교

# 요약만
git diff main...HEAD --stat               # 파일별 변경 줄 수
git diff main...HEAD --name-only          # 파일 목록만
git diff main...HEAD --name-status        # 파일 + 상태(A/M/D)

# 특정 파일의 이력
git log --oneline -- src/payment/          # 이 경로의 커밋만
git log -p src/payment/calc.js             # 변경 내용까지

# 누가 언제 이 줄을 바꿨나
git blame src/payment/calc.js
git blame -L 40,60 src/payment/calc.js     # 40~60 줄만
```

**`git diff main...HEAD`** (점 3개)가 PR과 같은 범위다. 점 2개(`..`)와 다르다.

```text
main..HEAD    두 브랜치의 현재 상태 차이
main...HEAD   main 에서 갈라진 지점부터 HEAD 까지  ← PR 이 보여주는 것
```

**QA가 실제로 가장 많이 쓰는 것**

```bash
# 릴리즈에 무엇이 들어갔나
git log --oneline v3.3.0..v3.4.0

# 어느 영역이 얼마나 바뀌었나
git diff v3.3.0..v3.4.0 --stat | tail -20

# 결제 쪽이 바뀌었나
git log --oneline v3.3.0..v3.4.0 -- src/payment/
```

**세 줄이면 회귀 범위의 출발점이 나온다.**

### diff 읽는 법

```diff
diff --git a/src/shipping.js b/src/shipping.js
index 3f2a1b4..8c9d2e1 100644
--- a/src/shipping.js
+++ b/src/shipping.js
@@ -12,7 +12,11 @@ function calcShipping(order, user) {
   const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
 
   if (user.grade === 'VIP') return 0;
-  if (subtotal > 30000) return 0;
+  if (subtotal >= 30000) return 0;
+
+  if (order.address.isRemote) {
+    return 6000;
+  }
   return 3000;
 }
```

| 기호 | 의미 |
|---|---|
| `---` / `+++` | 변경 전 / 후 파일 |
| `@@ -12,7 +12,11 @@` | 원본 12줄부터 7줄 → 변경 후 12줄부터 11줄 |
| `-` | 삭제된 줄 |
| `+` | 추가된 줄 |
| (공백) | 변경 없는 문맥 줄 |

**이 diff에서 QA가 즉시 읽어야 할 것**

```text
1. 부등호 변경: > → >=
   → 정확히 30000 인 케이스가 반대로 동작한다
   → 경계값 TC 필수 (29999 / 30000 / 30001)
   → 이게 버그 수정인가 사양 변경인가? 확인 필요

2. 새 분기 추가: isRemote
   → order.address 가 없으면 크래시  (앞 레슨)
   → VIP + 도서산간 조합은? 위 코드에선 VIP 가 먼저 return 되어 0원
   → 3만원 이상 + 도서산간도 0원  ← 명세와 맞는가?

3. 반환값 6000
   → 기본 3000 + 추가 3000 인가, 도서산간 고정 6000 인가
   → 기본 배송비가 바뀌면 함께 바뀌어야 하는데 하드코딩됨
```

**세 줄 바뀐 diff에서 TC 6건과 질문 3개가 나온다.** 이게 diff를 읽는 능력이다.

### 변경 유형별로 보는 곳이 다르다

트랙 4의 1단계에서 다룬 내용을 사람이 직접 하는 버전이다.

| diff에서 보이는 것 | 즉시 떠올릴 것 |
|---|---|
| 비교 연산자 변경 (`>` ↔ `>=`) | **경계값 TC** |
| 조건 추가/삭제 | 결정테이블 재작성 |
| 함수 시그니처 변경 | 호출처를 다 고쳤는가 |
| 새 파라미터에 기본값 | 기존 호출부가 기본값으로 동작 — 의도인가 |
| `null` 체크 삭제 | 왜 안전해졌는가 |
| try/catch 추가 | 무엇을 삼키는가 (앞 레슨) |
| 상수 값 변경 | 그 값에 의존하는 곳 전부 |
| 의존성 버전 업 | 변경 로그 확인 |
| DB 마이그레이션 파일 | **롤백 가능한가** (트랙 1) |
| 설정 파일 | 환경별로 다르게 적용되는가 |
| 테스트 파일 삭제 | **왜 지웠는가** ← 반드시 물어볼 것 |

**마지막 항목이 중요하다.** 제품 코드 변경과 함께 테스트가 삭제됐다면, 트랙 4에서 다룬 "테스트를 약화시켜 통과시키기"가 사람 손으로 일어난 것일 수 있다.

### 공통 모듈 변경 — 호출처 역추적

```bash
# 변경된 함수 찾기
git diff main...HEAD | grep -E '^[+-].*(function|const .* =)' 

# 그 함수를 쓰는 곳 찾기
grep -rn "calcShipping" src/ --include="*.js" --include="*.ts"

# 또는 git 이 추적하는 파일에서만
git grep -n "calcShipping"
```

**`git grep` 이 일반 `grep` 보다 빠르고 정확하다.** `.gitignore` 된 것(node_modules 등)을 안 뒤진다.

```text
결과가 3곳 → 범위가 좁다
결과가 47곳 → 공통 모듈. 회귀 범위를 크게 잡아야 한다
```

이 정보를 **트랙 4의 에이전트에게 함께 주면** 간접 영향 탐지가 크게 좋아진다.

### 결함이 언제 들어왔는지 찾기

**`git blame`** — 이 줄을 누가 언제 바꿨나

```bash
git blame -L 12,20 src/shipping.js
```

```text
8c9d2e1a (김개발 2026-08-10 14:23:11 +0900 15)   if (subtotal >= 30000) return 0;
3f2a1b4c (박개발 2026-05-02 09:11:45 +0900 16)   return 3000;
```

**커밋 해시로 그 변경의 전체 맥락**을 볼 수 있다.

```bash
git show 8c9d2e1a               # 그 커밋의 전체 diff
git log --oneline --all --source | grep 8c9d2e1  # 어느 브랜치/PR 인지
```

**`git bisect`** — 이진 탐색으로 원인 커밋 찾기

언제부터 깨졌는지 모를 때 쓴다. 커밋 100개 중 범인을 **7번의 확인**으로 찾는다.

```bash
git bisect start
git bisect bad                  # 현재는 깨져 있다
git bisect good v3.3.0          # 이 버전은 정상이었다

# git 이 중간 커밋으로 이동시킨다
# 여기서 재현 시도 후:
git bisect good    # 또는 git bisect bad

# 반복하면 범인 커밋을 알려준다
git bisect reset                # 원래대로 복귀
```

**자동화 테스트가 있으면 자동으로 돌릴 수도 있다.**

```bash
git bisect run npx playwright test tests/shipping.spec.ts
```

**이게 자동화의 숨은 가치다.** 트랙 3에서 만든 테스트가 여기서 원인 추적에 쓰인다.

### PR 리뷰에서 QA가 하는 일

개발자와 보는 곳이 다르다.

| 개발자가 보는 것 | QA가 보는 것 |
|---|---|
| 설계·구조 | **테스트 가능성** |
| 성능 | 경계값·null 처리 (4·5편) |
| 코드 스타일 | 에러 처리와 사용자에게 보이는 것 |
| 재사용성 | **회귀 범위** |
| | `data-testid` 가 유지되는가 (트랙 3) |
| | 테스트가 함께 추가/수정됐는가 |
| | 롤백 가능한 변경인가 (트랙 1) |

**QA가 PR에 남기는 좋은 코멘트 예시**

```text
[질문] 배송비 조건이 > 에서 >= 로 바뀌었습니다.
정확히 30,000원 주문이 이전에는 3,000원, 이제는 0원이 됩니다.
버그 수정인가요, 사양 변경인가요?
사양 변경이면 기존 TC-SHIP-004 를 업데이트하겠습니다.

[제안] order.address 가 없는 경우 크래시가 날 것 같습니다.
신규 주문 생성 직후에도 address 가 항상 있나요?

[테스트] 이 변경에 대해 아래 TC 를 추가하겠습니다.
- 29,999 / 30,000 / 30,001 경계
- VIP + 도서산간 조합
- address 누락 케이스
회귀 범위는 결제·주문 스위트로 잡겠습니다.

[요청] 장바구니 삭제 버튼의 data-testid 가 제거됐는데,
자동화 테스트가 이 속성에 의존합니다. 유지 가능할까요?
```

**네 번째가 QA만 할 수 있는 코멘트다.** 트랙 3·4의 셀렉터 관리와 직결된다.

### 커밋 메시지와 티켓 연결

```bash
git commit -m "fix(shipping): 무료배송 기준을 이상으로 수정 (PROJ-1423)"
```

**티켓 번호를 커밋에 넣으면** 트랙 2에서 다룬 대로 코드 변경과 결함이 자동 연결된다.

```bash
# 특정 티켓 관련 커밋 찾기
git log --oneline --grep="PROJ-1423"

# 릴리즈 노트 초안 만들기
git log --oneline v3.3.0..v3.4.0 --grep="^feat\|^fix"
```

**Conventional Commits** 형식(`feat:`, `fix:`, `refactor:`)을 쓰는 팀이면 이걸로 릴리즈 범위를 분류할 수 있다.

```bash
# 이번 릴리즈의 기능 추가와 버그 수정 분리
git log --oneline v3.3.0..v3.4.0 | grep "^[a-f0-9]* feat"
git log --oneline v3.3.0..v3.4.0 | grep "^[a-f0-9]* fix"
```

**`refactor:` 만 있는 릴리즈**를 봤다면, 트랙 1에서 배운 대로 **회귀를 가장 크게 잡아야 한다.**

### QA가 실수하기 쉬운 Git 상황

```bash
# 1. 로컬 변경을 날렸다
git reflog                       # 최근 HEAD 이동 이력 — 대부분 여기서 복구된다
git reset --hard <해시>

# 2. 실수로 커밋했다 (아직 push 안 함)
git reset --soft HEAD~1          # 커밋만 취소, 변경은 유지

# 3. 남의 브랜치를 로컬에서 보고 싶다
git fetch origin
git checkout origin/feature/coupon    # 읽기 전용으로 확인

# 4. 충돌이 났다
git status                       # 어느 파일인지 확인
# 충돌 마커(<<<<<<< ======= >>>>>>>)를 편집기에서 해결 후
git add <파일> && git commit
```

**`git reflog` 를 알면 대부분의 사고는 복구된다.** 이것만 기억해도 Git이 덜 무섭다.

### GitHub에서 PR 읽기

웹 UI에서 유용한 기능들.

```text
□ Files changed 탭 → 전체 diff
□ 우측 상단 톱니 → "Hide whitespace" (공백 변경 숨기기, 포맷팅 노이즈 제거)
□ 파일 우측 "Viewed" 체크 → 큰 PR 을 나눠서 검토
□ 줄 번호 클릭 → 그 줄에 코멘트
□ Commits 탭 → 커밋 단위로 나눠 보기
□ URL 에 .diff 또는 .patch 붙이기 → 원문 텍스트
   https://github.com/org/repo/pull/123.diff
```

**마지막이 유용하다.** `.diff` 로 받은 텍스트를 그대로 AI에게 주거나 파일로 저장할 수 있다 (트랙 4).

```bash
# gh CLI 를 쓰면 더 간단하다
gh pr diff 123
gh pr view 123 --json files,title,body
```

## 왜 채용시장이 요구하는가

- **"Git 사용 경험"** 은 이제 QA 공고의 기본 항목이다. 자동화 코드를 관리하려면 필수다.
- **"PR diff 를 읽고 회귀 범위를 정한다"** 는 시니어 QA의 핵심 역량이고, 트랙 4의 에이전트가 자동화하려는 바로 그 판단이다.
- 면접 질문: **"이번 릴리즈의 회귀 범위를 어떻게 정하세요?"** — diff와 호출처 역추적을 말할 수 있으면 강하다.
- **PR 리뷰에 참여하는 QA**는 조직에서 위치가 다르다. `data-testid` 유지 요청 같은 코멘트는 QA만 할 수 있다.
- **`git bisect` 로 원인 커밋을 찾아본 경험**은 흔치 않고, 자동화 테스트의 가치를 이해한다는 신호다.

## 실습 과제

### 과제 1 — 오픈소스 PR 읽기 (18분)

GitHub에서 활발한 오픈소스 프로젝트의 **머지된 PR** 하나를 고른다. (너무 크지 않은 것, 변경 50줄 내외)

| 항목 | 내용 |
|---|---|
| 변경 유형 (기능/수정/리팩터링) | |
| 변경된 파일 수와 영역 | |
| 조건문·경계 변경이 있는가 | |
| 새로 추가된 분기 | |
| 테스트가 함께 추가/수정됐는가 | |
| **내가 뽑은 TC 목록** | |
| **개발자에게 물어볼 질문 3개** | |

**"테스트가 함께 있는가"** 를 꼭 확인한다. 없으면 왜 없는지가 질문거리다.

### 과제 2 — 명령어 손에 익히기 (15분)

아무 오픈소스 저장소를 클론해서 실행한다.

```bash
git clone --depth 50 <repo> && cd <repo>

git log --oneline -20
git log --oneline --graph --all -15
git diff HEAD~5 --stat
git diff HEAD~5 --name-status
git log --oneline -- <디렉터리>
git blame -L 1,30 <파일>
git grep -n "<함수명>"
```

각 명령의 출력에서 **QA가 쓸 수 있는 정보**가 무엇인지 한 줄씩 적는다.

### 과제 3 — 회귀 범위 산정 (18분)

과제 2의 저장소에서 최근 10커밋을 릴리즈 범위로 가정한다.

```bash
git diff HEAD~10 --name-status
git diff HEAD~10 --stat | tail -20
```

1. 변경된 영역을 분류
2. 공통 모듈이 있으면 `git grep` 으로 **호출처 개수** 확인
3. 회귀 범위를 직접/간접으로 나눠 정리
4. **테스트하지 않을 영역과 이유**도 명시 (트랙 1)

| 영역 | 변경 줄 수 | 호출처 | 영향 | 회귀 범위 |
|---|---|---|---|---|
| | | | 직접/간접/없음 | |

### 과제 4 — bisect 실습 (15분)

연습용 저장소를 만들어 직접 해본다.

```bash
mkdir bisect-practice && cd bisect-practice && git init
# calc.js 를 만들고 10번 커밋한다. 중간(5번째쯤)에 버그를 심는다.
# 예: return a + b  →  return a - b
```

```bash
git bisect start
git bisect bad HEAD
git bisect good HEAD~9
# 각 단계에서 node -e "..." 로 확인 후 good/bad
git bisect reset
```

**몇 번 만에 찾았는지** 세어본다. 그리고 `git bisect run` 으로 자동화해 본다.

### 과제 5 — PR 리뷰 코멘트 쓰기 (15분)

트랙 6의 4편 과제에서 찾은 결함들을 **PR 코멘트 형식**으로 작성한다.

최소 4개, 각각 다른 유형으로:
- `[질문]` 사양 확인
- `[제안]` 개선 제안
- `[테스트]` 추가할 TC 공유
- `[요청]` 테스트 가능성 관련 요청 (`data-testid` 등)

**단정하지 않고, 근거를 대고, 다음 행동을 제시하는** 형식을 지킨다.

### 과제 6 — diff를 AI에 넘기기 (12분)

과제 1의 PR을 `.diff` 로 받아 AI 실습 도우미에 준다.

```bash
curl -sL https://github.com/<org>/<repo>/pull/<번호>.diff -o pr.diff
```

트랙 4의 1단계 프롬프트로 회귀 범위를 분석시키고, **과제 1에서 본인이 뽑은 것과 비교**한다.

| 비교 | 나 | AI |
|---|---|---|
| 직접 영향 | | |
| 간접 영향 | | |
| 경계값 지적 | | |
| **evidence 가 실제 존재하는가** | — | |
| 놓친 것 | | |

**호출처 정보를 함께 준 경우와 안 준 경우**도 비교하면 트랙 4의 실습이 완성된다.

## 자가 체크리스트

- [ ] QA가 Git을 알아야 하는 5가지 이유를 안다
- [ ] `git log --oneline`, `--stat`, `--name-status` 를 상황에 맞게 쓸 수 있다
- [ ] `main..HEAD` 와 `main...HEAD` 의 차이를 안다
- [ ] 릴리즈 두 태그 사이의 변경을 조회할 수 있다
- [ ] diff의 `@@`, `+`, `-` 표기를 읽을 수 있다
- [ ] 부등호 변경을 보면 즉시 경계값 TC를 떠올린다
- [ ] 새 분기 추가에서 null 안전성과 조합 커버리지를 확인한다
- [ ] 변경 유형별로 무엇을 봐야 하는지 11가지를 안다
- [ ] **테스트 파일 삭제**를 발견하면 이유를 묻는다
- [ ] `git grep` 으로 호출처를 역추적해 간접 영향을 판단할 수 있다
- [ ] `git blame` 으로 특정 줄의 변경 시점과 커밋을 찾을 수 있다
- [ ] `git bisect` 로 원인 커밋을 이진 탐색할 수 있다
- [ ] `git bisect run` 으로 자동화 테스트와 결합할 수 있다
- [ ] PR 리뷰에서 QA가 보는 관점 7가지를 안다
- [ ] `data-testid` 제거 같은 테스트 가능성 이슈를 PR에서 지적할 수 있다
- [ ] 커밋 메시지의 티켓 번호로 코드와 결함을 연결할 수 있다
- [ ] `refactor:` 만 있는 릴리즈에 회귀를 크게 잡아야 함을 안다
- [ ] `git reflog` 로 사고를 복구할 수 있다
- [ ] GitHub PR의 `.diff` URL 이나 `gh pr diff` 로 원문을 얻을 수 있다

## 참고 링크

- [Pro Git (한국어 무료)](https://git-scm.com/book/ko/v2) — 공식 책
- [Learn Git Branching](https://learngitbranching.js.org/?locale=ko) — 브라우저에서 하는 인터랙티브 학습, 무료
- [git bisect 문서](https://git-scm.com/docs/git-bisect) — 자동화 옵션 포함
- [GitHub CLI (gh)](https://cli.github.com/) — PR 조회·diff 다운로드
- [Conventional Commits](https://www.conventionalcommits.org/ko/) — 커밋 메시지 규약
