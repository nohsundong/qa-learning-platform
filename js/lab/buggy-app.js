/* ==========================================================================
   lab/buggy-app.js — 결함이 숨겨진 샘플 쇼핑몰
   --------------------------------------------------------------------------
   트랙 1의 설계 기법으로 찾을 수 있는 결함 14개를 의도적으로 심어뒀다.
   각 결함에는 "어떤 기법으로 찾는가"가 매핑되어 있다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  /* ------------------------------------------------------- 심어둔 결함 */

  var BUGS = [
    { id: 'B01', area: '로그인', technique: '경계값 분석',
      title: '비밀번호 7자도 가입/로그인이 통과된다',
      detail: '규칙은 "8자 이상"인데 검증이 `length < 7` 로 되어 있어 7자가 통과한다.',
      how: '7자 / 8자 비밀번호로 각각 로그인해 본다.' },
    { id: 'B02', area: '로그인', technique: '경계값 분석',
      title: '5회 실패로 잠겨야 하는데 6회째에 잠긴다',
      detail: '실패 카운터 비교가 `> 5` 로 되어 있다.',
      how: '비밀번호를 연속으로 틀려보며 몇 번째에 잠기는지 센다.' },
    { id: 'B03', area: '로그인', technique: '상태전이 (불가 전이)',
      title: '잠금 상태에서 올바른 비밀번호를 넣으면 로그인된다',
      detail: '잠금 검사가 비밀번호가 틀렸을 때만 수행된다.',
      how: '잠금시킨 뒤 올바른 비밀번호로 로그인을 시도한다.' },
    { id: 'B04', area: '로그인', technique: '상태전이',
      title: '로그인 성공 후에도 실패 카운터가 초기화되지 않는다',
      detail: '명세상 성공 시 카운터는 0이 되어야 한다.',
      how: '3회 실패 → 로그인 성공 → 로그아웃 → 다시 3회 실패 시 잠기는지 확인.' },

    { id: 'B05', area: '검색', technique: '동등분할 (비유효)',
      title: '빈 검색어로 검색하면 전체 목록이 나온다',
      detail: '빈 문자열 검증이 없다. 명세는 "검색어를 입력하세요" 안내.',
      how: '아무것도 입력하지 않고 검색한다.' },
    { id: 'B06', area: '검색', technique: '경쟁 조건 (비동기)',
      title: '빠르게 입력하면 이전 검색어의 결과가 화면에 남는다',
      detail: '짧은 검색어일수록 응답이 느려서, 늦게 도착한 옛 응답이 최신 결과를 덮어쓴다. 이전 요청을 취소하지 않는다.',
      how: '"노" → "노트" → "노트북" 을 빠르게 이어서 입력하고 최종 결과를 확인한다.' },
    { id: 'B07', area: '검색', technique: '경계값 분석',
      title: '결과 건수 표시가 실제보다 1 크다',
      detail: '표시 로직이 `length + 1`.',
      how: '결과 행의 개수를 세어 표시된 숫자와 비교한다.' },

    { id: 'B08', area: '장바구니', technique: '경계값 분석',
      title: '수량을 0으로 만들어도 항목이 남는다',
      detail: '0이면 목록에서 제거되어야 하는데 0개짜리 행이 유지된다.',
      how: '수량을 0으로 변경한다.' },
    { id: 'B09', area: '장바구니', technique: '동등분할 (비유효)',
      title: '수량에 음수를 입력할 수 있고 총액이 줄어든다',
      detail: '입력값 하한 검증이 없다.',
      how: '수량 입력창에 -5 를 직접 입력한다.' },
    { id: 'B10', area: '장바구니', technique: '탐색적 (일관성)',
      title: '수량을 바꿔도 상단 장바구니 배지 숫자가 갱신되지 않는다',
      detail: '배지는 담기 시에만 갱신된다.',
      how: '담은 뒤 수량을 변경하고 상단 배지를 본다.' },

    { id: 'B11', area: '결제', technique: '경계값 분석',
      title: '정확히 30,000원일 때 무료배송이 적용되지 않는다',
      detail: '조건이 `> 30000` 이다. 명세는 "30,000원 이상".',
      how: '합계를 정확히 30,000원으로 맞춰 배송비를 확인한다.' },
    { id: 'B12', area: '결제', technique: '결정테이블',
      title: '무료배송 대상이면 도서산간 추가금이 붙지 않는다',
      detail: '명세는 "무료 대상이라도 도서산간은 추가 3,000원".',
      how: '3만원 초과 주문 + 도서산간 체크 조합을 확인한다.' },
    { id: 'B13', area: '결제', technique: '상태전이 (중복 이벤트)',
      title: '쿠폰을 여러 번 적용할 수 있다',
      detail: '이미 적용됐는지 확인하지 않는다. 주문당 1장이 명세.',
      how: '쿠폰 적용 버튼을 두 번 이상 누른다.' },
    { id: 'B14', area: '결제', technique: '경계값 분석',
      title: '할인이 상품 금액을 넘으면 결제금액이 음수가 된다',
      detail: '하한 0 처리가 없다.',
      how: '소액 주문에 정액 5,000원 쿠폰을 여러 번 적용한다.' }
  ];

  /* ---------------------------------------------------------- 데이터 */

  var PRODUCTS = [
    { id: 501, name: '무선 이어폰',     price: 45000 },
    { id: 502, name: '노트북 파우치',   price: 15000 },
    { id: 503, name: '노트북 거치대',   price: 30000 },
    { id: 504, name: '기계식 키보드',   price: 89000 },
    { id: 505, name: 'USB-C 허브',      price: 22000 },
    { id: 506, name: '노트 세트',       price: 5000 },
    { id: 507, name: '마우스 패드',     price: 8000 }
  ];

  var ACCOUNT = { id: 'qa_user_01', pw: 'Test1234!' };

  var state = null;

  function initState() {
    state = {
      tab: 'login',
      loggedIn: false,
      failCount: 0,
      lockedUntil: 0,
      searchQuery: '',
      searchResults: null,
      searchSeq: 0,
      cart: [],
      badge: 0,
      couponApplied: 0,     // 적용 횟수 (BUG-13)
      isRemote: false,
      orderMsg: null,
      showAnswers: false
    };
  }

  /* ---------------------------------------------------------- 렌더 */

  function render(host) {
    var html = '';

    html += '<div class="lab-head">' +
      '<div class="lesson-crumbs"><a href="#/lab">실습 랩</a> <span>›</span> <span>결함이 숨겨진 샘플 앱</span></div>' +
      '<h1>🐞 결함이 숨겨진 샘플 앱</h1>' +
      '<p class="sub">아래 쇼핑몰에는 실무에서 자주 나오는 결함 ' + BUGS.length + '개가 심어져 있습니다. ' +
      '트랙 1의 설계 기법을 적용해 찾아보세요.</p></div>';

    html += '<div class="lab-layout"><div>';

    /* 앱 프레임 */
    html += '<div class="app-frame">';
    html += '<div class="app-topbar">' +
      '<span class="brand">QA Shop</span>' +
      '<span class="spacer"></span>' +
      '<span style="color:var(--text-dim)">' +
        (state.loggedIn ? '👤 ' + h(ACCOUNT.id) : '비로그인') + '</span>' +
      '<span class="cart-badge" data-testid="cart-badge">' + state.badge + '</span>' +
      '</div>';

    html += '<div class="tabs" style="margin:0;padding:0 10px">' +
      tab('login', '로그인') + tab('search', '검색') +
      tab('cart', '장바구니') + tab('checkout', '결제') + '</div>';

    html += '<div class="app-body" id="appBody">' + renderTab() + '</div>';
    html += '</div>';

    /* 하단 안내 */
    html += '<div class="callout info" style="margin-top:14px">' +
      '<strong>진행 방법</strong><br>' +
      '1. 먼저 기법을 정해 TC 를 설계합니다 (경계값·동등분할·상태전이·결정테이블).<br>' +
      '2. 찾은 결함을 오른쪽에 체크하며 기록합니다.<br>' +
      '3. 다 찾았다고 생각되면 정답을 열어 대조합니다. ' +
      '<strong>못 찾은 것이 있다면 어떤 기법을 빠뜨렸는지</strong> 확인하세요.</div>';

    html += '</div>';

    /* 사이드: 발견 기록 + 정답 */
    html += '<aside class="lab-side"><div class="card">' +
      '<div class="card-title">발견 기록<span class="hint" id="foundCount">0 / ' + BUGS.length + '</span></div>' +
      '<p style="font-size:12.5px;color:var(--text-dim)">찾은 결함에 체크하세요. 이 기록은 저장되지 않습니다.</p>';
    BUGS.forEach(function (b) {
      html += '<label style="display:flex;gap:7px;align-items:flex-start;padding:5px 0;font-size:12.5px;cursor:pointer">' +
        '<input type="checkbox" class="found-chk" data-id="' + b.id + '" style="margin-top:3px">' +
        '<span><span class="badge" style="font-size:10px">' + h(b.area) + '</span> ' +
        (state.showAnswers ? h(b.title) : '???') + '</span></label>';
    });
    html += '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-sm" id="btnAnswers">' + (state.showAnswers ? '정답 숨기기' : '정답 보기') + '</button>' +
      '<button class="btn btn-sm btn-ghost" id="btnReset">앱 초기화</button>' +
      '</div></div>';

    if (state.showAnswers) {
      html += '<div class="card"><div class="card-title">결함 상세</div>';
      BUGS.forEach(function (b) {
        html += '<div style="padding:9px 0;border-bottom:1px solid var(--border-soft)">' +
          '<div style="font-size:12px;margin-bottom:3px">' +
            '<span class="badge">' + h(b.id) + '</span> ' +
            '<span class="badge badge-accent">' + h(b.technique) + '</span></div>' +
          '<strong style="font-size:13px">' + h(b.title) + '</strong>' +
          '<p style="font-size:12.5px;color:var(--text-dim);margin:4px 0 0">' + h(b.detail) + '</p>' +
          '<p style="font-size:12px;color:var(--text-faint);margin:3px 0 0">재현: ' + h(b.how) + '</p>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</aside></div>';

    host.innerHTML = html;
    bind(host);
  }

  function tab(id, label) {
    return '<button class="tab" data-tab="' + id + '" aria-selected="' +
           (state.tab === id) + '">' + label + '</button>';
  }

  /* ------------------------------------------------------- 탭별 화면 */

  function renderTab() {
    if (state.tab === 'login') return renderLogin();
    if (state.tab === 'search') return renderSearch();
    if (state.tab === 'cart') return renderCart();
    return renderCheckout();
  }

  function renderLogin() {
    var locked = Date.now() < state.lockedUntil;
    var html = '<div style="max-width:340px">';
    html += '<div class="callout" style="font-size:12.5px">' +
      '<strong>명세</strong><br>' +
      '· 테스트 계정: <code>qa_user_01</code> / <code>Test1234!</code><br>' +
      '· 비밀번호는 <strong>8자 이상</strong><br>' +
      '· <strong>5회</strong> 연속 실패 시 <strong>30초</strong> 잠금<br>' +
      '· 잠금 중에는 올바른 비밀번호도 거부<br>' +
      '· 로그인 성공 시 실패 횟수 초기화</div>';

    if (state.loginMsg) {
      html += '<div class="msg ' + state.loginMsg.kind + '" role="alert">' + h(state.loginMsg.text) + '</div>';
    }

    if (state.loggedIn) {
      html += '<div class="msg ok">로그인되어 있습니다.</div>' +
        '<button class="btn" id="btnLogout">로그아웃</button>';
    } else {
      html += '<div class="field-row"><label for="lgId">아이디</label>' +
        '<input id="lgId" data-testid="login-id" value="qa_user_01" autocomplete="off"></div>';
      html += '<div class="field-row"><label for="lgPw">비밀번호</label>' +
        '<input id="lgPw" data-testid="login-pw" type="password" autocomplete="off"></div>';
      html += '<button class="btn btn-primary" id="btnLogin" data-testid="login-submit">로그인</button>';
    }

    html += '<p style="font-size:12px;color:var(--text-faint);margin-top:12px">' +
      '실패 횟수: <strong data-testid="fail-count">' + state.failCount + '</strong>' +
      (locked ? ' · <span style="color:var(--danger)">잠금 중 (' +
        Math.ceil((state.lockedUntil - Date.now()) / 1000) + '초)</span>' : '') +
      '</p>';
    html += '</div>';
    return html;
  }

  function renderSearch() {
    var html = '<div class="callout" style="font-size:12.5px">' +
      '<strong>명세</strong> · 검색어를 입력하면 상품명에 포함된 상품을 보여준다. ' +
      '검색어가 비어 있으면 "검색어를 입력하세요"를 표시한다. ' +
      '결과 건수를 정확히 표시한다.</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<input id="searchInput" data-testid="search-input" class="input" style="flex:1" ' +
      'placeholder="상품명 검색 (예: 노트북)" value="' + h(state.searchQuery) + '">' +
      '<button class="btn btn-primary" id="btnSearch" data-testid="search-submit">검색</button></div>';

    if (state.searching) {
      html += '<p style="color:var(--text-dim);font-size:13px">검색 중…</p>';
    }

    if (state.searchResults) {
      var r = state.searchResults;
      html += '<p style="font-size:13px;color:var(--text-dim)" data-testid="search-count">' +
        '검색어 "<strong>' + h(r.query) + '</strong>" · 총 <strong>' + (r.items.length + 1) + '</strong>건</p>';
      if (!r.items.length) {
        html += '<p style="font-size:13.5px;color:var(--text-faint)">결과가 없습니다.</p>';
      } else {
        r.items.forEach(function (p) {
          html += '<div class="prod-row" data-testid="product-row">' +
            '<span class="name">' + h(p.name) + '</span>' +
            '<span class="price">' + won(p.price) + '</span>' +
            '<button class="btn btn-sm" data-add="' + p.id + '">담기</button></div>';
        });
      }
    }
    return html;
  }

  function renderCart() {
    var html = '<div class="callout" style="font-size:12.5px">' +
      '<strong>명세</strong> · 수량은 1~10 만 허용한다. 수량이 0이 되면 항목을 삭제한다. ' +
      '상단 배지는 항상 장바구니 총 수량과 일치한다.</div>';

    if (!state.cart.length) {
      html += '<p style="color:var(--text-dim);font-size:14px">장바구니가 비어 있습니다. 검색 탭에서 상품을 담아보세요.</p>';
      return html;
    }

    state.cart.forEach(function (item) {
      html += '<div class="cart-row" data-testid="cart-item">' +
        '<span class="name">' + h(item.name) + '</span>' +
        '<span style="color:var(--text-dim)">' + won(item.price) + '</span>' +
        '<input type="number" data-qty="' + item.id + '" value="' + item.qty + '" ' +
          'data-testid="cart-qty" aria-label="' + h(item.name) + ' 수량">' +
        '<span class="sub" style="min-width:90px;text-align:right">' + won(item.price * item.qty) + '</span>' +
        '<button class="btn btn-sm btn-ghost" data-remove="' + item.id + '" aria-label="삭제">✕</button>' +
      '</div>';
    });

    html += '<div class="total-box"><div class="total-line grand">' +
      '<span>상품 합계</span><span data-testid="cart-subtotal">' + won(subtotal()) + '</span></div></div>';
    html += '<div style="margin-top:14px"><button class="btn btn-primary" data-tabgo="checkout">결제하기</button></div>';
    return html;
  }

  function renderCheckout() {
    var sub = subtotal();
    var discount = state.couponApplied * 5000;
    var free = sub > 30000;                       // BUG-11
    var ship = free ? 0 : 3000;
    if (state.isRemote && !free) ship += 3000;    // BUG-12
    var total = sub - discount + ship;            // BUG-14 (하한 없음)

    var html = '<div class="callout" style="font-size:12.5px">' +
      '<strong>명세</strong><br>' +
      '· 상품 합계 <strong>30,000원 이상</strong>이면 배송비 무료, 미만이면 3,000원<br>' +
      '· 도서산간은 <strong>무료 대상이라도</strong> 추가 3,000원<br>' +
      '· 쿠폰(5,000원 정액)은 <strong>주문당 1장</strong>만 적용<br>' +
      '· 결제 금액은 0원 미만이 될 수 없다</div>';

    if (!state.cart.length) {
      html += '<p style="color:var(--text-dim);font-size:14px">장바구니가 비어 있습니다.</p>';
      return html;
    }

    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<button class="btn btn-sm" id="btnCoupon" data-testid="apply-coupon">쿠폰 적용 (5,000원)</button>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:13.5px">' +
      '<input type="checkbox" id="chkRemote" data-testid="remote-check"' +
      (state.isRemote ? ' checked' : '') + '> 도서산간 배송</label></div>';

    html += '<div class="total-box">' +
      line('상품 합계', won(sub), 'sum-subtotal') +
      line('쿠폰 할인', '-' + won(discount) + (state.couponApplied > 1 ? ' (' + state.couponApplied + '회 적용)' : ''), 'sum-discount') +
      line('배송비', won(ship), 'sum-shipping') +
      '<div class="total-line grand"><span>결제 금액</span>' +
      '<span data-testid="sum-total"' + (total < 0 ? ' style="color:var(--danger)"' : '') + '>' + won(total) + '</span></div>' +
      '</div>';

    html += '<div style="margin-top:14px"><button class="btn btn-primary btn-block" id="btnPay" data-testid="pay">결제 완료</button></div>';

    if (state.orderMsg) {
      html += '<div class="msg ok" style="margin-top:12px" role="status">' + h(state.orderMsg) + '</div>';
    }
    return html;
  }

  function line(label, value, testid) {
    return '<div class="total-line"><span>' + label + '</span>' +
           '<span data-testid="' + testid + '">' + value + '</span></div>';
  }

  function subtotal() {
    return state.cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function won(n) { return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR') + '원'; }

  /* ---------------------------------------------------------- 동작 */

  function bind(host) {
    QALab.$$('.tab[data-tab]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        state.loginMsg = null;
        render(host);
      });
    });

    QALab.$$('[data-tabgo]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tabgo');
        render(host);
      });
    });

    /* --- 로그인 --- */
    var btnLogin = QALab.$('#btnLogin', host);
    if (btnLogin) btnLogin.addEventListener('click', function () {
      var pw = QALab.$('#lgPw', host).value;
      var id = QALab.$('#lgId', host).value;

      // BUG-01: 명세는 8자 이상인데 7자가 통과한다
      if (pw.length < 7) {
        state.loginMsg = { kind: 'err', text: '비밀번호는 8자 이상이어야 합니다.' };
        render(host); return;
      }

      if (id === ACCOUNT.id && pw === ACCOUNT.pw) {
        // BUG-03: 잠금 검사가 여기 없다 → 잠금 중에도 로그인된다
        // BUG-04: 성공해도 failCount 를 초기화하지 않는다
        state.loggedIn = true;
        state.loginMsg = { kind: 'ok', text: '로그인되었습니다.' };
      } else {
        if (Date.now() < state.lockedUntil) {
          state.loginMsg = { kind: 'err', text: '계정이 잠겨 있습니다. 잠시 후 다시 시도하세요.' };
          render(host); return;
        }
        state.failCount += 1;
        // BUG-02: 5회가 아니라 6회째에 잠긴다
        if (state.failCount > 5) {
          state.lockedUntil = Date.now() + 30000;
          state.loginMsg = { kind: 'err', text: '5회 실패로 계정이 30초간 잠겼습니다.' };
        } else {
          state.loginMsg = { kind: 'err', text: '아이디 또는 비밀번호가 일치하지 않습니다. (' + state.failCount + '회 실패)' };
        }
      }
      render(host);
    });

    var btnLogout = QALab.$('#btnLogout', host);
    if (btnLogout) btnLogout.addEventListener('click', function () {
      state.loggedIn = false;
      state.loginMsg = { kind: 'info', text: '로그아웃되었습니다.' };
      render(host);
    });

    /* --- 검색 --- */
    var doSearch = function () {
      var q = QALab.$('#searchInput', host).value;
      state.searchQuery = q;

      // BUG-05: 빈 검색어 검증이 없다 → 전체가 나온다
      var items = PRODUCTS.filter(function (p) { return p.name.indexOf(q) >= 0; });

      // BUG-06: 짧은 검색어일수록 느리게 응답하고, 이전 요청을 취소하지 않는다
      var delay = Math.max(120, 900 - q.length * 220);
      var seq = ++state.searchSeq;
      state.searching = true;
      render(host);

      setTimeout(function () {
        // 도착 순서대로 무조건 덮어쓴다 (seq 검사 없음 = 경쟁 조건)
        state.searching = false;
        state.searchResults = { query: q, items: items, seq: seq };
        render(host);
      }, delay);
    };

    var btnSearch = QALab.$('#btnSearch', host);
    if (btnSearch) btnSearch.addEventListener('click', doSearch);
    var si = QALab.$('#searchInput', host);
    if (si) {
      si.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
      si.addEventListener('input', function () {
        state.searchQuery = si.value;
        clearTimeout(si._t);
        si._t = setTimeout(doSearch, 150);
      });
      if (state.focusSearch) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); state.focusSearch = false; }
    }

    QALab.$$('[data-add]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = parseInt(b.getAttribute('data-add'), 10);
        var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
        var exist = state.cart.filter(function (x) { return x.id === id; })[0];
        if (exist) exist.qty += 1;
        else state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
        state.badge = state.cart.reduce(function (s, i) { return s + i.qty; }, 0);
        QALab.toast(p.name + ' 을(를) 담았습니다.');
        render(host);
      });
    });

    /* --- 장바구니 --- */
    QALab.$$('[data-qty]', host).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = parseInt(inp.getAttribute('data-qty'), 10);
        var item = state.cart.filter(function (x) { return x.id === id; })[0];
        // BUG-08: 0 이어도 제거하지 않는다
        // BUG-09: 음수·10 초과 검증이 없다
        item.qty = parseInt(inp.value, 10) || 0;
        // BUG-10: 배지를 갱신하지 않는다
        render(host);
      });
    });

    QALab.$$('[data-remove]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = parseInt(b.getAttribute('data-remove'), 10);
        state.cart = state.cart.filter(function (x) { return x.id !== id; });
        state.badge = state.cart.reduce(function (s, i) { return s + i.qty; }, 0);
        render(host);
      });
    });

    /* --- 결제 --- */
    var btnCoupon = QALab.$('#btnCoupon', host);
    if (btnCoupon) btnCoupon.addEventListener('click', function () {
      // BUG-13: 중복 적용 검사가 없다
      state.couponApplied += 1;
      QALab.toast('쿠폰이 적용되었습니다.');
      render(host);
    });

    var chkRemote = QALab.$('#chkRemote', host);
    if (chkRemote) chkRemote.addEventListener('change', function () {
      state.isRemote = chkRemote.checked;
      render(host);
    });

    var btnPay = QALab.$('#btnPay', host);
    if (btnPay) btnPay.addEventListener('click', function () {
      state.orderMsg = '주문이 완료되었습니다. (주문번호 ORD-TEST-' +
        String(Math.floor(Date.now() / 1000)).slice(-6) + ')';
      render(host);
    });

    /* --- 사이드 --- */
    var updateCount = function () {
      var n = QALab.$$('.found-chk:checked', host).length;
      var el = QALab.$('#foundCount', host);
      if (el) el.textContent = n + ' / ' + BUGS.length;
    };
    QALab.$$('.found-chk', host).forEach(function (c) {
      c.addEventListener('change', updateCount);
    });

    var btnAnswers = QALab.$('#btnAnswers', host);
    if (btnAnswers) btnAnswers.addEventListener('click', function () {
      state.showAnswers = !state.showAnswers;
      render(host);
    });

    var btnReset = QALab.$('#btnReset', host);
    if (btnReset) btnReset.addEventListener('click', function () {
      var show = state.showAnswers;
      initState();
      state.showAnswers = show;
      render(host);
      QALab.toast('앱을 초기화했습니다.');
    });
  }

  /* ---------------------------------------------------------------- */

  QALab.labs = QALab.labs || {};
  QALab.labs['buggy-app'] = {
    render: function (host) {
      if (!state) initState();
      render(host);
    }
  };
})(window);
