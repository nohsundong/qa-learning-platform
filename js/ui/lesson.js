/* ==========================================================================
   ui/lesson.js — 레슨 상세 화면
   --------------------------------------------------------------------------
   마크다운 본문 렌더 + 자가 체크리스트를 인터랙티브 위젯으로 변환한다.
   체크리스트에서 "약점" 으로 표시한 항목은 복습 큐(간격 반복)로 넘어간다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  function view() { return QALab.$('#view'); }

  function render(params) {
    var id = params.id;
    var meta = QALab.content.getLessonMeta(id);
    if (!meta) { QALab.views.notFound('레슨을 찾을 수 없습니다: ' + id); return; }

    view().innerHTML = '<div class="loading-block"><div class="spinner"></div><p>레슨을 불러오는 중…</p></div>';

    QALab.content.loadLesson(id).then(function (lesson) {
      paint(lesson);
    }).catch(function (err) {
      view().innerHTML = '<div class="callout danger"><strong>레슨을 불러오지 못했습니다.</strong><br>' +
        h(err.message) + '</div><a class="btn" href="#/tracks">트랙 목록으로</a>';
    });
  }

  function paint(lesson) {
    var meta = lesson.meta;
    var state = QALab.store.getLesson(meta.id);
    var nb = QALab.content.neighbors(meta.id);

    // 처음 열람하면 '진행중' 으로 표시 (완료된 레슨은 건드리지 않는다)
    if (state.status === 'todo') {
      QALab.store.updateLesson(meta.id, { status: 'doing' });
      state = QALab.store.getLesson(meta.id);
    }

    var html = '';

    html += '<article class="lesson">';
    html += '<div class="lesson-head">' +
      '<div class="lesson-crumbs">' +
        '<a href="#/tracks">트랙</a> <span>›</span> ' +
        '<a href="#/track/' + h(meta.trackId) + '">' + h(meta.trackTitle) + '</a>' +
      '</div>' +
      '<h1>' + h(meta.title) + '</h1>' +
      '<div class="lesson-meta">' +
        '<span class="badge" style="background:color-mix(in srgb,' + QALab.trackVar(meta.trackId) +
          ' 14%, transparent);color:' + QALab.trackVar(meta.trackId) + '">' + h(meta.trackTitle) + '</span>' +
        '<span class="badge">' + (meta.minutes || 15) + '분</span>' +
        (state.status === 'done' ? '<span class="badge badge-ok">완료</span>' : '') +
        (state.bookmarked ? '<span class="badge badge-accent">🔖 북마크</span>' : '') +
        (meta.tags || []).map(function (t) { return '<span class="badge">#' + h(t) + '</span>'; }).join('') +
      '</div></div>';

    html += '<div class="with-toc"><div class="prose" id="lessonBody"></div>' +
            '<aside class="toc" id="lessonToc" aria-label="이 레슨의 목차"></aside></div>';

    /* 개인 메모 */
    html += '<div class="note-box card">' +
      '<div class="card-title">내 메모<span class="hint">브라우저에 자동 저장됩니다</span></div>' +
      '<textarea id="lessonNote" placeholder="이 레슨에서 얻은 것, 헷갈렸던 것, 우리 팀에 적용할 점을 적어두세요."></textarea>' +
      '</div>';

    /* 하단 액션 */
    html += '<div class="lesson-actions">' +
      '<button class="btn ' + (state.status === 'done' ? 'btn-ok' : 'btn-primary') + '" id="btnComplete">' +
        (state.status === 'done' ? '✓ 완료함 (해제하려면 클릭)' : '이 레슨 완료로 표시') + '</button>' +
      '<button class="btn" id="btnBookmark">' + (state.bookmarked ? '🔖 북마크 해제' : '🔖 북마크') + '</button>' +
      '<button class="btn btn-ghost" id="btnAiPanel">🤖 AI 실습 도우미</button>' +
      '</div>';

    html += '<div id="aiPanelHost"></div>';

    /* 이전 / 다음 */
    html += '<div class="lesson-nav">';
    html += nb.prev
      ? '<a href="#/lesson/' + h(nb.prev.id) + '"><span class="dir">← 이전</span><span class="ttl">' + h(nb.prev.title) + '</span></a>'
      : '<span></span>';
    html += nb.next
      ? '<a class="next" href="#/lesson/' + h(nb.next.id) + '"><span class="dir">다음 →</span><span class="ttl">' + h(nb.next.title) + '</span></a>'
      : '<span></span>';
    html += '</div>';

    html += '</article>';

    view().innerHTML = html;

    /* 본문 렌더 */
    var body = QALab.$('#lessonBody');
    body.innerHTML = QALab.md.render(lesson.body);
    QALab.md.enhanceCodeBlocks(body);
    wireChecklist(body, meta.id);
    renderToc(body);

    /* 메모 */
    var note = QALab.$('#lessonNote');
    note.value = state.note || '';
    note.addEventListener('input', QALab.debounce(function () {
      QALab.store.updateLesson(meta.id, { note: note.value });
    }, 500));

    /* 완료 토글 */
    QALab.$('#btnComplete').addEventListener('click', function () {
      var cur = QALab.store.getLesson(meta.id).status;
      if (cur === 'done') {
        QALab.store.setStatus(meta.id, 'doing');
        QALab.toast('완료 표시를 해제했습니다.');
      } else {
        QALab.store.setStatus(meta.id, 'done');
        QALab.toast('완료! 오늘도 한 걸음 나아갔습니다 🎉');
      }
      render({ id: meta.id });
    });

    /* 북마크 */
    QALab.$('#btnBookmark').addEventListener('click', function () {
      var s = QALab.store.toggleBookmark(meta.id);
      QALab.toast(s.bookmarked ? '북마크에 추가했습니다.' : '북마크를 해제했습니다.');
      render({ id: meta.id });
    });

    /* AI 패널 */
    QALab.$('#btnAiPanel').addEventListener('click', function () {
      QALab.aiPanel.toggle(QALab.$('#aiPanelHost'), { lesson: lesson });
    });
  }

  /* ------------------------------------------------- 체크리스트 변환 */

  function wireChecklist(root, lessonId) {
    var boxes = QALab.$$('li > input[type="checkbox"]', root);
    if (!boxes.length) return;

    var state = QALab.store.getLesson(lessonId);

    boxes.forEach(function (input, idx) {
      var li = input.parentElement;
      var text = li.textContent.trim();

      var wrap = document.createElement('div');
      wrap.className = 'check-item';
      wrap.setAttribute('data-checked', String(!!state.checklist[idx]));
      wrap.setAttribute('data-weak', String(QALab.store.hasWeak(lessonId, idx)));

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state.checklist[idx];
      cb.id = 'chk-' + lessonId + '-' + idx;
      cb.setAttribute('aria-label', text);

      var label = document.createElement('label');
      label.className = 'txt';
      label.setAttribute('for', cb.id);
      // 원본 li 의 인라인 마크업(코드, 링크)을 살린다
      var clone = li.cloneNode(true);
      var oldInput = clone.querySelector('input[type="checkbox"]');
      if (oldInput) oldInput.remove();
      label.innerHTML = clone.innerHTML;

      var weak = document.createElement('button');
      weak.type = 'button';
      weak.className = 'weak-btn';
      weak.textContent = QALab.store.hasWeak(lessonId, idx) ? '복습 큐에 있음' : '약점으로';
      weak.title = '이 항목을 복습 큐에 넣어 간격 반복으로 다시 물어봅니다';

      cb.addEventListener('change', function () {
        QALab.store.toggleChecklist(lessonId, idx, cb.checked);
        wrap.setAttribute('data-checked', String(cb.checked));
      });

      weak.addEventListener('click', function () {
        if (QALab.store.hasWeak(lessonId, idx)) {
          QALab.store.removeWeak(lessonId, idx);
          wrap.setAttribute('data-weak', 'false');
          weak.textContent = '약점으로';
          QALab.toast('복습 큐에서 제외했습니다.');
        } else {
          QALab.store.addWeak(lessonId, idx, text);
          wrap.setAttribute('data-weak', 'true');
          weak.textContent = '복습 큐에 있음';
          QALab.toast('복습 큐에 추가했습니다. 내일 다시 물어봅니다.');
        }
      });

      wrap.appendChild(cb);
      wrap.appendChild(label);
      wrap.appendChild(weak);

      var ul = li.parentElement;
      ul.parentNode.insertBefore(wrap, ul);
      li.remove();
      if (!ul.children.length) ul.remove();
    });
  }

  /* -------------------------------------------------------- 목차 */

  function renderToc(body) {
    var host = QALab.$('#lessonToc');
    if (!host) return;
    var items = QALab.md.buildToc(body);
    if (items.length < 3) { host.style.display = 'none'; return; }

    host.innerHTML = '<div class="toc-title">목차</div>' + items.map(function (it) {
      return '<a href="#" class="' + (it.level === 3 ? 'h3' : '') + '" data-target="' + h(it.id) + '">' +
             h(it.text) + '</a>';
    }).join('');

    QALab.$$('a', host).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(a.getAttribute('data-target'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  QALab.views = QALab.views || {};
  QALab.views.lesson = render;
})(window);
