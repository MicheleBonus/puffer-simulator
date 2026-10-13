// Browser-driven tests for puffer-simulator.html.
// Usage: node test.mjs <path-to-html> [--shots]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = path.resolve(process.argv[2] || '../index.html');
const SHOTS = process.argv.includes('--shots');
const url = 'file:///' + file.replace(/\\/g, '/');
const outDir = path.resolve('shots'); fs.mkdirSync(outDir, { recursive: true });

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push([true, name]); console.log('  ok   ' + name); }
  catch (e) { results.push([false, name]); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n')[0]); }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(page, fn, { timeout = 20000, msg = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await page.evaluate(fn)) return; await sleep(150); }
  throw new Error('timeout waiting for ' + msg);
}
const text = (page, sel) => page.$eval(sel, el => el.textContent.trim());
const click = async (page, sel) => { await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.click(sel); };

// Median colour of the liquid region of a beaker canvas (ignores particles).
const liquidColour = (page, k) => page.evaluate(k => {
  const c = document.getElementById('bk' + k), ctx = c.getContext('2d');
  const dpr = c.width / 320;                       // logical width is 320
  const xs = [], ys = [];
  for (let i = 0; i < 9; i++) { xs.push(Math.round((20 + i * 35) * dpr)); ys.push(Math.round((70 + i * 24) * dpr)); }
  const ch = [[], [], []];
  for (const x of xs) for (const y of ys) { const d = ctx.getImageData(x, y, 1, 1).data; ch[0].push(d[0]); ch[1].push(d[1]); ch[2].push(d[2]); }
  const med = a => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(ch[0]), med(ch[1]), med(ch[2])];
}, k);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none'] });
const errors = [];
async function open(width = 1920, height = 1080, dark = false) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(400);
  return page;
}

console.log('Testing ' + file);
const page = await open();

