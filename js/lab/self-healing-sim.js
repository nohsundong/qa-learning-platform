/* ==========================================================================
   lab/self-healing-sim.js — 셀프힐링 시뮬레이터
   --------------------------------------------------------------------------
   배포로 DOM 이 바뀌어 테스트가 깨진 상황을 재현하고,
   어떤 복구 전략을 택할지 고르게 한다.
   핵심 학습 목표: "치유하면 안 되는 경우"를 골라내는 판단.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  /* -------------------------------------------------------- 시나리오 */

  var SCENARIOS = [
    {
      id: 1,
      title: '디자인 시스템 교체로 클래스가 바뀜',
      context: '배포 후 결제 버튼을 찾지 못해 테스트가 실패했다. 기존 로케이터는 ' +
               "<code>page.locator('.btn-primary')</code> 였다.",
      before: '<button class="btn-primary" data-testid="checkout">결제하기</button>',
      after:  '<button class="Button_root__x7f2a" data-testid="checkout">결제하기</button>',
      changed: 'class',
      options: [
        { code: "page.getByTestId('checkout')", result: 'ok',
          verdict: '✅ 최선. testid 가 그대로 남아 있고 1개만 매칭된다. 이 케이스는 안전하게 치유된다.' },
        { code: "page.getByRole('button', { name: '결제하기' })", result: 'ok',
          verdict: '✅ 좋다. 역할과 이름이 유지됐다. testid 다음 후보로 적절하다.' },
        { code: "page.locator('.Button_root__x7f2a')", result: 'danger',
          verdict: '❌ 새 클래스도 자동 생성된 것이다. 다음 빌드에 또 바뀐다. 치유가 아니라 문제 이동이다.' },
        { code: "page.locator('button').first()", result: 'danger',
          verdict: '❌ 순서 의존. 지금은 통과하지만 버튼이 하나만 추가돼도 엉뚱한 것을 누른다.' }
      ],
      lesson: '치유에 성공했더라도 **반드시 로그를 남긴다.** 1순위 로케이터가 실패했다는 것은 ' +
              '`.btn-primary` 에 의존하는 다른 테스트도 곧 깨진다는 신호다.'
    },
    {
      id: 2,
      title: 'data-testid 가 제거되고 같은 텍스트의 버튼이 추가됨',
      context: '상품 삭제 버튼을 찾던 테스트가 실패했다. 기존 로케이터는 ' +
               "<code>page.getByTestId('delete-item')</code> 였다.",
      before: '<div class="item">\n  <span>무선 이어폰</span>\n  <button data-testid="delete-item">삭제</button>\n</div>',
      after:  '<div class="item">\n  <span>무선 이어폰</span>\n  <button>삭제</button>\n</div>\n<footer>\n  <button>삭제</button>  <!-- 새로 추가된 계정 삭제 -->\n</footer>',
      changed: 'testid+sibling',
      options: [
        { code: "page.getByRole('button', { name: '삭제' })", result: 'danger',
          verdict: '❌ 2개가 매칭된다. `first()` 로 넘기면 계정 삭제를 누를 수 있다. **되돌릴 수 없는 액션이므로 치유하면 안 된다.**' },
        { code: "page.getByRole('button', { name: '삭제' }).first()", result: 'danger',
          verdict: '❌ 최악. 순서가 바뀌면 계정이 삭제된다. 셀프힐링에서 절대 하면 안 되는 형태다.' },
        { code: "page.locator('.item').filter({ hasText: '무선 이어폰' })\n  .getByRole('button', { name: '삭제' })", result: 'ok',
          verdict: '✅ 부모로 스코핑해 1개만 매칭된다. 다만 이 경우에도 **삭제 액션이므로 자동 치유 대상에서 제외**하고 사람이 확인하는 것이 안전하다.' },
        { code: "치유하지 않고 실패시킨다 + 개발팀에 testid 복구 요청", result: 'ok',
          verdict: '✅ 정답에 가깝다. 되돌릴 수 없는 액션은 `NEVER_HEAL` 목록에 넣는다. 실패가 곧 신호다.' }
      ],
      lesson: '**되돌릴 수 없는 액션(삭제·결제·전송)에는 셀프힐링을 적용하지 않는다.** ' +
              '그리고 `count > 1` 이면 치유하지 않고 실패시켜야 한다.'
    },
    {
      id: 3,
      title: '같은 버튼이 두 개로 렌더링됨',
      context: '결제 버튼 로케이터가 갑자기 2개를 매칭한다 (strict mode 위반).',
      before: '<button data-testid="pay">결제하기</button>',
      after:  '<button data-testid="pay">결제하기</button>\n<button data-testid="pay">결제하기</button>',
      changed: 'duplicate',
      options: [
        { code: "page.getByTestId('pay').first()", result: 'danger',
          verdict: '❌ 통과는 하지만 **중복 렌더링 버그를 숨긴다.** 사용자는 결제 버튼이 두 개 보이는 화면을 본다.' },
        { code: "page.getByTestId('pay').nth(0)", result: 'danger',
          verdict: '❌ 위와 같다. 셀프힐링이 결함을 은폐하는 전형적인 사례다.' },
        { code: "치유하지 않고 실패시킨다 → 제품 결함으로 리포트", result: 'ok',
          verdict: '✅ 정답. 이건 로케이터 문제가 아니라 **제품 결함**이다. 트랙 4-07 의 A 분류다.' },
        { code: "page.getByTestId('pay').last()", result: 'danger',
          verdict: '❌ 어느 쪽을 고르든 근본 문제는 그대로다.' }
      ],
      lesson: '`count > 1` 은 치유 대상이 아니라 **결함 신호**다. ' +
              '셀프힐링 구현에서 이 검사를 빼면 버그를 자동으로 숨기는 장치가 된다.'
    },
    {
      id: 4,
      title: '요소가 아예 사라짐',
      context: '"위시리스트 추가" 버튼을 찾지 못한다. 화면 어디에도 없다.',
      before: '<button aria-label="위시리스트 추가">♡</button>',
      after:  '<!-- 요소가 없다 -->',
      changed: 'removed',
      options: [
        { code: "page.getByRole('button', { name: /위시|찜|하트/ })", result: 'fail',
          verdict: '⚠️ 유사한 이름을 찾아보는 것 자체는 합리적이지만, 여기서는 매칭되는 게 없다.' },
        { code: "AI 에게 접근성 트리를 주고 비슷한 요소를 찾게 한다", result: 'danger',
          verdict: '❌ 위험하다. **없는 것을 억지로 찾아내면** 엉뚱한 요소를 조작하게 된다. AI 폴백에 `element_removed_possibility` 를 물어야 하는 이유다.' },
        { code: "치유하지 않고 '사양 변경 가능성'으로 사람에게 넘긴다", result: 'ok',
          verdict: '✅ 정답. 기능이 제거된 것인지 실수로 빠진 것인지는 **기획 확인**이 먼저다. 트랙 4-07 의 F 분류다.' },
        { code: "테스트를 test.skip 처리한다", result: 'fail',
          verdict: '⚠️ 임시 조치로는 가능하지만 **티켓 번호와 기한 없이 skip 하면 영영 잊힌다.**' }
      ],
      lesson: '요소가 사라진 것은 치유 대상이 아니라 **사양 확인 대상**이다. ' +
              'AI 폴백은 "없을 가능성"을 항상 함께 답하게 설계한다.'
    },
    {
      id: 5,
      title: '요소는 찾았는데 값이 다르다',
      context: '배송비 표시가 "0원"이어야 하는데 "3,000원"이 나온다. 로케이터는 정상 동작한다.',
      before: '<span data-testid="shipping-fee">0원</span>',
      after:  '<span data-testid="shipping-fee">3,000원</span>',
      changed: 'value',
      options: [
        { code: "로케이터를 다른 것으로 교체한다", result: 'danger',
          verdict: '❌ 요소는 이미 정확히 찾았다. 셀렉터 문제가 아니다. Call log 에 `locator resolved to` 가 나온다.' },
        { code: "기대값을 '3,000원' 으로 수정한다", result: 'danger',
          verdict: '❌ **가장 위험한 선택.** 제품 결함을 테스트 수정으로 덮는 것이다. 무료배송 로직이 깨졌을 수 있다.' },
        { code: "제품 결함(A)으로 분류하고 결함 티켓을 만든다", result: 'ok',
          verdict: '✅ 정답. "요소는 찾았는데 값이 다르다"는 A(제품 결함) 또는 F(사양 변경)다. 셀렉터 문제가 아니다.' },
        { code: "재시도 횟수를 늘린다", result: 'danger',
          verdict: '❌ 타이밍 문제가 아니다. 몇 번을 재시도해도 값은 같다.' }
      ],
      lesson: '**Call log 에서 "요소를 못 찾음"과 "값이 다름"을 구분**하는 것이 자가 복구 설계의 출발점이다. ' +
              '후자는 절대 자동 수정하지 않는다.'
    }
  ];

  var state = { idx: 0, picked: null, revealed: false, results: {} };

  /* ---------------------------------------------------------- 렌더 */

  function render(host) {
    var sc = SCENARIOS[state.idx];
    var html = '';

    html += '<div class="lab-head">' +
      '<div class="lesson-crumbs"><a href="#/lab">실습 랩</a> <span>›</span> <span>셀프힐링 시뮬레이터</span></div>' +
      '<h1>🩹 셀프힐링 시뮬레이터</h1>' +
      '<p class="sub">배포로 DOM 이 바뀌어 테스트가 깨졌습니다. 어떤 복구 전략을 택할지 고르세요. ' +
      '<strong>핵심은 "치유하면 안 되는 경우"를 알아보는 것</strong>입니다.</p></div>';

    /* 시나리오 네비 */
    html += '<div class="sim-nav">';
    SCENARIOS.forEach(function (s, i) {
      html += '<button class="sim-dot" data-go="' + i + '"' +
        (i === state.idx ? ' aria-current="true"' : '') +
        (state.results[s.id] ? ' data-done="true"' : '') + '>' + (i + 1) + '</button>';
    });
    html += '<span style="font-size:12.5px;color:var(--text-dim);margin-left:6px">' +
      Object.keys(state.results).length + ' / ' + SCENARIOS.length + ' 완료</span></div>';

    html += '<div class="lab-layout"><div>';

    html += '<div class="card">' +
      '<div class="card-title">시나리오 ' + sc.id + '<span class="hint">' + h(sc.title) + '</span></div>' +
      '<p style="font-size:13.5px;margin-bottom:14px">' + sc.context + '</p>';

    html += '<div class="grid grid-2" style="margin-bottom:14px">' +
      '<div><div style="font-size:12px;font-weight:700;color:var(--text-dim);margin-bottom:5px">배포 전</div>' +
      '<div class="dom-pane">' + h(sc.before) + '</div></div>' +
      '<div><div style="font-size:12px;font-weight:700;color:var(--text-dim);margin-bottom:5px">배포 후</div>' +
      '<div class="dom-pane">' + h(sc.after) + '</div></div>' +
      '</div>';

    html += '<p style="font-size:13px;font-weight:600;margin-bottom:9px">' +
      '어떻게 하시겠습니까?</p>';

    sc.options.forEach(function (o, i) {
      var showResult = state.revealed;
      html += '<label class="strategy"' +
        (showResult ? ' data-result="' + o.result + '"' : '') + '>' +
        '<input type="radio" name="strategy" value="' + i + '"' +
        (state.picked === i ? ' checked' : '') + (state.revealed ? ' disabled' : '') + '>' +
        '<span class="body"><code>' + h(o.code) + '</code>' +
        (showResult ? '<span class="verdict">' + o.verdict.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</span>' : '') +
        '</span></label>';
    });

    html += '<div class="btn-row" style="margin-top:12px">';
    if (!state.revealed) {
      html += '<button class="btn btn-primary" id="btnCheck"' +
        (state.picked === null ? ' disabled' : '') + '>정답 확인</button>';
    } else {
      if (state.idx < SCENARIOS.length - 1) {
        html += '<button class="btn btn-primary" id="btnNext">다음 시나리오 →</button>';
      }
      html += '<button class="btn" id="btnRetry">다시 풀기</button>';
    }
    html += '</div>';

    if (state.revealed) {
      html += '<div class="callout ' +
        (sc.options[state.picked].result === 'ok' ? 'ok' : 'warn') + '" style="margin-top:14px">' +
        '<strong>' + (sc.options[state.picked].result === 'ok' ? '좋은 선택입니다.' : '다시 생각해 볼 지점입니다.') + '</strong><br>' +
        sc.lesson.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</div>';
    }

    html += '</div>';

    if (state.revealed && state.idx === SCENARIOS.length - 1) {
      html += '<div class="card" style="margin-top:14px"><div class="card-title">전체 정리</div>' +
        '<table class="sel-table"><thead><tr><th>상황</th><th>치유 가능?</th><th>올바른 처리</th></tr></thead><tbody>' +
        row('클래스만 바뀜', '가능', '후보 폴백으로 치유 + <strong>로그 필수</strong>') +
        row('testid 제거 + 동명 요소 추가', '조건부', '스코핑으로 1개 확정. 삭제 액션이면 치유 금지') +
        row('요소가 2개로 중복', '<strong>불가</strong>', '제품 결함으로 리포트') +
        row('요소가 사라짐', '<strong>불가</strong>', '사양 변경 확인 후 사람이 판단') +
        row('값이 다름', '<strong>불가</strong>', '셀렉터 문제가 아님. A/F 분류') +
        '</tbody></table>' +
        '<p style="font-size:12.5px;color:var(--text-dim);margin-top:10px">' +
        '다섯 중 <strong>셋은 치유하면 안 되는 경우</strong>입니다. ' +
        '셀프힐링을 도입할 때 이 판정 로직이 없으면 결함을 자동으로 숨기게 됩니다. ' +
        '자세한 구현은 <a href="#/lesson/t4-l08">트랙 4-08</a>에 있습니다.</p></div>';
    }

    html += '</div>';

    /* 사이드 */
    html += '<aside class="lab-side"><div class="card"><div class="card-title">판정 원칙</div>' +
      '<ul style="font-size:13px;padding-left:1.2em;margin:0;color:var(--text-dim)">' +
      '<li><strong>count &gt; 1 이면 치유하지 않는다</strong> — 결함 신호</li>' +
      '<li>되돌릴 수 없는 액션은 치유 대상에서 제외</li>' +
      '<li>요소가 사라졌으면 사양 확인이 먼저</li>' +
      '<li>값이 다른 것은 셀렉터 문제가 아니다</li>' +
      '<li>치유했으면 <strong>반드시 로그</strong> — 조용한 치유 금지</li>' +
      '<li>같은 key 가 반복 치유되면 근본 수정</li>' +
      '</ul></div>';

    html += '<div class="card"><div class="card-title">관련 레슨</div>' +
      '<ul style="font-size:13px;padding-left:1.2em;margin:0">' +
      '<li><a href="#/lesson/t3-l02">3-02 로케이터 전략</a></li>' +
      '<li><a href="#/lesson/t4-l07">4-07 실패 원인 분류</a></li>' +
      '<li><a href="#/lesson/t4-l08">4-08 셀프힐링 구현</a></li>' +
      '<li><a href="#/lesson/t6-l03">6-03 DOM·셀렉터</a></li>' +
      '</ul></div></aside></div>';

    host.innerHTML = html;
    bind(host);
  }

  function row(a, b, c) {
    return '<tr><td>' + a + '</td><td>' + b + '</td><td>' + c + '</td></tr>';
  }

  function bind(host) {
    QALab.$$('[data-go]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.idx = parseInt(b.getAttribute('data-go'), 10);
        state.picked = null;
        state.revealed = false;
        render(host);
      });
    });

    QALab.$$('input[name="strategy"]', host).forEach(function (r) {
      r.addEventListener('change', function () {
        state.picked = parseInt(r.value, 10);
        render(host);
      });
    });

    var btnCheck = QALab.$('#btnCheck', host);
    if (btnCheck) btnCheck.addEventListener('click', function () {
      state.revealed = true;
      state.results[SCENARIOS[state.idx].id] = SCENARIOS[state.idx].options[state.picked].result;
      render(host);
    });

    var btnNext = QALab.$('#btnNext', host);
    if (btnNext) btnNext.addEventListener('click', function () {
      state.idx += 1;
      state.picked = null;
      state.revealed = false;
      render(host);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var btnRetry = QALab.$('#btnRetry', host);
    if (btnRetry) btnRetry.addEventListener('click', function () {
      state.picked = null;
      state.revealed = false;
      render(host);
    });
  }

  QALab.labs = QALab.labs || {};
  QALab.labs['self-healing'] = { render: render };
})(window);
