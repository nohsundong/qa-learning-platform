/* ==========================================================================
   ui/settings.js — 설정 · API 키(BYOK) · 데이터 백업/복원
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  function view() { return QALab.$('#view'); }

  function render() {
    var s = QALab.store.getSettings();
    var providers = QALab.ai.providers.list();
    var cur = QALab.ai.providers.get(s.ai.provider);
    var savedKey = QALab.store.getApiKey(cur.id);

    var html = '<div class="page-head"><h1>설정</h1>' +
      '<p class="sub">모든 설정과 학습 기록은 이 브라우저에만 저장됩니다. 서버로 전송되지 않습니다.</p></div>';

    /* ---------------- 화면 ---------------- */
    html += '<div class="card"><div class="card-title">화면</div>';
    html += '<div class="switch-row"><div><div class="label">테마</div>' +
      '<p class="desc">시스템 설정을 따르거나 직접 고정할 수 있습니다.</p></div>' +
      '<select class="select" id="selTheme" style="width:auto;min-width:130px">' +
        opt('auto', '시스템 설정', s.theme) +
        opt('light', '라이트', s.theme) +
        opt('dark', '다크', s.theme) +
      '</select></div>';
    html += '<div class="switch-row"><div><div class="label">하루 복습 개수</div>' +
      '<p class="desc">복습 큐에서 한 세션에 물어볼 항목 수입니다.</p></div>' +
      '<input class="input" id="inpReviewPerDay" type="number" min="1" max="30" step="1" ' +
      'value="' + (s.reviewPerDay || 5) + '" style="width:88px"></div>';
    html += '<div class="switch-row"><div><div class="label">아침 브리핑 메일 시각 (KST)</div>' +
      '<p class="desc">GitHub Actions 워크플로에 실제 반영하려면 ' +
      '<code>.github/workflows/daily-briefing.yml</code> 의 cron 도 함께 고쳐야 합니다.</p></div>' +
      '<input class="input" id="inpBriefHour" type="number" min="0" max="23" step="1" ' +
      'value="' + (s.briefingHour === undefined ? 8 : s.briefingHour) + '" style="width:88px"></div>';
    html += '</div>';

    /* ---------------- AI (BYOK) ---------------- */
    html += '<div class="card"><div class="card-title">AI 기능 (BYOK — 내 키 사용)' +
      '<span class="hint">' + (QALab.ai.providers.isReady() ? '<span class="badge badge-ok">사용 가능</span>'
                                                            : '<span class="badge">미설정</span>') + '</span></div>';

    html += '<div class="callout info"><strong>키는 이 브라우저에만 저장됩니다.</strong> ' +
      '저장소(git)로 커밋되지 않고, 백업 파일(JSON export)에도 포함되지 않습니다. ' +
      'API 키 없이도 <strong>모든 학습 콘텐츠와 실습 랩은 100% 동작</strong>합니다. ' +
      'AI 기능은 선택 사항입니다.</div>';

    html += '<div class="field"><label for="selProvider">제공자</label>' +
      '<select class="select" id="selProvider">' +
      providers.map(function (p) {
        return '<option value="' + h(p.id) + '"' + (p.id === cur.id ? ' selected' : '') + '>' +
               h(p.label) + (p.id === 'anthropic' ? ' (기본)' : '') + '</option>';
      }).join('') + '</select></div>';

    if (cur.note) {
      html += '<p class="desc" style="margin-top:-8px;margin-bottom:14px;font-size:12.5px;color:var(--text-dim)">' +
              h(cur.note) + '</p>';
    }

    if (cur.custom) {
      html += '<div class="field"><label for="inpBaseUrl">Base URL</label>' +
        '<p class="desc">예: <code>https://api.example.com/v1</code> — 끝에 <code>/chat/completions</code> 는 자동으로 붙습니다.</p>' +
        '<input class="input" id="inpBaseUrl" type="url" placeholder="https://api.example.com/v1" ' +
        'value="' + h(s.ai.baseUrl || '') + '"></div>';
    }

    html += '<div class="field"><label for="inpModel">모델</label>' +
      '<p class="desc">비워두면 기본 모델(<code>' + h(cur.defaultModel || '미지정') + '</code>)을 사용합니다.</p>' +
      '<input class="input" id="inpModel" list="modelList" placeholder="' + h(cur.defaultModel || '모델명 입력') + '" ' +
      'value="' + h(s.ai.model || '') + '">' +
      '<datalist id="modelList">' +
        (cur.models || []).map(function (m) { return '<option value="' + h(m) + '">'; }).join('') +
      '</datalist></div>';

    if (!cur.keyless) {
      html += '<div class="field"><label for="inpApiKey">API 키</label>' +
        (cur.keyUrl ? '<p class="desc">발급: <a href="' + h(cur.keyUrl) + '" target="_blank" rel="noopener">' +
                      h(cur.keyUrl) + '</a></p>' : '') +
        '<div class="input-row">' +
          '<input class="input" id="inpApiKey" type="password" autocomplete="off" spellcheck="false" ' +
          'placeholder="' + (savedKey ? '저장된 키가 있습니다 (다시 입력하면 교체)' : '키를 붙여넣으세요') + '">' +
          '<button class="btn btn-sm" id="btnToggleKey" type="button">보기</button>' +
        '</div></div>';
    }

    html += '<div class="btn-row">' +
      '<button class="btn btn-primary" id="btnSaveAi">저장</button>' +
      '<button class="btn" id="btnTestAi">연결 테스트</button>' +
      (savedKey ? '<button class="btn btn-danger" id="btnClearKey">이 제공자 키 삭제</button>' : '') +
      '</div>';
    html += '<div id="aiTestResult" style="margin-top:12px"></div>';
    html += '</div>';

    /* ---------------- 데이터 ---------------- */
    html += '<div class="card"><div class="card-title">학습 데이터 백업 · 복원</div>' +
      '<p style="font-size:13.5px;color:var(--text-dim)">진도·메모·복습 큐·연속 학습일이 JSON 한 파일로 저장됩니다. ' +
      '기기를 옮기거나 브라우저 데이터를 지우기 전에 반드시 내보내세요. ' +
      '<strong>API 키는 백업 파일에 포함되지 않습니다.</strong></p>' +
      '<div class="btn-row">' +
        '<button class="btn btn-primary" id="btnExport">JSON 내보내기</button>' +
        '<button class="btn" id="btnImportMerge">가져오기 (병합)</button>' +
        '<button class="btn" id="btnImportReplace">가져오기 (덮어쓰기)</button>' +
      '</div></div>';

    /* ---------------- 메일 스냅샷 ---------------- */
    html += '<div class="card"><div class="card-title">아침 브리핑 메일용 스냅샷</div>' +
      '<p style="font-size:13.5px;color:var(--text-dim)">' +
      '진도는 이 브라우저(localStorage)에만 있으므로, GitHub Actions 가 메일을 만들 때 참고할 ' +
      '요약본을 저장소에 올려둬야 합니다. 아래 내용을 복사해 ' +
      '<code>data/progress-snapshot.json</code> 에 붙여넣고 커밋하세요. (주 1회면 충분합니다)</p>' +
      '<div class="btn-row" style="margin-bottom:10px">' +
        '<button class="btn btn-primary" id="btnSnapCopy">클립보드에 복사</button>' +
        '<button class="btn" id="btnSnapDownload">파일로 저장</button>' +
      '</div>' +
      '<textarea class="textarea" id="snapPreview" readonly style="min-height:150px"></textarea></div>';

    /* ---------------- 초기화 ---------------- */
    html += '<div class="card"><div class="card-title">초기화</div>' +
      '<p style="font-size:13.5px;color:var(--text-dim)">모든 진도·메모·복습 기록을 지웁니다. 되돌릴 수 없습니다.</p>' +
      '<button class="btn btn-danger" id="btnReset">학습 기록 전체 삭제</button></div>';

    /* ---------------- 환경 정보 ---------------- */
    html += '<div class="card"><div class="card-title">환경</div>' +
      '<table style="width:100%;font-size:13px"><tbody>' +
      row('콘텐츠 로딩 모드', QALab.content.usingBundle
          ? 'file:// (lessons.bundle.js 사용)'
          : location.protocol + '// (content/*.md 직접 로딩)') +
      row('localStorage', QALab.store.available ? '사용 가능' : '차단됨 — 새로고침하면 진도가 사라집니다') +
      row('스키마 버전', 'v' + QALab.store.SCHEMA_VERSION) +
      row('레슨 수', QALab.content.allLessonMetas().length + '개') +
      '</tbody></table></div>';

    view().innerHTML = html;
    bind();
    refreshSnapshot();
  }

  function opt(value, label, current) {
    return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + label + '</option>';
  }

  function row(k, v) {
    return '<tr><td style="padding:4px 0;color:var(--text-dim)">' + h(k) + '</td>' +
           '<td style="padding:4px 0;text-align:right">' + h(v) + '</td></tr>';
  }

  /* ------------------------------------------------------------ 바인딩 */

  function bind() {
    QALab.$('#selTheme').addEventListener('change', function (e) {
      QALab.setTheme(e.target.value);
    });

    QALab.$('#inpReviewPerDay').addEventListener('change', function (e) {
      var v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 5));
      QALab.store.setSetting('reviewPerDay', v);
      e.target.value = v;
      QALab.toast('저장했습니다.');
    });

    QALab.$('#inpBriefHour').addEventListener('change', function (e) {
      var v = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 8));
      QALab.store.setSetting('briefingHour', v);
      e.target.value = v;
      QALab.toast('저장했습니다. 워크플로의 cron 도 함께 수정하세요.');
    });

    QALab.$('#selProvider').addEventListener('change', function (e) {
      QALab.store.setSetting('ai.provider', e.target.value);
      QALab.store.setSetting('ai.model', '');   // 제공자가 바뀌면 모델은 기본값으로
      render();
    });

    var keyInput = QALab.$('#inpApiKey');
    var toggle = QALab.$('#btnToggleKey');
    if (toggle) toggle.addEventListener('click', function () {
      var showing = keyInput.type === 'text';
      keyInput.type = showing ? 'password' : 'text';
      toggle.textContent = showing ? '보기' : '숨기기';
    });

    QALab.$('#btnSaveAi').addEventListener('click', function () {
      var cur = QALab.ai.providers.current();
      var model = QALab.$('#inpModel').value.trim();
      QALab.store.setSetting('ai.model', model);
      var baseUrl = QALab.$('#inpBaseUrl');
      if (baseUrl) QALab.store.setSetting('ai.baseUrl', baseUrl.value.trim());
      if (keyInput && keyInput.value.trim()) {
        QALab.store.setApiKey(cur.id, keyInput.value.trim());
        keyInput.value = '';
      }
      QALab.toast('저장했습니다.');
      render();
    });

    var clearBtn = QALab.$('#btnClearKey');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      var cur = QALab.ai.providers.current();
      QALab.store.setApiKey(cur.id, '');
      QALab.toast('키를 삭제했습니다.');
      render();
    });

    QALab.$('#btnTestAi').addEventListener('click', function () {
      var out = QALab.$('#aiTestResult');
      var btn = QALab.$('#btnTestAi');
      // 저장 안 하고 테스트하는 실수를 막기 위해 입력값을 먼저 반영한다
      if (keyInput && keyInput.value.trim()) {
        QALab.store.setApiKey(QALab.ai.providers.current().id, keyInput.value.trim());
      }
      var model = QALab.$('#inpModel').value.trim();
      QALab.store.setSetting('ai.model', model);
      var baseUrl = QALab.$('#inpBaseUrl');
      if (baseUrl) QALab.store.setSetting('ai.baseUrl', baseUrl.value.trim());

      btn.disabled = true;
      out.innerHTML = '<div class="callout"><div class="spinner" style="width:16px;height:16px;display:inline-block;margin:0 8px 0 0;vertical-align:-3px"></div>' +
                      QALab.ai.providers.current().label + ' (' + h(QALab.ai.providers.currentModel()) + ') 에 요청 중…</div>';
      QALab.ai.providers.testConnection().then(function (text) {
        out.innerHTML = '<div class="callout ok"><strong>연결 성공.</strong> 응답: <code>' +
                        h(text.trim().slice(0, 80)) + '</code></div>';
      }).catch(function (err) {
        out.innerHTML = '<div class="callout danger"><strong>연결 실패.</strong><br>' + h(err.message) + '</div>';
      }).then(function () { btn.disabled = false; });
    });

    QALab.$('#btnExport').addEventListener('click', function () {
      var data = QALab.store.exportAll();
      QALab.downloadJSON('qa-lab-backup-' + QALab.store.todayKey() + '.json', data);
      QALab.toast('백업 파일을 저장했습니다.');
    });

    QALab.$('#btnImportMerge').addEventListener('click', function () { doImport(true); });
    QALab.$('#btnImportReplace').addEventListener('click', function () { doImport(false); });

    QALab.$('#btnSnapCopy').addEventListener('click', function () {
      var text = QALab.$('#snapPreview').value;
      var done = function () { QALab.toast('복사했습니다. data/progress-snapshot.json 에 붙여넣으세요.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          QALab.$('#snapPreview').select();
          document.execCommand('copy');
          done();
        });
      } else {
        QALab.$('#snapPreview').select();
        document.execCommand('copy');
        done();
      }
    });

    QALab.$('#btnSnapDownload').addEventListener('click', function () {
      QALab.downloadJSON('progress-snapshot.json', buildSnapshot());
      QALab.toast('progress-snapshot.json 을 저장했습니다.');
    });

    QALab.$('#btnReset').addEventListener('click', function () {
      if (!confirm('모든 학습 기록(진도·메모·복습 큐)을 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?')) return;
      if (!confirm('정말 삭제할까요? 먼저 백업을 내보내는 것을 권장합니다.')) return;
      QALab.store.resetAll();
      QALab.toast('학습 기록을 초기화했습니다.');
      render();
    });
  }

  function doImport(merge) {
    QALab.pickJSONFile().then(function (payload) {
      QALab.store.importAll(payload, { merge: merge, includeSettings: false });
      QALab.toast(merge ? '병합해서 가져왔습니다.' : '덮어써서 가져왔습니다.');
      render();
    }).catch(function (err) {
      QALab.toast(err.message, 'err');
    });
  }

  /* -------------------------------------------------- 메일용 스냅샷 */

  function buildSnapshot() {
    var metas = QALab.content.allLessonMetas();
    var states = QALab.store.allLessonStates();
    var streak = QALab.store.getStreak();

    var completed = [];
    metas.forEach(function (m) {
      if (states[m.id] && states[m.id].status === 'done') completed.push(m.id);
    });

    var next = QALab.stats.nextLesson();

    var weak = QALab.store.allReviews()
      .sort(function (a, b) { return a.dueAt < b.dueAt ? -1 : 1; })
      .slice(0, 8)
      .map(function (it) {
        var m = QALab.content.getLessonMeta(it.lessonId);
        return {
          text: it.text,
          lessonId: it.lessonId,
          lessonTitle: m ? m.title : '',
          dueAt: it.dueAt,
          lapses: it.lapses
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      totalLessons: metas.length,
      completedCount: completed.length,
      percent: QALab.pct(completed.length, metas.length),
      streak: { current: streak.current, longest: streak.longest, lastStudyDate: streak.lastStudyDate },
      nextLesson: next ? { id: next.id, title: next.title, track: next.trackTitle, minutes: next.minutes || 15 } : null,
      completedLessonIds: completed,
      weakItems: weak
    };
  }

  function refreshSnapshot() {
    var ta = QALab.$('#snapPreview');
    if (ta) ta.value = JSON.stringify(buildSnapshot(), null, 2);
  }

  QALab.views = QALab.views || {};
  QALab.views.settings = render;
  QALab.buildSnapshot = buildSnapshot;
})(window);
