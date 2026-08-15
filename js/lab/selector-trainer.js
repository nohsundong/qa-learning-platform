/* ==========================================================================
   lab/selector-trainer.js — 셀렉터 연습기
   --------------------------------------------------------------------------
   화면 요소를 클릭하면 후보 셀렉터를 생성해 안정성 등급과 함께 보여준다.
   "DOM 변경 시뮬레이션"으로 각 셀렉터가 실제로 깨지는지 확인할 수 있다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  /* --------------------------------------------- 연습용 화면 (2가지 버전) */

  function stageHtml(variant) {
    // variant: 'before' | 'after'
    var cls = variant === 'after'
      ? { card: 'Card_root__9fa2b', title: 'Card_title__1x0z', btn: 'Btn_base__k3d9' }
      : { card: 'product-card', title: 'product-title', btn: 'btn btn-primary' };

    // after 버전은 구조도 한 겹 더 감싸고 testid 를 일부 제거한다
    var wrap = variant === 'after';

    var card = function (id, name, price, soldout) {
      var inner =
        '<span class="' + cls.title + '" data-pickable>' + name + '</span>' +
        '<span class="price" data-pickable>' + price + '</span>' +
        (soldout ? '<span class="badge badge-danger" data-pickable>품절</span>' : '') +
        '<button class="' + cls.btn + '" ' +
          (variant === 'before' ? 'data-testid="add-' + id + '" ' : '') +
          'data-pickable>담기</button>' +
        '<button aria-label="찜하기" class="icon-btn" data-pickable>♡</button>';
      return '<div class="' + cls.card + '" data-id="' + id + '" data-pickable>' +
             (wrap ? '<div class="Card_inner__aa1">' + inner + '</div>' : inner) +
             '</div>';
    };

    return '' +
      '<header data-pickable>' +
        '<h2 data-pickable>추천 상품</h2>' +
        '<nav data-pickable><a href="/cart" data-pickable>장바구니</a></nav>' +
      '</header>' +
      '<div class="list" data-pickable>' +
        card(10023, '무선 이어폰', '45,000원', false) +
        card(10024, '노트북 거치대', '30,000원', true) +
        card(10025, '기계식 키보드', '89,000원', false) +
      '</div>' +
      '<form data-pickable>' +
        '<label for="couponInput" data-pickable>쿠폰 코드</label>' +
        '<input id="couponInput" placeholder="쿠폰 코드를 입력하세요" data-pickable>' +
        '<button type="submit" class="' + cls.btn + '" data-pickable>적용</button>' +
      '</form>';
  }

  var state = { variant: 'before', picked: null, lastCandidates: null };

  /* --------------------------------------------- 셀렉터 후보 생성 */

  function roleOf(el) {
    var tag = el.tagName.toLowerCase();
    if (el.hasAttribute('role')) return el.getAttribute('role');
    var map = {
      button: 'button', a: el.hasAttribute('href') ? 'link' : null,
      h1: 'heading', h2: 'heading', h3: 'heading',
      nav: 'navigation', header: 'banner', form: 'form',
      label: null, input: 'textbox', img: 'img'
    };
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button') return 'button';
      return 'textbox';
    }
    return map[tag] || null;
  }

  function accessibleName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    var labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      var lb = document.getElementById(labelledby);
      if (lb) return lb.textContent.trim();
    }
    if (el.tagName.toLowerCase() === 'input') {
      var lab = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
      if (lab) return lab.textContent.trim();
      return el.getAttribute('placeholder') || '';
    }
    return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  }

  function cssPath(el, root) {
    var parts = [];
    var cur = el;
    while (cur && cur !== root) {
      var seg = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === cur.tagName;
        });
        if (same.length > 1) seg += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
      }
      parts.unshift(seg);
      cur = parent;
    }
    return parts.join(' > ');
  }

  function xpathOf(el, root) {
    var parts = [];
    var cur = el;
    while (cur && cur !== root) {
      var parent = cur.parentElement;
      var idx = 1;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === cur.tagName;
        });
        idx = same.indexOf(cur) + 1;
      }
      parts.unshift(cur.tagName.toLowerCase() + '[' + idx + ']');
      cur = parent;
    }
    return '//' + parts.join('/');
  }

  function buildCandidates(el, stage) {
    var out = [];
    var role = roleOf(el);
    var name = accessibleName(el);
    var testid = el.getAttribute('data-testid');
    var cls = (el.getAttribute('class') || '').trim();
    var id = el.id;
    var tag = el.tagName.toLowerCase();

    if (role && name) {
      out.push({
        code: "page.getByRole('" + role + "', { name: '" + name + "' })",
        kind: 'role', grade: 'best', depends: '의미(역할 + 접근성 이름)',
        breaks: '요소의 역할이 바뀌거나 문구가 바뀔 때. 가장 드물다.'
      });
    } else if (role) {
      out.push({
        code: "page.getByRole('" + role + "')",
        kind: 'role', grade: 'mid', depends: '역할만 (이름 없음)',
        breaks: '같은 역할의 요소가 여러 개면 strict mode 위반. **접근성 이름이 없는 것 자체가 결함 신호.**'
      });
    }

    if (tag === 'input' && el.id) {
      var lab = stage.querySelector('label[for="' + el.id + '"]');
      if (lab) out.push({
        code: "page.getByLabel('" + lab.textContent.trim() + "')",
        kind: 'label', grade: 'best', depends: '라벨 텍스트',
        breaks: '라벨 문구 변경, 다국어 전환.'
      });
      if (el.getAttribute('placeholder')) out.push({
        code: "page.getByPlaceholder('" + el.getAttribute('placeholder') + "')",
        kind: 'placeholder', grade: 'good', depends: 'placeholder 문구',
        breaks: 'placeholder 변경. 라벨보다 자주 바뀐다.'
      });
    }

    if (testid) {
      out.push({
        code: "page.getByTestId('" + testid + "')",
        kind: 'testid', grade: 'best', depends: '테스트 전용 속성(계약)',
        breaks: '개발자가 의도적으로 지울 때. 지워지면 CI 에서 즉시 드러난다.'
      });
    } else {
      out.push({
        code: "// data-testid 없음 — 개발팀에 요청을 검토",
        kind: 'testid-missing', grade: 'bad', depends: '—',
        breaks: '동적 목록이나 아이콘 버튼이면 testid 를 요청하는 것이 정석이다.'
      });
    }

    var text = (el.textContent || '').trim();
    if (text && text.length <= 20 && el.children.length === 0) {
      out.push({
        code: "page.getByText('" + text + "', { exact: true })",
        kind: 'text', grade: 'good', depends: '표시 텍스트',
        breaks: '문구 변경, 다국어. 같은 문구가 여러 곳에 있으면 strict 위반.'
      });
    }

    if (id) {
      out.push({
        code: "page.locator('#" + id + "')",
        kind: 'id', grade: /\d{4,}|[0-9a-f]{6,}/.test(id) ? 'bad' : 'good',
        depends: 'id 속성',
        breaks: /\d{4,}|[0-9a-f]{6,}/.test(id)
          ? '자동 생성 id 로 보인다. 렌더링마다 바뀔 수 있다.'
          : '개발자가 id 를 바꿀 때. 비교적 안정적.'
      });
    }

    if (cls) {
      var auto = /_{2}|__|[A-Za-z]+_[A-Za-z]+__|sc-[a-zA-Z]{6,}|css-[a-z0-9]{6,}/.test(cls);
      out.push({
        code: "page.locator('." + cls.split(/\s+/).join('.') + "')",
        kind: 'class', grade: auto ? 'bad' : 'mid', depends: '스타일 클래스',
        breaks: auto
          ? '**자동 생성 클래스다. 빌드할 때마다 바뀐다.** 절대 쓰지 말 것.'
          : '디자인 변경, CSS 리팩터링 시 깨진다.'
      });
    }

    out.push({
      code: "page.locator('" + cssPath(el, stage) + "')",
      kind: 'csspath', grade: 'bad', depends: 'DOM 구조',
      breaks: '부모 요소가 하나만 추가돼도 깨진다.'
    });

    out.push({
      code: 'page.locator("xpath=' + xpathOf(el, stage) + '")',
      kind: 'xpath', grade: 'bad', depends: 'DOM 구조 (절대 경로)',
      breaks: '거의 항상 깨진다. 최후의 수단.'
    });

    // 부모로 스코핑한 안정적 조합 제안
    var card = el.closest('[data-id]');
    if (card && card !== el) {
      var cardName = (card.querySelector('span') || {}).textContent || '';
      if (role && name) {
        out.unshift({
          code: "page.locator('[data-id]')\n  .filter({ hasText: '" + cardName.trim() + "' })\n  .getByRole('" + role + "', { name: '" + name + "' })",
          kind: 'scoped', grade: 'best', depends: '내용으로 스코핑 + 역할',
          breaks: '목록 순서가 바뀌어도 안전하다. 실무에서 가장 권장되는 형태.'
        });
      }
    }

    return out;
  }

  /* ---------------------------------------------------------- 렌더 */

  function render(host) {
    var html = '';

    html += '<div class="lab-head">' +
      '<div class="lesson-crumbs"><a href="#/lab">실습 랩</a> <span>›</span> <span>셀렉터 연습기</span></div>' +
      '<h1>🎯 셀렉터 연습기</h1>' +
      '<p class="sub">아래 화면의 요소를 클릭하면 후보 셀렉터와 안정성 등급이 나옵니다. ' +
      '「DOM 변경 시뮬레이션」으로 실제로 무엇이 깨지는지 확인하세요.</p></div>';

    html += '<div class="lab-layout"><div>';

    html += '<div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn ' + (state.variant === 'before' ? 'btn-primary' : '') + '" data-variant="before">배포 전 DOM</button>' +
      '<button class="btn ' + (state.variant === 'after' ? 'btn-primary' : '') + '" data-variant="after">배포 후 DOM (디자인 시스템 교체)</button>' +
      '</div>';

    if (state.variant === 'after') {
      html += '<div class="callout warn" style="font-size:13px">' +
        '<strong>배포 후 상태입니다.</strong> 클래스명이 자동 생성 방식으로 바뀌었고, ' +
        '카드 안에 <code>div</code> 가 한 겹 추가됐으며, 일부 <code>data-testid</code> 가 제거됐습니다. ' +
        '앞에서 만든 셀렉터 중 무엇이 살아남는지 확인하세요.</div>';
    }

    html += '<div class="sel-stage" id="selStage">' + stageHtml(state.variant) + '</div>';

    html += '<div class="card" style="margin-top:14px"><div class="card-title">후보 셀렉터' +
      '<span class="hint">' + (state.picked ? '선택됨: <code>' + h(state.pickedDesc || '') + '</code>' : '요소를 클릭하세요') + '</span></div>';

    if (!state.lastCandidates) {
      html += '<p style="color:var(--text-dim);font-size:13.5px;margin:0">' +
        '위 화면에서 버튼·텍스트·입력창 등을 클릭해 보세요.</p>';
    } else {
      html += '<div class="table-scroll"><table class="sel-table"><thead><tr>' +
        '<th>등급</th><th>셀렉터</th><th>무엇에 의존하나</th><th>언제 깨지나</th>' +
        '</tr></thead><tbody>';
      state.lastCandidates.forEach(function (c) {
        html += '<tr>' +
          '<td><span class="grade ' + c.grade + '">' + gradeLabel(c.grade) + '</span></td>' +
          '<td><code>' + h(c.code) + '</code></td>' +
          '<td>' + h(c.depends) + '</td>' +
          '<td>' + c.breaks.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    html += '</div>';

    /* 사이드 */
    html += '<aside class="lab-side"><div class="card"><div class="card-title">판단 기준</div>' +
      '<p style="font-size:13px;color:var(--text-dim)">셀렉터의 안정성은 <strong>무엇에 의존하는가</strong>로 결정됩니다.</p>' +
      '<table class="sel-table"><tbody>' +
      gradeRow('best', '의미 · 계약', 'role+name, label, testid') +
      gradeRow('good', '표시 내용', 'text, placeholder, 수동 id') +
      gradeRow('mid', '스타일', '일반 클래스') +
      gradeRow('bad', '구조 · 자동생성', 'nth-of-type, XPath, 해시 클래스') +
      '</tbody></table>' +
      '<p style="font-size:12.5px;color:var(--text-faint);margin-top:10px">' +
      '자세한 근거는 <a href="#/lesson/t3-l02">트랙 3-02 로케이터 전략</a>과 ' +
      '<a href="#/lesson/t6-l03">트랙 6-03 DOM·셀렉터</a>에 있습니다.</p></div>';

    html += '<div class="card"><div class="card-title">연습 과제</div>' +
      '<ol style="font-size:13px;padding-left:1.2em;margin:0">' +
      '<li>「배포 전」에서 <strong>담기 버튼</strong>을 클릭해 셀렉터 5개를 확인</li>' +
      '<li>가장 안정적일 것 같은 것과 가장 취약한 것을 예측</li>' +
      '<li>「배포 후」로 전환</li>' +
      '<li>같은 버튼을 다시 클릭해 <strong>어떤 셀렉터가 사라졌는지</strong> 확인</li>' +
      '<li>♡ 찜하기 버튼을 클릭 — <code>aria-label</code> 이 없었다면 어떻게 됐을까?</li>' +
      '<li>품절 배지를 클릭 — 이 정보로 상품 카드를 어떻게 지목할까?</li>' +
      '</ol></div>';

    html += '</aside></div>';

    host.innerHTML = html;
    bind(host);
  }

  function gradeLabel(g) {
    return { best: '최상', good: '상', mid: '중', bad: '하' }[g] || g;
  }

  function gradeRow(g, what, ex) {
    return '<tr><td><span class="grade ' + g + '">' + gradeLabel(g) + '</span></td>' +
           '<td>' + what + '<br><span style="color:var(--text-faint);font-size:11.5px">' + ex + '</span></td></tr>';
  }

  function bind(host) {
    QALab.$$('[data-variant]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.variant = b.getAttribute('data-variant');
        state.lastCandidates = null;
        state.picked = null;
        render(host);
      });
    });

    var stage = QALab.$('#selStage', host);
    if (!stage) return;

    stage.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var el = e.target.closest('[data-pickable]');
      if (!el || !stage.contains(el)) return;

      QALab.$$('[data-picked]', stage).forEach(function (x) { x.removeAttribute('data-picked'); });
      el.setAttribute('data-picked', 'true');

      state.picked = el;
      state.pickedDesc = '<' + el.tagName.toLowerCase() + '> ' +
        (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      state.lastCandidates = buildCandidates(el, stage);
      render(host);
    });
  }

  QALab.labs = QALab.labs || {};
  QALab.labs['selector'] = { render: render };
})(window);
