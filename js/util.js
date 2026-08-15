/* ==========================================================================
   util.js — 전역 유틸리티 (다른 모든 모듈보다 먼저 로드된다)
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab = global.QALab || {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /** HTML 이스케이프. 템플릿 문자열에 값 넣을 때 반드시 통과시킨다. */
  function h(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 속성값(따옴표 안)용 이스케이프 */
  function attr(s) { return h(s); }

  function toast(message, kind) {
    var host = $('#toastHost');
    if (!host) { console.log('[toast]', message); return; }
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, kind === 'err' ? 4200 : 2400);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function pct(done, total) {
    if (!total) return 0;
    return Math.round((done / total) * 100);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.getFullYear() + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' +
           String(d.getDate()).padStart(2, '0');
  }

  function relativeDay(dateKey) {
    if (!dateKey) return '';
    var today = QALab.store ? QALab.store.todayKey() : null;
    if (!today) return dateKey;
    var diff = QALab.store.daysBetween(dateKey, today);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff > 1) return diff + '일 지남';
    if (diff === -1) return '내일';
    return (-diff) + '일 뒤';
  }

  /** 브라우저에서 파일 저장 (서버 없이 export 구현) */
  function downloadJSON(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** <input type="file"> 없이 파일 하나 읽기 */
  function pickJSONFile() {
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) { reject(new Error('파일이 선택되지 않았습니다.')); return; }
        var reader = new FileReader();
        reader.onload = function () {
          try { resolve(JSON.parse(reader.result)); }
          catch (e) { reject(new Error('JSON 파싱에 실패했습니다: ' + e.message)); }
        };
        reader.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
        reader.readAsText(file);
      });
      input.click();
    });
  }

  /** 트랙 색 CSS 변수명 */
  function trackVar(trackId) {
    var n = /(\d+)/.exec(trackId || '');
    return 'var(--track-' + (n ? n[1] : '1') + ')';
  }

  QALab.$ = $;
  QALab.$$ = $$;
  QALab.h = h;
  QALab.attr = attr;
  QALab.toast = toast;
  QALab.debounce = debounce;
  QALab.pct = pct;
  QALab.formatDate = formatDate;
  QALab.relativeDay = relativeDay;
  QALab.downloadJSON = downloadJSON;
  QALab.pickJSONFile = pickJSONFile;
  QALab.trackVar = trackVar;
})(window);
