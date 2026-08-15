#!/usr/bin/env node
/* ==========================================================================
   tools/render-briefing.mjs
   --------------------------------------------------------------------------
   아침 학습 브리핑 메일 본문을 생성한다.

   입력
     content/manifest.json          전체 레슨 목차
     data/progress-snapshot.json    브라우저에서 내보낸 진도 스냅샷
     data/knowledge-bites.json      오늘의 QA 지식 풀
     data/missions.json             오늘의 실습 미션 풀

   출력 (out/)
     subject.txt    메일 제목
     briefing.html  HTML 본문
     briefing.txt   텍스트 대체본

   환경변수
     SITE_URL   배포된 플랫폼 주소 (예: https://nohsundong.github.io/qa-learning-platform)
     TZ         Asia/Seoul 권장 (워크플로에서 설정)

   npm 패키지를 쓰지 않는다. Node 내장 모듈만 사용한다.
   ========================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const SITE = (process.env.SITE_URL || '').replace(/\/+$/, '');

/* ------------------------------------------------------------- 유틸 */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function readJSON(rel, fallback = null) {
  try {
    return JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
  } catch (e) {
    if (fallback !== null) return fallback;
    throw new Error(`${rel} 을 읽지 못했습니다: ${e.message}`);
  }
}

/** 로컬(TZ) 기준 YYYY-MM-DD */
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 연중 일차 — 지식/미션을 날짜로 순환 선택할 때 쓴다 */
function dayIndex(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function lessonUrl(id) {
  return SITE ? `${SITE}/#/lesson/${id}` : `#/lesson/${id}`;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/* ------------------------------------------------------------- 조립 */

function buildModel({ manifest, snapshot, bites, missions }) {
  const now = new Date();
  const today = todayKey(now);
  const idx = dayIndex(now);

  // 전체 레슨을 순서대로 편다
  const allLessons = [];
  for (const track of manifest.tracks || []) {
    for (const l of track.lessons || []) {
      allLessons.push({ ...l, trackTitle: track.shortTitle || track.title, trackId: track.id });
    }
  }

  const synced = !!(snapshot && snapshot.generatedAt);
  const completedIds = new Set((snapshot && snapshot.completedLessonIds) || []);
  const completedCount = allLessons.filter((l) => completedIds.has(l.id)).length;
  const total = allLessons.length;
  const percent = total ? Math.round((completedCount / total) * 100) : 0;

  // 오늘 학습할 레슨: 스냅샷의 nextLesson 우선, 없으면 순서상 첫 미완료
  let next = null;
  if (snapshot && snapshot.nextLesson && snapshot.nextLesson.id) {
    next = allLessons.find((l) => l.id === snapshot.nextLesson.id) || null;
  }
  if (!next) next = allLessons.find((l) => !completedIds.has(l.id)) || null;

  // 스냅샷 신선도 — 오래되면 동기화를 재촉한다
  let snapshotAgeDays = null;
  if (synced) {
    snapshotAgeDays = daysBetween(todayKey(new Date(snapshot.generatedAt)), today);
  }

  const streak = (snapshot && snapshot.streak) || { current: 0, longest: 0, lastStudyDate: null };

  // 복습 항목: 마감일이 이른 순 3개
  const weak = ((snapshot && snapshot.weakItems) || [])
    .slice()
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, 3);

  const biteList = bites.bites || [];
  const missionList = missions.missions || [];
  const bite = biteList.length ? biteList[idx % biteList.length] : null;
  const mission = missionList.length ? missionList[idx % missionList.length] : null;

  // 트랙별 진도
  const trackProgress = (manifest.tracks || []).map((t) => {
    const done = (t.lessons || []).filter((l) => completedIds.has(l.id)).length;
    const tot = (t.lessons || []).length;
    return { title: t.shortTitle || t.title, done, total: tot, percent: tot ? Math.round((done / tot) * 100) : 0 };
  });

  return {
    now, today, synced, snapshotAgeDays,
    completedCount, total, percent, next, streak, weak, bite, mission, trackProgress,
    remainingMinutes: allLessons
      .filter((l) => !completedIds.has(l.id))
      .reduce((s, l) => s + (l.minutes || 15), 0)
  };
}

/* -------------------------------------------------------------- HTML */

const C = {
  bg: '#f5f6f8', card: '#ffffff', border: '#e2e6ec',
  text: '#14181d', dim: '#59626d', faint: '#8b939d',
  accent: '#2456c7', ok: '#14713c', warn: '#8a5300',
  soft: '#eef2fb'
};

function section(title, inner, extra = '') {
  return `
  <tr><td style="padding:0 0 14px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${C.card};border:1px solid ${C.border};border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.06em;color:${C.faint};
                    text-transform:uppercase;margin-bottom:10px;">${esc(title)}${extra}</div>
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

/* 메일 클라이언트에서 안전한 진도 막대.
   중첩 테이블을 쓴다. div + width% 는 Outlook 에서 깨진다. */
function bar(percent, color = C.accent) {
  const w = Math.max(0, Math.min(100, Math.round(percent)));
  const track = (inner) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    border="0" style="background:#e3e7ee;border-radius:99px;border-collapse:separate;"><tr>
    <td style="padding:0;font-size:0;line-height:0;height:8px;">${inner}</td></tr></table>`;

  if (w === 0) return track('&nbsp;');
  return track(
    `<table role="presentation" width="${w}%" cellpadding="0" cellspacing="0" border="0"
      style="background:${color};border-radius:99px;border-collapse:separate;"><tr>
      <td style="padding:0;font-size:0;line-height:0;height:8px;">&nbsp;</td></tr></table>`
  );
}

function renderHtml(m) {
  const dateLabel = `${m.now.getMonth() + 1}월 ${m.now.getDate()}일 (${WEEKDAY[m.now.getDay()]})`;
  let body = '';

  /* 스냅샷 미동기화 안내 */
  if (!m.synced) {
    body += section('먼저 할 일',
      `<p style="margin:0 0 8px;font-size:14px;color:${C.text};">
         <strong>진도 스냅샷이 아직 동기화되지 않았습니다.</strong></p>
       <p style="margin:0;font-size:13.5px;color:${C.dim};line-height:1.7;">
         플랫폼 → <strong>설정 · 백업</strong> → <em>아침 브리핑 메일용 스냅샷</em> 에서
         「클립보드에 복사」를 누르고, 저장소의
         <code style="background:${C.soft};padding:1px 5px;border-radius:4px;">data/progress-snapshot.json</code>
         에 붙여넣어 커밋하세요. 주 1회면 충분합니다.</p>`);
  } else if (m.snapshotAgeDays !== null && m.snapshotAgeDays >= 10) {
    body += section('알림',
      `<p style="margin:0;font-size:13.5px;color:${C.warn};">
        진도 스냅샷이 ${m.snapshotAgeDays}일 전 것입니다. 아래 숫자가 실제와 다를 수 있어요.</p>`);
  }

  /* 1. 오늘 학습할 레슨 */
  if (m.next) {
    body += section('오늘 학습할 레슨',
      `<div style="font-size:12px;color:${C.accent};font-weight:700;margin-bottom:4px;">${esc(m.next.trackTitle)}</div>
       <div style="font-size:18px;font-weight:800;color:${C.text};line-height:1.4;margin-bottom:6px;">
         ${esc(m.next.title)}</div>
       <p style="margin:0 0 14px;font-size:13.5px;color:${C.dim};line-height:1.65;">
         ${esc(m.next.summary || '')}</p>
       <a href="${lessonUrl(m.next.id)}"
          style="display:inline-block;background:${C.accent};color:#fff;text-decoration:none;
                 padding:10px 18px;border-radius:8px;font-size:14px;font-weight:700;">
         학습 시작 (${m.next.minutes || 15}분) →</a>`);
  } else {
    body += section('오늘 학습할 레슨',
      `<p style="margin:0;font-size:14px;color:${C.ok};">
        <strong>모든 레슨을 완료했습니다.</strong> 복습 큐로 지식을 굳히거나 실습 랩에서 손을 움직여 보세요.</p>`);
  }

  /* 2. 진도 */
  const trackRows = m.trackProgress.map((t) => `
    <tr>
      <td style="padding:3px 0;font-size:12.5px;color:${C.dim};white-space:nowrap;">${esc(t.title)}</td>
      <td style="padding:3px 0 3px 10px;width:100%;">${bar(t.percent)}</td>
      <td style="padding:3px 0 3px 8px;font-size:12px;color:${C.faint};white-space:nowrap;
                 text-align:right;">${t.done}/${t.total}</td>
    </tr>`).join('');

  body += section('어제까지의 진도',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
       <tr>
         <td style="font-size:30px;font-weight:800;color:${C.text};line-height:1;">${m.percent}<span style="font-size:15px;color:${C.dim};">%</span></td>
         <td style="text-align:right;font-size:13px;color:${C.dim};">
           ${m.completedCount} / ${m.total} 레슨 · 남은 학습량 약 ${Math.round(m.remainingMinutes / 60)}시간</td>
       </tr>
     </table>
     ${bar(m.percent)}
     <div style="margin-top:12px;padding-top:12px;border-top:1px solid ${C.border};">
       <span style="font-size:14px;color:${C.text};">🔥 연속 학습 <strong>${m.streak.current}일</strong></span>
       <span style="font-size:12.5px;color:${C.faint};margin-left:8px;">최장 ${m.streak.longest}일</span>
     </div>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="margin-top:12px;padding-top:12px;border-top:1px solid ${C.border};">
       ${trackRows}
     </table>`);

  /* 3. 복습 */
  if (m.weak.length) {
    const items = m.weak.map((w) => `
      <li style="margin:0 0 9px;font-size:13.5px;color:${C.text};line-height:1.6;">
        ${esc(w.text)}
        <div style="font-size:12px;color:${C.faint};margin-top:2px;">
          ${esc(w.lessonTitle || w.lessonId || '')}${w.lapses ? ` · 실패 ${w.lapses}회` : ''}
        </div>
      </li>`).join('');
    body += section('복습할 약점',
      `<ul style="margin:0;padding-left:18px;">${items}</ul>
       ${SITE ? `<a href="${SITE}/#/review" style="display:inline-block;margin-top:6px;font-size:13px;
                    color:${C.accent};text-decoration:none;font-weight:600;">복습 큐 열기 →</a>` : ''}`,
      ` <span style="color:${C.warn};">${m.weak.length}개</span>`);
  } else if (m.synced) {
    body += section('복습할 약점',
      `<p style="margin:0;font-size:13.5px;color:${C.dim};">
        오늘 복습할 항목이 없습니다. 레슨의 자가 체크리스트에서 헷갈리는 항목을
        <strong>「약점으로」</strong> 표시해 두면 여기에 쌓입니다.</p>`);
  }

  /* 4. 오늘의 QA 지식 */
  if (m.bite) {
    body += section('오늘의 QA 지식',
      `<div style="font-size:16px;font-weight:800;color:${C.text};margin-bottom:4px;">${esc(m.bite.term)}</div>
       <div style="font-size:13.5px;color:${C.accent};font-weight:600;margin-bottom:8px;">${esc(m.bite.short)}</div>
       <p style="margin:0;font-size:13.5px;color:${C.dim};line-height:1.7;">${esc(m.bite.detail)}</p>
       ${m.bite.lesson ? `<a href="${lessonUrl(m.bite.lesson)}"
          style="display:inline-block;margin-top:10px;font-size:12.5px;color:${C.accent};
                 text-decoration:none;font-weight:600;">관련 레슨 →</a>` : ''}`);
  }

  /* 5. 오늘의 실습 미션 */
  if (m.mission) {
    const steps = (m.mission.steps || []).map((s) => `
      <li style="margin:0 0 6px;font-size:13.5px;color:${C.text};line-height:1.6;">${esc(s)}</li>`).join('');
    body += section('오늘의 실습 미션',
      `<div style="font-size:16px;font-weight:800;color:${C.text};margin-bottom:8px;">${esc(m.mission.title)}</div>
       <ol style="margin:0;padding-left:18px;">${steps}</ol>
       ${m.mission.lesson ? `<a href="${lessonUrl(m.mission.lesson)}"
          style="display:inline-block;margin-top:10px;font-size:12.5px;color:${C.accent};
                 text-decoration:none;font-weight:600;">관련 레슨 →</a>` : ''}`,
      ` <span style="color:${C.faint};">${m.mission.minutes || 15}분</span>`);
  }

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA-Lab 아침 브리핑</title></head>
<body style="margin:0;padding:0;background:${C.bg};
  font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${esc(m.next ? m.next.title : '오늘의 학습')} · 진도 ${m.percent}% · 연속 ${m.streak.current}일
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

    <tr><td style="padding:0 0 18px 0;">
      <div style="font-size:20px;font-weight:800;color:${C.text};">🧪 QA-Lab 아침 브리핑</div>
      <div style="font-size:13px;color:${C.faint};margin-top:3px;">${dateLabel}</div>
    </td></tr>

    ${body}

    <tr><td style="padding:6px 4px 0;">
      <p style="margin:0;font-size:11.5px;color:${C.faint};line-height:1.7;">
        이 메일은 GitHub Actions 가 자동으로 보냅니다.
        ${SITE ? `<a href="${SITE}" style="color:${C.faint};">플랫폼 열기</a> · ` : ''}
        진도 숫자는 저장소의 <code>data/progress-snapshot.json</code> 기준입니다.
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

/* -------------------------------------------------------------- TEXT */

function renderText(m) {
  const dateLabel = `${m.now.getFullYear()}-${String(m.now.getMonth() + 1).padStart(2, '0')}-${String(m.now.getDate()).padStart(2, '0')} (${WEEKDAY[m.now.getDay()]})`;
  const L = [];
  const hr = '─'.repeat(46);

  L.push(`QA-Lab 아침 브리핑  ${dateLabel}`, hr, '');

  if (!m.synced) {
    L.push('[먼저 할 일]',
      '진도 스냅샷이 아직 동기화되지 않았습니다.',
      '플랫폼 > 설정·백업 > 아침 브리핑 메일용 스냅샷 에서 복사해',
      'data/progress-snapshot.json 에 붙여넣고 커밋하세요.', '');
  } else if (m.snapshotAgeDays !== null && m.snapshotAgeDays >= 10) {
    L.push(`[알림] 진도 스냅샷이 ${m.snapshotAgeDays}일 전 것입니다.`, '');
  }

  L.push('[1] 오늘 학습할 레슨');
  if (m.next) {
    L.push(`  ${m.next.trackTitle}`,
      `  ${m.next.title} (${m.next.minutes || 15}분)`,
      `  ${m.next.summary || ''}`,
      `  ${lessonUrl(m.next.id)}`);
  } else {
    L.push('  모든 레슨을 완료했습니다. 복습 큐 또는 실습 랩으로.');
  }
  L.push('');

  L.push('[2] 어제까지의 진도',
    `  전체 ${m.percent}%  (${m.completedCount}/${m.total} 레슨)`,
    `  연속 학습 ${m.streak.current}일 (최장 ${m.streak.longest}일)`,
    `  남은 학습량 약 ${Math.round(m.remainingMinutes / 60)}시간`);
  m.trackProgress.forEach((t) => {
    L.push(`    - ${t.title}: ${t.done}/${t.total} (${t.percent}%)`);
  });
  L.push('');

  L.push('[3] 복습할 약점');
  if (m.weak.length) {
    m.weak.forEach((w, i) => {
      L.push(`  ${i + 1}. ${w.text}`,
        `     (${w.lessonTitle || w.lessonId || ''}${w.lapses ? `, 실패 ${w.lapses}회` : ''})`);
    });
    if (SITE) L.push(`  ${SITE}/#/review`);
  } else if (m.synced) {
    L.push('  오늘 복습할 항목이 없습니다.',
      '  레슨의 자가 체크리스트에서 헷갈리는 항목을 「약점으로」 표시해 두세요.');
  } else {
    L.push('  (스냅샷 동기화 후 표시됩니다)');
  }
  L.push('');

  if (m.bite) {
    L.push('[4] 오늘의 QA 지식',
      `  ${m.bite.term} — ${m.bite.short}`,
      `  ${m.bite.detail}`);
    if (m.bite.lesson) L.push(`  ${lessonUrl(m.bite.lesson)}`);
    L.push('');
  }

  if (m.mission) {
    L.push(`[5] 오늘의 실습 미션 (${m.mission.minutes || 15}분)`, `  ${m.mission.title}`);
    (m.mission.steps || []).forEach((s, i) => L.push(`   ${i + 1}) ${s}`));
    if (m.mission.lesson) L.push(`  ${lessonUrl(m.mission.lesson)}`);
    L.push('');
  }

  L.push(hr,
    '이 메일은 GitHub Actions 가 자동으로 보냅니다.',
    '진도 숫자는 저장소의 data/progress-snapshot.json 기준입니다.');
  if (SITE) L.push(SITE);

  return L.join('\n');
}

/* -------------------------------------------------------------- 실행 */

async function main() {
  const [manifest, snapshot, bites, missions] = await Promise.all([
    readJSON('content/manifest.json'),
    readJSON('data/progress-snapshot.json', {}),
    readJSON('data/knowledge-bites.json', { bites: [] }),
    readJSON('data/missions.json', { missions: [] })
  ]);

  const m = buildModel({ manifest, snapshot, bites, missions });

  const subject = m.next
    ? `[QA-Lab] 오늘의 학습: ${m.next.title} · 진도 ${m.percent}% · 연속 ${m.streak.current}일`
    : `[QA-Lab] 전체 완료 · 복습 ${m.weak.length}건`;

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'subject.txt'), subject, 'utf8');
  await writeFile(join(OUT, 'briefing.html'), renderHtml(m), 'utf8');
  await writeFile(join(OUT, 'briefing.txt'), renderText(m), 'utf8');

  // GitHub Actions 에서 제목을 다음 스텝으로 넘긴다
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `subject=${subject}\n`);
  }

  console.log('브리핑 생성 완료');
  console.log(`  제목      : ${subject}`);
  console.log(`  스냅샷    : ${m.synced ? `동기화됨 (${m.snapshotAgeDays}일 전)` : '미동기화'}`);
  console.log(`  진도      : ${m.completedCount}/${m.total} (${m.percent}%)`);
  console.log(`  다음 레슨 : ${m.next ? m.next.id + ' ' + m.next.title : '없음'}`);
  console.log(`  복습      : ${m.weak.length}건`);
  console.log(`  지식      : ${m.bite ? m.bite.term : '없음'}`);
  console.log(`  미션      : ${m.mission ? m.mission.title : '없음'}`);
  console.log(`  출력      : out/subject.txt, out/briefing.html, out/briefing.txt`);
}

main().catch((err) => {
  console.error('브리핑 생성 실패:', err.message);
  process.exit(1);
});
