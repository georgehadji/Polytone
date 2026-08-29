// Independently re-measure every load-bearing claim in the plan.
import { readFileSync } from 'node:fs';
import { polytonize } from './engine.mjs';

const nfc = (s) => s.normalize('NFC');
const nfd = (s) => s.normalize('NFD');
const cp = (s) => [...s].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
const R = [];
const check = (id, claim, got, want) => {
  const ok = got === want;
  R.push({ ok, id, claim, got, want });
};

// --- 1. NFC already produces the 9 Koronis defect targets ---
const defects = [
  ['Η+psili+ypo', 'Η\u0313\u0345', '\u1F98'],
  ['Η+dasia+ypo', 'Η\u0314\u0345', '\u1F99'],
  ['Ω+psili+ypo', 'Ω\u0313\u0345', '\u1FA8'],
  ['Ω+dasia+ypo', 'Ω\u0314\u0345', '\u1FA9'],
  ['ρ+psili', 'ρ\u0313', '\u1FE4'],
  ['υ+psili', 'υ\u0313', '\u1F50'],
  ['υ+psili+oxeia', 'υ\u0313\u0301', '\u1F54'],
  ['υ+psili+varia', 'υ\u0313\u0300', '\u1F52'],
  ['υ+psili+perisp', 'υ\u0313\u0342', '\u1F56'],
];
for (const [name, seq, want] of defects) check('NFC:' + name, 'NFC fixes it', nfc(seq), want);
check('NFC:legacy-oxia', 'U+1F71 normalizes to U+03AC', nfc('\u1F71'), '\u03AC');

// --- 2. Engine behaviour claims (F1, Ymplax, F5, and the u-rule goldens) ---
const lexicon = JSON.parse(readFileSync('./lexicon.json', 'utf8'));
const conv = (s) => polytonize(s, lexicon).text;

check('F1', "polytonize('Ηνέθη') inserts a capital iota", conv('Ηνέθη'), 'ἨΙνέθη');
check('Ymplax', "polytonize('Υμπλαξ') starts with bare combining psili",
  cp(conv('Υμπλαξ')).startsWith('U+03A5 U+0313'), true);

// The exact sweep as implemented in test.mjs S3 (narrow base+mark restriction, both
// Unicode ranges). An earlier, looser scan in this same script wrongly reported 207 and
// caused a bad "correction" in KORONIS-PLAN.md; this is the corrected, load-bearing check.
{
  const SWEEP_BASES = 'αεηιουωρΑΕΗΙΟΥΩΡ';
  const SWEEP_MARKS = new Set(['̓', '̔', '̈', '́', '̀', '͂', 'ͅ']);
  const bareCount = (s) => [...s.normalize('NFD')].filter((c) => !/\p{M}/u.test(c)).length;
  const mrk = (s) => [...s.normalize('NFD')].filter((c) => /\p{M}/u.test(c)).sort().join('');
  let sw = 0, bd = 0;
  for (const [lo, hi] of [[0x0370, 0x03FF], [0x1F00, 0x1FFF]]) {
    for (let c2 = lo; c2 <= hi; c2++) {
      const ch = String.fromCodePoint(c2);
      if (ch.normalize('NFC') !== ch) continue;
      const d = [...ch.normalize('NFD')];
      if (d.length < 2 || !SWEEP_BASES.includes(d[0]) || !d.slice(1).every((m) => SWEEP_MARKS.has(m))) continue;
      sw++;
      const val = ch + 'βαβα';
      const out = conv2('Αβαβα', { αβαβα: val });
      if (bareCount(out) !== 5 || mrk(out) !== mrk(val)) bd++;
    }
  }
  check('exact-sweep-pool', 'test.mjs S3 sweep pool (both ranges, narrow criteria)', sw, 209);
  check('exact-sweep-bad', 'test.mjs S3 sweep violations pre-E3', bd, 63);
}
function conv2(s, lex) { return polytonize(s, lex).text; }
check('Ymplax-unassigned', 'U+1F58 is unassigned (no precomposed Y+psili)', nfc('Υ\u0313'), 'Υ\u0313');

const f5 = polytonize('ο δάσκαλος μου', lexicon);
check('F5-text', 'enclisis rewrites text', f5.text, 'ὁ δάσκαλός μου');
check('F5-token', 'but tokens[1].out is stale', f5.tokens[1].out, 'δάσκαλος');

// diphthong safety: the rule Koronis broke
for (const [inp, note] of [['αυτομπλα', 'αυ-'], ['ευμπλα', 'ευ-'], ['ουμπλα', 'ου-']]) {
  const out = conv(inp);
  check('diphthong:' + note, 'keeps psili today (must stay after the u-rule)',
    nfd(out).includes('\u0313'), true);
}

// --- 3. Reverse sweep: does toUpperCase expand precomposed Greek? ---
const letters = (s) => [...nfd(s)].filter((c) => !/\p{M}/u.test(c)).length;
let pool = 0, viol = 0;
const examples = [];
for (const range of [[0x1F00, 0x1FFF]]) {  // Greek Extended; the basic block adds 22 chars, 0 violations
  for (let c = range[0]; c <= range[1]; c++) {
    const ch = String.fromCodePoint(c);
    if (nfc(ch) !== ch) continue;              // only precomposed NFC singletons
    const d = nfd(ch);
    if (d.length < 2) continue;                // must be base + mark(s)
    if (!/\p{Script=Greek}/u.test(d[0])) continue;
    pool++;
    if (letters(ch.toUpperCase()) > letters(ch)) {
      viol++;
      if (examples.length < 4) examples.push(`${ch} ${cp(ch)} -> ${ch.toUpperCase()} ${cp(ch.toUpperCase())}`);
    }
  }
}
check('sweep-pool', 'precomposed base+mark chars in Greek Extended', pool, 207);
check('sweep-viol', 'toUpperCase expands letter count', viol, 63);

// --- 4. Legacy oxia codepoints present in the shipped lexicon? ---
const LEGACY = /[\u1F71\u1FBB\u1F73\u1FC9\u1F75\u1FCB\u1F77\u1FD3\u1FDB\u1F79\u1FF9\u1F7B\u1FE3\u1FEB\u1F7D\u1FFB]/;
const raw = readFileSync('./lexicon.json', 'utf8');
check('legacy-in-lexicon', 'zero legacy-oxia codepoints in lexicon.json', LEGACY.test(raw), false);

// --- report ---
let bad = 0;
for (const r of R) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} ${r.claim}`);
  if (!r.ok) console.log(`        got=${JSON.stringify(r.got)}  want=${JSON.stringify(r.want)}`);
}
if (examples.length) console.log('\nsweep examples:\n  ' + examples.join('\n  '));
console.log(`\n${R.length - bad}/${R.length} claims confirmed`);
