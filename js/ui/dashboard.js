/* ==========================================================================
   ui/dashboard.js — 대시보드 / 트랙 목록 / 트랙 상세 / 북마크
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  function view() { return QALab.$('#view'); }

  /* ------------------------------------------------------------ 집계 */

  function overallStats() {
    var metas = QALab.content.allLessonMetas();
    var states = QALab.store.allLessonStates();
    var done = 0, doing = 0, minutesDone = 0, minutesLeft = 0;
    metas.forEach(function (m) {
      var st = states[m.id];
      if (st && st.status === 'done') { done++; minutesDone += (m.minutes || 15); }
      else {
        minutesLeft += (m.minutes || 15);
        if (st && st.status === 'doing') doing++;
      }
    });
    return {
      total: metas.length, done: done, doing: doing,
      percent: QALab.pct(done, metas.length),
      minutesDone: minutesDone, minutesLeft: minutesLeft
    };
  }

  function trackStats(track) {
    var states = QALab.store.allLessonStates();
    var done = track.lessons.filter(function (l) {
      return states[l.id] && states[l.id].status === 'done';
    }).length;
    return { done: done, total: track.lessons.length, percent: QALab.pct(done, track.lessons.length) };
  }

  /** 다음에 학습할 레슨: 진행중 → 미완료 순서상 첫 번째 */
  function nextLesson() {
    var metas = QALab.content.allLessonMetas();
    var states = QALab.store.allLessonStates();
    var doing = metas.filter(function (m) { return states[m.id] && states[m.id].status === 'doing'; })[0];
    if (doing) return doing;
    return metas.filter(function (m) { return !states[m.id] || states[m.id].status !== 'done'; })[0] || null;
  }

  function recentActivity(limit) {
    var states = QALab.store.allLessonStates();
    var rows = [];
    for (var id in states) {
      var st = states[id];
      if (!st.updatedAt) continue;
      var meta = QALab.content.getLessonMeta(id);
      if (!meta) continue;
      rows.push({ meta: meta, state: st });
    }
    rows.sort(function (a, b) { return a.state.updatedAt < b.state.updatedAt ? 1 : -1; });
    return rows.slice(0, limit || 6);
  }

  /* -------------------------------------------------------- 대시보드 */

  function renderDashboard() {
    var s = overallStats();
    var streak = QALab.store.getStreak();
    var next = nextLesson();
    var due = QALab.store.dueReviews();
    var recent = recentActivity(5);

    var html = '';

    html += '<div class="page-head">' +
      '<h1>대시보드</h1>' +
      '<p class="sub">2026년 QA 채용시장이 요구하는 역량을 ' + QALab.content.getTracks().length + '개 트랙 ' + s.total + '개 레슨으로 학습합니다.</p>' +
      '</div>';

    /* 통계 타일 */
    html += '<div class="grid grid-4" style="margin-bottom:16px">';
    html += tile('전체 진도', s.percent + '<span class="unit">%</span>', s.done + ' / ' + s.total + ' 레슨');
    html += tile('연속 학습', streak.current + '<span class="unit">일</span>', '최장 ' + streak.longest + '일');
    html += tile('오늘 복습', due.length + '<span class="unit">개</span>',
                 due.length ? '복습 큐에서 확인' : '밀린 복습 없음');
    html += tile('남은 학습량', Math.round(s.minutesLeft / 60) + '<span class="unit">시간</span>',
                 '완료 ' + Math.round(s.minutesDone / 60) + '시간');
    html += '</div>';

    /* 이어서 학습하기 */
    if (next) {
      html += '<div class="card" style="border-left:4px solid ' + QALab.trackVar(next.trackId) + '">' +
        '<div class="card-title">이어서 학습하기<span class="hint">' + h(next.trackTitle) + '</span></div>' +
        '<h3 style="font-size:17px;margin-bottom:5px">' + h(next.title) + '</h3>' +
        '<p style="color:var(--text-dim);font-size:13.5px;margin-bottom:12px">' + h(next.summary || '') + '</p>' +
        '<div class="btn-row">' +
          '<a class="btn btn-primary" href="#/lesson/' + h(next.id) + '">학습 시작 (' + (next.minutes || 15) + '분)</a>' +
          '<a class="btn" href="#/track/' + h(next.trackId) + '">트랙 전체 보기</a>' +
        '</div></div>';
    } else {
      html += '<div class="card"><div class="card-title">🎉 모든 레슨 완료</div>' +
        '<p style="margin:0;color:var(--text-dim)">복습 큐로 지식을 굳히거나, 실습 랩에서 손을 움직여 보세요.</p></div>';
    }

    /* 복습 알림 */
    if (due.length) {
      html += '<div class="callout warn" style="margin-top:14px">' +
        '<strong>복습할 항목이 ' + due.length + '개 있습니다.</strong> ' +
        '자가 체크리스트에서 약점으로 표시한 항목들입니다. ' +
        '<a href="#/review">복습 시작 →</a></div>';
    }

    /* 트랙별 진도 */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">트랙별 진도' +
            '<span class="hint"><a href="#/tracks">전체 보기</a></span></div>';
    QALab.content.getTracks().forEach(function (t) {
      var ts = trackStats(t);
      html += '<div style="margin-bottom:11px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">' +
          '<a href="#/track/' + h(t.id) + '" style="color:var(--text);font-weight:600">' + h(t.title) + '</a>' +
          '<span style="color:var(--text-faint);font-variant-numeric:tabular-nums">' + ts.done + '/' + ts.total + '</span>' +
        '</div>' +
        '<div class="bar"><span style="width:' + ts.percent + '%;--fill:' + QALab.trackVar(t.id) + '"></span></div>' +
      '</div>';
    });
    html += '</div>';

    /* 학습 잔디 + 최근 활동 */
    html += '<div class="grid grid-2" style="margin-top:14px">';
    html += '<div class="card"><div class="card-title">최근 8주 학습</div>' + heatmap(streak.history) + '</div>';

    html += '<div class="card"><div class="card-title">최근 활동</div>';
    if (!recent.length) {
      html += '<p style="color:var(--text-dim);font-size:13.5px;margin:0">아직 학습 기록이 없습니다. 첫 레슨을 시작해 보세요.</p>';
    } else {
      recent.forEach(function (r) {
        var badge = r.state.status === 'done'
          ? '<span class="badge badge-ok">완료</span>'
          : (r.state.status === 'doing' ? '<span class="badge badge-warn">진행중</span>' : '<span class="badge">열람</span>');
        html += '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-soft)">' +
          '<a href="#/lesson/' + h(r.meta.id) + '" style="flex:1;min-width:0;color:var(--text);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          h(r.meta.title) + '</a>' + badge +
          '<span style="font-size:11.5px;color:var(--text-faint);flex:none">' + QALab.formatDate(r.state.updatedAt) + '</span>' +
          '</div>';
      });
    }
    html += '</div></div>';

    /* 실습 랩 안내 */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">실습 랩</div>' +
      '<p style="color:var(--text-dim);font-size:13.5px">일부러 결함을 심어둔 샘플 앱, 셀렉터 연습기, ' +
      'Playwright 스크립트 리뷰어, 셀프힐링 시뮬레이터로 손을 움직여 훈련합니다.</p>' +
      '<a class="btn" href="#/lab">실습 랩 열기</a></div>';

    view().innerHTML = html;
  }

  function tile(label, value, foot) {
    return '<div class="stat"><div class="stat-label">' + h(label) + '</div>' +
           '<div class="stat-value">' + value + '</div>' +
           '<div class="stat-foot">' + h(foot) + '</div></div>';
  }

  /** 최근 8주 학습 히트맵 (GitHub 잔디 축소판) */
  function heatmap(history) {
    history = history || {};
    var weeks = 8, cells = [];
    var today = new Date();
    // 이번 주 일요일까지 채우도록 끝을 맞춘다
    var end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    for (var i = weeks * 7 - 1; i >= 0; i--) {
      var d = new Date(end);
      d.setDate(end.getDate() - i);
      var key = QALab.store.todayKey(d);
      cells.push({ key: key, count: history[key] || 0, future: d > today });
    }

    var html = '<div style="display:grid;grid-template-rows:repeat(7,1fr);grid-auto-flow:column;gap:3px">';
    cells.forEach(function (c) {
      var lvl = c.count === 0 ? 0 : (c.count === 1 ? 1 : (c.count <= 3 ? 2 : 3));
      var bg = ['var(--surface-3)', 'color-mix(in srgb, var(--ok) 35%, var(--surface-3))',
                'color-mix(in srgb, var(--ok) 65%, var(--surface-3))', 'var(--ok)'][lvl];
      html += '<div title="' + c.key + ' · ' + c.count + '개" ' +
              'style="width:13px;height:13px;border-radius:3px;background:' + bg +
              ';opacity:' + (c.future ? '.28' : '1') + '"></div>';
    });
    html += '</div>';
    html += '<p style="font-size:11.5px;color:var(--text-faint);margin:9px 0 0">' +
            '레슨을 완료하면 해당 날짜 칸이 진해집니다.</p>';
    return html;
  }

  /* ------------------------------------------------------- 트랙 목록 */

  function renderTracks() {
    var html = '<div class="page-head"><h1>학습 트랙</h1>' +
      '<p class="sub">트랙 1부터 순서대로 진행하는 것을 권장하지만, 필요한 트랙부터 골라 들어도 됩니다.</p></div>';

    html += '<div class="grid grid-2">';
    QALab.content.getTracks().forEach(function (t) {
      var ts = trackStats(t);
      html += '<a class="track-card" href="#/track/' + h(t.id) + '" style="--tc:' + QALab.trackVar(t.id) + '">' +
        '<h3>' + h(t.title) + '</h3>' +
        '<p class="desc">' + h(t.summary || '') + '</p>' +
        '<div class="bar"><span style="width:' + ts.percent + '%;--fill:' + QALab.trackVar(t.id) + '"></span></div>' +
        '<div class="meta"><span>' + ts.done + ' / ' + ts.total + ' 레슨</span><span>' + ts.percent + '%</span></div>' +
      '</a>';
    });
    html += '</div>';
    view().innerHTML = html;
  }

  /* ------------------------------------------------------- 트랙 상세 */

  function renderTrack(params) {
    var track = QALab.content.getTrack(params.id);
    if (!track) { renderNotFound('트랙을 찾을 수 없습니다: ' + params.id); return; }

    var ts = trackStats(track);
    var states = QALab.store.allLessonStates();

    var html = '<div class="page-head">' +
      '<div class="lesson-crumbs"><a href="#/tracks">학습 트랙</a> <span>›</span> <span>' + h(track.shortTitle || track.title) + '</span></div>' +
      '<h1>' + h(track.title) + '</h1>' +
      '<p class="sub">' + h(track.summary || '') + '</p></div>';

    html += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">' +
      '<strong>진도</strong><span>' + ts.done + ' / ' + ts.total + ' (' + ts.percent + '%)</span></div>' +
      '<div class="bar"><span style="width:' + ts.percent + '%;--fill:' + QALab.trackVar(track.id) + '"></span></div></div>';

    if (track.outcomes && track.outcomes.length) {
      html += '<div class="card" style="margin-bottom:16px"><div class="card-title">이 트랙을 마치면</div><ul style="margin:0;font-size:14px">';
      track.outcomes.forEach(function (o) { html += '<li>' + h(o) + '</li>'; });
      html += '</ul></div>';
    }

    track.lessons.forEach(function (l, i) {
      var st = (states[l.id] && states[l.id].status) || 'todo';
      var badge = st === 'done' ? '<span class="badge badge-ok">완료</span>'
                : st === 'doing' ? '<span class="badge badge-warn">진행중</span>' : '';
      html += '<a class="lesson-row" href="#/lesson/' + h(l.id) + '" data-status="' + st + '">' +
        '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="body"><strong>' + h(l.title) + '</strong>' +
        '<span class="sub">' + h(l.summary || '') + '</span></span>' +
        '<span class="right">' + badge + '<span class="badge">' + (l.minutes || 15) + '분</span></span>' +
      '</a>';
    });

    view().innerHTML = html;
  }

  /* --------------------------------------------------------- 북마크 */

  function renderBookmarks() {
    var ids = QALab.store.bookmarks();
    var html = '<div class="page-head"><h1>북마크</h1>' +
      '<p class="sub">나중에 다시 볼 레슨을 모아둔 곳입니다.</p></div>';

    if (!ids.length) {
      html += '<div class="empty"><span class="big">🔖</span>' +
        '아직 북마크한 레슨이 없습니다.<br>레슨 하단의 <strong>북마크</strong> 버튼으로 추가하세요.</div>';
    } else {
      ids.forEach(function (id) {
        var m = QALab.content.getLessonMeta(id);
        if (!m) return;
        var st = QALab.store.getLesson(id).status;
        html += '<a class="lesson-row" href="#/lesson/' + h(id) + '" data-status="' + st + '">' +
          '<span class="idx">🔖</span><span class="body"><strong>' + h(m.title) + '</strong>' +
          '<span class="sub">' + h(m.trackTitle) + '</span></span>' +
          '<span class="right"><span class="badge">' + (m.minutes || 15) + '분</span></span></a>';
      });
    }
    view().innerHTML = html;
  }

  /* ---------------------------------------------------------- 404 */

  function renderNotFound(msg) {
    view().innerHTML = '<div class="empty"><span class="big">🧭</span>' +
      h(msg || '페이지를 찾을 수 없습니다.') +
      '<div style="margin-top:14px"><a class="btn" href="#/">대시보드로</a></div></div>';
  }

  QALab.views = QALab.views || {};
  QALab.views.dashboard = renderDashboard;
  QALab.views.tracks = renderTracks;
  QALab.views.track = renderTrack;
  QALab.views.bookmarks = renderBookmarks;
  QALab.views.notFound = renderNotFound;
  QALab.stats = { overall: overallStats, track: trackStats, nextLesson: nextLesson };
})(window);
