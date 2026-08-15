/* ==========================================================================
   ui/review.js — 약점 노트 · 간격 반복 복습 큐
   --------------------------------------------------------------------------
   자가 체크리스트에서 "약점으로" 표시한 항목이 여기로 모인다.
   먼저 스스로 답을 떠올린 뒤 원문을 열어 맞는지 확인하고, 난이도를 평가하면
   store.gradeReview() 가 다음 복습 날짜를 계산한다 (SM-2 축약판).
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  var session = null;   // { queue: [], index: 0, revealed: false, done: 0 }

  function view() { return QALab.$('#view'); }

  function render() {
    var due = QALab.store.dueReviews();
    var all = QALab.store.allReviews();

    if (session && session.index >= session.queue.length) session = null;

    var html = '<div class="page-head"><h1>복습 큐</h1>' +
      '<p class="sub">체크리스트에서 약점으로 표시한 항목을 간격 반복으로 다시 물어봅니다. ' +
      '기억이 흐려질 때쯤 다시 나타나도록 날짜가 자동 계산됩니다.</p></div>';

    html += '<div class="grid grid-3" style="margin-bottom:16px">' +
      stat('오늘 복습할 항목', due.length) +
      stat('전체 약점 항목', all.length) +
      stat('평균 난이도', all.length
        ? (all.reduce(function (s, i) { return s + i.ease; }, 0) / all.length).toFixed(2)
        : '—') +
      '</div>';

    if (!all.length) {
      html += '<div class="empty"><span class="big">🧠</span>' +
        '복습 큐가 비어 있습니다.<br>레슨의 자가 체크리스트에서 헷갈리는 항목의 ' +
        '<strong>「약점으로」</strong> 버튼을 누르면 여기에 쌓입니다.' +
        '<div style="margin-top:14px"><a class="btn" href="#/tracks">레슨 보러 가기</a></div></div>';
      view().innerHTML = html;
      return;
    }

    if (!due.length && !session) {
      html += '<div class="callout ok"><strong>오늘 복습할 항목이 없습니다.</strong> ' +
        '아래에서 예정된 항목을 미리 볼 수 있습니다.</div>';
    }

    if (session) {
      html += renderCard();
    } else if (due.length) {
      html += '<div class="card" style="text-align:center;padding:26px">' +
        '<div style="font-size:34px;margin-bottom:8px">🎯</div>' +
        '<h3 style="margin-bottom:6px">' + due.length + '개 항목이 대기 중입니다</h3>' +
        '<p style="color:var(--text-dim);font-size:13.5px">한 항목당 20~30초면 충분합니다.</p>' +
        '<button class="btn btn-primary" id="btnStartReview">복습 시작</button></div>';
    }

    /* 전체 목록 */
    html += '<div class="card" style="margin-top:16px"><div class="card-title">약점 항목 전체' +
      '<span class="hint">' + all.length + '개</span></div>';
    all.sort(function (a, b) { return a.dueAt < b.dueAt ? -1 : 1; }).forEach(function (it) {
      var meta = QALab.content.getLessonMeta(it.lessonId);
      var overdue = it.dueAt <= QALab.store.todayKey();
      html += '<div style="display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border-soft)">' +
        '<span class="badge ' + (overdue ? 'badge-warn' : '') + '" style="flex:none">' +
          h(QALab.relativeDay(it.dueAt)) + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13.5px">' + h(it.text) + '</div>' +
          '<div style="font-size:11.5px;color:var(--text-faint)">' +
            (meta ? '<a href="#/lesson/' + h(it.lessonId) + '">' + h(meta.title) + '</a>' : h(it.lessonId)) +
            ' · 복습 ' + it.reps + '회 · 실패 ' + it.lapses + '회</div>' +
        '</div>' +
        '<button class="btn btn-sm btn-ghost" data-drop="' + h(it.key) + '" title="복습 큐에서 제거">✕</button>' +
      '</div>';
    });
    html += '</div>';

    view().innerHTML = html;
    bind();
  }

  function stat(label, value) {
    return '<div class="stat"><div class="stat-label">' + h(label) + '</div>' +
           '<div class="stat-value">' + h(value) + '</div></div>';
  }

  function renderCard() {
    var it = session.queue[session.index];
    var meta = QALab.content.getLessonMeta(it.lessonId);

    var html = '<div class="card" style="padding:22px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-faint);margin-bottom:14px">' +
        '<span>' + (session.index + 1) + ' / ' + session.queue.length + '</span>' +
        '<span>' + h(meta ? meta.trackTitle : '') + '</span>' +
      '</div>' +
      '<div class="bar" style="margin-bottom:18px"><span style="width:' +
        QALab.pct(session.index, session.queue.length) + '%"></span></div>' +

      '<p style="font-size:12px;color:var(--text-dim);margin-bottom:6px">이 항목을 설명할 수 있나요?</p>' +
      '<h3 style="font-size:18px;line-height:1.5;margin-bottom:18px">' + h(it.text) + '</h3>';

    if (!session.revealed) {
      html += '<button class="btn btn-primary btn-block" id="btnReveal">답을 떠올렸다 — 원문 확인</button>';
    } else {
      html += '<div class="callout info"><strong>확인하기</strong><br>' +
        (meta
          ? '원문 레슨: <a href="#/lesson/' + h(it.lessonId) + '" target="_blank" rel="noopener">' + h(meta.title) + '</a> ' +
            '(새 탭에서 열어 비교한 뒤 아래에서 평가하세요)'
          : '원문 레슨을 찾을 수 없습니다.') +
        '</div>' +
        '<p style="font-size:13px;color:var(--text-dim);margin-bottom:9px">얼마나 잘 떠올렸나요?</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-danger" data-grade="again">전혀 못 함 <span style="opacity:.6">1일</span></button>' +
          '<button class="btn" data-grade="hard">어려웠음</button>' +
          '<button class="btn" data-grade="good">떠올림</button>' +
          '<button class="btn btn-ok" data-grade="easy">아주 쉬움</button>' +
        '</div>';
    }

    html += '<div style="margin-top:16px;text-align:right">' +
      '<button class="btn btn-sm btn-ghost" id="btnEndSession">복습 중단</button></div>';
    html += '</div>';
    return html;
  }

  function bind() {
    var start = QALab.$('#btnStartReview');
    if (start) start.addEventListener('click', function () {
      var s = QALab.store.getSettings();
      session = { queue: QALab.store.dueReviews(s.reviewPerDay || 5), index: 0, revealed: false, done: 0 };
      render();
    });

    var reveal = QALab.$('#btnReveal');
    if (reveal) reveal.addEventListener('click', function () {
      session.revealed = true;
      render();
    });

    QALab.$$('[data-grade]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var it = session.queue[session.index];
        QALab.store.gradeReview(it.key, btn.getAttribute('data-grade'));
        session.index += 1;
        session.revealed = false;
        session.done += 1;
        if (session.index >= session.queue.length) {
          QALab.toast(session.done + '개 항목 복습 완료 🎉');
          session = null;
        }
        render();
      });
    });

    var end = QALab.$('#btnEndSession');
    if (end) end.addEventListener('click', function () { session = null; render(); });

    QALab.$$('[data-drop]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-drop');
        var parts = key.split('#');
        QALab.store.removeWeak(parts[0], parseInt(parts[1], 10));
        QALab.toast('복습 큐에서 제거했습니다.');
        render();
      });
    });
  }

  QALab.views = QALab.views || {};
  QALab.views.review = render;
})(window);
