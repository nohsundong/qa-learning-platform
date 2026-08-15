/* ==========================================================================
   content.js — 학습 콘텐츠 로더
   --------------------------------------------------------------------------
   두 가지 모드를 지원한다.

   1) http(s) 모드 (GitHub Pages, 로컬 http 서버)
      content/manifest.json 과 content/<track>/<file>.md 를 fetch 로 읽는다.
      .md 를 고치면 새로고침만으로 즉시 반영된다.

   2) file:// 모드 (index.html 더블클릭)
      브라우저가 fetch 를 CORS 로 막기 때문에, script 태그로
      content/lessons.bundle.js 를 주입해 window.QALAB_BUNDLE 을 읽는다.
      번들은 tools/build-content.mjs 가 .md 에서 생성한다.
      (GitHub Actions 가 push 마다 자동 재생성 → 평소엔 신경 쓸 필요 없음)
   ========================================================================== */
(function (global) {
  'use strict';

  var USE_BUNDLE = location.protocol === 'file:';

  var state = {
    manifest: null,
    lessonCache: {},   // id -> { meta, body }
    lessonIndex: {},   // id -> meta
    orderedIds: []
  };

  /* ------------------------------------------------------------ 유틸 */

  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(src + ' 를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      return res.json();
    });
  }

  function getText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      return res.text();
    });
  }

  /* ------------------------------------------- frontmatter 파서 (YAML 축약) */

  // 지원 형식: key: value / key: [a, b] / key: "값" — 중첩은 지원하지 않는다.
  // build-content.mjs 의 파서와 동작이 같아야 한다.
  function parseFrontmatter(raw) {
    var meta = {};
    var body = raw;
    var m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    if (m) {
      body = raw.slice(m[0].length);
      m[1].split(/\r?\n/).forEach(function (line) {
        if (!line.trim() || /^\s*#/.test(line)) return;
        var i = line.indexOf(':');
        if (i < 0) return;
        var key = line.slice(0, i).trim();
        var val = line.slice(i + 1).trim();
        if (/^\[.*\]$/.test(val)) {
          val = val.slice(1, -1).split(',')
            .map(function (v) { return v.trim().replace(/^["']|["']$/g, ''); })
            .filter(Boolean);
        } else {
          val = val.replace(/^["']|["']$/g, '');
          if (/^\d+$/.test(val)) val = parseInt(val, 10);
          else if (val === 'true') val = true;
          else if (val === 'false') val = false;
        }
        meta[key] = val;
      });
    }
    return { meta: meta, body: body };
  }

  /* ------------------------------------------------------------ 로드 */

  function init() {
    if (state.manifest) return Promise.resolve(state.manifest);

    var load = USE_BUNDLE
      ? injectScript('content/lessons.bundle.js').then(function () {
          if (!global.QALAB_BUNDLE) {
            throw new Error('lessons.bundle.js 가 비어 있습니다. `node tools/build-content.mjs` 를 실행하세요.');
          }
          return global.QALAB_BUNDLE.manifest;
        })
      : getJSON('content/manifest.json');

    return load.then(function (manifest) {
      state.manifest = manifest;
      state.orderedIds = [];
      state.lessonIndex = {};
      (manifest.tracks || []).forEach(function (track) {
        (track.lessons || []).forEach(function (meta) {
          meta.trackId = track.id;
          meta.trackTitle = track.title;
          meta.trackColor = track.color;
          state.lessonIndex[meta.id] = meta;
          state.orderedIds.push(meta.id);
        });
      });
      return manifest;
    });
  }

  function getManifest() { return state.manifest; }

  function getTracks() { return (state.manifest && state.manifest.tracks) || []; }

  function getTrack(trackId) {
    return getTracks().filter(function (t) { return t.id === trackId; })[0] || null;
  }

  function getLessonMeta(id) { return state.lessonIndex[id] || null; }

  function allLessonMetas() {
    return state.orderedIds.map(function (id) { return state.lessonIndex[id]; });
  }

  function neighbors(id) {
    var i = state.orderedIds.indexOf(id);
    return {
      prev: i > 0 ? state.lessonIndex[state.orderedIds[i - 1]] : null,
      next: (i >= 0 && i < state.orderedIds.length - 1) ? state.lessonIndex[state.orderedIds[i + 1]] : null
    };
  }

  function loadLesson(id) {
    if (state.lessonCache[id]) return Promise.resolve(state.lessonCache[id]);

    var meta = state.lessonIndex[id];
    if (!meta) return Promise.reject(new Error('레슨을 찾을 수 없습니다: ' + id));

    var p;
    if (USE_BUNDLE) {
      var raw = global.QALAB_BUNDLE.lessons[id];
      p = raw === undefined
        ? Promise.reject(new Error('번들에 레슨이 없습니다: ' + id))
        : Promise.resolve(raw);
    } else {
      p = getText('content/' + meta.path);
    }

    return p.then(function (raw) {
      var parsed = parseFrontmatter(raw);
      var lesson = { meta: meta, body: parsed.body, frontmatter: parsed.meta };
      state.lessonCache[id] = lesson;
      return lesson;
    });
  }

  /* ------------------------------------------------------- 데이터 파일 */

  // data/*.json — file:// 에서도 읽히도록 번들에 함께 담는다.
  function loadData(name) {
    if (USE_BUNDLE) {
      var d = (global.QALAB_BUNDLE.data || {})[name];
      return d ? Promise.resolve(d) : Promise.reject(new Error('번들에 data/' + name + ' 이 없습니다.'));
    }
    return getJSON('data/' + name + '.json');
  }

  /* ---------------------------------------------------------- 검색 */

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    return allLessonMetas().filter(function (m) {
      var hay = (m.title + ' ' + (m.summary || '') + ' ' + (m.tags || []).join(' ') + ' ' + m.trackTitle).toLowerCase();
      return hay.indexOf(q) >= 0;
    }).slice(0, 30);
  }

  /* ---------------------------------------------------------------- */

  global.QALab = global.QALab || {};
  global.QALab.content = {
    usingBundle: USE_BUNDLE,
    init: init,
    getManifest: getManifest,
    getTracks: getTracks,
    getTrack: getTrack,
    getLessonMeta: getLessonMeta,
    allLessonMetas: allLessonMetas,
    neighbors: neighbors,
    loadLesson: loadLesson,
    loadData: loadData,
    search: search,
    parseFrontmatter: parseFrontmatter
  };
})(window);
