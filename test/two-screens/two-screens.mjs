// Drives the real app in two browser windows and plays between them.
// Proves the pairing, the sync and the hazard engine; says nothing about Supabase.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';  // or just 'playwright'

const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8099);
const SHOT = process.env.SHOT_DIR ? process.env.SHOT_DIR + '/shots' : '/tmp/two-screens-shots';

const results = [];
let failed = false;
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   — ' + detail : ''));
  if (!ok) failed = true;
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox']
});
const ctxA = await browser.newContext(phone);
const ctxB = await browser.newContext(phone);
const A = await ctxA.newPage();   // phone one — Paul, white
const B = await ctxB.newPage();   // phone two — Anca, black

const errs = { A: [], B: [] };
A.on('pageerror', e => errs.A.push(String(e)));
B.on('pageerror', e => errs.B.push(String(e)));
A.on('console', m => { if (m.type() === 'error') errs.A.push('console: ' + m.text()); });
B.on('console', m => { if (m.type() === 'error') errs.B.push('console: ' + m.text()); });

const sq = (page, label) => page.locator(`button.sq[aria-label="${label}"]`);
const band = page => page.locator('.band h2').innerText();
const says = page => page.locator('.band .say').innerText();

async function waitTurn(page, name, ms = 8000) {
  await page.waitForFunction(
    n => { const h = document.querySelector('.band h2'); return !!h && h.textContent.trim() === n + ' mută'; },
    name, { timeout: ms });
}
async function clearReveal(page) {
  const r = page.locator('.reveal');
  if (await r.count()) { await r.click(); await page.waitForTimeout(120); }
}
// the hidden tester's panel: fire one hazard on the last square played
async function force(page, name) {
  await clearReveal(page);
  await page.locator('.dock button', { hasText: 'Meniu' }).click();
  const opener = page.locator('.menurow', { hasText: 'Forțează un eveniment' });
  if (await opener.count()) await opener.click();
  await page.locator('.sheet .deckcard', { hasText: name }).first().click();
  await page.waitForTimeout(500);
}
const waterCount = page => page.locator('.sq .water').count();
const mireCount = page => page.locator('.sq .mire').count();

console.log('\n── împerechere ──');

await A.goto(BASE, { waitUntil: 'load' });
await B.goto(BASE, { waitUntil: 'load' });

await A.locator('button.row', { hasText: 'pornește' }).click();
await A.locator('#f-host-name').fill('Paul');
await A.waitForFunction(() => {
  const b = [...document.querySelectorAll('button.btn')].find(x => /Creează meciul/.test(x.textContent));
  return b && !b.disabled;
}, null, { timeout: 10000 });
await A.locator('button.btn', { hasText: 'Creează meciul' }).click();

await A.locator('.codecard .v').waitFor({ timeout: 10000 });
const code = (await A.locator('.codecard .v').innerText()).trim();
check('gazda primește un cod de patru litere', /^[A-Z0-9]{4}$/.test(code), code);

await B.locator('button.row', { hasText: 'intră cu un cod' }).click();
await B.locator('#f-code').fill(code);
await B.locator('#f-guest-name').fill('Anca');
const joinLive = await B.evaluate(() => {
  const b = [...document.querySelectorAll('button.btn')].find(x => /^Intră/.test(x.textContent));
  return b ? !b.disabled : null;
});
check('butonul Intră se trezește când codul e scris', joinLive === true);

await B.locator('#f-code').press('Enter');
await B.locator('button.sq').first().waitFor({ timeout: 10000 });
check('al doilea telefon intră și ajunge pe tablă', true);
check('niciun mesaj de eroare la intrare', (await B.locator('.callout').count()) === 0);

await A.locator('button.sq').first().waitFor({ timeout: 10000 });
check('gazda pleacă singură de pe ecranul de așteptare', true);

// the two things that had to go
check('nu se pictează teren înainte de meci', (await B.locator('.terrbar').count()) === 0);
check('nu există panoul „Ce s-a întâmplat?”', (await B.locator('.pane.ask').count()) === 0);

