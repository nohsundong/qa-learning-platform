/* ==========================================================================
   ui/lab.js — 실습 랩 인덱스
   --------------------------------------------------------------------------
   개별 랩은 5단계에서 js/lab/*.js 로 추가한다. 지금은 인덱스와 라우팅만
   잡아두고, 아직 안 만든 랩은 "준비 중"으로 정직하게 표시한다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  var LABS = [
    {
      id: 'buggy-app',
      icon: '🐞',
      title: '결함이 숨겨진 샘플 앱',
      desc: '로그인 · 검색 · 장바구니 · 결제 화면에 실제 현업에서 자주 나오는 결함을 심어뒀습니다. ' +
            '탐색적 테스트로 찾아내고 결함 리포트를 써보세요.',
      tracks: ['트랙 1', '트랙 4']
    },
    {
      id: 'selector',
      icon: '🎯',
      title: '셀렉터 연습기',
      desc: '화면 요소를 클릭하면 CSS · XPath 셀렉터 후보를 보여주고, 어떤 것이 안정적이고 ' +
            '어떤 것이 배포 한 번에 깨지는지 비교해 줍니다.',
      tracks: ['트랙 3', '트랙 6']
    },
    {
      id: 'script-review',
      icon: '🔍',
      title: 'Playwright 스크립트 리뷰어',
      desc: '테스트 코드를 붙여넣으면 고정 sleep, 무의미한 assert, 취약한 로케이터 같은 ' +
            '안티패턴을 지적합니다. API 키 없이 규칙 기반으로 동작합니다.',
      tracks: ['트랙 3', '트랙 6']
    },
    {
      id: 'self-healing',
      icon: '🩹',
      title: '셀프힐링 시뮬레이터',
      desc: '배포로 DOM 이 바뀌어 테스트가 깨진 상황을 재현하고, 어떤 전략으로 로케이터를 ' +
            '복구할지 선택하며 판단력을 훈련합니다.',
      tracks: ['트랙 4']
    },
    {
      id: 'agentic-ops',
      icon: '🧭',
      title: '에이전틱 테스트 운영 판단 훈련',
      desc: '결제 회귀를 자율 실행에 맡길까? 에이전트가 올린 기대값 수정 PR을 머지할까? ' +
            '실행 모드 선택 · 사람 승인 게이트 · 프롬프트 인젝션 · 벤더 주장 검증 8가지 상황에서 판단을 훈련합니다.',
      tracks: ['트랙 8', '트랙 4']
    }
  ];

  function view() { return QALab.$('#view'); }

  function renderIndex() {
    var html = '<div class="page-head"><h1>실습 랩</h1>' +
      '<p class="sub">읽기만 해서는 늘지 않습니다. 브라우저 안에서 바로 손을 움직여 훈련하세요.</p></div>';

    html += '<div class="grid grid-2">';
    LABS.forEach(function (lab) {
      var ready = !!(QALab.labs && QALab.labs[lab.id]);
      html += '<div class="card">' +
        '<div class="card-title"><span style="font-size:18px">' + lab.icon + '</span> ' + h(lab.title) +
        (ready ? '' : '<span class="hint"><span class="badge badge-warn">준비 중</span></span>') + '</div>' +
        '<p style="font-size:13.5px;color:var(--text-dim)">' + h(lab.desc) + '</p>' +
        '<div style="display:flex;gap:5px;margin-bottom:12px">' +
          lab.tracks.map(function (t) { return '<span class="badge">' + h(t) + '</span>'; }).join('') +
        '</div>' +
        (ready
          ? '<a class="btn btn-primary" href="#/lab/' + h(lab.id) + '">열기</a>'
          : '<button class="btn" disabled>5단계에서 추가됩니다</button>') +
      '</div>';
    });
    html += '</div>';

    view().innerHTML = html;
  }

  function renderLab(params) {
    var lab = LABS.filter(function (l) { return l.id === params.id; })[0];
    if (!lab) { QALab.views.notFound('실습 랩을 찾을 수 없습니다: ' + params.id); return; }

    var impl = QALab.labs && QALab.labs[lab.id];
    if (!impl) {
      view().innerHTML = '<div class="page-head">' +
        '<div class="lesson-crumbs"><a href="#/lab">실습 랩</a> <span>›</span> <span>' + h(lab.title) + '</span></div>' +
        '<h1>' + lab.icon + ' ' + h(lab.title) + '</h1></div>' +
        '<div class="empty"><span class="big">🚧</span>아직 준비 중인 랩입니다.' +
        '<div style="margin-top:14px"><a class="btn" href="#/lab">실습 랩 목록</a></div></div>';
      return;
    }
    impl.render(view(), lab);
  }

  QALab.views = QALab.views || {};
  QALab.views.lab = renderIndex;
  QALab.views.labDetail = renderLab;
  QALab.LABS = LABS;
})(window);
