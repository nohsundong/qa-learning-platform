/* ==========================================================================
   ui/nav.js — 사이드바 내비게이션
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    tracks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 15h9"/></svg>',
    review: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5h-5"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2"/></svg>',
    caret: '<svg viewBox="0 0 24 24" class="nav-track-caret" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };

  var openTracks = {};   // 세션 동안만 유지되는 아코디언 상태

  function lessonStatus(id) {
    return QALab.store.getLesson(id).status;
  }

  function trackProgress(track) {
    var done = 0;
    track.lessons.forEach(function (l) { if (lessonStatus(l.id) === 'done') done++; });
    return { done: done, total: track.lessons.length };
  }

  function render() {
    var host = QALab.$('#sidebarInner');
    if (!host) return;

    var cur = QALab.router.getCurrent();
    var curPath = cur.path;
    var curLessonId = cur.params && cur.params.id;

    // 현재 보고 있는 레슨이 속한 트랙은 자동으로 펼친다
    if (curLessonId) {
      var meta = QALab.content.getLessonMeta(curLessonId);
      if (meta) openTracks[meta.trackId] = true;
    }
    if (cur.pattern === '/track/:id') openTracks[cur.params.id] = true;

    var dueCount = QALab.store.dueReviews().length;
    var bmCount = QALab.store.bookmarks().length;

    var html = '';

    html += '<div class="nav-section">';
    html += navItem('#/', ICONS.home, '대시보드', curPath === '/');
    html += navItem('#/tracks', ICONS.tracks, '학습 트랙', curPath === '/tracks');
    html += navItem('#/lab', ICONS.lab, '실습 랩', curPath.indexOf('/lab') === 0);
    html += navItem('#/review', ICONS.review, '복습 큐', curPath === '/review', dueCount || '');
    html += navItem('#/bookmarks', ICONS.bookmark, '북마크', curPath === '/bookmarks', bmCount || '');
    html += '</div>';

    html += '<div class="nav-section">';
    html += '<div class="nav-section-title">커리큘럼</div>';

    QALab.content.getTracks().forEach(function (track) {
      var pr = trackProgress(track);
      var isOpen = !!openTracks[track.id];
      html += '<div class="nav-track" data-open="' + isOpen + '" data-track="' + h(track.id) + '">';
      html += '<button type="button" class="nav-track-head" aria-expanded="' + isOpen + '">' +
                '<span class="nav-track-dot" style="--dot:' + QALab.trackVar(track.id) + '"></span>' +
                '<span class="nav-track-name">' + h(track.shortTitle || track.title) + '</span>' +
                '<span class="nav-track-frac">' + pr.done + '/' + pr.total + '</span>' +
                ICONS.caret +
              '</button>';
      html += '<div class="nav-lessons">';
      track.lessons.forEach(function (l) {
        var st = lessonStatus(l.id);
        var active = curLessonId === l.id;
        html += '<a class="nav-lesson" href="#/lesson/' + h(l.id) + '" data-status="' + st + '"' +
                (active ? ' aria-current="page"' : '') + '>' +
                '<span class="tick" aria-hidden="true"></span>' +
                '<span>' + h(l.title) + '</span></a>';
      });
      html += '<a class="nav-lesson" href="#/track/' + h(track.id) + '">' +
              '<span class="tick" style="border-style:dotted" aria-hidden="true"></span>' +
              '<span>트랙 개요 보기</span></a>';
      html += '</div></div>';
    });
    html += '</div>';

    html += '<div class="nav-section">';
    html += navItem('#/settings', ICONS.settings, '설정 · 백업', curPath === '/settings');
    html += '</div>';

    host.innerHTML = html;

    QALab.$$('.nav-track-head', host).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = btn.closest('.nav-track');
        var id = wrap.getAttribute('data-track');
        openTracks[id] = !openTracks[id];
        wrap.setAttribute('data-open', String(openTracks[id]));
        btn.setAttribute('aria-expanded', String(openTracks[id]));
      });
    });

    // 모바일: 링크 누르면 사이드바 닫기
    QALab.$$('a', host).forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 960px)').matches) closeNav();
      });
    });
  }

  function navItem(href, icon, label, active, count) {
    return '<a class="nav-item" href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' +
      icon + '<span>' + h(label) + '</span>' +
      (count ? '<span class="nav-count">' + h(count) + '</span>' : '') +
      '</a>';
  }

  function openNav() {
    document.body.setAttribute('data-nav', 'open');
    var t = QALab.$('#navToggle');
    if (t) { t.setAttribute('aria-expanded', 'true'); t.setAttribute('aria-label', '메뉴 닫기'); }
    var scrim = QALab.$('#scrim');
    if (scrim) scrim.hidden = false;
  }

  function closeNav() {
    document.body.removeAttribute('data-nav');
    var t = QALab.$('#navToggle');
    if (t) { t.setAttribute('aria-expanded', 'false'); t.setAttribute('aria-label', '메뉴 열기'); }
    var scrim = QALab.$('#scrim');
    if (scrim) scrim.hidden = true;
  }

  function toggleNav() {
    if (document.body.getAttribute('data-nav') === 'open') closeNav();
    else openNav();
  }

  function bindChrome() {
    var t = QALab.$('#navToggle');
    if (t) t.addEventListener('click', toggleNav);
    var scrim = QALab.$('#scrim');
    if (scrim) scrim.addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  /** 상단바 전체 진도 막대 갱신 */
  function renderTopbarProgress() {
    var metas = QALab.content.allLessonMetas();
    var states = QALab.store.allLessonStates();
    var done = metas.filter(function (m) { return states[m.id] && states[m.id].status === 'done'; }).length;
    var p = QALab.pct(done, metas.length);
    var fill = QALab.$('#topbarBarFill');
    var label = QALab.$('#topbarBarLabel');
    if (fill) fill.style.width = p + '%';
    if (label) label.textContent = p + '%';
  }

  QALab.nav = {
    render: render,
    bindChrome: bindChrome,
    closeNav: closeNav,
    renderTopbarProgress: renderTopbarProgress,
    ICONS: ICONS
  };
})(window);
