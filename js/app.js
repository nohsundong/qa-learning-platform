/* ==========================================================================
   app.js — 부트스트랩 (가장 마지막에 로드)
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;

  /* ------------------------------------------------------------- 테마 */

  function effectiveDark(theme) {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    QALab.store.setSetting('theme', theme);
    QALab.md.applyHighlightTheme(effectiveDark(theme));
  }

  function initTheme() {
    var theme = QALab.store.getSettings().theme || 'auto';
    document.documentElement.setAttribute('data-theme', theme);
    QALab.md.applyHighlightTheme(effectiveDark(theme));

    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if ((QALab.store.getSettings().theme || 'auto') === 'auto') {
          QALab.md.applyHighlightTheme(mq.matches);
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    var btn = QALab.$('#themeToggle');
    if (btn) btn.addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      var cur = QALab.store.getSettings().theme || 'auto';
      var next = order[(order.indexOf(cur) + 1) % order.length];
      setTheme(next);
      QALab.toast({ auto: '테마: 시스템 설정', light: '테마: 라이트', dark: '테마: 다크' }[next]);
      // 설정 화면을 보고 있다면 셀렉트도 갱신
      var sel = QALab.$('#selTheme');
      if (sel) sel.value = next;
    });
  }

  /* ------------------------------------------------------------ 라우트 */

  function registerRoutes() {
    var r = QALab.router;
    r.on('/', function () { QALab.views.dashboard(); });
    r.on('/tracks', function () { QALab.views.tracks(); });
    r.on('/track/:id', function (p) { QALab.views.track(p); });
    r.on('/lesson/:id', function (p) { QALab.views.lesson(p); });
    r.on('/lab', function () { QALab.views.lab(); });
    r.on('/lab/:id', function (p) { QALab.views.labDetail(p); });
    r.on('/review', function () { QALab.views.review(); });
    r.on('/bookmarks', function () { QALab.views.bookmarks(); });
    r.on('/settings', function () { QALab.views.settings(); });
    r.notFound(function (path) { QALab.views.notFound('페이지를 찾을 수 없습니다: ' + path); });
  }

  /* ------------------------------------------------------------- 시작 */

  function fatal(err) {
    console.error(err);
    var v = QALab.$('#view');
    var hint = QALab.content.usingBundle
      ? '<code>content/lessons.bundle.js</code> 가 없거나 비어 있을 수 있습니다. ' +
        '터미널에서 <code>node tools/build-content.mjs</code> 를 한 번 실행한 뒤 새로고침하세요.'
      : '<code>content/manifest.json</code> 을 읽지 못했습니다. 경로와 파일 존재 여부를 확인하세요.';
    if (v) {
      v.innerHTML = '<div class="callout danger"><strong>콘텐츠를 불러오지 못했습니다.</strong><br>' +
        QALab.h(err.message) + '</div><div class="callout">' + hint + '</div>';
    }
  }

  function boot() {
    initTheme();
    QALab.nav.bindChrome();

    QALab.content.init().then(function () {
      registerRoutes();

      // 진도가 바뀌면 사이드바와 상단 진도 막대를 다시 그린다
      QALab.store.onChange(QALab.debounce(function () {
        QALab.nav.render();
        QALab.nav.renderTopbarProgress();
      }, 60));

      QALab.router.start();
      QALab.nav.render();
      QALab.nav.renderTopbarProgress();

      // 라우트가 바뀔 때도 사이드바의 현재 위치 표시를 갱신
      global.addEventListener('hashchange', function () { QALab.nav.render(); });
    }).catch(fatal);
  }

  QALab.setTheme = setTheme;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