// ---- preserved behaviour (characterisation)
await test('loads without console or page errors', async () => { expect(errors.length === 0, 'errors: ' + errors.join(' | ')); });
await test('initial pH values 4,76 / 2,38 / 2,30', async () => {
  expect((await text(page, '#phA')).includes('4,76'), 'A=' + await text(page, '#phA'));
  expect((await text(page, '#phB')).includes('2,38'), 'B=' + await text(page, '#phB'));
  expect((await text(page, '#phC')).includes('2,30'), 'C=' + await text(page, '#phC'));
});
await test('+8 OH⁻ to C raises pH to about 12,2 and reports the addition', async () => {
  await click(page, '[data-k="C"][data-sp="OH"][data-n="8"]');
  await waitFor(page, () => /Zugabe\s*8 Kugeln/.test(document.getElementById('rC').textContent), { msg: 'C dosed' });
  await sleep(600);
  expect(/12,[12]\d/.test(await text(page, '#phC')), 'C=' + await text(page, '#phC'));
});
await test('reset all restores C to pH 2,30', async () => {
  await click(page, '#resetAll'); await sleep(300);
  expect((await text(page, '#phC')).includes('2,30'), 'C=' + await text(page, '#phC'));
});
await test('changing the acid pair relabels solution A', async () => {
  await page.select('#acid', '9.25'); await sleep(300);
  expect((await text(page, '#subA')).includes('Ammonium'), 'subA=' + await text(page, '#subA'));
  expect((await text(page, '#phA')).includes('9,25'), 'A=' + await text(page, '#phA'));
  await page.select('#acid', '4.76'); await sleep(300);
});
await test('mole-fraction slider recomposes A (x=0,25 → pH 4,28)', async () => {
  await page.$eval('#xfrac', el => { el.value = 0.25; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(300);
  expect((await text(page, '#xVal')).includes('0,25'), 'xVal=' + await text(page, '#xVal'));
  expect((await text(page, '#phA')).includes('4,28'), 'A=' + await text(page, '#phA'));
  await page.$eval('#xfrac', el => { el.value = 0.5; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(300);
});

await test('at 1920×1080 the all-solutions dosing row is above the caption bar without scrolling', async () => {
  const r = await page.evaluate(() => { const a = document.querySelector('.all').getBoundingClientRect(), t = document.getElementById('tour').getBoundingClientRect(); return { aBottom: a.bottom, tTop: t.top }; });
  expect(r.aBottom <= r.tTop, `dosing row bottom ${r.aBottom.toFixed(0)} is below bar top ${r.tTop.toFixed(0)}`);
});

// ---- new behaviour: liquid tint follows pH
const c0 = await liquidColour(page, 'C'), a0 = await liquidColour(page, 'A');
await test('liquid of C (pH 2,3) is tinted red, not blue', async () => { expect(c0[0] > c0[2] + 25, 'rgb=' + c0); });
await test('liquid of A (pH 4,76) is tinted toward orange-yellow', async () => { expect(a0[0] > a0[2] + 25 && a0[1] > a0[2] + 10, 'rgb=' + a0); });
await test('after +8 OH⁻ C turns blue-violet while A barely changes', async () => {
  await click(page, '[data-all="OH"][data-n="8"]');
  await waitFor(page, () => /Zugabe\s*8 Kugeln/.test(document.getElementById('rC').textContent) && /Zugabe\s*8 Kugeln/.test(document.getElementById('rA').textContent), { msg: 'all dosed' });
  await sleep(900);
  const c1 = await liquidColour(page, 'C'), a1 = await liquidColour(page, 'A');
  expect(c1[2] > c1[0] + 25, 'C rgb=' + c1);
  expect(dist(a0, a1) < 25, 'A moved ' + dist(a0, a1).toFixed(1) + ' (' + a0 + ' → ' + a1 + ')');
  expect(dist(c0, c1) > 60, 'C moved only ' + dist(c0, c1).toFixed(1));
  await click(page, '#resetAll'); await sleep(300);
});

// ---- new behaviour: stacked ratio bar
await test('HA and A⁻ fills of A share one stacked track', async () => {
  const r = await page.evaluate(() => {
    const ha = document.getElementById('fAHA'), a = document.getElementById('fAA');
    const w = el => el.getBoundingClientRect().width;
    return { same: ha.parentElement === a.parentElement, sum: w(ha) + w(a), track: w(ha.parentElement) };
  });
  expect(r.same, 'fills have different parents');
  expect(Math.abs(r.sum - r.track) < 3, `sum ${r.sum.toFixed(1)} ≠ track ${r.track.toFixed(1)}`);
});

// ---- new behaviour: typography
await test('body is set in Fira Sans', async () => {
  const ff = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(/^"?Fira Sans/.test(ff), 'font-family=' + ff);
  const loaded = await page.evaluate(() => document.fonts.check('16px "Fira Sans"'));
  if (!loaded) console.log('       (warning: Fira Sans not loaded from network)');
});

// ---- tour: runs all 16 steps; caption stays on screen when scrolled
await test('tour runs through all 16 steps and ends', async () => {
  await click(page, '#tourStart');
  for (let i = 1; i <= 16; i++) {
    await waitFor(page, i => document.getElementById('stepLbl').textContent.includes(`Schritt ${i} von 16`), { msg: 'step ' + i, timeout: 5000 }).catch(() => {});
    const lbl = await text(page, '#stepLbl'); expect(lbl.includes(`Schritt ${i} von 16`), 'label=' + lbl);
    await waitFor(page, () => !document.getElementById('tourNext').disabled, { msg: 'step ' + i + ' settled', timeout: 25000 });
    if (i === 4) expect(/4,79|4,80/.test(await text(page, '#phA')), 'A after 8 OH⁻: ' + await text(page, '#phA'));
    if (i === 9) expect(/3,0\d/.test(await text(page, '#phB')), 'B after 8 OH⁻: ' + await text(page, '#phB'));
    if (i === 13) expect(/12,1\d/.test(await text(page, '#phC')), 'C after 8 OH⁻: ' + await text(page, '#phC'));
    if (i === 8) {   // caption must be visible while the user scrolls to the chart
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
      const r = await page.$eval('#tour', el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight }; });
      await page.evaluate(() => window.scrollTo(0, 0));
      results.push([r.top >= 0 && r.bottom <= r.h + 1, 'tour caption stays in view after scrolling to the chart']);
      console.log((r.top >= 0 && r.bottom <= r.h + 1 ? '  ok   ' : '  FAIL ') + 'tour caption stays in view after scrolling to the chart' + (r.top >= 0 && r.bottom <= r.h + 1 ? '' : `\n       rect top ${r.top.toFixed(0)} bottom ${r.bottom.toFixed(0)} viewport ${r.h}`));
    }
    await click(page, '#tourNext'); await sleep(200);
  }
  await waitFor(page, () => !document.getElementById('tourStart').hidden, { msg: 'tour ended', timeout: 3000 });
});
await test('still no console or page errors after the tour', async () => { expect(errors.length === 0, 'errors: ' + errors.join(' | ')); });
if (SHOTS) await page.screenshot({ path: path.join(outDir, 'desktop-light.png'), fullPage: true });
await page.close();

// ---- phone width and dark mode
await test('no horizontal overflow at 390px', async () => {
  const p = await open(390, 844);
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  if (SHOTS) await p.screenshot({ path: path.join(outDir, 'phone-light.png'), fullPage: true });
  await p.close();
  expect(w[0] <= w[1], `scrollWidth ${w[0]} > ${w[1]}`);
});
await test('dark mode gives a dark page background', async () => {
  const p = await open(1920, 1080, true);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const m = bg.match(/\d+/g).map(Number);
  if (SHOTS) { await p.screenshot({ path: path.join(outDir, 'desktop-dark.png'), fullPage: true }); }
  await p.close();
  expect(m[0] + m[1] + m[2] < 200, 'bg=' + bg);
});

// ---- existing crash: a sphere that reacts in the same frame another one lands must not be re-targeted
await test('dense dosing on all beakers does not crash the simulation', async () => {
  const before = errors.length; const p = await open(1280, 720);
  for (let r = 0; r < 3; r++) {
    await click(p, '[data-all="H"][data-n="8"]'); await sleep(5500);          // free H₃O⁺ sit in B and C
    for (let i = 0; i < 40; i++) { await click(p, '[data-k="B"][data-sp="OH"][data-n="1"]'); await click(p, '[data-k="C"][data-sp="OH"][data-n="1"]'); }
    await sleep(2500);
    for (let i = 0; i < 30; i++) { await click(p, '[data-all="H"][data-n="1"]'); }
    await sleep(2500);
  }
  await sleep(4000);
  const alive = await p.evaluate(() => new Promise(res => { requestAnimationFrame(() => requestAnimationFrame(() => res(true))); setTimeout(() => res(false), 1500); }));
  await p.close();
  expect(errors.length === before, 'errors: ' + errors.slice(before).join(' | '));
  expect(alive, 'animation frames stopped');
});
if (SHOTS) {
  const p = await open(1280, 720); await p.screenshot({ path: path.join(outDir, 'projector-1280.png') }); await p.close();
  const q = await open(1920, 1080); await q.screenshot({ path: path.join(outDir, 'projector-1920.png') }); await q.close();
}
await browser.close();

const fails = results.filter(r => !r[0]).length;
console.log(`\n${results.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
