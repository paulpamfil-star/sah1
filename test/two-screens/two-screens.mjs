// Drives the real app in two browser windows against the local harness.
// Proves the pairing and sync code; says nothing about Supabase itself.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';  // or just 'playwright'

const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8099);
const SHOT = process.env.SHOT_DIR ? process.env.SHOT_DIR + '/shots' : '/tmp/two-screens-shots';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   — ' + detail : ''));
  if (!ok) failed = true;
}
let failed = false;

const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox']
});

const ctxA = await browser.newContext({ viewport: phone, ...phone });
const ctxB = await browser.newContext({ viewport: phone, ...phone });
const A = await ctxA.newPage();   // phone one
const B = await ctxB.newPage();   // phone two

const errs = { A: [], B: [] };
A.on('pageerror', e => errs.A.push(String(e)));
B.on('pageerror', e => errs.B.push(String(e)));
A.on('console', m => { if (m.type() === 'error') errs.A.push('console: ' + m.text()); });
B.on('console', m => { if (m.type() === 'error') errs.B.push('console: ' + m.text()); });

const sq = (page, label) => page.locator(`button.sq[aria-label="${label}"]`);
const pieceAt = (page, name) => page.locator(`button.sq[aria-label*="${name}"]`).count();

async function waitTurn(page, name, ms = 8000) {
  await page.waitForFunction(
    n => {
      const h = document.querySelector('.band h2');
      return !!h && h.textContent.trim() === n + ' to move';
    },
    name, { timeout: ms }
  );
}

console.log('\n── pairing ──');

await A.goto(BASE, { waitUntil: 'load' });
await B.goto(BASE, { waitUntil: 'load' });

// Net.ready comes from the (fake) client script loading.
await A.locator('button.row', { hasText: 'start a match' }).click();
await A.locator('#f-host-name').fill('Paul');
const createBtn = A.locator('button.btn', { hasText: 'Create the match' });
await createBtn.waitFor({ state: 'visible' });
await A.waitForFunction(() => {
  const b = [...document.querySelectorAll('button.btn')].find(x => /Create the match/.test(x.textContent));
  return b && !b.disabled;
}, null, { timeout: 10000 });
await createBtn.click();

await A.locator('.codecard .v').waitFor({ timeout: 10000 });
const code = (await A.locator('.codecard .v').innerText()).trim();
check('host gets a four-letter code', /^[A-Z0-9]{4}$/.test(code), code);

await B.locator('button.row', { hasText: 'join with a code' }).click();
await B.locator('#f-code').fill(code);
await B.locator('#f-guest-name').fill('Anca');

// the bug the user hit: the code typed in, and Enter does nothing
const joinEnabled = await B.evaluate(() => {
  const b = [...document.querySelectorAll('button.btn')].find(x => /^Join/.test(x.textContent));
  return b ? !b.disabled : null;
});
check('Join button is live once the code is typed', joinEnabled === true, 'disabled=' + (joinEnabled === null ? 'no button' : !joinEnabled));

await B.locator('#f-code').press('Enter');          // the user's own gesture
await B.locator('button.sq').first().waitFor({ timeout: 10000 });
check('second phone joins and lands on the board', true);

const bErr = await B.locator('.callout').count();
check('no error banner on the joining phone', bErr === 0,
  bErr ? await B.locator('.callout').first().innerText() : '');

// the host should leave the waiting screen by itself
await A.locator('button.sq').first().waitFor({ timeout: 10000 });
check('host leaves the waiting screen when they join', true);

await A.waitForTimeout(600);
const linkedA = await A.locator('.pill .dot.on').count();
const linkedB = await B.locator('.pill .dot.on').count();
check('both phones show Linked', linkedA === 1 && linkedB === 1, 'A=' + linkedA + ' B=' + linkedB);

console.log('\n── sides and turn order ──');

const flipA = await A.evaluate(() => document.querySelector('.ranks div').textContent);
const flipB = await B.evaluate(() => document.querySelector('.ranks div').textContent);
check('each phone shows the board from its own side', flipA !== flipB, 'A top rank ' + flipA + ', B top rank ' + flipB);

// black's phone must not be able to move white
await sq(B, 'white pawn on e2').click();
await B.waitForTimeout(150);
const bSay = await B.locator('.band .say').innerText();
const bSel = await B.locator('button.sq.sel').count();
check('black cannot pick up a white piece', bSel === 0, 'console says: "' + bSay.trim() + '"');

console.log('\n── a move on one phone reaches the other ──');

await sq(A, 'white pawn on e2').click();
await A.waitForTimeout(100);
check('white can pick up its own pawn', (await A.locator('button.sq.sel').count()) === 1);
const dots = await A.locator('.dotmark').count();
check('legal squares are dotted', dots > 0, dots + ' squares offered');

await sq(A, 'e4').click();

// the move itself syncs before the turn is handed over
await B.waitForFunction(() => !!document.querySelector('button.sq[aria-label^="white pawn on e4"]'), null, { timeout: 8000 })
  .then(() => check('the pawn arrives on the other phone', true))
  .catch(async () => check('the pawn arrives on the other phone', false,
    'B still shows: ' + (await B.locator('.band h2').innerText())));

const waitingB = await B.locator('.pane.ask, .pane').first().innerText();
check('the waiting phone is told whose turn it still is', /saying what happened/.test(waitingB), waitingB.trim());

