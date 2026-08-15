/* ==========================================================================
   lab/script-reviewer.js — Playwright 스크립트 리뷰어
   --------------------------------------------------------------------------
   규칙 기반 정적 검사. API 키가 없어도 100% 동작한다.
   트랙 3·4·6 에서 정리한 안티패턴을 그대로 규칙으로 구현했다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  /* ------------------------------------------------------------ 규칙 */

  var RULES = [
    /* --- 대기 (트랙 3-03) --- */
    {
      id: 'W01', sev: 'high', cat: '대기',
      re: /waitForTimeout\s*\(/,
      title: '고정 대기(waitForTimeout) 사용',
      why: '서버가 빠르면 시간을 낭비하고, 느리면 실패한다. CI 는 로컬보다 느려서 "로컬은 되는데 CI 는 실패"의 1순위 원인이다.',
      fix: "// 시간이 아니라 조건을 기다린다\nawait expect(page.getByTestId('total')).toHaveText('9,000원');",
      ref: 't3-l03'
    },
    {
      id: 'W02', sev: 'high', cat: '대기',
      re: /waitForLoadState\s*\(\s*['"`]networkidle/,
      title: 'networkidle 대기',
      why: '폴링·웹소켓·분석 스크립트가 있으면 영원히 idle 이 안 된다. 반대로 요청이 잠깐 끊긴 틈에 너무 일찍 넘어가기도 한다. 화면 상태와 무관하다.',
      fix: "// 결과를 어서션하면 충분하다\nawait expect(page.getByTestId('product-card')).toHaveCount(20);",
      ref: 't6-l02'
    },
    {
      id: 'W03', sev: 'high', cat: '대기',
      re: /expect\s*\(\s*await\s+/,
      title: 'expect(await ...) — 재시도가 안 되는 어서션',
      why: '값을 한 번만 읽고 비교한다. 비동기 갱신을 기다리지 않아 간헐적으로 실패한다.',
      fix: "// await 를 expect 앞으로 옮긴다 (자동 재시도)\nawait expect(locator).toHaveText('완료');",
      ref: 't3-l03'
    },
    {
      id: 'W04', sev: 'mid', cat: '대기',
      re: /timeout\s*:\s*(\d{5,})/,
      title: '과도한 타임아웃',
      why: '원인을 고치지 않고 기다리는 시간만 늘린 것이다. 테스트가 느려지고 실패는 여전히 발생한다.',
      fix: '// 왜 오래 걸리는지 먼저 확인한다.\n// 정말 필요하면 이유를 주석으로 남긴다.',
      ref: 't3-l03'
    },

    /* --- 가짜 통과 (트랙 3-03, 6-08) --- */
    {
      id: 'F01', sev: 'high', cat: '가짜 통과',
      re: /catch\s*\([^)]*\)\s*\{/,
      title: 'try/catch — 어서션 실패를 삼킬 수 있음',
      why: '테스트 안의 try/catch 는 대부분 실패를 숨긴다. 결함이 있어도 초록불이 뜨고, 그게 가장 위험하다.',
      fix: '// 실패해야 할 것은 실패하게 둔다.\n// 예외 자체를 검증하려면:\nawait expect(async () => { ... }).rejects.toThrow();',
      ref: 't3-l03'
    },
    {
      id: 'F02', sev: 'high', cat: '가짜 통과',
      re: /toBeGreaterThanOrEqual\s*\(\s*0\s*\)|toBeGreaterThan\s*\(\s*-1\s*\)/,
      title: '항상 참인 어서션',
      why: '어떤 값이 와도 통과한다. 검증이 아니라 장식이다.',
      fix: "await expect(locator).toHaveCount(3);   // 기대값을 명시한다",
      ref: 't6-l08'
    },
    {
      id: 'F03', sev: 'high', cat: '가짜 통과',
      re: /toContain\s*\(\s*\[?\s*(200|201)[^)]*\b(40\d|50\d)/,
      title: '여러 상태코드를 모두 허용',
      why: '200 이든 404 든 통과한다. 성공과 실패를 구분하지 못한다.',
      fix: 'expect(res.status()).toBe(201);   // 기대하는 하나만',
      ref: 't2-l02'
    },
    {
      id: 'F04', sev: 'mid', cat: '가짜 통과',
      re: /if\s*\(\s*await\s[\s\S]{0,140}?\.(isVisible|isEnabled|isChecked)\s*\(\s*\)\s*\)/,
      title: '조건 분기로 어서션 회피',
      why: '조건이 거짓이면 아무것도 검증하지 않고 통과한다. 전제조건이 통제되지 않았다는 신호이기도 하다.',
      fix: "// 상태 자체를 단언한다\nawait expect(page.getByText('쿠폰 적용됨')).toBeVisible();",
      ref: 't3-l03'
    },
    {
      id: 'F05', sev: 'mid', cat: '가짜 통과',
      re: /\.(toBeDefined|toBeTruthy)\s*\(\s*\)\s*;?\s*$/m,
      title: '존재만 확인하는 어서션',
      why: '값이 무엇인지는 검증하지 않는다. 잘못된 값이 들어와도 통과한다.',
      fix: "expect(body.totalAmount).toBe(9000);   // 실제 계산과 비교",
      ref: 't6-l08'
    },

    /* --- 로케이터 (트랙 3-02) --- */
    {
      id: 'L01', sev: 'high', cat: '로케이터',
      re: /(locator|click|fill|\$|\$\$)\s*\(\s*['"`]\s*\.(sc-[A-Za-z]{5,}|css-[a-z0-9]{5,}|[A-Za-z]+_[A-Za-z]+__)/,
      title: '자동 생성 클래스에 의존',
      why: 'CSS-in-JS·CSS Modules 가 만든 클래스는 빌드할 때마다 바뀐다. 코드를 한 줄도 안 고쳐도 테스트가 깨진다.',
      fix: "await page.getByRole('button', { name: '결제하기' }).click();",
      ref: 't3-l02'
    },
    {
      id: 'L02', sev: 'mid', cat: '로케이터',
      re: /(locator|click|fill)\s*\(\s*['"`]\s*[.#][\w-]+\s*[>\s]\s*/,
      title: 'CSS 구조 셀렉터 사용',
      why: 'DOM 구조에 의존한다. 요소가 하나만 추가돼도 깨진다.',
      fix: "await page.getByRole('button', { name: '...' })",
      ref: 't3-l02'
    },
    {
      id: 'L03', sev: 'mid', cat: '로케이터',
      re: /\.(nth\s*\(\s*\d+\s*\)|first\s*\(\s*\)|last\s*\(\s*\))/,
      title: '순서에 의존하는 로케이터',
      why: '목록 순서가 바뀌거나 항목이 추가되면 엉뚱한 요소를 조작한다.',
      fix: "page.getByRole('row').filter({ hasText: '무선 이어폰' })",
      ref: 't3-l02'
    },
    {
      id: 'L04', sev: 'mid', cat: '로케이터',
      re: /(locator|click|fill)\s*\(\s*['"`]\s*(\/\/|xpath=)/,
      title: 'XPath 사용',
      why: 'DOM 구조 의존이 크고 읽기 어렵다. 모바일(Appium)에서는 성능 문제도 심각하다.',
      fix: "// filter() 로 대체 가능한지 먼저 검토한다\npage.getByTestId('card').filter({ hasText: '품절' })",
      ref: 't6-l03'
    },

    /* --- 데이터·격리 (트랙 3-04) --- */
    {
      id: 'D01', sev: 'high', cat: '데이터·격리',
      re: /(password|passwd|pw)\s*[:=]\s*['"`][^'"`]{4,}['"`]|\.fill\s*\(\s*['"`](?=[^'"`]*[A-Z])(?=[^'"`]*\d)[^'"`]{8,}['"`]\s*\)/i,
      title: '비밀번호로 보이는 값이 하드코딩됨',
      why: '저장소에 커밋되면 유출된다. 환경마다 계정이 다르면 이식성도 없다.',
      fix: "await page.getByLabel('비밀번호').fill(process.env.TEST_PASSWORD!);",
      ref: 't3-l09'
    },
    {
      id: 'D02', sev: 'mid', cat: '데이터·격리',
      re: /(goto|baseURL|url)\s*[:(]\s*['"`]https?:\/\//,
      title: '환경 URL 하드코딩',
      why: '스테이징과 운영을 오갈 때마다 코드를 고쳐야 한다. 실수로 운영에 테스트를 돌릴 위험도 있다.',
      fix: "// config 의 baseURL 을 쓰고 경로만 지정\nawait page.goto('/login');",
      ref: 't3-l01'
    },
    {
      id: 'D03', sev: 'mid', cat: '데이터·격리',
      re: /['"`][\w.+-]+@[\w-]+\.[\w.]+['"`]/,
      title: '고정 테스트 계정 사용',
      why: '병렬 실행 시 여러 테스트가 같은 계정을 건드려 서로를 깨뜨린다.',
      fix: "const email = `qa_${Date.now()}_${process.env.TEST_WORKER_INDEX ?? 0}@test.com`;",
      ref: 't3-l04'
    },
    {
      id: 'D04', sev: 'low', cat: '데이터·격리',
      re: /['"`]20\d{2}[-./]\d{2}[-./]\d{2}['"`]/,
      title: '날짜 하드코딩',
      why: '그 날짜가 지나면 테스트가 깨진다. "내일" 같은 상대 날짜 검증에서 특히 위험하다.',
      fix: "await page.clock.setFixedTime(new Date('2026-08-15T10:00:00+09:00'));",
      ref: 't3-l05'
    },

    /* --- 구조 (트랙 3-04) --- */
    {
      id: 'S01', sev: 'mid', cat: '구조',
      re: /class\s+\w*Page\b[\s\S]{0,4000}?\bexpect\s*\(/,
      title: '페이지 오브젝트 안에 어서션',
      why: '실패 케이스를 테스트할 수 없게 된다. 페이지 오브젝트는 "할 수 있는 일"만 제공하고 판단은 테스트가 한다.',
      fix: '// 페이지 오브젝트는 상태만 반환\nasync isErrorVisible() { return this.error.isVisible(); }',
      ref: 't3-l04'
    },
    {
      id: 'S02', sev: 'low', cat: '구조',
      re: /test\s*\(\s*['"`](테스트|test|검증|확인|동작)\s*\d*['"`]/i,
      title: '테스트 이름이 내용을 설명하지 않음',
      why: 'CI 리포트에서 무엇이 깨졌는지 알 수 없다.',
      fix: "test('잘못된 비밀번호로 로그인하면 오류 메시지가 보인다', ...)",
      ref: 't3-l01'
    },
    {
      id: 'S03', sev: 'low', cat: '구조',
      re: /test\.only\s*\(/,
      title: 'test.only 가 남아 있음',
      why: '커밋되면 나머지 테스트가 전부 건너뛰어진다. config 의 forbidOnly 로 CI 에서 차단할 수 있다.',
      fix: "// test.only 를 제거하고, playwright.config.ts 에\n// forbidOnly: !!process.env.CI 를 설정한다",
      ref: 't3-l01'
    },
    {
      id: 'S04', sev: 'mid', cat: '구조',
      re: /test\.(skip|fixme)\s*\(/,
      title: '비활성화된 테스트',
      why: '이유와 티켓 없이 skip 하면 영영 잊힌다. 격리에는 기록이 따라야 한다.',
      fix: "test.fixme('중복 주문 @issue-1500', ...);   // 티켓 번호를 남긴다",
      ref: 't3-l05'
    },

    /* --- 환각 (트랙 6-08) --- */
    {
      id: 'H01', sev: 'high', cat: '환각 의심',
      re: /\.(waitForElementVisible|waitForClickable|waitUntil|elementIsVisible|toHaveStatusCode|waitForText)\s*\(/,
      title: 'Playwright 에 존재하지 않는 API',
      why: '다른 프레임워크(WebdriverIO, Selenium)의 API 이거나 존재하지 않는 이름이다. AI 생성 코드에서 자주 나온다.',
      fix: '// 공식 문서에서 확인하고 tsc --noEmit 로 검증한다\nawait expect(locator).toBeVisible();',
      ref: 't6-l08'
    },
    {
      id: 'H02', sev: 'mid', cat: '환각 의심',
      re: /page\.\$\$?\s*\(|\.\$eval\s*\(/,
      title: '구버전 API ($, $$, $eval)',
      why: '동작은 하지만 자동 대기가 없어 불안정하다. 로케이터 API 를 쓰는 것이 표준이다.',
      fix: "const items = page.getByTestId('item');   // 자동 대기 포함",
      ref: 't3-l02'
    }
  ];

  /* ------------------------------------------------------ 샘플 코드 */

  var SAMPLE = [
    "import { test, expect } from '@playwright/test';",
    "",
    "test('테스트1', async ({ page }) => {",
    "  await page.goto('https://staging.example.com/login');",
    "  await page.fill('#email', 'qa@test.com');",
    "  await page.fill('.sc-bdVaJa input', 'Test1234!');",
    "  await page.click('.btn.btn-primary');",
    "  await page.waitForTimeout(3000);",
    "",
    "  const text = await page.locator('.dashboard-title').textContent();",
    "  expect(text).toBeDefined();",
    "",
    "  await page.waitForLoadState('networkidle');",
    "  const rows = await page.$$('.order-row');",
    "  expect(rows.length).toBeGreaterThanOrEqual(0);",
    "",
    "  try {",
    "    await expect(page.locator('.total')).toHaveText('9,000원');",
    "  } catch (e) {",
    "    console.log('총액 다름');",
    "  }",
    "",
    "  await page.locator('.order-row').nth(2).click();",
    "  await page.waitForElementVisible('.detail');",
    "",
    "  if (await page.locator('.coupon-badge').isVisible()) {",
    "    await expect(page.locator('.total')).toHaveText('9,000원');",
    "  }",
    "",
    "  await expect(page.locator('//div[@class=\"footer\"]/span[2]'))",
    "    .toBeVisible({ timeout: 120000 });",
    "});"
  ].join('\n');

  /* ---------------------------------------------------------- 분석 */

  function analyze(code) {
    var lines = code.split('\n');
    var findings = [];

    lines.forEach(function (line, i) {
      // 주석 줄은 건너뛴다 (단, 예외 허용 주석은 아래에서 처리)
      var trimmed = line.trim();
      if (trimmed.indexOf('//') === 0 || trimmed.indexOf('*') === 0) return;

      RULES.forEach(function (rule) {
        if (rule.multiline) return;
        rule.re.lastIndex = 0;
        if (rule.re.test(line)) {
          // 다음 줄 또는 같은 줄에 예외 주석이 있으면 통과
          var okComment = /antipattern-ok/.test(line) ||
                          (lines[i - 1] && /antipattern-ok/.test(lines[i - 1]));
          if (okComment) return;
          findings.push({
            rule: rule, line: i + 1, snippet: trimmed.slice(0, 120)
          });
        }
      });
    });

    // 여러 줄에 걸친 규칙 (S01)
    RULES.filter(function (r) { return r.id === 'S01'; }).forEach(function (rule) {
      if (rule.re.test(code)) {
        findings.push({ rule: rule, line: 0, snippet: '(파일 전체 구조)' });
      }
    });

    // 어서션 없는 테스트 블록 탐지
    var testBlocks = code.split(/\btest\s*\(/).slice(1);
    var noAssert = testBlocks.filter(function (b) {
      var body = b.slice(0, b.length);
      return !/expect\s*\(/.test(body.slice(0, 3000));
    }).length;
    if (noAssert > 0) {
      findings.push({
        rule: {
          id: 'F06', sev: 'high', cat: '가짜 통과',
          title: '어서션이 없는 테스트 블록 ' + noAssert + '개',
          why: '동작만 하고 아무것도 검증하지 않는다. 제품이 완전히 깨져도 통과한다.',
          fix: '// 최소 하나의 의미 있는 어서션을 넣는다',
          ref: 't6-l08'
        },
        line: 0, snippet: '(테스트 블록)'
      });
    }

    findings.sort(function (a, b) {
      var order = { high: 0, mid: 1, low: 2 };
      if (order[a.rule.sev] !== order[b.rule.sev]) return order[a.rule.sev] - order[b.rule.sev];
      return a.line - b.line;
    });
    return findings;
  }

  function score(findings, lineCount) {
    var penalty = findings.reduce(function (s, f) {
      return s + ({ high: 12, mid: 6, low: 2 })[f.rule.sev];
    }, 0);
    return Math.max(0, 100 - penalty);
  }

  /* ---------------------------------------------------------- 렌더 */

  var state = { code: SAMPLE, findings: null };

  function render(host) {
    var html = '';

    html += '<div class="lab-head">' +
      '<div class="lesson-crumbs"><a href="#/lab">실습 랩</a> <span>›</span> <span>Playwright 스크립트 리뷰어</span></div>' +
      '<h1>🔍 Playwright 스크립트 리뷰어</h1>' +
      '<p class="sub">테스트 코드를 붙여넣으면 안티패턴을 지적합니다. ' +
      '<strong>규칙 기반이라 API 키 없이 동작</strong>하며, 코드는 브라우저 밖으로 나가지 않습니다.</p></div>';

    html += '<div class="lab-layout"><div>';

    html += '<div class="card"><div class="card-title">검사할 코드' +
      '<span class="hint">' + state.code.split('\n').length + '줄</span></div>' +
      '<textarea class="review-editor" id="reviewCode" spellcheck="false">' + h(state.code) + '</textarea>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-primary" id="btnAnalyze">검사하기</button>' +
        '<button class="btn" id="btnSample">샘플 코드 불러오기</button>' +
        '<button class="btn btn-ghost" id="btnClear">비우기</button>' +
      '</div></div>';

    if (state.findings) {
      var s = score(state.findings, state.code.split('\n').length);
      html += '<div class="card"><div class="card-title">검사 결과' +
        '<span class="hint">' + state.findings.length + '건</span></div>';

      html += '<div class="score-box"><div class="score-num" style="color:' +
        (s >= 80 ? 'var(--ok)' : s >= 50 ? 'var(--warn)' : 'var(--danger)') + '">' + s + '</div>' +
        '<div style="font-size:12.5px;color:var(--text-dim);margin-top:4px">' +
        (s >= 80 ? '양호합니다' : s >= 50 ? '개선이 필요합니다' : '중대한 안티패턴이 있습니다') +
        '</div></div>';

      if (!state.findings.length) {
        html += '<div class="callout ok"><strong>탐지된 안티패턴이 없습니다.</strong><br>' +
          '다만 규칙 기반 검사는 <strong>형태</strong>만 봅니다. ' +
          '이 테스트가 <em>실제로 무엇을 검증하는지</em>는 사람이 판단해야 합니다. ' +
          '변이 검사(기대값을 틀리게 바꿔 실패하는지 확인)를 함께 하세요.</div>';
      } else {
        state.findings.forEach(function (f) {
          html += '<div class="finding sev-' + f.rule.sev + '">' +
            '<div class="head">' +
              '<span class="badge badge-' + (f.rule.sev === 'high' ? 'danger' : f.rule.sev === 'mid' ? 'warn' : 'info') + '">' +
                (f.rule.sev === 'high' ? '높음' : f.rule.sev === 'mid' ? '중간' : '낮음') + '</span>' +
              '<span class="badge">' + h(f.rule.cat) + '</span>' +
              (f.line ? '<span class="line">L' + f.line + '</span>' : '') +
              '<strong>' + h(f.rule.title) + '</strong>' +
            '</div>' +
            (f.snippet !== '(파일 전체 구조)' && f.snippet !== '(테스트 블록)'
              ? '<div class="snippet">' + h(f.snippet) + '</div>' : '') +
            '<p class="why">' + h(f.rule.why) + '</p>' +
            '<div class="fix">' + h(f.rule.fix) + '</div>' +
            (f.rule.ref ? '<div style="margin-top:6px;font-size:12px">' +
              '<a href="#/lesson/' + f.rule.ref + '">관련 레슨 보기 →</a></div>' : '') +
          '</div>';
        });
      }
      html += '</div>';
    }

    html += '</div>';

    /* 사이드 */
    html += '<aside class="lab-side">';
    html += '<div class="card"><div class="card-title">검사 규칙 ' +
      '<span class="hint">' + RULES.length + '개</span></div>';
    var cats = {};
    RULES.forEach(function (r) { cats[r.cat] = (cats[r.cat] || 0) + 1; });
    html += '<table class="sel-table"><tbody>';
    Object.keys(cats).forEach(function (c) {
      html += '<tr><td>' + h(c) + '</td><td style="text-align:right">' + cats[c] + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p style="font-size:12px;color:var(--text-faint);margin-top:10px">' +
      '정당한 예외는 해당 줄이나 바로 윗줄에 <code>// antipattern-ok: 이유</code> ' +
      '주석을 달면 검사에서 제외됩니다.</p></div>';

    html += '<div class="card"><div class="card-title">이 도구의 한계</div>' +
      '<p style="font-size:13px;color:var(--text-dim);margin:0">' +
      '규칙 기반 검사는 <strong>형태</strong>만 봅니다. 다음은 잡지 못합니다.</p>' +
      '<ul style="font-size:12.5px;color:var(--text-dim);padding-left:1.2em;margin:8px 0 0">' +
      '<li>기대값이 실제로 옳은지</li>' +
      '<li>테스트가 의미 있는 것을 검증하는지</li>' +
      '<li>빠진 엣지 케이스</li>' +
      '<li>우리 도메인 규칙 위반</li>' +
      '</ul>' +
      '<p style="font-size:12.5px;color:var(--text-dim);margin-top:8px">' +
      '이건 <a href="#/lesson/t6-l08">3단계 검증 파이프라인</a>의 1단계입니다. ' +
      '2·3단계는 사람이 합니다.</p></div>';

    html += '<div class="card"><div class="card-title">연습 방법</div>' +
      '<ol style="font-size:13px;padding-left:1.2em;margin:0">' +
      '<li>샘플 코드를 먼저 <strong>직접 읽고</strong> 문제를 찾아 적는다</li>' +
      '<li>검사를 돌려 대조한다</li>' +
      '<li>내가 놓친 것 / 도구가 놓친 것을 분류한다</li>' +
      '<li>AI 에게 테스트를 생성시켜 여기에 붙여넣는다</li>' +
      '<li>지적된 것을 고쳐 100점을 만든다</li>' +
      '<li><strong>100점이어도 변이 검사를 해본다</strong></li>' +
      '</ol></div>';

    html += '</aside></div>';

    host.innerHTML = html;
    bind(host);
  }

  function bind(host) {
    var ta = QALab.$('#reviewCode', host);

    QALab.$('#btnAnalyze', host).addEventListener('click', function () {
      state.code = ta.value;
      state.findings = analyze(state.code);
      render(host);
      var res = QALab.$('.score-box', host);
      if (res) res.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    QALab.$('#btnSample', host).addEventListener('click', function () {
      state.code = SAMPLE;
      state.findings = null;
      render(host);
    });

    QALab.$('#btnClear', host).addEventListener('click', function () {
      state.code = '';
      state.findings = null;
      render(host);
    });

    if (ta) ta.addEventListener('input', function () { state.code = ta.value; });
  }

  QALab.labs = QALab.labs || {};
  QALab.labs['script-review'] = { render: render, RULES: RULES, analyze: analyze };
})(window);
