/* ==========================================================================
   ai/providers.js — BYOK(Bring Your Own Key) AI 어댑터
   --------------------------------------------------------------------------
   키는 오직 브라우저 localStorage 에만 저장되고, 요청은 브라우저에서 각
   제공자 API 로 직접 나간다. 중계 서버가 없으므로 운영비가 0원이고,
   키가 저장소(git)에 커밋될 경로 자체가 존재하지 않는다.

   API 형태는 크게 세 가지뿐이다.
     - anthropic : /v1/messages
     - gemini    : /v1beta/models/{model}:generateContent
     - openai    : /v1/chat/completions  ← 나머지 대부분이 이 규격을 따른다
   그래서 Perplexity, xAI(Grok), DeepSeek, OpenRouter, Ollama, 그리고
   "커스텀" 항목까지 openai 어댑터 하나로 처리한다.
   ========================================================================== */
(function (global) {
  'use strict';

  var QALab = global.QALab;

  /* ------------------------------------------------------- 제공자 정의 */

  var PROVIDERS = [
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      kind: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-sonnet-5',
      models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
      keyUrl: 'https://console.anthropic.com/settings/keys',
      note: '브라우저 직접 호출을 위해 anthropic-dangerous-direct-browser-access 헤더를 함께 보냅니다.'
    },
    {
      id: 'gemini',
      label: 'Google Gemini',
      kind: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      defaultModel: 'gemini-2.5-flash',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      keyUrl: 'https://aistudio.google.com/apikey',
      note: '무료 티어(분당·일일 호출 제한 내 무과금)가 있어 비용 0원 제약에 가장 잘 맞습니다.'
    },
    {
      id: 'openai',
      label: 'OpenAI (ChatGPT)',
      kind: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4.1-mini',
      models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
      keyUrl: 'https://platform.openai.com/api-keys'
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      kind: 'openai',
      endpoint: 'https://api.perplexity.ai/chat/completions',
      defaultModel: 'sonar',
      models: ['sonar', 'sonar-pro'],
      keyUrl: 'https://www.perplexity.ai/settings/api',
      note: '검색 근거가 붙는 답변이라 "이 API가 실제로 존재하는가" 같은 사실 확인에 유리합니다.'
    },
    {
      id: 'xai',
      label: 'xAI Grok',
      kind: 'openai',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      defaultModel: 'grok-4',
      models: ['grok-4', 'grok-3-mini'],
      keyUrl: 'https://console.x.ai/'
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      kind: 'openai',
      endpoint: 'https://api.deepseek.com/chat/completions',
      defaultModel: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      keyUrl: 'https://platform.deepseek.com/api_keys'
    },
    {
      id: 'openrouter',
      label: 'OpenRouter (여러 모델 한 키로)',
      kind: 'openai',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'google/gemini-2.5-flash',
      models: ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-5', 'openai/gpt-4.1-mini'],
      keyUrl: 'https://openrouter.ai/keys',
      note: '무료(:free) 모델도 일부 제공합니다.'
    },
    {
      id: 'ollama',
      label: 'Ollama (내 PC 로컬 모델)',
      kind: 'openai',
      endpoint: 'http://localhost:11434/v1/chat/completions',
      defaultModel: 'llama3.1',
      models: ['llama3.1', 'qwen2.5', 'gemma3'],
      keyless: true,
      note: '완전 무료·오프라인. 로컬에서 `ollama serve` 가 떠 있어야 하고, ' +
            'GitHub Pages(https) 에서는 혼합 콘텐츠 차단 때문에 index.html 을 로컬에서 열 때만 동작합니다.'
    },
    {
      id: 'custom',
      label: '커스텀 (OpenAI 호환 엔드포인트)',
      kind: 'openai',
      endpoint: '',
      defaultModel: '',
      models: [],
      custom: true,
      note: 'Base URL 과 모델명을 직접 입력합니다. OpenAI 호환 규격을 제공하는 서비스라면 ' +
            '무엇이든 붙습니다. (Genspark·Manus 처럼 아직 공개 채팅 API 가 없는 서비스는 ' +
            'API 가 열리는 시점에 여기에 주소만 넣으면 됩니다.)'
    }
  ];

  function list() { return PROVIDERS; }

  function get(id) {
    return PROVIDERS.filter(function (p) { return p.id === id; })[0] || PROVIDERS[0];
  }

  function currentProvider() {
    var s = QALab.store.getSettings();
    return get(s.ai.provider || 'anthropic');
  }

  function currentModel() {
    var s = QALab.store.getSettings();
    var p = currentProvider();
    return s.ai.model || p.defaultModel;
  }

  function isReady() {
    var p = currentProvider();
    if (p.custom && !(QALab.store.getSettings().ai.baseUrl || '').trim()) return false;
    if (p.keyless) return true;
    return !!QALab.store.getApiKey(p.id);
  }

  /* ------------------------------------------------------------ 호출 */

  /**
   * chat(system, user, opts) → Promise<string>
   * opts: { maxTokens, temperature, signal, model }
   */
  function chat(system, user, opts) {
    opts = opts || {};
    var s = QALab.store.getSettings();
    var p = currentProvider();
    var model = opts.model || currentModel();
    var key = QALab.store.getApiKey(p.id);

    if (!p.keyless && !key) {
      return Promise.reject(new Error('API 키가 없습니다. 설정에서 ' + p.label + ' 키를 입력하세요.'));
    }

    var endpoint = p.endpoint;
    if (p.custom) {
      var base = (s.ai.baseUrl || '').replace(/\/+$/, '');
      if (!base) return Promise.reject(new Error('커스텀 제공자의 Base URL 을 설정에서 입력하세요.'));
      endpoint = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
    }
    if (!model) return Promise.reject(new Error('모델명을 설정에서 입력하세요.'));

    if (p.kind === 'anthropic') return callAnthropic(endpoint, key, model, system, user, opts);
    if (p.kind === 'gemini') return callGemini(endpoint, key, model, system, user, opts);
    return callOpenAI(endpoint, key, model, system, user, opts, p);
  }

  function callAnthropic(endpoint, key, model, system, user, opts) {
    return request(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // 브라우저에서 직접 호출하려면 반드시 필요한 헤더
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: opts.maxTokens || 2048,
        temperature: opts.temperature === undefined ? 0.3 : opts.temperature,
        system: system,
        messages: [{ role: 'user', content: user }]
      }),
      signal: opts.signal
    }).then(function (data) {
      if (!data.content || !data.content.length) throw new Error('빈 응답을 받았습니다.');
      return data.content
        .filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; })
        .join('\n');
    });
  }

  function callGemini(endpoint, key, model, system, user, opts) {
    var url = endpoint.replace('{model}', encodeURIComponent(model));
    return request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: opts.temperature === undefined ? 0.3 : opts.temperature,
          maxOutputTokens: opts.maxTokens || 2048
        }
      }),
      signal: opts.signal
    }).then(function (data) {
      var cand = (data.candidates || [])[0];
      var parts = cand && cand.content && cand.content.parts;
      if (!parts || !parts.length) throw new Error('빈 응답을 받았습니다.');
      return parts.map(function (p) { return p.text || ''; }).join('');
    });
  }

  function callOpenAI(endpoint, key, model, system, user, opts, provider) {
    var headers = { 'content-type': 'application/json' };
    if (!provider.keyless) headers['authorization'] = 'Bearer ' + key;
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = location.origin || 'https://localhost';
      headers['X-Title'] = 'QA-Lab';
    }
    return request(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: model,
        temperature: opts.temperature === undefined ? 0.3 : opts.temperature,
        max_tokens: opts.maxTokens || 2048,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: opts.signal
    }).then(function (data) {
      var choice = (data.choices || [])[0];
      var text = choice && choice.message && choice.message.content;
      if (!text) throw new Error('빈 응답을 받았습니다.');
      return text;
    });
  }

  function request(url, init) {
    return fetch(url, init).then(function (res) {
      return res.text().then(function (raw) {
        var data;
        try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = { raw: raw }; }
        if (!res.ok) {
          var msg = (data.error && (data.error.message || data.error.type)) ||
                    data.message || raw || ('HTTP ' + res.status);
          throw new Error('API 오류 (' + res.status + '): ' + String(msg).slice(0, 300));
        }
        return data;
      });
    }).catch(function (err) {
      if (err.name === 'AbortError') throw err;
      if (err instanceof TypeError) {
        // fetch 자체가 실패 → 대부분 CORS 차단이나 네트워크 문제
        throw new Error('네트워크 요청이 차단되었습니다. CORS 정책, 오프라인 상태, ' +
                        '또는 잘못된 엔드포인트 주소를 확인하세요. (원인: ' + err.message + ')');
      }
      throw err;
    });
  }

  /** 설정 화면의 "연결 테스트" 용 */
  function testConnection() {
    return chat(
      '너는 연결 테스트에 응답하는 도우미다. 다른 말 없이 정확히 "OK" 라고만 답하라.',
      '연결 테스트',
      { maxTokens: 16, temperature: 0 }
    );
  }

  QALab.ai = QALab.ai || {};
  QALab.ai.providers = {
    list: list,
    get: get,
    current: currentProvider,
    currentModel: currentModel,
    isReady: isReady,
    chat: chat,
    testConnection: testConnection
  };
})(window);
