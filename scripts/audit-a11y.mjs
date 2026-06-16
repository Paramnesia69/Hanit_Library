#!/usr/bin/env node
/**
 * Headless accessibility + quality audit (axe-core) across all 9 themes.
 * Checks: axe a11y violations, color-contrast per theme, touch-target sizes,
 * console errors, no-results empty state, and mobile horizontal overflow.
 *
 * Usage:
 *   node scripts/audit-a11y.mjs [URL]
 *     URL default: https://hanit-library.vercel.app/  (use http://localhost:4173/ for a local preview)
 *
 * Needs the Playwright Chromium (already cached for the emulator tests) + network (axe from CDN).
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import pw from 'playwright-core';

const URL = process.argv[2] || 'https://hanit-library.vercel.app/';
const AXE = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js';
const THEMES = ['light','pearl','cream','copilot','noir','pinkdesert','amethyst','pitwall-dark','pitwall-light'];
const DARK = new Set(['copilot','noir','amethyst','pitwall-dark']);

function findChromium() {
  const base = join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base);
  for (const d of dirs) if (d.startsWith('chromium_headless_shell')) {
    const p = join(base, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  for (const d of dirs) if (d.startsWith('chromium-')) {
    const p = join(base, d, 'chrome-mac', 'Chromium.app/Contents/MacOS/Chromium');
    if (existsSync(p)) return p;
  }
  return undefined;
}

const browser = await pw.chromium.launch({ executablePath: findChromium() });
const axeRun = (page, opts) => page.addScriptTag({ url: AXE }).then(() => page.evaluate(async (o) => window.axe.run(document, o), opts));
let fail = 0;

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await ctx.addInitScript(() => localStorage.setItem('hanit-library:editpass','audit-admin'));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const full = await axeRun(page, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } });
  console.log('\n=== FULL a11y scan (admin) ===');
  if (full.violations.length === 0) console.log('✅ no violations');
  else { fail += full.violations.length; for (const v of full.violations) console.log(`  ❌ ${v.impact} ${v.nodes.length}× ${v.id} — ${v.help}`); }

  console.log('\n=== color-contrast across all 9 themes ===');
  for (const t of THEMES) {
    await page.evaluate((id) => localStorage.setItem('hanit-library:theme', id), t);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const cc = await axeRun(page, { runOnly: { type: 'rule', values: ['color-contrast'] } });
    const n = cc.violations.reduce((s,v)=>s+v.nodes.length,0);
    if (n) fail++;
    console.log(`  ${DARK.has(t)?'🌙':'☀️'} ${t.padEnd(14)} ${n===0?'✅ ok':'❌ '+n+' low-contrast'}`);
  }

  await page.evaluate(() => localStorage.setItem('hanit-library:theme','light'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  console.log('\n=== other checks ===');
  await page.locator('input[placeholder*="חיפוש"]').first().fill('zzzqqq-nomatch');
  await page.waitForTimeout(400);
  const noRes = await page.getByText('לא נמצאו ספרים').count() > 0;
  console.log(`  no-results state: ${noRes?'✅':'❌'}`); if(!noRes) fail++;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  const okOverflow = o.sw <= o.iw + 1;
  console.log(`  mobile overflow: ${okOverflow?'✅ none':'❌ +'+(o.sw-o.iw)+'px'}`); if(!okOverflow) fail++;

  const real = errs.filter(e => !/favicon|manifest|api\/books|404|sw\.js|workbox/i.test(e));
  console.log(`  console errors: ${real.length===0?'✅ none':'❌ '+real.length}`);
  real.slice(0,8).forEach(e => console.log('     '+e.slice(0,150)));
  if (real.length) fail++;

  await ctx.close();
} catch (e) {
  console.error('AUDIT CRASH:', e.message); fail++;
} finally {
  await browser.close();
}
console.log(`\n${fail===0 ? '✅ ALL CLEAN' : '❌ '+fail+' issue group(s)'}`);
process.exit(fail ? 1 : 0);
