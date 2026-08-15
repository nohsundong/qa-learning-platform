/* ==========================================================================
   ai/ai-panel.js — 레슨에 붙는 AI 실습 도우미 패널
   --------------------------------------------------------------------------
   키가 없으면 "프롬프트만 복사해서 다른 곳에 붙여넣기" 모드로 동작한다.
   즉 API 키 없이도 이 화면은 쓸모가 있다 (프롬프트 패턴 자체가 학습 자료).
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;
  var h = QALab.h;

  var open = false;
  var currentAbort = null;

  function toggle(host, ctx) {
    open = !open;
    if (!open) { host.innerHTML = ''; return; }
    render(host, ctx);
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render(host, ctx) {
    var lesson = ctx && ctx.lesson;
    var templates = QALab.ai.prompts.list();
    var ready = QALab.ai.providers.isReady();
    var provider = QALab.ai.providers.current();

    var html = '<div class="card" id="aiPanel" style="margin-top:16px">';
    html += '<div class="card-title">🤖 AI 실습 도우미' +
      '<span class="hint">' + (ready
        ? h(provider.label) + ' · ' + h(QALab.ai.providers.currentModel())
        : '<a href="#/settings">키 미설정 — 프롬프트 복사 모드</a>') + '</span></div>';

    if (!ready) {
      html += '<div class="callout warn">API 키가 없어도 됩니다. 아래에서 프롬프트를 만들어 ' +
        '복사한 뒤 평소 쓰는 AI 도구(Claude, ChatGPT, Gemini 등)에 붙여넣으세요. ' +
        '<a href="#/settings">설정에서 키를 넣으면</a> 이 화면에서 바로 실행됩니다.</div>';
    }

    html += '<div class="field"><label for="aiTemplate">작업</label>' +
      '<select class="select" id="aiTemplate">' +
      templates.map(function (t) {
        return '<option value="' + h(t.id) + '">' + h(t.label) + '</option>';
      }).join('') + '</select>' +
      '<p class="desc" id="aiHint" style="margin:6px 0 0"></p></div>';

    html += '<div class="field" id="aiInputField">' +
      '<label for="aiInput">입력</label>' +
      '<textarea class="textarea" id="aiInput"></textarea></div>';

    html += '<div class="btn-row">' +
      '<button class="btn btn-primary" id="aiRun"' + (ready ? '' : ' disabled title="설정에서 API 키를 입력하세요"') + '>실행</button>' +
      '<button class="btn" id="aiCopyPrompt">프롬프트 복사</button>' +
      '<button class="btn btn-ghost" id="aiStop" hidden>중단</button>' +
      '</div>';

    html += '<div id="aiOutput" style="margin-top:14px"></div>';
    html += '</div>';

    host.innerHTML = html;

    var sel = QALab.$('#aiTemplate');
    var input = QALab.$('#aiInput');
    var hint = QALab.$('#aiHint');

    function syncTemplate() {
      var t = QALab.ai.prompts.TEMPLATES[sel.value];
      hint.textContent = t.hint || '';
      input.placeholder = t.placeholder || '';
      QALab.$('#aiInputField').hidden = (t.id === 'quiz');
    }
    sel.addEventListener('change', syncTemplate);
    syncTemplate();

    function buildPrompt() {
      var t = QALab.ai.prompts.TEMPLATES[sel.value];
      return { system: t.system, user: t.build(input.value.trim(), lesson), template: t };
    }

    QALab.$('#aiCopyPrompt').addEventListener('click', function () {
      var p = buildPrompt();
      var text = '[시스템 지시]\n' + p.system + '\n\n---\n\n' + p.user;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          QALab.toast('프롬프트를 복사했습니다.');
        }, function () { QALab.toast('복사에 실패했습니다.', 'err'); });
      }
      QALab.$('#aiOutput').innerHTML =
        '<div class="card-title" style="font-size:13px">복사된 프롬프트</div>' +
        '<pre style="white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--border);' +
        'border-radius:var(--radius-sm);padding:12px;font-size:12.5px;max-height:340px;overflow:auto">' +
        h(text) + '</pre>';
    });

    QALab.$('#aiRun').addEventListener('click', function () {
      var t = QALab.ai.prompts.TEMPLATES[sel.value];
      if (t.id !== 'quiz' && !input.value.trim()) {
        QALab.toast('입력 내용을 채워주세요.', 'err');
        return;
      }
      run(buildPrompt());
    });

    QALab.$('#aiStop').addEventListener('click', function () {
      if (currentAbort) currentAbort.abort();
    });
  }

  function run(p) {
    var out = QALab.$('#aiOutput');
    var runBtn = QALab.$('#aiRun');
    var stopBtn = QALab.$('#aiStop');

    currentAbort = new AbortController();
    runBtn.disabled = true;
    stopBtn.hidden = false;
    out.innerHTML = '<div class="loading-block" style="padding:24px"><div class="spinner"></div>' +
                    '<p>생성 중… (모델과 길이에 따라 10~40초 걸립니다)</p></div>';

    QALab.ai.providers.chat(p.system, p.user, { signal: currentAbort.signal, maxTokens: 3000 })
      .then(function (text) {
        out.innerHTML =
          '<div class="callout info" style="margin-bottom:10px">' +
          '<strong>그대로 믿지 마세요.</strong> 이 결과를 트랙 6의 ' +
          '<em>AI 산출물 검증 체크리스트</em>로 한 번 걸러내는 것까지가 훈련입니다.</div>' +
          '<div class="prose" id="aiResultBody"></div>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn btn-sm" id="aiCopyResult">결과 복사</button>' +
            '<button class="btn btn-sm" id="aiCrossCheck">이 결과를 교차검증하기</button>' +
          '</div>';
        var body = QALab.$('#aiResultBody');
        body.innerHTML = QALab.md.render(text);
        QALab.md.enhanceCodeBlocks(body);

        QALab.$('#aiCopyResult').addEventListener('click', function () {
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          QALab.toast('결과를 복사했습니다.');
        });
        QALab.$('#aiCrossCheck').addEventListener('click', function () {
          QALab.$('#aiTemplate').value = 'reviewAiOutput';
          QALab.$('#aiTemplate').dispatchEvent(new Event('change'));
          QALab.$('#aiInput').value = text;
          QALab.$('#aiInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
          QALab.toast('교차검증 템플릿에 결과를 넣었습니다. 실행을 눌러보세요.');
        });
      })
      .catch(function (err) {
        if (err.name === 'AbortError') {
          out.innerHTML = '<div class="callout warn">요청을 중단했습니다.</div>';
          return;
        }
        out.innerHTML = '<div class="callout danger"><strong>실행 실패.</strong><br>' + h(err.message) +
          '<br><br>설정에서 <a href="#/settings">연결 테스트</a>를 먼저 해보세요.</div>';
      })
      .then(function () {
        runBtn.disabled = false;
        stopBtn.hidden = true;
        currentAbort = null;
      });
  }

  QALab.aiPanel = { toggle: toggle };
})(window);
