import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('web GUI exposes CLI parity navigation and reader toggles', async () => {
  const html = await read('apps/web/public/index.html');
  for (const required of [
    'data-view="modules"', 'data-view="reader"', 'data-view="review"',
    'data-view="content"', 'data-view="packages"', 'data-view="progress"',
    'data-view="settings"', 'translation-toggle', 'characters-toggle',
    'breakdown-toggle', 'data-mode="normal"', 'data-mode="expert"',
    'data-mode="developer"', 'input type="radio" name="source-locale"'
  ]) assert.match(html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('web application JavaScript parses without browser execution', async () => {
  const source = await read('apps/web/public/app.js');
  assert.doesNotThrow(() => new vm.Script(source));
});

test('web server exposes built-in modules, backup, workbook, and projected curriculum routes', async () => {
  const source = await read('apps/web/server.ts');
  for (const route of [
    '/api/modules', '/api/chess', '/api/geography/continents',
    '/api/mathematics/workbook', '/api/backup', '/api/backup/restore'
  ]) assert.match(source, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(source, /projectCurriculumMarkdown/);
  assert.match(source, /translations/);
  assert.match(source, /breakdown/);
  assert.match(source, /characters/);
  assert.match(source, /reading-support\.json/);
  assert.match(source, /reading-translation\.en\.json/);
  assert.match(source, /combineDeveloperGrammarMarkdown/);
});

test('public landing page describes the whole modular platform', async () => {
  const html = await read('apps/web/public/landing.html');
  assert.match(html, /Learn deeply/);
  assert.match(html, /Languages/);
  assert.match(html, /Chess/);
  assert.match(html, /Geography/);
  assert.match(html, /Mathematics/);
  assert.match(html, /Feature parity/);
  assert.match(html, /Build knowledge that sticks/);
  assert.match(html, />Developer notes</);
  assert.match(html, /href="\/login"[^>]*>Log in</);
  assert.equal((html.match(/href="\/login\?returnTo=\/app"/g) ?? []).length, 3);
});

test('successful login honors the safe app return route', async () => {
  const source = await read('apps/web/public/login.js');
  let submit;
  let assigned;
  const button = { disabled: false };
  const error = { textContent: '' };
  const form = {
    username: { value: 'learner' },
    password: { value: 'secret' },
    addEventListener: (_name, handler) => { submit = handler; },
    querySelector: () => button
  };
  const context = {
    URL,
    URLSearchParams,
    location: {
      origin: 'https://www.whacksmacker.com',
      search: '?returnTo=/app',
      assign: destination => { assigned = destination; }
    },
    document: { querySelector: selector => selector === '#login-form' ? form : selector === '#login-error' ? error : {} },
    WhackSmackerUiLocale: { installSelector: () => 'en', translate: () => 'error' },
    fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    Response,
    JSON
  };
  vm.runInNewContext(source, context);
  await submit({ preventDefault() {} });
  assert.equal(assigned, '/app');
});


test('redesign preserves legacy deep links and source-locale regression hooks', async () => {
  const [html, login, script] = await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/login.html'),
    read('apps/web/public/app.js')
  ]);
  assert.match(html, /Curriculum reader/);
  assert.match(login, /There is no public registration or default account/);
  assert.match(script, /legacy=new URLSearchParams\(location\.search\)/);
  assert.match(script, /const initialRoute=readRoute\(\)/);
  assert.match(script, /restoreRoute\(initialRoute\)/);
  assert.match(script, /JSON\.stringify\(\{locale\}\)/);
});
