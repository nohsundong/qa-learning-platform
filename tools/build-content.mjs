#!/usr/bin/env node
/* ==========================================================================
   tools/build-content.mjs
   --------------------------------------------------------------------------
   content/**.md 의 frontmatter 를 읽어 두 파일을 생성한다.

     content/manifest.json      ← http(s) 로 열었을 때 쓰는 목차
     content/lessons.bundle.js  ← file:// 로 열었을 때 쓰는 전체 번들

   npm 패키지를 하나도 쓰지 않는다 (Node 내장 모듈만). 따라서
     node tools/build-content.mjs
   만 실행하면 끝이고, 설치도 락파일도 필요 없다.
   GitHub Actions 가 push 마다 자동 실행하므로 평소엔 .md 만 고치면 된다.
   ========================================================================== */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content');
const DATA_DIR = join(ROOT, 'data');

/* ------------------------------------------------- frontmatter 파서 */
/* js/content.js 의 parseFrontmatter 와 동작이 같아야 한다.               */

function parseFrontmatter(raw) {
  const meta = {};
  let body = raw;
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (/^\[.*\]$/.test(val)) {
        meta[key] = val.slice(1, -1).split(',')
          .map(v => v.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
        continue;
      }
      val = val.replace(/^["']|["']$/g, '');
      if (/^\d+$/.test(val)) meta[key] = parseInt(val, 10);
      else if (val === 'true') meta[key] = true;
      else if (val === 'false') meta[key] = false;
      else meta[key] = val;
    }
  }
  return { meta, body };
}

/* ------------------------------------------------------------ 수집 */

async function listMarkdown(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => join(dir, e.name))
    .sort();
}

async function loadDataFiles() {
  const out = {};
  let entries = [];
  try {
    entries = await readdir(DATA_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    const name = e.name.replace(/\.json$/, '');
    try {
      out[name] = JSON.parse(await readFile(join(DATA_DIR, e.name), 'utf8'));
    } catch (err) {
      console.warn(`  ! data/${e.name} 파싱 실패 — 번들에서 제외합니다. (${err.message})`);
    }
  }
  return out;
}

/* ------------------------------------------------------------ 빌드 */

async function build() {
  const tracksMeta = JSON.parse(await readFile(join(CONTENT_DIR, 'tracks.json'), 'utf8'));

  const manifest = { generatedAt: new Date().toISOString(), tracks: [] };
  const lessons = {};
  const problems = [];
  const seenIds = new Set();

  for (const track of tracksMeta.tracks) {
    const dir = join(CONTENT_DIR, track.id);
    const files = await listMarkdown(dir);
    const trackLessons = [];

    for (const file of files) {
      const relPath = relative(CONTENT_DIR, file).split(sep).join('/');
      const raw = await readFile(file, 'utf8');
      const { meta, body } = parseFrontmatter(raw);

      if (!meta.id) { problems.push(`${relPath}: frontmatter 에 id 가 없습니다.`); continue; }
      if (!meta.title) { problems.push(`${relPath}: frontmatter 에 title 이 없습니다.`); continue; }
      if (seenIds.has(meta.id)) { problems.push(`${relPath}: id 가 중복됩니다 → ${meta.id}`); continue; }
      if (!body.trim()) { problems.push(`${relPath}: 본문이 비어 있습니다.`); continue; }
      seenIds.add(meta.id);

      trackLessons.push({
        id: meta.id,
        title: meta.title,
        summary: meta.summary || '',
        minutes: meta.minutes || 15,
        tags: meta.tags || [],
        order: meta.order ?? 999,
        path: relPath
      });
      lessons[meta.id] = raw;
    }

    trackLessons.sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));

    manifest.tracks.push({
      id: track.id,
      title: track.title,
      shortTitle: track.shortTitle || track.title,
      summary: track.summary || '',
      outcomes: track.outcomes || [],
      lessons: trackLessons
    });
  }

  const data = await loadDataFiles();

  await writeFile(join(CONTENT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const bundle =
    '/* 자동 생성 파일 — 직접 수정하지 마세요.\n' +
    '   생성: tools/build-content.mjs   (원본: content/**.md, data/*.json)\n' +
    '   용도: index.html 을 file:// 로 열었을 때 fetch 가 CORS 로 막히므로,\n' +
    '         script 태그로 읽을 수 있는 형태로 콘텐츠를 담아둔다. */\n' +
    'window.QALAB_BUNDLE = ' + JSON.stringify({ manifest, lessons, data }) + ';\n';

  await writeFile(join(CONTENT_DIR, 'lessons.bundle.js'), bundle, 'utf8');

  /* ----------------------------------------------------------- 리포트 */

  const lessonCount = Object.keys(lessons).length;
  const bundleKb = Math.round(Buffer.byteLength(bundle, 'utf8') / 1024);

  console.log('content 빌드 완료');
  console.log(`  트랙 ${manifest.tracks.length}개 / 레슨 ${lessonCount}개`);
  for (const t of manifest.tracks) {
    const flag = t.lessons.length === 0 ? '  (레슨 없음)' : '';
    console.log(`  - ${t.shortTitle}: ${t.lessons.length}개${flag}`);
  }
  console.log(`  content/manifest.json`);
  console.log(`  content/lessons.bundle.js (${bundleKb} KB)`);

  if (problems.length) {
    console.error('\n문제가 발견되었습니다:');
    problems.forEach(p => console.error('  ! ' + p));
    process.exitCode = 1;
  }
}

build().catch(err => {
  console.error('빌드 실패:', err);
  process.exit(1);
});