await A.waitForTimeout(600);
check('ambele telefoane arată Legat',
  (await A.locator('.pill .dot.on').count()) === 1 && (await B.locator('.pill .dot.on').count()) === 1);

const topA = await A.evaluate(() => document.querySelector('.ranks div').textContent);
const topB = await B.evaluate(() => document.querySelector('.ranks div').textContent);
check('fiecare vede tabla din partea lui', topA !== topB, 'A: ' + topA + ', B: ' + topB);

console.log('\n── rândul și refuzurile ──');

await sq(B, 'alb pion pe e2').click();
await B.waitForTimeout(150);
check('negrul nu poate ridica o piesă albă', (await B.locator('button.sq.sel').count()) === 0,
  '„' + (await says(B)).trim() + '”');

await sq(A, 'alb pion pe e2').click();
await A.waitForTimeout(120);
check('albul își poate ridica pionul', (await A.locator('button.sq.sel').count()) === 1);
check('căsuțele posibile sunt punctate', (await A.locator('.dotmark').count()) === 2);

await sq(A, 'a4').click();
await A.waitForTimeout(120);
check('o mutare imposibilă e explicată', /nu poate ajunge/.test(await says(A)), '„' + (await says(A)).trim() + '”');

console.log('\n── o mutare ajunge singură pe celălalt telefon ──');

await sq(A, 'e4').click();
await B.waitForFunction(() => !!document.querySelector('button.sq[aria-label^="alb pion pe e4"]'), null, { timeout: 8000 })
  .then(() => check('pionul apare pe celălalt telefon', true))
  .catch(async () => check('pionul apare pe celălalt telefon', false, 'B arată: ' + (await band(B))));

let handed = true;
await waitTurn(B, 'Anca').catch(() => { handed = false; });
check('rândul trece singur, fără să fie întrebat nimeni', handed, 'B: „' + (await band(B)) + '”');
check('mutarea e în jurnalul celuilalt', /e4/.test(await B.locator('.pane').first().innerText()));

await sq(B, 'negru pion pe e7').click();
await sq(B, 'e5').click();
await A.waitForFunction(() => !!document.querySelector('button.sq[aria-label^="negru pion pe e5"]'), null, { timeout: 8000 })
  .then(() => check('răspunsul negrului ajunge înapoi', true))
  .catch(() => check('răspunsul negrului ajunge înapoi', false));
await waitTurn(A, 'Paul').catch(() => {});

console.log('\n── deschiderea e ferită ──');
const anyHazard = await A.evaluate(() => document.querySelectorAll('.chipcard').length);
check('nimic nu se declanșează în primele mutări', anyHazard === 0);

console.log('\n── Râu ──');
await force(A, 'Râu');
const wA = await waterCount(A), wB = await waterCount(B);
check('apa intră pe tablă', wA >= 3, wA + ' căsuțe');
check('aceeași apă pe ambele telefoane', wA === wB, 'A=' + wA + ' B=' + wB);
check('râul are un cronometru pe căsuțe', (await A.locator('.sq .ttimer').count()) >= 3);
check('râul e pe raftul din joc', (await B.locator('.chipcard').count()) === 1,
  (await B.locator('.chipcard').innerText().catch(() => '')).replace('\n', ' '));

const offeredWater = [];
for (const label of await B.locator('button.sq[aria-label^="negru "]').evaluateAll(n => n.map(x => x.getAttribute('aria-label')))) {
  await sq(B, label).click();
  const bad = await B.evaluate(() => [...document.querySelectorAll('.sq')]
    .filter(s => s.querySelector('.dotmark') && s.querySelector('.water')).length);
  if (bad) offeredWater.push(label);
  await sq(B, label).click();
}
check('nicio piesă nu primește o căsuță sub apă', offeredWater.length === 0, '16 piese verificate');

console.log('\n── Ger ──');
await force(B, 'Ger');
await A.waitForTimeout(400);
check('gerul e în joc pe ambele telefoane',
  (await A.locator('.chipcard').count()) === 2 && (await B.locator('.chipcard').count()) === 2);
