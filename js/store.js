/* ==========================================================================
   store.js — localStorage 영속 계층
   --------------------------------------------------------------------------
   저장 키는 모두 `qalab.v1.*` 네임스페이스를 쓴다.
   각 레코드에 schemaVersion 을 넣어두고, 구조가 바뀌면 migrate() 에서
   단계별로 올린다. 이렇게 해두면 나중에 스키마를 바꿔도 기존 진도가 날아가지
   않는다. (QA 관점: 마이그레이션은 회귀 위험이 큰 지점이라 버전을 명시한다)
   ========================================================================== */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var NS = 'qalab.v1.';

  var KEYS = {
    progress: NS + 'progress',
    settings: NS + 'settings',
    review:   NS + 'review',
    streak:   NS + 'streak'
  };

  /* ---------------------------------------------------------- 기본값 */

  function defaults(kind) {
    switch (kind) {
      case 'progress':
        // lessons[lessonId] = { status, completedAt, checklist{}, note, bookmarked, updatedAt }
        return { schemaVersion: SCHEMA_VERSION, lessons: {} };
      case 'settings':
        return {
          schemaVersion: SCHEMA_VERSION,
          theme: 'auto',                  // auto | light | dark
          ai: {
            provider: 'anthropic',        // 기본값: Claude
            model: '',                    // 비우면 제공자 기본 모델
            baseUrl: '',                  // 커스텀(OpenAI 호환) 전용
            keys: {}                      // { providerId: apiKey }
          },
          briefingHour: 8,                // 아침 브리핑 메일 시각 (KST)
          reviewPerDay: 5
        };
      case 'review':
        // items[key] = { key, lessonId, text, reps, ease, intervalDays, dueAt, lapses, addedAt }
        return { schemaVersion: SCHEMA_VERSION, items: {} };
      case 'streak':
        return {
          schemaVersion: SCHEMA_VERSION,
          current: 0,
          longest: 0,
          lastStudyDate: null,            // 'YYYY-MM-DD'
          history: {}                     // { 'YYYY-MM-DD': 그날 완료한 레슨 수 }
        };
    }
    return {};
  }

  /* ------------------------------------------------------ 저수준 IO */

  var available = (function () {
    try {
      var t = NS + '__probe';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var memoryFallback = {};   // 사파리 프라이빗 모드 등 localStorage 차단 환경 대비

  function rawGet(key) {
    if (!available) return memoryFallback[key] || null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function rawSet(key, value) {
    if (!available) { memoryFallback[key] = value; return true; }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // QuotaExceededError 등
      console.error('[store] 저장 실패:', e);
      if (global.QALab && global.QALab.toast) {
        global.QALab.toast('저장 공간이 부족합니다. 설정에서 데이터를 내보낸 뒤 정리하세요.', 'err');
      }
      return false;
    }
  }

  /* ---------------------------------------------------- 캐시 + 읽기 */

  var cache = {};

  function read(kind) {
    if (cache[kind]) return cache[kind];
    var raw = rawGet(KEYS[kind]);
    var data;
    if (!raw) {
      data = defaults(kind);
    } else {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn('[store] ' + kind + ' 파싱 실패, 기본값으로 되돌립니다.', e);
        data = defaults(kind);
      }
      data = migrate(kind, data);
    }
    cache[kind] = data;
    return data;
  }

  function write(kind) {
    var data = cache[kind];
    if (!data) return false;
    var ok = rawSet(KEYS[kind], JSON.stringify(data));
    emit(kind);
    return ok;
  }

  function migrate(kind, data) {
    if (!data || typeof data !== 'object') return defaults(kind);
    var v = data.schemaVersion || 0;
    // v0 -> v1: schemaVersion 이 없던 초기 데이터. 기본값과 병합만 한다.
    if (v < 1) {
      var base = defaults(kind);
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) base[k] = data[k];
      base.schemaVersion = 1;
      data = base;
    }
    // 이후 버전이 생기면 여기에 if (v < 2) { ... } 형태로 추가한다.
    return data;
  }

  /* ------------------------------------------------------ 변경 이벤트 */

  var listeners = [];

  function emit(kind) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](kind); } catch (e) { console.error(e); }
    }
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ------------------------------------------------------------ 날짜 */

  function todayKey(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function daysBetween(a, b) {
    var da = new Date(a + 'T00:00:00');
    var db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  /* ---------------------------------------------------------- 진도 API */

  function getLesson(lessonId) {
    var p = read('progress');
    return p.lessons[lessonId] || {
      status: 'todo', completedAt: null, checklist: {},
      note: '', bookmarked: false, updatedAt: null
    };
  }

  function updateLesson(lessonId, patch) {
    var p = read('progress');
    var cur = p.lessons[lessonId] || {
      status: 'todo', completedAt: null, checklist: {},
      note: '', bookmarked: false, updatedAt: null
    };
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
    cur.updatedAt = new Date().toISOString();
    p.lessons[lessonId] = cur;
    write('progress');
    return cur;
  }

  function setStatus(lessonId, status) {
    var wasDone = getLesson(lessonId).status === 'done';
    var patch = { status: status };
    patch.completedAt = status === 'done' ? new Date().toISOString() : null;
    var res = updateLesson(lessonId, patch);
    if (status === 'done' && !wasDone) touchStreak(1);
    return res;
  }

  function toggleChecklist(lessonId, index, checked) {
    var l = getLesson(lessonId);
    var cl = {};
    for (var k in l.checklist) cl[k] = l.checklist[k];
    cl[index] = !!checked;
    return updateLesson(lessonId, { checklist: cl });
  }

  function toggleBookmark(lessonId) {
    var l = getLesson(lessonId);
    return updateLesson(lessonId, { bookmarked: !l.bookmarked });
  }

  function allLessonStates() { return read('progress').lessons; }

  function bookmarks() {
    var lessons = allLessonStates();
    var out = [];
    for (var id in lessons) if (lessons[id].bookmarked) out.push(id);
    return out;
  }

  /* --------------------------------------------------------- 스트릭 API */

  function touchStreak(count) {
    var s = read('streak');
    var today = todayKey();
    if (s.lastStudyDate === today) {
      s.history[today] = (s.history[today] || 0) + (count || 0);
    } else {
      var gap = s.lastStudyDate ? daysBetween(s.lastStudyDate, today) : null;
      s.current = (gap === 1) ? s.current + 1 : 1;
      s.lastStudyDate = today;
      s.history[today] = count || 0;
      if (s.current > s.longest) s.longest = s.current;
    }
    write('streak');
    return s;
  }

  function getStreak() {
    var s = read('streak');
    // 하루 이상 건너뛰었으면 표시상 0으로 끊어준다 (저장값은 유지)
    if (s.lastStudyDate) {
      var gap = daysBetween(s.lastStudyDate, todayKey());
      if (gap > 1) return { current: 0, longest: s.longest, lastStudyDate: s.lastStudyDate, history: s.history };
    }
    return s;
  }

  /* ------------------------------------------------- 복습 큐 (SM-2 축약판) */

  // 간격 반복: 정답이면 간격을 ease 배로 늘리고, 오답이면 1일로 리셋한다.
  var FIRST_STEPS = [1, 3];

  function reviewKey(lessonId, index) { return lessonId + '#' + index; }

  function addWeak(lessonId, index, text) {
    var r = read('review');
    var key = reviewKey(lessonId, index);
    if (!r.items[key]) {
      r.items[key] = {
        key: key,
        lessonId: lessonId,
        index: index,
        text: text || '',
        reps: 0,
        ease: 2.3,
        intervalDays: 0,
        dueAt: todayKey(),
        lapses: 0,
        addedAt: new Date().toISOString()
      };
    } else {
      r.items[key].text = text || r.items[key].text;
    }
    write('review');
    return r.items[key];
  }

  function removeWeak(lessonId, index) {
    var r = read('review');
    delete r.items[reviewKey(lessonId, index)];
    write('review');
  }

  function hasWeak(lessonId, index) {
    return !!read('review').items[reviewKey(lessonId, index)];
  }

  function gradeReview(key, grade) {
    // grade: 'again' | 'hard' | 'good' | 'easy'
    var r = read('review');
    var it = r.items[key];
    if (!it) return null;

    if (grade === 'again') {
      it.lapses += 1;
      it.reps = 0;
      it.ease = Math.max(1.3, it.ease - 0.2);
      it.intervalDays = 1;
    } else {
      if (it.reps < FIRST_STEPS.length) {
        it.intervalDays = FIRST_STEPS[it.reps];
      } else {
        var mult = grade === 'hard' ? 1.2 : (grade === 'easy' ? it.ease * 1.3 : it.ease);
        it.intervalDays = Math.max(1, Math.round(it.intervalDays * mult));
      }
      it.reps += 1;
      if (grade === 'easy') it.ease = Math.min(3.0, it.ease + 0.15);
      if (grade === 'hard') it.ease = Math.max(1.3, it.ease - 0.15);
    }

    var due = new Date();
    due.setDate(due.getDate() + it.intervalDays);
    it.dueAt = todayKey(due);
    it.lastReviewedAt = new Date().toISOString();

    // 충분히 익었으면 큐에서 졸업시킨다
    if (it.reps >= 5 && it.intervalDays >= 30) delete r.items[key];

    write('review');
    touchStreak(0);
    return it;
  }

  function dueReviews(limit) {
    var r = read('review');
    var today = todayKey();
    var list = [];
    for (var k in r.items) {
      if (r.items[k].dueAt <= today) list.push(r.items[k]);
    }
    list.sort(function (a, b) {
      if (a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
      return b.lapses - a.lapses;
    });
    return limit ? list.slice(0, limit) : list;
  }

  function allReviews() {
    var r = read('review');
    return Object.keys(r.items).map(function (k) { return r.items[k]; });
  }

  /* ---------------------------------------------------------- 설정 API */

  function getSettings() { return read('settings'); }

  function setSetting(path, value) {
    var s = read('settings');
    var parts = path.split('.');
    var node = s;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    write('settings');
    return s;
  }

  function getApiKey(provider) {
    var s = read('settings');
    return (s.ai.keys && s.ai.keys[provider]) || '';
  }

  function setApiKey(provider, key) {
    var s = read('settings');
    if (!s.ai.keys) s.ai.keys = {};
    if (key) s.ai.keys[provider] = key;
    else delete s.ai.keys[provider];
    write('settings');
  }

  /* ------------------------------------------------------ export / import */

  function exportAll() {
    return {
      app: 'qa-lab',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      progress: read('progress'),
      review: read('review'),
      streak: read('streak'),
      settings: sanitizeSettings(read('settings'))
    };
  }

  // API 키는 백업 파일에 절대 넣지 않는다. 파일이 저장소나 클라우드로
  // 새어나가는 사고를 원천 차단한다.
  function sanitizeSettings(s) {
    var copy = JSON.parse(JSON.stringify(s));
    if (copy.ai) copy.ai.keys = {};
    return copy;
  }

  function importAll(payload, opts) {
    opts = opts || {};
    if (!payload || payload.app !== 'qa-lab') {
      throw new Error('QA-Lab 백업 파일이 아닙니다.');
    }
    ['progress', 'review', 'streak'].forEach(function (kind) {
      if (!payload[kind]) return;
      if (opts.merge && kind === 'progress') {
        var cur = read('progress');
        var inc = payload.progress.lessons || {};
        for (var id in inc) {
          var a = cur.lessons[id], b = inc[id];
          // 더 최근에 갱신된 쪽을 남긴다
          if (!a || (b.updatedAt && (!a.updatedAt || b.updatedAt > a.updatedAt))) cur.lessons[id] = b;
        }
        cache.progress = cur;
      } else {
        cache[kind] = migrate(kind, payload[kind]);
      }
      write(kind);
    });
    if (payload.settings && opts.includeSettings) {
      var incoming = migrate('settings', payload.settings);
      incoming.ai.keys = read('settings').ai.keys;   // 기존 키는 유지
      cache.settings = incoming;
      write('settings');
    }
    return true;
  }

  function resetAll() {
    ['progress', 'review', 'streak'].forEach(function (kind) {
      cache[kind] = defaults(kind);
      write(kind);
    });
  }

  /* ---------------------------------------------------------------- */

  global.QALab = global.QALab || {};
  global.QALab.store = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    KEYS: KEYS,
    available: available,
    onChange: onChange,
    todayKey: todayKey,
    daysBetween: daysBetween,

    getLesson: getLesson,
    updateLesson: updateLesson,
    setStatus: setStatus,
    toggleChecklist: toggleChecklist,
    toggleBookmark: toggleBookmark,
    allLessonStates: allLessonStates,
    bookmarks: bookmarks,

    getStreak: getStreak,
    touchStreak: touchStreak,

    addWeak: addWeak,
    removeWeak: removeWeak,
    hasWeak: hasWeak,
    gradeReview: gradeReview,
    dueReviews: dueReviews,
    allReviews: allReviews,

    getSettings: getSettings,
    setSetting: setSetting,
    getApiKey: getApiKey,
    setApiKey: setApiKey,

    exportAll: exportAll,
    importAll: importAll,
    resetAll: resetAll
  };
})(window);
