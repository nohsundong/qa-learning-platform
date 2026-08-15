/* ==========================================================================
   router.js — 해시 기반 라우터
   --------------------------------------------------------------------------
   GitHub Pages 는 서버 리라이트를 못 하므로 History API 대신 해시를 쓴다.
   (#/lesson/t1-l01 형태 → 새로고침·북마크·뒤로가기 모두 정상 동작)
   ========================================================================== */
(function (global) {
  'use strict';

  var routes = [];
  var notFoundHandler = null;
  var current = { path: '/', params: {} };

  function on(pattern, handler) {
    // '/lesson/:id' → /^\/lesson\/([^\/]+)$/
    var names = [];
    var regexSrc = '^' + pattern.replace(/:[A-Za-z0-9_]+/g, function (m) {
      names.push(m.slice(1));
      return '([^/]+)';
    }).replace(/\//g, '\\/') + '$';
    routes.push({ re: new RegExp(regexSrc), names: names, handler: handler, pattern: pattern });
  }

  function notFound(handler) { notFoundHandler = handler; }

  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h === '/') return { path: '/', query: {} };
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var query = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    return { path: path, query: query };
  }

  function resolve() {
    var parsed = parseHash();
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i].re.exec(parsed.path);
      if (m) {
        var params = {};
        routes[i].names.forEach(function (n, idx) { params[n] = decodeURIComponent(m[idx + 1]); });
        current = { path: parsed.path, params: params, query: parsed.query, pattern: routes[i].pattern };
        routes[i].handler(params, parsed.query);
        return;
      }
    }
    current = { path: parsed.path, params: {}, query: parsed.query, pattern: null };
    if (notFoundHandler) notFoundHandler(parsed.path);
  }

  function go(path, opts) {
    opts = opts || {};
    if (('#' + path) === location.hash) { resolve(); return; }
    if (opts.replace) location.replace('#' + path);
    else location.hash = path;
  }

  function start() {
    global.addEventListener('hashchange', function () {
      resolve();
      // 라우트 이동 시 본문 상단으로 (앵커 이동은 예외)
      if (!location.hash.includes('#', 1)) window.scrollTo(0, 0);
    });
    resolve();
  }

  function getCurrent() { return current; }

  global.QALab = global.QALab || {};
  global.QALab.router = {
    on: on,
    notFound: notFound,
    start: start,
    go: go,
    getCurrent: getCurrent
  };
})(window);