check('caii sunt înghețați vizibil', (await A.locator('.sq .pc.frozen').count()) === 4,
  (await A.locator('.sq .pc.frozen').count()) + ' cai');

await clearReveal(A);
await sq(A, 'alb cal pe b1').click();
await A.waitForTimeout(150);
const knightDots = await A.evaluate(() => [...document.querySelectorAll('.sq')]
  .filter(s => s.querySelector('.dotmark')).map(s => s.getAttribute('aria-label')));
check('calul nu mai sare — merge ca un pion',
  !knightDots.some(l => /\ba3\b|\bc3\b/.test(l)), knightDots.length ? knightDots.join(', ') : 'nicio căsuță');
await sq(A, 'alb cal pe b1').click();

console.log('\n── Cădere în tranșeu, apoi Înviere ──');
const beforeKill = await A.locator('.sq .pc').count();
await force(A, 'Cădere în tranșeu');
await A.waitForTimeout(400);
const afterKill = await A.locator('.sq .pc').count();
const afterKillB = await B.locator('.sq .pc').count();
check('tranșeul ia o piesă de pe tablă', afterKill === beforeKill - 1, beforeKill + ' → ' + afterKill);
check('piesa dispare și de pe celălalt telefon', afterKill === afterKillB);

await force(B, 'Înviere');
await B.waitForTimeout(400);
const revSheet = await B.locator('.sheet').innerText().catch(() => '');
check('învierea cere o alegere celui care a călcat', /Înviere/.test(revSheet), revSheet.split('\n')[0]);
await B.locator('.sheet .deckcard').first().click();
await B.waitForTimeout(250);
await sq(B, 'e6').click();
await B.waitForTimeout(500);
const afterRev = await B.locator('.sq .pc').count();
check('piesa se întoarce pe căsuța aleasă', afterRev === afterKill + 1, afterKill + ' → ' + afterRev);
check('se întoarce și pe celălalt telefon', (await A.locator('.sq .pc').count()) === afterRev);

console.log('\n── Mlaștină ──');
await clearReveal(A); await clearReveal(B);
await force(A, 'Mlaștină');
await A.waitForTimeout(400);
check('mlaștina se vede pe ambele telefoane', (await mireCount(A)) === 1 && (await mireCount(B)) === 1);

console.log('\n── resetare ──');
await clearReveal(B);
await B.locator('.dock button', { hasText: 'Meniu' }).click();
await B.waitForTimeout(150);
await B.locator('.sheet button', { hasText: 'Resetează tot ce e în joc' }).click();
await B.waitForTimeout(150);
await B.locator('.sheet button', { hasText: 'Da, șterge tot' }).click();
await B.waitForTimeout(700);
check('resetarea curăță ambele telefoane',
  (await A.locator('.chipcard').count()) === 0 && (await B.locator('.chipcard').count()) === 0);
check('apa și mlaștina se duc odată cu el',
  (await A.locator('.sq .water').count()) === 0 && (await A.locator('.sq .mire').count()) === 0);

console.log('\n── căsuțe consumate ──');
const safe = await A.locator('.sq .safemark').count();
check('căsuțele care au declanșat sunt marcate ca sigure', safe > 0, safe + ' căsuțe');

console.log('\n── totul în română ──');
const textA = await A.locator('.app').innerText();
const english = ['What happened', 'to move', 'Undo', 'Cards', 'More', 'Terrain'].filter(w => textA.includes(w));
check('nimic în engleză pe ecran', english.length === 0, english.join(', '));

console.log('\n── erori ──');
check('nicio eroare pe telefonul unu', errs.A.length === 0, errs.A.slice(0, 2).join(' | '));
check('nicio eroare pe telefonul doi', errs.B.length === 0, errs.B.slice(0, 2).join(' | '));

await A.screenshot({ path: SHOT + '-A.png' });
await B.screenshot({ path: SHOT + '-B.png' });
await browser.close();

console.log('\n' + results.filter(r => r.ok).length + ' din ' + results.length + ' verificări au trecut');
process.exit(failed ? 1 : 0);
