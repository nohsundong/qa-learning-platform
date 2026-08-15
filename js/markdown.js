/* ==========================================================================
   markdown.js — 마크다운 → 안전한 HTML
   --------------------------------------------------------------------------
   marked(파싱) + DOMPurify(살균) + highlight.js(하이라이팅) 를 CDN 에서 쓴다.
   CDN 이 막혔거나 오프라인이면 원문을 <pre> 로 보여주는 폴백으로 떨어진다.
   (학습 콘텐츠가 "무슨 일이 있어도" 읽히게 하는 게 우선)
   ========================================================================== */
(function (global) {
  'use strict';

  var ready = false;

  function setup() {
    if (ready || !global.marked) return;

    var renderer = new global.marked.Renderer();

    // 헤딩에 id 를 붙여 목차 앵커로 쓴다
    var slugCount = {};
    renderer.heading = function (text, level) {
      var plain = String(text).replace(/<[^>]+>/g, '');
      var base = plain.trim().toLowerCase()
        .replace(/[^\w가-힣\s-]/g, '')
        .replace(/\s+/g, '-') || 'h';
      slugCount[base] = (slugCount[base] || 0) + 1;
      var id = slugCount[base] > 1 ? base + '-' + slugCount[base] : base;
      return '<h' + level + ' id="' + id + '">' + text + '</h' + level + '>';
    };

    // 외부 링크는 새 탭으로
    renderer.link = function (href, title, text) {
      var external = /^https?:\/\//.test(href || '');
      return '<a href="' + (href || '#') + '"' +
        (title ? ' title="' + title + '"' : '') +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' + text + '</a>';
    };

    // 넓은 표는 가로 스크롤 컨테이너로 감싼다 (모바일에서 페이지가 밀리지 않게)
    renderer.table = function (header, body) {
      return '<div class="table-scroll"><table><thead>' + header +
             '</thead><tbody>' + body + '</tbody></table></div>';
    };

    global.marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: false,
      headerIds: false,
      mangle: false,
      highlight: function (code, lang) {
        if (!global.hljs) return code;
        try {
          if (lang && global.hljs.getLanguage(lang)) {
            return global.hljs.highlight(code, { language: lang }).value;
          }
          return global.hljs.highlightAuto(code).value;
        } catch (e) {
          return code;
        }
      }
    });

    ready = true;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(md) {
    setup();
    if (!ready) {
      return '<div class="callout warn"><strong>마크다운 렌더러를 불러오지 못했습니다.</strong> ' +
             'CDN 접근이 막혀 있을 수 있습니다. 아래는 원문입니다.</div>' +
             '<pre>' + escapeHtml(md) + '</pre>';
    }
    var html = global.marked.parse(md);
    if (global.DOMPurify) {
      html = global.DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel', 'id', 'data-idx', 'type', 'checked', 'disabled']
      });
    }
    return html;
  }

  /* ----------------------------------------------------- 렌더 후 보강 */

  // 코드 블록에 복사 버튼 달기
  function enhanceCodeBlocks(root) {
    root.querySelectorAll('pre > code').forEach(function (code) {
      var pre = code.parentElement;
      if (pre.parentElement && pre.parentElement.classList.contains('code-wrap')) return;

      var wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = '복사';
      btn.addEventListener('click', function () {
        var text = code.textContent;
        var done = function () {
          btn.textContent = '복사됨';
          setTimeout(function () { btn.textContent = '복사'; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        } else {
          fallbackCopy(text); done();
        }
      });
      wrap.appendChild(btn);
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  // h2 / h3 로 목차 데이터를 만든다
  function buildToc(root) {
    var items = [];
    root.querySelectorAll('h2, h3').forEach(function (h) {
      if (!h.id) return;
      items.push({ id: h.id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3 });
    });
    return items;
  }

  // 테마 전환 시 highlight.js 스타일시트 교체
  function applyHighlightTheme(isDark) {
    var light = document.getElementById('hljs-light');
    var dark = document.getElementById('hljs-dark');
    if (light) light.disabled = !!isDark;
    if (dark) dark.disabled = !isDark;
  }

  global.QALab = global.QALab || {};
  global.QALab.md = {
    render: render,
    escapeHtml: escapeHtml,
    enhanceCodeBlocks: enhanceCodeBlocks,
    buildToc: buildToc,
    applyHighlightTheme: applyHighlightTheme
  };
})(window);