await A.locator('button.btn', { hasText: 'end the turn' }).click();
let handed = true;
await waitTurn(B, 'Anca').catch(() => { handed = false; });
check('ending the turn hands it over on the other phone', handed);

const logB = await B.locator('.pane .row, .pane').first().innerText().catch(() => '');
check('the move is in the other phone\'s log', /e4/.test(logB), logB.split('\n').slice(0, 2).join(' / '));

await waitTurn(A, 'Anca').catch(() => {});
const turnB = await B.locator('.band h2').innerText();
const turnA = await A.locator('.band h2').innerText();
check('the turn passes to the other player on both phones',
  /Anca/.test(turnB) && /Anca/.test(turnA), 'A: "' + turnA + '"  B: "' + turnB + '"');

// tapping a piece you may not move should say so, not sit silent
await sq(B, 'black pawn on e7').click();
await B.waitForTimeout(80);
await sq(B, 'a4').click();
await B.waitForTimeout(80);
const refusal = await B.locator('.band .say').innerText();
check('an impossible move is explained, not ignored', /cannot reach/.test(refusal), '"' + refusal.trim() + '"');
await sq(B, 'black pawn on e7').click();   // tapping it again puts it down
check('tapping the selected piece again puts it down', (await B.locator('button.sq.sel').count()) === 0);

console.log('\n── and back the other way ──');

await sq(B, 'black pawn on e7').click();
await sq(B, 'e5').click();
await A.waitForFunction(() => !!document.querySelector('button.sq[aria-label^="black pawn on e5"]'), null, { timeout: 8000 })
  .then(() => check('black\'s reply arrives on the first phone', true))
  .catch(() => check('black\'s reply arrives on the first phone', false));
await B.locator('button.btn', { hasText: 'end the turn' }).click();
await waitTurn(A, 'Paul').catch(() => {});
check('the turn comes back round to white', /Paul/.test(await A.locator('.band h2').innerText()));

console.log('\n── a card played on one phone ──');

await A.locator('.dock button', { hasText: 'Cards' }).click();
const river = A.getByRole('button', { name: /^Râu The River/ });
check('the deck offers the river card', (await river.count()) === 1, (await A.locator('.deckcard').count()) + ' cards in the deck');
await river.click();
await A.waitForTimeout(800);

const wallsA = await A.locator('.sq .water').count();
const wallsB = await B.locator('.sq .water').count();
check('the river draws itself on the board', wallsA >= 3, wallsA + ' squares');
check('the same river appears on the other phone', wallsA === wallsB, 'A=' + wallsA + ' B=' + wallsB);

const revealB = await B.locator('.reveal').count();
check('the other player is told a card was played', revealB === 1);
if (revealB) await B.locator('.reveal').click();

const chipB = await B.locator('.chipcard').count();
check('the card is on both shelves', chipB === 1);

console.log('\n── the river actually blocks pieces ──');
const wallSquares = await B.evaluate(() =>
  [...document.querySelectorAll('.sq')].filter(s => s.querySelector('.water'))
    .map(s => s.getAttribute('aria-label')));
check('the barrier is carried in the shared state', wallSquares.length > 0, wallSquares.join(', '));

// black is to move: pick up each of its pieces in turn and make sure no square
// the app offers is one the river covers
const blackPieces = await B.locator('button.sq[aria-label^="black "]').evaluateAll(
  ns => ns.map(n => n.getAttribute('aria-label')));
let offeredWater = [];
for (const label of blackPieces) {
  await sq(B, label).click();
  const bad = await B.evaluate(() =>
    [...document.querySelectorAll('.sq')]
      .filter(s => s.querySelector('.dotmark') && s.querySelector('.water'))
      .map(s => s.getAttribute('aria-label')));
  if (bad.length) offeredWater.push(label + ' → ' + bad.join(','));
  await sq(B, label).click();   // put it back down
}
check('no piece is offered a square the river covers', offeredWater.length === 0,
  blackPieces.length + ' pieces tried' + (offeredWater.length ? '; ' + offeredWater.join(' | ') : ''));

console.log('\n── reset powerups ──');
await B.locator('.dock button', { hasText: 'More' }).click();
await B.waitForTimeout(150);
const resetVisible = await B.locator('.sheet').innerText();
check('the hidden reset is reachable from More', /[Rr]eset/.test(resetVisible),
  resetVisible.split('\n').filter(Boolean).slice(-3).join(' / '));

await B.locator('.sheet button', { hasText: 'Reset the power-ups' }).click();
await B.waitForTimeout(150);
await B.locator('.sheet button', { hasText: 'Yes, clear them' }).click();
await B.waitForTimeout(800);

const afterB = await B.locator('.chipcard').count();
const afterA = await A.locator('.chipcard').count();
check('reset clears the cards on both phones', afterA === 0 && afterB === 0, 'A=' + afterA + ' B=' + afterB);

console.log('\n── page errors ──');
check('no uncaught errors on phone one', errs.A.length === 0, errs.A.slice(0, 3).join(' | '));
check('no uncaught errors on phone two', errs.B.length === 0, errs.B.slice(0, 3).join(' | '));

await A.screenshot({ path: SHOT + '-A.png' });
await B.screenshot({ path: SHOT + '-B.png' });

await browser.close();

const pass = results.filter(r => r.ok).length;
console.log('\n' + pass + ' of ' + results.length + ' checks passed');
process.exit(failed ? 1 : 0);
