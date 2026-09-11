# 🧪 QA-Lab — QA 엔지니어 자기개발 학습 플랫폼

2026년 QA 채용시장이 요구하는 역량을 **62개 레슨**과 **5개 실습 랩**으로 학습하는 개인용 웹 플랫폼입니다.

**서버 없음 · 데이터베이스 없음 · 빌드 도구 없음 · 비용 0원.**
`index.html` 을 더블클릭하면 바로 열립니다.

```
📚 8개 트랙 · 62 레슨 · 약 21시간 분량
✅ 자가 체크리스트 883항목
🔬 실습 랩 5종 (결함 심은 샘플 앱 / 셀렉터 연습기 / 스크립트 리뷰어 / 셀프힐링 시뮬레이터 / 에이전틱 운영 판단 훈련)
📧 평일 아침 학습 브리핑 메일 (GitHub Actions)
🤖 AI 기능은 BYOK — 키가 없어도 콘텐츠와 실습 랩은 100% 동작
```

---

## 목차

1. [바로 써보기](#1-바로-써보기)
2. [GitHub Pages 배포](#2-github-pages-배포)
3. [아침 브리핑 메일 설정](#3-아침-브리핑-메일-설정)
4. [진도 스냅샷 동기화](#4-진도-스냅샷-동기화)
5. [AI 기능 설정 (BYOK)](#5-ai-기능-설정-byok)
6. [콘텐츠 추가·수정하기](#6-콘텐츠-추가수정하기)
7. [커리큘럼](#7-커리큘럼)
8. [파일 구조](#8-파일-구조)
9. [문제 해결](#9-문제-해결)
10. [비용이 0원인 이유](#10-비용이-0원인-이유)

---

## 1. 바로 써보기

### 방법 A — 더블클릭 (가장 간단)

```bash
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

파일 탐색기에서 `index.html` 을 더블클릭해도 됩니다.

> **왜 이게 되나요?**
> `file://` 프로토콜에서는 브라우저가 `fetch()` 를 CORS 정책으로 막습니다.
> 그래서 `content/lessons.bundle.js` 라는 번들 파일을 `<script>` 태그로 주입하는 방식으로 우회했습니다.
> 이 번들은 `.md` 원본에서 자동 생성되며, 저장소에 이미 포함돼 있습니다.

### 방법 B — 로컬 서버 (콘텐츠를 자주 고칠 때)

`.md` 파일을 고치면 **새로고침만으로 즉시 반영**됩니다. 번들 재생성이 필요 없습니다.

```bash
python3 -m http.server 8123
# 또는
npx serve .
```

브라우저에서 `http://localhost:8123` 을 엽니다.

### 방법 C — GitHub Pages (어디서나 접속)

아래 [2번](#2-github-pages-배포)을 따라 하세요. 스마트폰에서도 열립니다.

---

## 2. GitHub Pages 배포

**public 저장소는 무료입니다.** 별도 워크플로 없이 브랜치 배포만으로 끝납니다.

### 2-1. 저장소에 올리기

이미 저장소가 있다면 건너뜁니다.

```bash
git init -b main
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/<사용자명>/qa-learning-platform.git
git push -u origin main
```

> 저장소는 반드시 **Public** 으로 만드세요.
> Private 저장소도 Pages 를 쓸 수 있지만 유료 플랜이 필요하고, Actions 무료 분량도 제한됩니다.

### 2-2. Pages 켜기

1. GitHub 저장소 → **Settings** 탭
2. 왼쪽 메뉴 → **Pages**
3. **Source** 를 `Deploy from a branch` 로 선택
4. **Branch** 를 `main`, 폴더를 `/ (root)` 로 선택
5. **Save**

1~2분 뒤 아래 주소로 열립니다.

```
https://<사용자명>.github.io/qa-learning-platform/
```

> `.nojekyll` 파일이 저장소에 있어야 합니다. (이미 포함돼 있습니다)
> 없으면 GitHub 이 Jekyll 로 처리하면서 `_` 로 시작하는 파일을 무시합니다.

### 2-3. 확인

- 대시보드가 보이는가
- 레슨을 열면 본문이 렌더링되는가
- 체크박스를 누르고 새로고침해도 유지되는가

세 가지가 되면 배포 성공입니다.

---

## 3. 아침 브리핑 메일 설정

평일 아침 **한국시간 08:00** 에 학습 브리핑이 메일로 옵니다.

```
1. 오늘 학습할 레슨 1개 (진도 기준 추천)
2. 어제까지의 진도율 · 연속 학습일 · 트랙별 진도
3. 복습해야 할 약점 항목 3개
4. 오늘의 QA 지식 한 조각 (136개 풀에서 순환)
5. 오늘의 실습 미션 1개 (82개 풀에서 순환, 10~20분)
```

### 3-1. Gmail 앱 비밀번호 발급

⚠️ **계정 비밀번호가 아닙니다.** 앱 전용 16자리 비밀번호를 따로 발급해야 합니다.

**① 2단계 인증을 먼저 켭니다** (앱 비밀번호는 2단계 인증이 켜져 있어야 나타납니다)

1. https://myaccount.google.com/security 접속
2. **Google에 로그인하는 방법** → **2단계 인증**
3. 안내에 따라 켭니다 (휴대폰 번호 또는 인증 앱)

**② 앱 비밀번호를 만듭니다**

1. https://myaccount.google.com/apppasswords 접속
   (2단계 인증이 꺼져 있으면 이 페이지가 열리지 않습니다)
2. 앱 이름에 `QA-Lab` 을 입력하고 **만들기**
3. **16자리 비밀번호가 한 번만 표시됩니다.** 바로 복사하세요
   - 예: `abcd efgh ijkl mnop` → 공백은 빼고 `abcdefghijklmnop` 로 씁니다
4. 창을 닫으면 다시 볼 수 없습니다. 잃어버리면 삭제하고 새로 만드세요

> **직장 계정(Google Workspace)** 은 관리자가 앱 비밀번호를 막아둔 경우가 많습니다.
> 그럴 때는 개인 Gmail 을 쓰거나 [3-5번의 대안](#3-5-메일-말고-다른-방법)을 보세요.

### 3-2. GitHub Secrets 등록

저장소 → **Settings** → **Secrets and variables** → **Actions**

**Secrets 탭** → `New repository secret` 으로 3개를 만듭니다.

| 이름 | 값 | 예시 |
|---|---|---|
| `MAIL_USERNAME` | 보내는 Gmail 주소 | `myname@gmail.com` |
| `MAIL_APP_PASSWORD` | 위에서 발급한 16자리 (공백 제거) | `abcdefghijklmnop` |
| `MAIL_TO` | 받는 주소 (본인 주소 그대로) | `myname@gmail.com` |

**Variables 탭** → `New repository variable` 로 1개를 만듭니다.

| 이름 | 값 |
|---|---|
| `SITE_URL` | `https://<사용자명>.github.io/qa-learning-platform` |

> `SITE_URL` 은 선택입니다. 없어도 메일은 오고, 메일 안의 링크만 빠집니다.
> **Secrets 는 등록 후 다시 볼 수 없습니다.** 값이 틀렸으면 삭제하고 다시 만듭니다.

### 3-3. 바로 테스트하기

cron 을 기다리지 말고 수동으로 돌려봅니다.

1. 저장소 → **Actions** 탭
2. 왼쪽에서 **아침 학습 브리핑** 선택
3. 오른쪽 **Run workflow** → **Run workflow**
4. 1분쯤 뒤 메일함 확인

**메일이 안 왔다면** Actions 실행 로그를 봅니다. 발송이 실패해도 본문은 아티팩트로 남으므로,
실행 화면 하단의 `briefing-N` 을 내려받아 `briefing.html` 을 열면 내용은 확인할 수 있습니다.

자주 나오는 오류는 [9번 문제 해결](#9-문제-해결)에 정리해 뒀습니다.

### 3-4. 시각 바꾸기

`.github/workflows/daily-briefing.yml` 의 cron 을 고칩니다.

⚠️ **GitHub Actions 의 cron 은 UTC 기준입니다.** 한국시간에서 9시간을 빼야 합니다.

```yaml
on:
  schedule:
    - cron: '0 23 * * 0-4'      # ← 여기
```

**환산 규칙**: `UTC 시각 = KST 시각 - 9`.
결과가 0보다 작으면 **24를 더하고 요일을 하루 당깁니다.**

| 원하는 시각 (KST) | cron (UTC) | 설명 |
|---|---|---|
| 평일 07:00 | `0 22 * * 0-4` | 전날 22시 |
| **평일 08:00** | **`0 23 * * 0-4`** | 전날 23시 ← 기본값 |
| 평일 09:00 | `0 0 * * 1-5` | 같은 날 0시, 요일 그대로 |
| 평일 09:30 | `30 0 * * 1-5` | |
| 평일 18:00 | `0 9 * * 1-5` | |
| 매일 08:00 | `0 23 * * *` | 주말 포함 |

> **가장 흔한 실수**: `0 23 * * 1-5` 로 쓰는 것.
> 이건 UTC 월~금 23시 = **KST 화~토 08시** 라서 토요일에 오고 월요일엔 오지 않습니다.
>
> 작성한 cron 은 [crontab.guru](https://crontab.guru) 에서 검증할 수 있습니다.
>
> 그리고 GitHub 의 schedule 은 **정시 실행을 보장하지 않습니다.**
> 부하에 따라 수 분~수십 분 늦게 올 수 있습니다. (공식 문서에 명시된 동작)

플랫폼의 **설정 · 백업** 화면에서도 브리핑 시각을 바꿀 수 있지만,
그건 표시용 설정일 뿐이고 **실제 발송 시각은 위 cron 이 결정합니다.** 둘 다 고쳐야 합니다.

### 3-5. 메일 말고 다른 방법

`daily-briefing.yml` 하단 주석에 세 가지 대안이 코드와 함께 있습니다.

| 대안 | 장점 | 비용 |
|---|---|---|
| **Resend** | 앱 비밀번호 불필요, 발송 로그 대시보드 | 무료 (하루 100통) |
| **Slack / Discord 웹훅** | 웹훅 URL 하나만 있으면 됨 | 무료 |
| **GitHub Issue 생성** | **설정 0.** GitHub 앱이 알림을 보내줌 | 무료 |

Gmail 앱 비밀번호 발급이 막혀 있다면 **GitHub Issue 방식이 가장 빠릅니다.**

---

## 4. 진도 스냅샷 동기화

### 왜 필요한가

학습 진도는 **브라우저의 localStorage** 에만 있습니다. 서버도 DB 도 없기 때문입니다.
그래서 GitHub Actions 가 메일을 만들 때 참고할 요약본을 저장소에 올려둬야 합니다.

**주 1회면 충분합니다.** 안 해도 메일은 오고, "동기화하세요" 안내가 대신 표시됩니다.

### 방법

1. 플랫폼에서 **설정 · 백업** 화면을 엽니다
2. **아침 브리핑 메일용 스냅샷** 카드에서 `클립보드에 복사`
3. 저장소의 `data/progress-snapshot.json` 을 열어 **전체를 덮어씁니다**
4. 커밋 & 푸시

GitHub 웹에서 바로 편집해도 됩니다.

```
저장소 → data → progress-snapshot.json → 연필 아이콘 → 전체 선택 후 붙여넣기 → Commit changes
```

`파일로 저장` 버튼을 쓰면 `progress-snapshot.json` 파일로 내려받아 그대로 교체할 수도 있습니다.

### 스냅샷에 담기는 것

```json
{
  "generatedAt": "2026-08-15T08:30:00.000Z",
  "totalLessons": 62,
  "completedCount": 11,
  "percent": 23,
  "streak": { "current": 6, "longest": 9, "lastStudyDate": "2026-08-14" },
  "nextLesson": { "id": "t2-l04", "title": "...", "minutes": 20 },
  "completedLessonIds": ["t1-l01", "..."],
  "weakItems": [{ "text": "...", "lessonId": "...", "dueAt": "...", "lapses": 2 }]
}
```

**개인 메모는 포함되지 않습니다.** 완료한 레슨 ID, 진도 숫자, 복습 항목 텍스트만 들어갑니다.

### 전체 백업은 따로

기기를 옮기거나 브라우저 데이터를 지우기 전에는 **설정 · 백업 → JSON 내보내기** 를 쓰세요.
이쪽은 메모까지 전부 들어간 완전한 백업입니다.

> ⚠️ 이 백업 파일은 **저장소에 커밋하지 마세요.** 개인 메모가 들어갑니다.
> `.gitignore` 에 `qa-lab-backup-*.json` 이 이미 등록돼 있습니다.

---

## 5. AI 기능 설정 (BYOK)

**AI 기능은 선택 사항입니다.** 키가 없어도 62개 레슨과 5개 실습 랩은 100% 동작합니다.

### 설정 방법

1. 플랫폼 → **설정 · 백업** → **AI 기능 (BYOK)**
2. 제공자를 고릅니다 (기본값 **Claude**)
3. API 키를 붙여넣고 **저장**
4. **연결 테스트** 로 확인

### 지원 제공자

| 제공자 | 비고 |
|---|---|
| **Anthropic Claude** | 기본값 |
| **Google Gemini** | **무료 티어 있음** — 비용 0원 제약에 가장 잘 맞습니다 |
| OpenAI (ChatGPT) | |
| Perplexity | 검색 근거가 붙어 사실 확인에 유리 |
| xAI Grok / DeepSeek / OpenRouter | |
| **Ollama (로컬)** | 완전 무료·오프라인. `index.html` 을 로컬에서 열 때만 동작 |
| **커스텀 (OpenAI 호환)** | Base URL 직접 입력 |

> Genspark·Manus 처럼 아직 공개 채팅 API 가 없는 서비스는 지금은 붙일 수 없습니다.
> API 가 열리면 **커스텀** 항목에 주소만 넣으면 바로 동작합니다.

### 키는 어디에 저장되나

- **브라우저 localStorage 에만** 저장됩니다
- 저장소로 커밋될 경로가 **구조적으로 존재하지 않습니다** (중계 서버가 없습니다)
- **JSON 백업 파일에도 포함되지 않습니다** — 백업 파일이 유출돼도 키는 안전합니다
- 요청은 브라우저에서 각 제공자 API 로 직접 나갑니다

### 키 없이 쓰는 방법

레슨의 **AI 실습 도우미** 는 키가 없으면 **프롬프트 복사 모드**로 동작합니다.
프롬프트를 만들어 복사한 뒤 평소 쓰는 AI 도구에 붙여넣으면 됩니다.
**프롬프트 패턴 자체가 학습 자료**이므로 어디에 붙여넣든 상관없습니다.

---

## 6. 콘텐츠 추가·수정하기

### 레슨 고치기

`content/<트랙폴더>/<파일>.md` 를 편집합니다. 마크다운입니다.

```markdown
---
id: t1-l09
title: 새 레슨 제목
summary: 목록에 표시될 한 줄 요약
minutes: 20
order: 9
tags: [태그1, 태그2]
---

## 개념 설명
...

## 왜 채용시장이 요구하는가
...

## 실습 과제
...

## 자가 체크리스트
- [ ] 체크 항목 1
- [ ] 체크 항목 2

## 참고 링크
- [링크](https://...)
```

**`## 자가 체크리스트` 의 `- [ ]` 항목은 자동으로 인터랙티브 위젯이 됩니다.**
체크 상태가 저장되고, 「약점으로」 버튼으로 복습 큐에 넣을 수 있습니다.

### 번들 재생성

```bash
node tools/build-content.mjs
```

- 로컬 서버(방법 B)로 보고 있다면 **불필요합니다.** `.md` 를 바로 읽습니다
- `file://` 로 열거나 GitHub Pages 에 올릴 때 필요합니다
- **push 하면 GitHub Actions 가 자동으로 재생성해 커밋합니다.** 잊어도 됩니다

### 트랙 추가

`content/tracks.json` 에 항목을 추가하고 같은 이름의 폴더를 만듭니다.

```json
{
  "id": "track-9-security",
  "title": "트랙 9. 보안 테스트",
  "shortTitle": "9. 보안",
  "summary": "한 줄 설명",
  "outcomes": ["이 트랙을 마치면 할 수 있는 것"]
}
```

### 지식 조각 · 미션 추가

메일에 나오는 콘텐츠입니다.

- `data/knowledge-bites.json` — `term` / `short` / `detail` / `lesson`
- `data/missions.json` — `title` / `minutes` / `steps[]` / `lesson`

날짜 기준으로 순환 선택되므로 개수가 많을수록 반복이 늦어집니다.

### 메일 미리보기

```bash
TZ=Asia/Seoul SITE_URL=https://<사용자명>.github.io/qa-learning-platform \
  node tools/render-briefing.mjs

open out/briefing.html
```

---

## 7. 커리큘럼

총 **62레슨 · 1,262분(약 21시간) · 자가 체크리스트 883항목**

<details>
<summary><strong>트랙 1. QA 기본기</strong> (8편) — 채용공고 공통 요구사항</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | 테스트 계획과 테스트 전략 문서 | 20분 |
| 02 | TC 설계 기법 (1) 동등분할과 경계값 분석 | 18분 |
| 03 | TC 설계 기법 (2) 상태전이와 결정테이블 | 20분 |
| 04 | TC 설계 기법 (3) 페어와이즈와 조합 폭발 다루기 | 18분 |
| 05 | 테스트 유형 — 기능·회귀·통합·탐색적 | 20분 |
| 06 | 결함 리포트 작성법 | 18분 |
| 07 | 릴리즈 품질 검증과 Go/No-Go 판단 | 20분 |
| 08 | 품질 지표 — 커버리지, 결함 밀도, 실패율, 결함 탈출률 | 20분 |
</details>

<details>
<summary><strong>트랙 2. 도구 실무</strong> (6편) — Jira · Postman · SQL · 모니터링</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | 이슈관리와 협업 — Jira · Confluence · Notion · Slack | 18분 |
| 02 | API 테스트 (1) — HTTP 기초와 Postman 응답 검증 | 20분 |
| 03 | API 테스트 (2) — Swagger 읽기와 컬렉션 러너·CI 연동 | 20분 |
| 04 | SQL (1) — QA를 위한 조회와 JOIN 읽기 | 20분 |
| 05 | SQL (2) — 데이터 정합성 검증 쿼리 패턴 | 20분 |
| 06 | 로그·모니터링 기반 원인 분석 — Datadog · Grafana | 20분 |
</details>

<details>
<summary><strong>트랙 3. 테스트 자동화</strong> (10편) — Playwright 중심</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | Playwright 시작하기 — 첫 테스트와 디버깅 도구 | 20분 |
| 02 | 로케이터 전략 — 깨지지 않는 셀렉터 고르기 | 20분 |
| 03 | 대기와 어서션 — sleep 없이 안정적인 테스트 만들기 | 20분 |
| 04 | 페이지 오브젝트 모델과 테스트 데이터 관리 | 20분 |
| 05 | 플래키 테스트 — 원인 분류와 격리 전략 | 20분 |
| 06 | 모바일 자동화 — Appium · Maestro · XCUITest · Espresso | 20분 |
| 07 | 도구 비교와 선택 기준 — Playwright · Cypress · Selenium · Detox | 18분 |
| 08 | 자동화용 언어 기초 — JavaScript/TypeScript와 Python | 20분 |
| 09 | CI/CD 연동 — GitHub Actions와 Jenkins에서 테스트 돌리기 | 20분 |
| 10 | 무엇을 자동화하고 무엇을 남길 것인가 | 20분 |
</details>

<details>
<summary><strong>트랙 4. AI 활용 QA</strong> (10편) — 2026년 신규 표준 ⭐</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | AI로 테스트 케이스 생성하기 — 프롬프트 패턴 | 20분 |
| 02 | AI로 결함 분류·우선순위 판정·품질 리포트 자동화 | 20분 |
| 03 | QA를 위한 AI 도구 활용법 — Cursor · Claude Code · Copilot · Windsurf | 20분 |
| 04 | **Agentic Testing (1)** — 요구사항과 PR diff를 읽고 검증 범위 판단 | 22분 |
| 05 | **Agentic Testing (2)** — 테스트 자동 생성과 우선순위 판정 | 20분 |
| 06 | **Agentic Testing (3)** — 자율 탐색으로 엣지 케이스 발견 | 22분 |
| 07 | **Agentic Testing (4)** — 실패 원인 분석과 테스트 자가 복구 | 22분 |
| 08 | 셀프힐링 — 깨진 로케이터 자동 보정 구현 | 22분 |
| 09 | 자연어 테스트 파이프라인 — 생성 → 실행 → 복구 | 22분 |
| 10 | 에이전트형 테스트 체계 구축 — 명세·PR·장애 이력을 입력으로 | 22분 |
</details>

<details>
<summary><strong>트랙 5. 성능·부하 테스트</strong> (4편) — k6</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | 성능 테스트 기초와 k6 첫 스크립트 | 20분 |
| 02 | 부하 유형 구분과 시나리오 설계 | 20분 |
| 03 | 임계치 설정과 결과 해석 — p95·p99·에러율·처리량 | 20분 |
| 04 | 성능 테스트를 CI에 붙이고 회귀를 감지하기 | 20분 |
</details>

<details>
<summary><strong>트랙 6. 교차검증을 위한 개발 지식</strong> (9편) — AI를 검증하는 관점 ⭐</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | HTTP와 인증 — 세션·JWT·OAuth를 검증 관점으로 | 20분 |
| 02 | 클라이언트–서버 구조와 렌더링·비동기 처리 | 20분 |
| 03 | HTML·DOM 구조와 셀렉터 — 자동화 로케이터의 기반 | 20분 |
| 04 | JavaScript 코드 읽기 — 문법이 아니라 판단 | 20분 |
| 05 | Python 코드 읽기 — 백엔드와 데이터 스크립트 판단하기 | 18분 |
| 06 | Git 기본과 PR diff 읽는 법 | 20분 |
| 07 | SQL 읽기와 결과 검증 — 남이 쓴 쿼리를 믿지 않기 | 20분 |
| 08 | **AI 생성 결과물 검증 체크리스트** | 22분 |
| 09 | 교차검증 실전 워크플로 — 전체 트랙 종합 | 22분 |
</details>

<details>
<summary><strong>트랙 7. 비즈니스 이해 — CXO 역할과 QA</strong> (7편) — 결함을 경영진의 언어로 ⭐</summary>

| # | 레슨 | 시간 |
|---|---|---|
| 01 | CXO 지도 — C레벨 직함과 조직 구조 읽는 법 | 18분 |
| 02 | CEO와 해외 법인장 — 최종 결정권자와 CEO Japan | 20분 |
| 03 | CSO와 CFO — 전략과 돈의 언어로 품질을 말하기 | 22분 |
| 04 | CISO·CIO·CDO — 보안, 사내 IT, 디지털 전환 | 22분 |
| 05 | CRO·CMO·CCO — 매출, 마케팅, 고객 여정과 성장 | 22분 |
| 06 | COO·CHRO 그리고 새로 떠오른 C레벨 — CTO·CPO·CAIO·CQO | 20분 |
| 07 | **C레벨에게 품질을 보고하는 법** — 하나의 이슈를 역할별 언어로 번역하기 | 22분 |
</details>

<details>
<summary><strong>트랙 8. 엔터프라이즈 에이전틱 테스팅 — 플랫폼과 운영 모델</strong> (8편) — 테스트 클라우드·오케스트레이션·거버넌스 ⭐ NEW</summary>

UiPath Test Cloud 웨비나(2026-09)를 출발점으로, 공개 문서·보도자료·조사 보고서(DORA 2025, Faros AI 2026, Gartner·Forrester, ISO/IEC TS 42119-2, ISTQB CT-GenAI)로 확인·보강했다.
본문에서 **웨비나 주장**과 **확인된 사실**을 구분해 표시하고, 같은 원리를 Playwright Test Agents·GitHub Actions 로 무료 재현한다.

| # | 레슨 | 시간 |
|---|---|---|
| 01 | AI 가속의 역설 — 테스트가 병목이 된 이유와 측정법 (리드타임 분해·암달의 법칙) | 20분 |
| 02 | 에이전틱 테스트 플랫폼 해부 — 라이프사이클 4단계 × 유스케이스 지도 | 22분 |
| 03 | 커스텀 테스트 에이전트 설계 — 로우코드와 프로코드 (스펙 카드·평가셋) | 22분 |
| 04 | **에이전트 오케스트레이션** — 사람·로봇·에이전트를 하나의 테스트 파이프라인으로 | 22분 |
| 05 | 자동화 → 증강 → 자율 — 실행 모드를 테스트마다 고르는 법 | 20분 |
| 06 | 자율 탐색 테스팅 운영 — 요구사항 기반 미션, 타임박스, 발견의 자산화 | 22분 |
| 07 | **거버넌스와 신뢰** — 가드레일·감사·데이터 주권·온프레미스 | 22분 |
| 08 | **도입 로드맵과 벤더 평가** — 주장을 검증하고 다크 테스팅 팩토리로 가는 길 | 22분 |
</details>

### 실습 랩

| 랩 | 내용 |
|---|---|
| 🐞 **결함이 숨겨진 샘플 앱** | 로그인·검색·장바구니·결제에 결함 **14개**. 각 결함에 발견 기법이 매핑돼 있고 정답 대조 가능 |
| 🎯 **셀렉터 연습기** | 요소 클릭 시 후보 셀렉터 7종과 안정성 등급. **배포 전/후 DOM 전환**으로 무엇이 깨지는지 실증 |
| 🔍 **Playwright 스크립트 리뷰어** | 규칙 **23개** 정적 검사. API 키 불필요, 코드가 브라우저 밖으로 나가지 않음 |
| 🩹 **셀프힐링 시뮬레이터** | 시나리오 5개 중 **3개는 "치유하면 안 되는 경우"**. 판단력 훈련 |
| 🧭 **에이전틱 테스트 운영 판단 훈련** | 상황 **8개** — 실행 모드 선택, 사양 질문, 기대값 수정 PR 승인, 프롬프트 인젝션, 12배 주장 검증, 사내망 LLM, 에이전트 평가 |

### 학습 관리

- 대시보드: 전체·트랙별 진도, 연속 학습일(streak), 최근 8주 학습 히트맵, 최근 활동
- 레슨별 완료 체크 / 개인 메모 / 북마크
- 자가 체크리스트에서 「약점으로」 표시 → **간격 반복 복습 큐** (SM-2 축약판)
- JSON export / import (병합·덮어쓰기 선택 가능)

---

## 8. 파일 구조

```
qa-learning-platform/
├── index.html                    단일 진입점
├── .nojekyll                     GitHub Pages 가 _ 폴더를 무시하지 않게
│
├── assets/css/                   base(토큰·테마) / layout / components / lab
│
├── js/
│   ├── util.js  store.js  content.js  markdown.js  router.js  app.js
│   ├── ui/       nav · dashboard · lesson · review · settings · lab
│   ├── lab/      buggy-app · selector-trainer · script-reviewer · self-healing-sim · agentic-ops
│   └── ai/       providers(BYOK 9종) · prompts · ai-panel
│
├── content/
│   ├── tracks.json               트랙 메타데이터 (직접 편집)
│   ├── track-1-fundamentals/     레슨 .md (직접 편집)
│   ├── ... track-8-agentic-platform/
│   ├── manifest.json             ⚙️ 자동 생성
│   └── lessons.bundle.js         ⚙️ 자동 생성 (file:// 대응)
│
├── data/
│   ├── progress-snapshot.json    메일용 진도 요약 (수동 동기화)
│   ├── knowledge-bites.json      오늘의 QA 지식 136개
│   └── missions.json             오늘의 실습 미션 82개
│
├── tools/
│   ├── build-content.mjs         .md → manifest + bundle
│   └── render-briefing.mjs       메일 HTML·텍스트 생성
│
└── .github/workflows/
    ├── build-content.yml         .md 변경 시 번들 자동 재생성
    └── daily-briefing.yml        평일 아침 메일 발송
```

**`tools/` 의 스크립트는 npm 패키지를 하나도 쓰지 않습니다.** Node 내장 모듈만 사용하므로
`npm install` 도 `package.json` 도 락파일도 없습니다.

### 기술 선택

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | 없음 (바닐라 JS) | 빌드 없이 브라우저에서 바로 실행 |
| 라우팅 | 해시 (`#/lesson/t1-l01`) | GitHub Pages 는 서버 리라이트를 못 함 |
| 저장소 | localStorage (`qalab.v1.*`) | DB 없음. 스키마 버전 + 마이그레이션 훅 포함 |
| 마크다운 | marked + DOMPurify + highlight.js (CDN) | CDN 실패 시 원문 `<pre>` 폴백 |
| 스타일 | CSS 변수 + `data-theme` | 다크모드·시스템 연동, 모바일 반응형 |

---

## 9. 문제 해결

<details>
<summary><strong>더블클릭했더니 "콘텐츠를 불러오지 못했습니다" 가 뜹니다</strong></summary>

`content/lessons.bundle.js` 가 없거나 비어 있습니다.

```bash
node tools/build-content.mjs
```

를 실행한 뒤 새로고침하세요. Node.js 가 없다면 [방법 B](#방법-b--로컬-서버-콘텐츠를-자주-고칠-때)로 로컬 서버를 띄우면 번들 없이도 동작합니다.
</details>

<details>
<summary><strong>레슨을 고쳤는데 반영이 안 됩니다</strong></summary>

- **로컬 서버**로 보고 있다면: 브라우저 강력 새로고침 (`Cmd/Ctrl + Shift + R`)
- **`file://`** 로 보고 있다면: `node tools/build-content.mjs` 실행 후 새로고침
- **GitHub Pages** 라면: push 후 Actions 가 번들을 재생성하고 Pages 가 배포될 때까지 1~2분 기다립니다
</details>

<details>
<summary><strong>진도가 사라졌습니다</strong></summary>

localStorage 는 다음 경우에 지워집니다.

- 브라우저 데이터/쿠키 삭제
- 시크릿 창 사용 (창을 닫으면 소멸)
- **다른 도메인에서 접속** — `file://` 과 `http://localhost` 와 GitHub Pages 는 **서로 다른 저장소**입니다

**하나의 접속 방법을 정해서 쓰는 것을 권장합니다.** 옮길 때는 설정 → JSON 내보내기/가져오기를 쓰세요.

설정 화면 하단 **환경** 섹션에서 localStorage 사용 가능 여부를 확인할 수 있습니다.
</details>

<details>
<summary><strong>메일이 오지 않습니다</strong></summary>

**① Actions 로그를 봅니다** (저장소 → Actions → 아침 학습 브리핑 → 최근 실행)

| 로그의 오류 | 원인과 해결 |
|---|---|
| `Invalid login: 535-5.7.8 Username and Password not accepted` | 앱 비밀번호가 틀렸습니다. **계정 비밀번호를 넣지 않았는지** 확인하고, 16자리에서 공백을 뺐는지 봅니다 |
| `Missing credentials` / `secrets.MAIL_* is empty` | Secret 이름 오타입니다. 대소문자까지 정확히 `MAIL_USERNAME`, `MAIL_APP_PASSWORD`, `MAIL_TO` |
| `getaddrinfo ENOTFOUND` | `server_address` 오타 — `smtp.gmail.com` |
| 워크플로가 아예 실행되지 않음 | 60일 이상 커밋이 없으면 GitHub 이 schedule 을 자동 비활성화합니다. Actions 탭에서 다시 켜세요 |

**② 스팸함을 확인합니다.** 자기 자신에게 보내는 메일이 스팸으로 가는 경우가 있습니다.
한 번 "스팸 아님" 처리하면 이후로는 정상 수신됩니다.

**③ 발송은 실패해도 본문은 남습니다.** 실행 화면 하단 `briefing-N` 아티팩트를 내려받아
`briefing.html` 을 열면 내용을 확인할 수 있습니다. 이걸로 렌더링 문제인지 발송 문제인지 구분됩니다.
</details>

<details>
<summary><strong>메일은 오는데 진도가 0% 입니다</strong></summary>

진도 스냅샷을 아직 동기화하지 않았습니다. [4번](#4-진도-스냅샷-동기화)을 따라 하세요.

메일 상단에 "먼저 할 일" 안내가 함께 표시됩니다.
</details>

<details>
<summary><strong>메일이 이상한 요일에 옵니다</strong></summary>

cron 의 UTC 환산이 틀렸습니다. [3-4번의 환산표](#3-4-시각-바꾸기)를 보세요.

가장 흔한 실수는 `0 23 * * 1-5` 입니다. KST 화~토에 옵니다.
평일 08시를 원하면 `0 23 * * 0-4` 여야 합니다.
</details>

<details>
<summary><strong>AI 기능에서 연결 실패가 납니다</strong></summary>

설정 → **연결 테스트** 의 오류 메시지를 봅니다.

| 메시지 | 원인 |
|---|---|
| `API 오류 (401)` | 키가 틀렸거나 만료됐습니다 |
| `API 오류 (429)` | 요청 한도 초과. 무료 티어라면 잠시 후 재시도 |
| `네트워크 요청이 차단되었습니다` | CORS 또는 오프라인. 커스텀 제공자라면 Base URL 확인 |
| `모델명을 설정에서 입력하세요` | 커스텀 제공자는 모델명을 직접 넣어야 합니다 |

**Ollama 는 `https://` 로 배포된 Pages 에서는 동작하지 않습니다.** (혼합 콘텐츠 차단)
로컬에서 `index.html` 을 열 때만 쓸 수 있습니다.
</details>

<details>
<summary><strong>GitHub Pages 에서 404 가 납니다</strong></summary>

- Settings → Pages 에서 Branch 가 `main` / `/ (root)` 인지 확인
- 저장소가 **Public** 인지 확인
- `.nojekyll` 파일이 루트에 있는지 확인
- 배포에 1~2분 걸립니다. Actions 탭의 `pages build and deployment` 완료를 기다리세요
</details>

<details>
<summary><strong>Actions 가 "Permission denied" 로 실패합니다</strong></summary>

`build-content.yml` 이 생성물을 커밋하려면 쓰기 권한이 필요합니다.

저장소 → Settings → Actions → General → **Workflow permissions** →
`Read and write permissions` 선택 후 Save.
</details>

---

## 10. 비용이 0원인 이유

| 항목 | 사용한 것 | 비용 |
|---|---|---|
| 호스팅 | GitHub Pages (public 저장소) | **0원** |
| 스케줄 작업 | GitHub Actions (public 저장소 무료 무제한) | **0원** |
| 데이터베이스 | 없음 — localStorage + 저장소 내 JSON | **0원** |
| 백엔드 서버 | 없음 — 정적 파일만 | **0원** |
| 빌드 도구 | 없음 — npm 패키지 0개 | **0원** |
| 외부 라이브러리 | CDN (jsDelivr) | **0원** |
| 메일 발송 | Gmail SMTP + 앱 비밀번호 | **0원** |
| AI 기능 | BYOK (내 키). Gemini 무료 티어 / Ollama 로컬 가능 | **0원 가능** |

**유료 서비스 의존성이 하나도 없습니다.** 구독을 취소해도 계속 동작합니다.

실습에 쓰는 연습 대상도 전부 무료입니다 — `test.k6.io`, `httpbin.org`, `jsonplaceholder.typicode.com`,
`petstore3.swagger.io`, `demo.playwright.dev`, `db-fiddle.com`, `play.grafana.org`, Jira Cloud 무료 플랜.

> **주의**: AI 제공자 중 유료 종량제(Anthropic, OpenAI 등)를 쓰면 **본인 계정에 사용량만큼 과금**됩니다.
> 완전 무료로 유지하려면 Gemini 무료 티어 또는 Ollama 로컬 모델을 쓰거나,
> **키를 넣지 않고 프롬프트 복사 모드로만** 사용하세요.

---

## 라이선스

개인 학습용 프로젝트입니다. 자유롭게 포크해서 본인 커리큘럼으로 고쳐 쓰세요.

레슨 본문에 인용된 외부 문서·표준의 저작권은 각 원저작자에게 있으며,
본 저장소는 링크와 요약만 제공합니다.
